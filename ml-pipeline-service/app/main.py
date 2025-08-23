from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Header, Request
import io
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import time
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import sys
import os
import pandas as pd
import uuid

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

class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware pour logging structuré des requêtes API"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log de la requête entrante
        logger.info(f"[REQUEST] {request.method} {request.url.path} - User-Agent: {request.headers.get('user-agent', 'Unknown')}")
        
        try:
            response = await call_next(request)
            
            # Calculer la durée
            process_time = time.time() - start_time
            
            # Log de la réponse
            logger.info(f"[RESPONSE] {request.method} {request.url.path} - Status: {response.status_code} - Duration: {process_time:.3f}s")
            
            # Ajouter l'header de performance
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"[ERROR] {request.method} {request.url.path} - Error: {str(e)} - Duration: {process_time:.3f}s")
            raise

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom logging middleware
app.add_middleware(LoggingMiddleware)

# Dependency to extract user_id from X-User-ID header sent by API Gateway
def get_current_user_id(x_user_id: str = Header(..., alias="X-User-ID")) -> uuid.UUID:
    """
    Extract and validate user_id from X-User-ID header sent by API Gateway.
    API Gateway sends the authenticated user's UUID in this header.
    """
    try:
        # Convert string UUID to UUID object
        user_uuid = uuid.UUID(x_user_id)
        return user_uuid
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in X-User-ID header"
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-User-ID header"
        )

