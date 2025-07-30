from celery import Task
from celery.utils.log import get_task_logger
import pandas as pd
import numpy as np
import json
import joblib
import os
import io
import base64
from datetime import datetime
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
                 soft_time_limit=3600, time_limit=3900)
def train_model(self, experiment_id: str):
    """
    Train a machine learning model based on experiment configuration
    
    Args:
        experiment_id: UUID of the experiment
        
    Returns:
        dict: Training results
    """
    logger.info(f"Starting training for experiment {experiment_id}")
    
    try:
        # Get experiment from database
        experiment = self.db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if not experiment:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        # Update status to running
        experiment.status = 'running'
        experiment.progress = 10
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100})
        
        # Initialize storage client
        storage_client = get_storage_client()
        
        # Download dataset
        logger.info(f"Downloading dataset {experiment.dataset_id}")
        dataset_path = f"datasets/{experiment.dataset_id}/data.parquet"
        
        # Read data from storage
        data_buffer = io.BytesIO()
        storage_client.download_file(dataset_path, data_buffer)
        data_buffer.seek(0)
        df = pd.read_parquet(data_buffer)
        
        logger.info(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")
        
        # Update progress
        experiment.progress = 30
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 30, 'total': 100})
        
        # Preprocess data
        logger.info("Preprocessing data")
        X_train, X_test, y_train, y_test, preprocessing_pipeline = preprocess_data(
            df, 
            experiment.preprocessing_config
        )
        
        # Update progress
        experiment.progress = 50
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 50, 'total': 100})
        
        # Initialize model based on algorithm
        logger.info(f"Training {experiment.algorithm} model")
        if experiment.algorithm == 'decision_tree':
            model = DecisionTreeWrapper(**experiment.hyperparameters)
        elif experiment.algorithm == 'random_forest':
            model = RandomForestWrapper(**experiment.hyperparameters)
        else:
            raise ValueError(f"Unknown algorithm: {experiment.algorithm}")
        
        # Train model
        model.fit(X_train, y_train)
        
        # Update progress
        experiment.progress = 70
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 70, 'total': 100})
        
        # Evaluate model
        logger.info("Evaluating model")
        metrics = evaluate_model(model, X_test, y_test, 
                               task_type=experiment.preprocessing_config.get('task_type', 'classification'))
        
        # Generate visualizations
        logger.info("Generating visualizations")
        visualizations = generate_visualizations(
            model, X_test, y_test, 
            feature_names=preprocessing_pipeline.get_feature_names_out() if hasattr(preprocessing_pipeline, 'get_feature_names_out') else None,
            task_type=experiment.preprocessing_config.get('task_type', 'classification')
        )
        
        # Update progress
        experiment.progress = 90
        self.db.commit()
        self.update_state(state='PROGRESS', meta={'current': 90, 'total': 100})
        
        # Save model and artifacts
        logger.info("Saving model artifacts")
        model_filename = f"model_{experiment.id}.joblib"
        model_path = f"ibis-x-models/{experiment.project_id}/{experiment.id}/{model_filename}"
        
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
        
        # Upload model to storage
        storage_client.upload_file(model_path, model_buffer)
        
        # Upload visualizations
        viz_urls = {}
        for viz_name, viz_data in visualizations.items():
            if isinstance(viz_data, dict) and 'image' in viz_data:
                # Decode base64 image
                img_data = base64.b64decode(viz_data['image'])
                img_buffer = io.BytesIO(img_data)
                img_buffer.seek(0)
                
                viz_path = f"ibis-x-models/{experiment.project_id}/{experiment.id}/viz_{viz_name}.png"
                storage_client.upload_file(viz_path, img_buffer)
                viz_urls[viz_name] = viz_path
        
        # Extract feature importance
        feature_importance = {}
        if hasattr(model, 'get_feature_importance'):
            importance_data = model.get_feature_importance()
            if importance_data is not None and len(importance_data) > 0:
                feature_names = importance_data.get('features', [])
                importances = importance_data.get('importance', [])
                feature_importance = dict(zip(feature_names[:20], importances[:20]))  # Top 20 features
        
        # Update experiment with results
        experiment.status = 'completed'
        experiment.progress = 100
        experiment.metrics = metrics
        experiment.model_uri = model_path
        experiment.visualizations = viz_urls
        experiment.feature_importance = feature_importance
        experiment.updated_at = datetime.utcnow()
        self.db.commit()
        
        logger.info(f"Training completed successfully for experiment {experiment_id}")
        
        return {
            'status': 'completed',
            'metrics': metrics,
            'model_uri': model_path,
            'visualizations': viz_urls
        }
        
    except Exception as e:
        logger.error(f"Error in training task: {str(e)}")
        
        # Update experiment with error
        experiment = self.db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if experiment:
            experiment.status = 'failed'
            experiment.error_message = str(e)
            experiment.updated_at = datetime.utcnow()
            self.db.commit()
        
        raise
    
    finally:
        # Clean up database session
        if self._db:
            self._db.close()
            self._db = None 