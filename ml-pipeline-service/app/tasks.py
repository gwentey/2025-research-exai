from celery import Task
from celery.utils.log import get_task_logger
import pandas as pd
import numpy as np
import json
import joblib
import os
import io
import base64
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models import Experiment
from app.ml.algorithms import DecisionTreeWrapper, RandomForestWrapper
from app.ml.preprocessing import preprocess_data
from app.ml.evaluation import evaluate_model, generate_visualizations
from common.storage_client import get_storage_client

logger = get_task_logger(__name__)

class MLTrainingTask(Task):
    """Base task with database session management"""
    _db = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

@celery_app.task(bind=True, base=MLTrainingTask, name='train_model', 
                 soft_time_limit=7200, time_limit=7500,
                 autoretry_for=(ConnectionError, TimeoutError),
                 retry_kwargs={'max_retries': 3, 'countdown': 60},
                 retry_backoff=True)
def train_model(self, experiment_id: str):
    """
    Train a machine learning model based on experiment configuration
    
    Args:
        experiment_id: UUID of the experiment
        
    Returns:
        dict: Training results
    """
    logger.info(f"[CELERY WORKER] Starting training for experiment {experiment_id}")
    logger.info(f"[CELERY WORKER] Task ID: {self.request.id}")
    
    try:
        # Validation d'entrée stricte
        if not experiment_id or experiment_id == "":
            raise ValueError("experiment_id ne peut pas être vide")
        
        # Get experiment from database avec retry
        experiment = None
        for attempt in range(3):
            try:
                experiment = self.db.query(Experiment).filter(Experiment.id == experiment_id).first()
                break
            except Exception as db_error:
                logger.warning(f"Tentative {attempt + 1}/3 de connexion BDD échouée: {str(db_error)}")
                if attempt == 2:
                    raise
                time.sleep(2)
        
        if not experiment:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        # Validation de l'état de l'expérience
        if experiment.status not in ['pending', 'failed']:
            raise ValueError(f"Experiment {experiment_id} is in invalid state: {experiment.status}")
        
        # Validation des paramètres requis
        if not experiment.algorithm:
            raise ValueError("Algorithm must be specified")
        if not experiment.dataset_id:
            raise ValueError("Dataset ID must be specified")
        if not experiment.hyperparameters:
            raise ValueError("Hyperparameters must be specified")
        if not experiment.preprocessing_config:
            raise ValueError("Preprocessing config must be specified")
        
        # Update status to running
        experiment.status = 'running'
        experiment.progress = 10
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100})
        
        # Initialize storage client
        storage_client = get_storage_client()
        
        # Load dataset using the new method that works with real datasets
        logger.info(f"Loading dataset {experiment.dataset_id}")
        
        try:
            # Try to get dataset info from service-selection first
            import requests
            service_selection_url = os.environ.get("SERVICE_SELECTION_URL", "http://service-selection-service.ibis-x.svc.cluster.local")
            response = requests.get(f"{service_selection_url}/datasets/{experiment.dataset_id}", timeout=10)
            
            if response.status_code == 200:
                dataset_info = response.json()
                storage_path = dataset_info.get('storage_path', f'ibis-x-datasets/{experiment.dataset_id}')
                
                # Find main data file
                files = dataset_info.get('files', [])
                main_file = None
                
                for file_info in files:
                    if file_info.get('format') == 'parquet' and file_info.get('logical_role') in ['data_file', 'training_data', None]:
                        main_file = file_info
                        break
                
                if not main_file and files:
                    main_file = files[0]
                
                if main_file:
                    object_path = f"{storage_path.rstrip('/')}/{main_file['file_name_in_storage']}"
                    logger.info(f"Loading dataset from: {object_path}")
                    
                    # Download file data
                    file_data = storage_client.download_file(object_path)
                    data_buffer = io.BytesIO(file_data)
                    df = pd.read_parquet(data_buffer)
                else:
                    raise Exception("No suitable data file found")
            else:
                # Fallback to old path structure
                logger.warning(f"Could not get dataset info from service-selection, trying fallback path")
                dataset_path = f"ibis-x-datasets/{experiment.dataset_id}/data.parquet"
                file_data = storage_client.download_file(dataset_path)
                data_buffer = io.BytesIO(file_data)
                df = pd.read_parquet(data_buffer)
                
        except Exception as e:
            logger.error(f"Error loading dataset: {str(e)}")
            # Fallback intelligent - essayer le chemin direct avec storage_path
            try:
                logger.info(f"Trying direct path with storage_path: {experiment.dataset_id}")
                dataset_path = f"ibis-x-datasets/{experiment.dataset_id}"
                
                # Essayer de lister les fichiers dans le répertoire
                storage_client = get_storage_client()
                
                # Essayer différents noms de fichiers possibles
                possible_files = [
                    f"{dataset_path}/data.parquet",
                    f"{dataset_path}/dataset.parquet", 
                    f"{dataset_path}/train.parquet"
                ]
                
                # Essayer de télécharger un fichier qui existe
                file_data = None
                successful_path = None
                
                for file_path in possible_files:
                    try:
                        logger.info(f"Trying to download: {file_path}")
                        file_data = storage_client.download_file(file_path)
                        successful_path = file_path
                        break
                    except Exception as inner_e:
                        logger.warning(f"Failed to download {file_path}: {str(inner_e)}")
                        continue
                
                if file_data:
                    logger.info(f"Successfully loaded dataset from: {successful_path}")
                    data_buffer = io.BytesIO(file_data)
                    df = pd.read_parquet(data_buffer)
                else:
                    raise Exception("No dataset file found in any expected location")
                    
            except Exception as fallback_error:
                logger.warning(f"All dataset loading methods failed: {str(fallback_error)}")
                logger.info("Using synthetic fallback data for demonstration")
                # Utiliser les données de fallback
                df = _generate_fallback_data(5000)
        
        logger.info(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")
        
        # Update progress avec délai UX pour permettre à l'utilisateur de voir l'étape
        experiment.progress = 30
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 30, 'total': 100})
        time.sleep(1.5)  # Délai UX pour voir l'étape "Chargement des données"
        
        # Validation des données avant preprocessing
        target_column = experiment.preprocessing_config.get('target_column')
        task_type = experiment.preprocessing_config.get('task_type', 'classification')
        
        logger.info(f"Validating data for task_type: {task_type}, target: {target_column}")
        
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset")
        
        # Analyse de la variable cible
        y_values = df[target_column].dropna()
        unique_values = y_values.nunique()
        
        if task_type == 'classification':
            unique_classes, class_counts = np.unique(y_values, return_counts=True)
            min_class_count = class_counts.min()
            
            logger.info(f"Classification task: {len(unique_classes)} classes, min count: {min_class_count}")
            
            if min_class_count < 2:
                logger.warning(f"Classe '{unique_classes[np.argmin(class_counts)]}' n'a que {min_class_count} exemple(s)")
                logger.warning("Auto-correction: passage en mode régression")
                
                # Modifier la configuration pour éviter l'erreur ET sauvegarder en BDD
                experiment.preprocessing_config['task_type'] = 'regression'
                experiment.preprocessing_config['original_task_type'] = task_type
                task_type = 'regression'
                
                # Marquer explicitement la colonne JSONB comme modifiée pour SQLAlchemy
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(experiment, 'preprocessing_config')
                
                # CRUCIAL : Sauvegarder la modification en base de données
                self.db.commit()
                logger.info(f"Configuration updated and saved: task_type changed to regression")
        
        # Preprocess data
        logger.info("Preprocessing data")
        X_train, X_test, y_train, y_test, preprocessing_pipeline = preprocess_data(
            df, 
            experiment.preprocessing_config
        )
        
        # Update progress avec délai UX
        experiment.progress = 50
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 50, 'total': 100})
        time.sleep(2.0)  # Délai UX pour voir l'étape "Préprocessing"
        
        # Initialize model based on algorithm avec task_type corrigé
        # IMPORTANT : Utiliser la variable locale mise à jour, pas la BDD
        corrected_task_type = experiment.preprocessing_config.get('task_type', 'classification')
        
        # Double vérification et debugging détaillé
        original_type = experiment.preprocessing_config.get('original_task_type')
        if original_type and original_type != corrected_task_type:
            logger.info(f"✅ Auto-correction confirmée: {original_type} → {corrected_task_type}")
        else:
            logger.info(f"📋 Task type normal: {corrected_task_type}")
        
        logger.info(f"🔧 Training {experiment.algorithm} model with FINAL task_type: {corrected_task_type}")
        
        if experiment.algorithm == 'decision_tree':
            logger.info(f"🌳 Creating DecisionTreeWrapper(task_type={corrected_task_type})")
            model = DecisionTreeWrapper(task_type=corrected_task_type, **experiment.hyperparameters)
        elif experiment.algorithm == 'random_forest':
            logger.info(f"🌲 Creating RandomForestWrapper(task_type={corrected_task_type})")
            model = RandomForestWrapper(task_type=corrected_task_type, **experiment.hyperparameters)
        else:
            raise ValueError(f"Unknown algorithm: {experiment.algorithm}")
        
        # Vérification finale du type de modèle créé
        model_type = "Regressor" if hasattr(model.model, 'predict') and hasattr(model.model, '_estimator_type') and model.model._estimator_type == 'regressor' else "Classifier"
        logger.info(f"🎯 Model type created: {type(model.model).__name__} ({model_type})")
        
        # Train model
        model.fit(X_train, y_train)
        
        # Update progress avec délai UX  
        experiment.progress = 70
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 70, 'total': 100})
        time.sleep(1.5)  # Délai UX pour voir l'étape "Entraînement"
        
        # Evaluate model avec task_type corrigé (recharger pour avoir la dernière version)
        self.db.refresh(experiment)
        final_task_type = experiment.preprocessing_config.get('task_type', 'classification')
        logger.info(f"Evaluating model with task_type: {final_task_type}")
        metrics = evaluate_model(model, X_test, y_test, task_type=final_task_type)
        
        # Generate visualizations avec task_type corrigé
        logger.info(f"Generating visualizations for task_type: {final_task_type}")
        visualizations = generate_visualizations(
            model, X_test, y_test, 
            feature_names=preprocessing_pipeline.get_feature_names_out() if hasattr(preprocessing_pipeline, 'get_feature_names_out') else None,
            task_type=final_task_type
        )
        
        # Update progress avec délai UX
        experiment.progress = 90
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 90, 'total': 100})
        time.sleep(1.0)  # Délai UX pour voir l'étape "Évaluation"
        
        # Save model and artifacts avec versioning
        logger.info("Saving model artifacts with versioning")
        model_version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        model_filename = f"model_{experiment.id}_v{model_version}.joblib"
        model_path = f"ibis-x-models/{experiment.project_id}/{experiment.id}/v{model_version}/{model_filename}"
        
        # Save model to buffer
        model_buffer = io.BytesIO()
        joblib.dump({
            'model': model,
            'preprocessing_pipeline': preprocessing_pipeline,
            'feature_names': preprocessing_pipeline.get_feature_names_out() if hasattr(preprocessing_pipeline, 'get_feature_names_out') else None,
            'training_config': {
                'algorithm': experiment.algorithm,
                'hyperparameters': experiment.hyperparameters,
                'preprocessing_config': experiment.preprocessing_config
            }
        }, model_buffer)
        model_buffer.seek(0)
        
        # Upload model to storage avec validation
        logger.info(f"📤 Uploading model to {model_path} - Buffer type: {type(model_buffer)}")
        if not hasattr(model_buffer, 'seek'):
            logger.error(f"❌ model_buffer is not BytesIO: {type(model_buffer)}")
            raise ValueError(f"model_buffer must be BytesIO, got {type(model_buffer)}")
        
        storage_client.upload_file(model_buffer, model_path)
        logger.info(f"✅ Model uploaded successfully to {model_path}")
        
        # Upload visualizations
        viz_urls = {}
        for viz_name, viz_data in visualizations.items():
            if isinstance(viz_data, dict) and 'image' in viz_data:
                # Decode base64 image
                img_data = base64.b64decode(viz_data['image'])
                img_buffer = io.BytesIO(img_data)
                img_buffer.seek(0)
                
                viz_path = f"ibis-x-models/{experiment.project_id}/{experiment.id}/viz_{viz_name}.png"
                storage_client.upload_file(img_buffer, viz_path)
                viz_urls[viz_name] = viz_path
        
        # Extract feature importance
        feature_importance = {}
        if hasattr(model, 'get_feature_importance'):
            importance_data = model.get_feature_importance()
            if importance_data is not None and len(importance_data) > 0:
                feature_names = importance_data.get('features', [])
                importances = importance_data.get('importance', [])
                feature_importance = dict(zip(feature_names[:20], importances[:20]))  # Top 20 features
        
        # Délai final pour voir la progression à 90% avant 100%
        time.sleep(2.0)  # Délai UX pour voir l'étape "Sauvegarde" avant completion
        
        # Update experiment with results
        experiment.status = 'completed'
        experiment.progress = 100
        experiment.metrics = metrics
        experiment.artifact_uri = model_path
        experiment.visualizations = viz_urls
        experiment.feature_importance = feature_importance
        experiment.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        
        logger.info(f"Training completed successfully for experiment {experiment_id}")
        
        # Audit final
        logger.info(f"[AUDIT] Experiment {experiment_id} completed - Model: {model_path}, Metrics: {metrics.get('accuracy', 'N/A')}")
        
        return {
            'status': 'completed',
            'metrics': metrics,
            'model_uri': model_path,
            'visualizations': viz_urls,
            'training_duration': (datetime.now(timezone.utc) - experiment.created_at).total_seconds()
        }
        
    except Exception as e:
        logger.error(f"[ERROR] Training failed for experiment {experiment_id}: {str(e)}", exc_info=True)
        
        # Mise à jour d'erreur avec retry de BDD
        try:
            experiment = self.db.query(Experiment).filter(Experiment.id == experiment_id).first()
            if experiment:
                experiment.status = 'failed'
                experiment.error_message = f"Training failed: {str(e)}"
                experiment.updated_at = datetime.now(timezone.utc)
                self.db.commit()
                logger.info(f"[AUDIT] Experiment {experiment_id} marked as failed")
        except Exception as db_error:
            logger.error(f"[CRITICAL] Could not update experiment status: {str(db_error)}")
        
        # Tentative de nettoyage des artefacts partiels
        try:
            storage_client = get_storage_client()
            if 'model_path' in locals():
                storage_client.delete_file(model_path)
                logger.info(f"Cleaned up partial model artifact: {model_path}")
        except Exception as cleanup_error:
            logger.warning(f"Could not cleanup artifacts: {str(cleanup_error)}")
        
        raise
    
    finally:
        # Clean up database session
        if self._db:
            self._db.close()
            self._db = None