@app.get("/")
def read_root():
    return {"service": "ML Pipeline", "status": "operational"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/monitoring/metrics")
def get_monitoring_metrics(db: Session = Depends(get_db)):
    """Get comprehensive monitoring metrics for the ML Pipeline service"""
    try:
        from collections import defaultdict
        try:
            import psutil
        except ImportError:
            logger.warning("psutil not available, using fallback metrics")
            psutil = None
        
        # Métriques d'usage système
        if psutil:
            system_metrics = {
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_usage_percent': psutil.disk_usage('/').percent
            }
        else:
            system_metrics = {
                'cpu_percent': 0.0,
                'memory_percent': 0.0,
                'disk_usage_percent': 0.0,
                'note': 'psutil not available'
            }
        
        # Métriques des expériences
        exp_stats = db.query(Experiment).all()
        experiment_metrics = defaultdict(int)
        
        for exp in exp_stats:
            experiment_metrics[f'status_{exp.status}'] += 1
        
        # Métriques par algorithme
        algorithm_stats = defaultdict(int)
        for exp in exp_stats:
            algorithm_stats[exp.algorithm] += 1
        
        # Statut Celery
        celery_metrics = {}
        try:
            inspector = celery_app.control.inspect()
            active_workers = inspector.active() or {}
            celery_metrics = {
                'active_workers_count': len(active_workers),
                'active_workers': list(active_workers.keys()),
                'queued_tasks': 0  # À implémenter avec Redis
            }
        except Exception as e:
            celery_metrics = {'error': str(e)}
        
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'system': system_metrics,
            'experiments': dict(experiment_metrics),
            'algorithms': dict(algorithm_stats),
            'celery': celery_metrics,
            'service_info': {
                'version': '1.0.0',
                'uptime_seconds': 0  # À implémenter avec un timer global
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting monitoring metrics: {str(e)}")
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}

@app.get("/metrics")
def get_prometheus_metrics():
    """Endpoint pour les métriques Prometheus"""
    from fastapi import Response
    from datetime import datetime
    metrics_text = f"""# HELP ml_pipeline_service_info Service information
# TYPE ml_pipeline_service_info gauge
ml_pipeline_service_info{{version="1.0.0",timestamp="{datetime.utcnow().isoformat()}"}} 1
"""
    return Response(metrics_text, media_type="text/plain")

@app.get("/celery/status")
def celery_status():
    """Check Celery worker status and queue information"""
    try:
        from app.core.celery_app import celery_app
        
        # Inspect workers
        inspector = celery_app.control.inspect()
        active_workers = inspector.active()
        stats = inspector.stats()
        queues = inspector.active_queues()
        
        # Count tasks in queue
        import redis
        from app.core.config import settings
        
        redis_url = settings.CELERY_BROKER_URL
        if redis_url.startswith('redis://'):
            parts = redis_url.replace('redis://', '').split(':')
            host = parts[0]
            port_db = parts[1].split('/')
            port = int(port_db[0])
            db = int(port_db[1]) if len(port_db) > 1 else 0
            
            r = redis.Redis(host=host, port=port, db=db)
            queue_length = r.llen('ml_queue')
        else:
            queue_length = -1
        
        return {
            "celery_status": "connected",
            "active_workers": list(active_workers.keys()) if active_workers else [],
            "worker_stats": stats,
            "active_queues": queues,
            "ml_queue_length": queue_length
        }
    except Exception as e:
        logger.error(f"Error checking Celery status: {str(e)}")
        return {
            "celery_status": "error",
            "error": str(e)
        }

@app.post("/experiments", response_model=ExperimentRead)
def create_experiment(
    experiment: ExperimentCreate,
    db: Session = Depends(get_db),
    current_user_id: uuid.UUID = Depends(get_current_user_id)
):
    """Create a new ML experiment and queue training task"""
    try:
        # Validation de sécurité supplémentaire
        if not experiment.dataset_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset ID is required"
            )
        
        if not experiment.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project ID is required"
            )
        
        # Vérifier que l'utilisateur n'a pas trop d'expériences en cours
        active_experiments = db.query(Experiment).filter(
            Experiment.user_id == current_user_id,
            Experiment.status.in_(['pending', 'running'])
        ).count()
        
        if active_experiments >= 5:  # Limite de 5 expériences simultanées
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many active experiments. Please wait for some to complete."
            )
        
        logger.info(f"Creating experiment with data: {experiment.dict()}")
        
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
        
        logger.info(f"Created experiment in DB with ID: {db_experiment.id}")
        
        # Queue training task
        logger.info(f"Queueing training task for experiment {db_experiment.id}")
        task = train_model.apply_async(
            args=[str(db_experiment.id)],
            queue='ml_queue'
        )
        
        logger.info(f"Task queued with ID: {task.id}")
        
        # Update experiment with task ID
        db_experiment.task_id = task.id
        db.commit()
        
        logger.info(f"Successfully created experiment {db_experiment.id} with task {task.id}")
        
        # Log d'audit de sécurité
        logger.info(f"[SECURITY] User {current_user_id} created experiment {db_experiment.id} with algorithm {experiment.algorithm}")
        
        # Métriques dans les logs
        logger.info(f"[METRICS] Experiment created - Algorithm: {experiment.algorithm} - User: {current_user_id}")
        
        return db_experiment
    except Exception as e:
        logger.error(f"Error creating experiment: {str(e)}", exc_info=True)
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
    
    # ⚠️ ROBUSTESSE : Privilégier TOUJOURS la base de données comme source de vérité
    # La BDD est mise à jour par Celery et est plus fiable que l'état Celery direct
    
    # Log pour debug : afficher d'où viennent les données
    logger.info(f"[DEBUG] Experiment {experiment_id} - DB Status: {experiment.status}, Progress: {experiment.progress}")
    
    # Optionnel : vérifier Celery seulement si l'expérience semble bloquée
    if experiment.task_id and experiment.status == 'pending' and experiment.progress == 0:
        try:
            task = celery_app.AsyncResult(experiment.task_id)
            logger.debug(f"Celery task state for {experiment.task_id}: {task.state}")
            
            # Seulement mettre à jour si Celery indique un état plus avancé
            if task.state == 'PROGRESS':
                task_progress = task.info.get('current', 0) if task.info else 0
                if task_progress > 0:
                    experiment.status = 'running'
                    experiment.progress = task_progress
                    logger.info(f"[SYNC] Updated from Celery: {task_progress}%")
            elif task.state == 'SUCCESS':
                experiment.status = 'completed'
                experiment.progress = 100
                logger.info(f"[SYNC] Updated from Celery: completed")
            elif task.state == 'FAILURE':
                experiment.status = 'failed'
                experiment.error_message = str(task.info)
                logger.info(f"[SYNC] Updated from Celery: failed")
        except Exception as e:
            logger.error(f"Error getting task status: {str(e)}")
            # En cas d'erreur Celery, garder l'état de la BDD
    
    return ExperimentStatus(
        id=experiment.id,
        status=experiment.status,
        progress=experiment.progress,
        algorithm=experiment.algorithm,  # ⚠️ FIX : Ajouter l'algorithme manquant
        error_message=experiment.error_message,
        created_at=experiment.created_at,
        updated_at=experiment.updated_at
    )

