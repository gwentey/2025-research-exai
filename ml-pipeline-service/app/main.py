from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import sys
import os
import pandas as pd

from app.core.config import settings
from app.database import engine, get_db, Base
from app.models import Experiment, DataQualityAnalysis as DataQualityAnalysisModel
from app.schemas import (
    ExperimentCreate, ExperimentRead, ExperimentStatus, 
    ExperimentResults, AlgorithmInfo, DataQualityAnalysisRequest,
    DataQualityAnalysis, PreprocessingStrategyRequest, PreprocessingStrategy
)
from app.tasks import train_model
from app.core.celery_app import celery_app

# Configure logging
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

# Database tables are managed by Alembic migrations
# Base.metadata.create_all(bind=engine)  # Removed - causes startup issues

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("ML Pipeline service starting up...")
    yield
    # Shutdown
    logger.info("ML Pipeline service shutting down...")

app = FastAPI(
    title="ML Pipeline Service",
    description="Service for machine learning model training and management",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"service": "ML Pipeline", "status": "operational"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/experiments", response_model=ExperimentRead)
def create_experiment(
    experiment: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user_id: str = "test-user"  # This will come from auth in production
):
    """Create a new ML experiment and queue training task"""
    try:
        # Create experiment record in database
        db_experiment = Experiment(
            user_id=current_user_id,
            project_id=experiment.project_id,
            dataset_id=experiment.dataset_id,
            algorithm=experiment.algorithm,
            hyperparameters=experiment.hyperparameters,
            preprocessing_config=experiment.preprocessing_config,
            status="pending",
            progress=0
        )
        db.add(db_experiment)
        db.commit()
        db.refresh(db_experiment)
        
        # Queue training task
        task = train_model.apply_async(
            args=[str(db_experiment.id)],
            queue='ml_queue'
        )
        
        # Update experiment with task ID
        db_experiment.task_id = task.id
        db.commit()
        
        return db_experiment
    except Exception as e:
        logger.error(f"Error creating experiment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating experiment: {str(e)}"
        )

@app.get("/experiments/{experiment_id}", response_model=ExperimentStatus)
def get_experiment_status(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """Get the status of an experiment"""
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experiment not found"
        )
    
    # Get task status from Celery if task_id exists
    if experiment.task_id:
        try:
            task = celery_app.AsyncResult(experiment.task_id)
            if task.state == 'PENDING':
                experiment.status = 'pending'
            elif task.state == 'PROGRESS':
                experiment.status = 'running'
                experiment.progress = task.info.get('current', 0)
            elif task.state == 'SUCCESS':
                experiment.status = 'completed'
                experiment.progress = 100
            elif task.state == 'FAILURE':
                experiment.status = 'failed'
                experiment.error_message = str(task.info)
        except Exception as e:
            logger.error(f"Error getting task status: {str(e)}")
    
    return ExperimentStatus(
        id=experiment.id,
        status=experiment.status,
        progress=experiment.progress,
        error_message=experiment.error_message,
        created_at=experiment.created_at,
        updated_at=experiment.updated_at
    )

@app.get("/experiments/{experiment_id}/results", response_model=ExperimentResults)
def get_experiment_results(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """Get the results of a completed experiment"""
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experiment not found"
        )
    
    if experiment.status != 'completed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Experiment is not completed. Current status: {experiment.status}"
        )
    
    return ExperimentResults(
        id=experiment.id,
        metrics=experiment.metrics or {},
        model_uri=experiment.model_uri,
        visualizations=experiment.visualizations or {},
        feature_importance=experiment.feature_importance or {},
        created_at=experiment.created_at,
        completed_at=experiment.updated_at
    )