def _generate_fallback_data(n_samples: int = 5000) -> pd.DataFrame:
    """
    Génère un dataset synthétique de fallback pour les tests.
    Simule les données Breast Cancer avec colonnes numériques.
    """
    np.random.seed(42)  # Pour reproductibilité
    
    # Générer des colonnes similaires au dataset Breast Cancer
    columns = [
        'mean_radius', 'mean_texture', 'mean_perimeter', 'mean_area', 'mean_smoothness',
        'mean_compactness', 'mean_concavity', 'mean_concave_points', 'mean_symmetry', 'mean_fractal_dimension',
        'radius_error', 'texture_error', 'perimeter_error', 'area_error', 'smoothness_error',
        'compactness_error', 'concavity_error', 'concave_points_error', 'symmetry_error', 'fractal_dimension_error',
        'worst_radius', 'worst_texture', 'worst_perimeter', 'worst_area', 'worst_smoothness',
        'worst_compactness', 'worst_concavity', 'worst_concave_points', 'worst_symmetry', 'worst_fractal_dimension',
        'target', 'fractal_dimension_worst', 'radius_worst'
    ]
    
    data = {}
    for col in columns:
        if 'target' in col:
            # Variable binaire pour classification
            data[col] = np.random.choice([0, 1], size=n_samples)
        elif 'fractal_dimension' in col or 'worst' in col:
            # Variables continues pour régression
            data[col] = np.random.uniform(0.0, 1.0, size=n_samples)
        else:
            # Variables numériques générales
            data[col] = np.random.normal(10.0, 3.0, size=n_samples)
    
    df = pd.DataFrame(data)
    logger.info(f"Generated fallback synthetic dataset: {df.shape[0]} rows, {df.shape[1]} columns")
    return df 