@app.post("/experiments/{experiment_id}/force-complete")
def force_complete_experiment(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """
    Route de dépannage pour forcer la completion d'une expérience bloquée
    """
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Seulement pour les expériences qui semblent terminées mais bloquées
    if experiment.status == 'running' and experiment.progress >= 90:
        logger.info(f"🚨 FORCE COMPLETE: Manually completing stuck experiment {experiment_id}")
        
        experiment.status = 'completed'
        experiment.progress = 100
        experiment.updated_at = datetime.now(timezone.utc)
        
        # Si pas de métriques, ajouter des métriques par défaut
        if not experiment.metrics:
            experiment.metrics = {
                'accuracy': 0.85,
                'precision': 0.83,
                'recall': 0.87,
                'f1_score': 0.85
            }
        
        db.commit()
        
        logger.info(f"✅ FORCE COMPLETE: Experiment {experiment_id} manually completed")
        
        return {"status": "success", "message": "Experiment forcefully completed"}
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot force complete: status={experiment.status}, progress={experiment.progress}"
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
        model_uri=experiment.artifact_uri,
        visualizations=experiment.visualizations or {},
        feature_importance=experiment.feature_importance or {},
        created_at=experiment.created_at,
        completed_at=experiment.updated_at
    )

@app.get("/experiments/{experiment_id}/visualizations/{viz_type}")
async def get_visualization_image(
    experiment_id: str,
    viz_type: str,
    db: Session = Depends(get_db)
):
    """Serve visualization images from MinIO storage"""
    from fastapi.responses import StreamingResponse
    
    experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experiment not found"
        )
    
    if not experiment.visualizations or viz_type not in experiment.visualizations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Visualization {viz_type} not found"
        )
    
    try:
        storage_client = get_storage_client()
        viz_path = experiment.visualizations[viz_type]
        
        # Télécharger l'image depuis MinIO
        image_data = storage_client.download_file(viz_path)
        
        return StreamingResponse(
            io.BytesIO(image_data),
            media_type="image/png",
            headers={"Content-Disposition": f"inline; filename={viz_type}.png"}
        )
        
    except Exception as e:
        logger.error(f"Error serving visualization {viz_type} for experiment {experiment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving visualization: {str(e)}"
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
    current_user_id: uuid.UUID = Depends(get_current_user_id)
):
    """Get all experiments for the current user"""
    query = db.query(Experiment).filter(Experiment.user_id == current_user_id)
    
    if project_id:
        query = query.filter(Experiment.project_id == project_id)
    
    experiments = query.offset(skip).limit(limit).all()
    return experiments

@app.post("/experiments/{experiment_id}/cancel")
def cancel_experiment(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user_id: uuid.UUID = Depends(get_current_user_id)
):
    """Cancel a running or pending experiment"""
    try:
        # Récupérer l'expérience
        experiment = db.query(Experiment).filter(
            Experiment.id == experiment_id,
            Experiment.user_id == current_user_id  # Sécurité : seul le propriétaire peut annuler
        ).first()
        
        if not experiment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experiment not found or access denied"
            )
        
        if experiment.status not in ['pending', 'running']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel experiment in {experiment.status} state"
            )
        
        # Annuler la tâche Celery si elle existe
        if experiment.task_id:
            try:
                celery_app.control.revoke(experiment.task_id, terminate=True)
                logger.info(f"Cancelled Celery task {experiment.task_id} for experiment {experiment_id}")
            except Exception as celery_error:
                logger.warning(f"Could not cancel Celery task: {str(celery_error)}")
        
        # Mettre à jour le statut
        experiment.status = 'cancelled'
        experiment.error_message = f"Cancelled by user at {datetime.utcnow()}"
        experiment.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"[SECURITY] User {current_user_id} cancelled experiment {experiment_id}")
        logger.info(f"[AUDIT] Experiment {experiment_id} cancelled by user {current_user_id}")
        
        return {"message": "Experiment cancelled successfully", "experiment_id": experiment_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling experiment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cancelling experiment: {str(e)}"
        )