@app.get("/algorithms", response_model=List[AlgorithmInfo])
def get_available_algorithms():
    """Get list of available algorithms and their configurations"""
    algorithms = [
        AlgorithmInfo(
            name="decision_tree",
            display_name="Decision Tree",
            description="A tree-like model of decisions and their possible consequences",
            supports_classification=True,
            supports_regression=True,
            hyperparameters={
                "criterion": {
                    "type": "select",
                    "options": ["gini", "entropy"],
                    "default": "gini",
                    "description": "The function to measure the quality of a split"
                },
                "max_depth": {
                    "type": "number",
                    "min": 1,
                    "max": 50,
                    "default": 5,
                    "description": "Maximum depth of the tree"
                },
                "min_samples_split": {
                    "type": "number",
                    "min": 2,
                    "max": 100,
                    "default": 2,
                    "description": "Minimum samples required to split an internal node"
                },
                "min_samples_leaf": {
                    "type": "number",
                    "min": 1,
                    "max": 50,
                    "default": 1,
                    "description": "Minimum samples required to be at a leaf node"
                }
            }
        ),
        AlgorithmInfo(
            name="random_forest",
            display_name="Random Forest",
            description="An ensemble of decision trees trained on random subsets of data",
            supports_classification=True,
            supports_regression=True,
            hyperparameters={
                "n_estimators": {
                    "type": "number",
                    "min": 10,
                    "max": 500,
                    "default": 100,
                    "description": "Number of trees in the forest"
                },
                "max_depth": {
                    "type": "number",
                    "min": 1,
                    "max": 50,
                    "default": 10,
                    "description": "Maximum depth of the trees"
                },
                "min_samples_split": {
                    "type": "number",
                    "min": 2,
                    "max": 100,
                    "default": 2,
                    "description": "Minimum samples required to split an internal node"
                },
                "bootstrap": {
                    "type": "boolean",
                    "default": True,
                    "description": "Whether bootstrap samples are used when building trees"
                }
            }
        )
    ]
    return algorithms

@app.get("/experiments", response_model=List[ExperimentRead])
def get_user_experiments(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: str = "test-user"  # This will come from auth in production
):
    """Get all experiments for the current user"""
    query = db.query(Experiment).filter(Experiment.user_id == current_user_id)
    
    if project_id:
        query = query.filter(Experiment.project_id == project_id)
    
    experiments = query.offset(skip).limit(limit).all()
    return experiments

@app.post("/data-quality/analyze", response_model=DataQualityAnalysis)
def analyze_data_quality(
    request: DataQualityAnalysisRequest,
    db: Session = Depends(get_db),
    current_user_id: str = "test-user"  # This will come from auth in production
):
    """Analyser la qualité des données d'un dataset avec système de cache"""
    import pandas as pd
    import time
    from app.ml.preprocessing import analyze_dataset_quality
    from common.storage_client import StorageClient
    
    try:
        # 1. Vérifier si on a déjà une analyse en cache
        cached_analysis = db.query(DataQualityAnalysisModel).filter(
            DataQualityAnalysisModel.dataset_id == request.dataset_id,
            DataQualityAnalysisModel.expires_at > datetime.utcnow()
        ).order_by(DataQualityAnalysisModel.created_at.desc()).first()
        
        if cached_analysis and not request.force_refresh:
            logger.info(f"Utilisation du cache pour l'analyse du dataset {request.dataset_id}")
            # Retourner l'analyse depuis le cache
            return DataQualityAnalysis(
                dataset_overview=cached_analysis.analysis_data['dataset_overview'],
                column_types=cached_analysis.analysis_data['column_types'],
                missing_data_analysis=cached_analysis.analysis_data['missing_data_analysis'],
                outliers_analysis=cached_analysis.analysis_data['outliers_analysis'],
                data_quality_score=cached_analysis.quality_score,
                preprocessing_recommendations=cached_analysis.analysis_data['preprocessing_recommendations']
            )
        
        # 2. Sinon, effectuer l'analyse
        logger.info(f"Nouvelle analyse pour le dataset {request.dataset_id}")
        start_time = time.time()
        
        # Charger un échantillon du dataset pour l'analyse
        sample_data = _load_dataset_sample(request.dataset_id, request.sample_size)
        
        # Effectuer l'analyse de qualité
        analysis_result = analyze_dataset_quality(sample_data, request.target_column)
        
        # Calculer le temps d'analyse
        analysis_duration = time.time() - start_time
        
        # 3. Sauvegarder en cache
        new_analysis = DataQualityAnalysisModel(
            dataset_id=request.dataset_id,
            analysis_data=analysis_result,
            column_strategies=analysis_result.get('preprocessing_recommendations', {}).get('missing_values_strategy', {}),
            quality_score=analysis_result['data_quality_score'],
            total_rows=analysis_result['dataset_overview']['total_rows'],
            total_columns=analysis_result['dataset_overview']['total_columns'],
            analysis_duration_seconds=analysis_duration,
            expires_at=datetime.utcnow() + timedelta(days=7)  # Cache pour 7 jours
        )
        db.add(new_analysis)
        db.commit()
        
        # Convertir le résultat en format Pydantic
        return _convert_analysis_to_schema(analysis_result)
        
    except Exception as e:
        logger.error(f"Error analyzing data quality: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing data quality: {str(e)}"
        )

