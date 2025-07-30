from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import sys

from app.core.config import settings
from app.database import engine, get_db, Base
from app.models import Experiment
from app.schemas import (
    ExperimentCreate, ExperimentRead, ExperimentStatus, 
    ExperimentResults, AlgorithmInfo
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082) 