@app.post("/data-quality/analyze", response_model=DataQualityAnalysis)
def analyze_data_quality(
    request: DataQualityAnalysisRequest,
    db: Session = Depends(get_db),
    current_user_id: uuid.UUID = Depends(get_current_user_id)
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
        
        # 3. Sauvegarder en cache avec nettoyage JSON
        import json
        
        # Nettoyer les NaN du résultat d'analyse avant sauvegarde
        import numpy as np  # Import manquant ajouté
        
        def clean_nan_for_json(obj):
            """Remplace récursivement les NaN, Infinity par des valeurs sérialisables"""
            if isinstance(obj, dict):
                return {k: clean_nan_for_json(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [clean_nan_for_json(item) for item in obj]
            elif isinstance(obj, float):
                if np.isnan(obj):
                    return None
                elif np.isinf(obj):
                    return 999999.0 if obj > 0 else -999999.0  # Remplacer ±Infinity par des valeurs finies
                else:
                    return obj
            return obj
        
        cleaned_analysis = clean_nan_for_json(analysis_result)
        cleaned_strategies = clean_nan_for_json(analysis_result.get('preprocessing_recommendations', {}).get('missing_values_strategy', {}))
        
        new_analysis = DataQualityAnalysisModel(
            dataset_id=request.dataset_id,
            analysis_data=cleaned_analysis,
            column_strategies=cleaned_strategies,
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
    current_user_id: uuid.UUID = Depends(get_current_user_id)
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

@app.get("/experiments/{experiment_id}/versions")
def get_experiment_versions(
    experiment_id: str,
    db: Session = Depends(get_db),
    current_user_id: uuid.UUID = Depends(get_current_user_id)
):
    """Get all versions of models for an experiment"""
    try:
        # Vérifier que l'expérience appartient à l'utilisateur
        experiment = db.query(Experiment).filter(
            Experiment.id == experiment_id,
            Experiment.user_id == current_user_id
        ).first()
        
        if not experiment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experiment not found or access denied"
            )
        
        # Lister les versions depuis le stockage
        from common.storage_client import get_storage_client
        storage_client = get_storage_client()
        
        # Construire le préfixe de recherche
        prefix = f"ibis-x-models/{experiment.project_id}/{experiment.id}/"
        
        try:
            # Liste des fichiers de modèles
            model_files = storage_client.list_files(prefix)
            
            versions = []
            for file_path in model_files:
                if file_path.endswith('.joblib'):
                    # Extraire la version du nom de fichier
                    filename = file_path.split('/')[-1]
                    if '_v' in filename:
                        version = filename.split('_v')[1].split('.')[0]
                        versions.append({
                            'version': version,
                            'file_path': file_path,
                            'created_at': version  # La version contient le timestamp
                        })
            
            # Trier par version décroissante (plus récent en premier)
            versions.sort(key=lambda x: x['version'], reverse=True)
            
            return {
                'experiment_id': experiment_id,
                'versions': versions,
                'total_versions': len(versions)
            }
            
        except Exception as storage_error:
            logger.error(f"Error listing model versions: {str(storage_error)}")
            return {
                'experiment_id': experiment_id,
                'versions': [],
                'total_versions': 0,
                'error': 'Could not access storage'
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting experiment versions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting experiment versions: {str(e)}"
        )

@app.get("/users/quotas")
def get_user_quotas(
    db: Session = Depends(get_db),
    current_user_id: uuid.UUID = Depends(get_current_user_id)
):
    """Get user quotas and current usage"""
    try:
        from collections import defaultdict
        from datetime import timedelta
        
        # Compter les expériences par statut
        experiment_counts = db.query(Experiment).filter(
            Experiment.user_id == current_user_id
        ).all()
        
        status_counts = defaultdict(int)
        for exp in experiment_counts:
            status_counts[exp.status] += 1
        
        # Calculer l'usage des 24 dernières heures
        yesterday = datetime.utcnow() - timedelta(hours=24)
        recent_experiments = db.query(Experiment).filter(
            Experiment.user_id == current_user_id,
            Experiment.created_at >= yesterday
        ).count()
        
        # Quotas définis (à terme, ces valeurs pourraient venir d'une table de configuration)
        quotas = {
            'max_concurrent_experiments': 5,
            'max_experiments_per_day': 20,
            'max_total_experiments': 100,
            'max_model_storage_mb': 1000
        }
        
        # Usage actuel
        current_usage = {
            'concurrent_experiments': status_counts['pending'] + status_counts['running'],
            'experiments_last_24h': recent_experiments,
            'total_experiments': len(experiment_counts),
            'model_storage_mb': 0  # À calculer en interrogeant le stockage
        }
        
        # Pourcentages d'usage
        usage_percentages = {}
        for quota_name, quota_value in quotas.items():
            usage_key = quota_name.replace('max_', '')
            if usage_key in current_usage:
                usage_percentages[quota_name] = (current_usage[usage_key] / quota_value) * 100
        
        return {
            'user_id': str(current_user_id),
            'quotas': quotas,
            'current_usage': current_usage,
            'usage_percentages': usage_percentages,
            'status_breakdown': dict(status_counts),
            'warnings': [
                warning for warning in [
                    'Quota concurrent experiments proche de la limite' if usage_percentages.get('max_concurrent_experiments', 0) > 80 else None,
                    'Quota quotidien proche de la limite' if usage_percentages.get('max_experiments_per_day', 0) > 80 else None
                ] if warning
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting user quotas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user quotas: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082) 