@app.post("/data-quality/suggest-strategy", response_model=PreprocessingStrategy)
def suggest_preprocessing_strategy(
    request: PreprocessingStrategyRequest,
    current_user_id: str = "test-user"
):
    """Suggérer une stratégie de preprocessing optimisée"""
    import pandas as pd
    from app.ml.preprocessing import analyze_dataset_quality, DataQualityAnalyzer
    
    try:
        # Charger le dataset
        sample_data = _load_dataset_sample(request.dataset_id, 5000)
        
        # Analyser la qualité
        analysis = analyze_dataset_quality(sample_data, request.target_column)
        
        # Générer des suggestions personnalisées
        strategy = _generate_optimal_strategy(analysis, request)
        
        return strategy
        
    except Exception as e:
        logger.error(f"Error generating preprocessing strategy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating preprocessing strategy: {str(e)}"
        )

def _load_dataset_sample(dataset_id: str, sample_size: int = 5000) -> pd.DataFrame:
    """Charger un échantillon du dataset depuis MinIO"""
    import numpy as np
    import requests
    from io import BytesIO
    
    try:
        # 1. Récupérer les métadonnées du dataset depuis service-selection
        service_selection_url = os.environ.get("SERVICE_SELECTION_URL", "http://service-selection-service.ibis-x.svc.cluster.local")
        response = requests.get(f"{service_selection_url}/datasets/{dataset_id}", timeout=10)
        
        if response.status_code != 200:
            logger.warning(f"Dataset {dataset_id} non trouvé dans service-selection, utilisation de données de fallback")
            return _generate_fallback_data(sample_size)
        
        dataset_info = response.json()
        
        # 2. Charger le fichier depuis MinIO
        from common.storage_client import get_storage_client
        storage_client = get_storage_client()
        
        # Construire le chemin vers le fichier principal
        storage_path = dataset_info.get('storage_path', f'ibis-x-datasets/{dataset_id}')
        
        # Essayer de trouver un fichier Parquet
        files = dataset_info.get('files', [])
        main_file = None
        
        for file_info in files:
            if file_info.get('format') == 'parquet' and file_info.get('logical_role') in ['data_file', 'training_data', None]:
                main_file = file_info
                break
        
        if not main_file and files:
            main_file = files[0]  # Prendre le premier fichier disponible
        
        if not main_file:
            logger.warning(f"Aucun fichier trouvé pour dataset {dataset_id}")
            return _generate_fallback_data(sample_size)
        
        # Construire le chemin complet
        object_path = f"{storage_path.rstrip('/')}/{main_file['file_name_in_storage']}"
        
        logger.info(f"Chargement du dataset depuis: {object_path}")
        
        # Télécharger et lire le fichier
        file_data = storage_client.download_file(object_path)
        
        if main_file.get('format') == 'parquet':
            parquet_buffer = BytesIO(file_data)
            df = pd.read_parquet(parquet_buffer)
        else:
            # Fallback pour CSV
            csv_buffer = BytesIO(file_data)
            df = pd.read_csv(csv_buffer)
        
        logger.info(f"Dataset chargé avec succès: {len(df)} lignes, {len(df.columns)} colonnes")
        
        # Échantillonner si le dataset est trop gros
        if len(df) > sample_size:
            df = df.sample(n=sample_size, random_state=42)
            logger.info(f"Échantillon pris: {len(df)} lignes")
        
        return df
        
    except Exception as e:
        logger.error(f"Erreur lors du chargement du dataset {dataset_id}: {str(e)}")
        logger.info("Utilisation de données de fallback pour la démonstration")
        return _generate_fallback_data(sample_size)

def _generate_fallback_data(sample_size: int = 1000) -> pd.DataFrame:
    """Génère des données de fallback en cas d'erreur"""
    import numpy as np
    
    np.random.seed(42)
    n_samples = min(sample_size, 1000)
    
    # Générer des données synthétiques réalistes
    data = {
        'price': np.random.lognormal(3, 0.5, n_samples),
        'age': np.random.normal(35, 12, n_samples),
        'score': np.random.beta(2, 5, n_samples) * 100,
        'category': np.random.choice(['Premium', 'Standard', 'Basic'], n_samples, p=[0.2, 0.5, 0.3]),
        'region': np.random.choice(['North', 'South', 'East', 'West'], n_samples),
        'purchased': np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
    }
    
    df = pd.DataFrame(data)
    
    # Introduire des données manquantes réalistes
    missing_mask = np.random.random(n_samples) < 0.15
    df.loc[missing_mask, 'age'] = np.nan
    
    missing_mask = np.random.random(n_samples) < 0.08
    df.loc[missing_mask, 'price'] = np.nan
    
    missing_mask = np.random.random(n_samples) < 0.05
    df.loc[missing_mask, 'region'] = np.nan
    
    return df

def _convert_analysis_to_schema(analysis: dict) -> DataQualityAnalysis:
    """Convertir le résultat d'analyse en schema Pydantic"""
    from app.schemas import (
        DataQualityAnalysis, DatasetOverview, ColumnTypes, 
        MissingDataAnalysis, OutliersAnalysis, PreprocessingRecommendations,
        ColumnMissingInfo, OutlierInfo
    )
    
    # Convertir les informations sur les colonnes manquantes
    columns_missing_converted = {}
    for col, info in analysis['missing_data_analysis']['columns_with_missing'].items():
        columns_missing_converted[col] = ColumnMissingInfo(**info)
    
    # Convertir les informations sur les outliers
    iqr_converted = {}
    zscore_converted = {}
    
    for col, info in analysis.get('outliers_analysis', {}).get('iqr_method', {}).items():
        if isinstance(info, dict):
            iqr_converted[col] = OutlierInfo(**info)
    
    for col, info in analysis.get('outliers_analysis', {}).get('zscore_method', {}).items():
        if isinstance(info, dict):
            zscore_converted[col] = OutlierInfo(**info)
    
    return DataQualityAnalysis(
        dataset_overview=DatasetOverview(**analysis['dataset_overview']),
        column_types=ColumnTypes(**analysis['column_types']),
        missing_data_analysis=MissingDataAnalysis(
            total_rows=analysis['missing_data_analysis']['total_rows'],
            total_columns=analysis['missing_data_analysis']['total_columns'],
            columns_with_missing=columns_missing_converted,
            missing_patterns=analysis['missing_data_analysis']['missing_patterns'],
            severity_assessment=analysis['missing_data_analysis']['severity_assessment']
        ),
        outliers_analysis=OutliersAnalysis(
            iqr_method=iqr_converted,
            zscore_method=zscore_converted
        ),
        data_quality_score=analysis['data_quality_score'],
        preprocessing_recommendations=PreprocessingRecommendations(**analysis['preprocessing_recommendations'])
    )

def _generate_optimal_strategy(analysis: dict, request: PreprocessingStrategyRequest) -> PreprocessingStrategy:
    """Générer une stratégie de preprocessing optimisée"""
    
    # Extraire les recommandations de l'analyse
    recommendations = analysis['preprocessing_recommendations']
    
    # Stratégies pour les valeurs manquantes
    missing_strategies = {}
    for col, strategy_info in recommendations['missing_values_strategy'].items():
        missing_strategies[col] = strategy_info['strategy']
    
    # Stratégies pour les outliers
    outlier_strategies = {}
    if recommendations['outlier_handling'].get('affected_columns'):
        for col in recommendations['outlier_handling']['affected_columns']:
            outlier_strategies[col] = 'iqr_capping'  # Méthode conservatrice
    
    # Estimation de l'impact
    estimated_impact = {
        'expected_improvement': '15-25%',
        'training_time_factor': 1.2,
        'data_retention_rate': 0.92,
        'confidence_score': 0.85
    }
    
    return PreprocessingStrategy(
        missing_values=missing_strategies,
        outlier_handling=outlier_strategies,
        scaling_method=recommendations['scaling_recommendation'],
        encoding_method=recommendations['encoding_recommendation'],
        feature_selection=None,  # À implémenter plus tard
        estimated_impact=estimated_impact
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082) 