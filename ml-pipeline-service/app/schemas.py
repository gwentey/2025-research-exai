from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import UUID

class ExperimentCreate(BaseModel):
    user_id: UUID
    project_id: UUID
    dataset_id: UUID
    algorithm: str = Field(..., pattern="^(decision_tree|random_forest)$")
    hyperparameters: Dict[str, Any]
    preprocessing_config: Dict[str, Any]
    
    @field_validator('hyperparameters')
    @classmethod
    def validate_hyperparameters(cls, v, info):
        algorithm = info.data.get('algorithm')
        if algorithm == 'decision_tree':
            allowed_params = {'criterion', 'max_depth', 'min_samples_split', 'min_samples_leaf', 'max_features'}
        elif algorithm == 'random_forest':
            allowed_params = {'n_estimators', 'max_depth', 'min_samples_split', 'bootstrap', 'max_features'}
        else:
            return v
        
        # Check for unknown parameters
        unknown_params = set(v.keys()) - allowed_params
        if unknown_params:
            raise ValueError(f"Unknown parameters for {algorithm}: {unknown_params}")
        
        return v

class ExperimentRead(BaseModel):
    id: UUID
    user_id: UUID
    project_id: UUID
    dataset_id: UUID
    algorithm: str
    hyperparameters: Dict[str, Any]
    preprocessing_config: Dict[str, Any]
    status: str
    progress: Optional[int] = None
    task_id: Optional[str] = None
    error_message: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    artifact_uri: Optional[str] = None
    visualizations: Optional[Dict[str, Any]] = None
    feature_importance: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ExperimentUpdate(BaseModel):
    status: Optional[str] = None
    progress: Optional[int] = None
    task_id: Optional[str] = None
    error_message: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    artifact_uri: Optional[str] = None
    visualizations: Optional[Dict[str, Any]] = None
    feature_importance: Optional[Dict[str, Any]] = None

class ExperimentStatus(BaseModel):
    id: UUID
    status: str
    progress: Optional[int] = None
    task_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ExperimentResults(BaseModel):
    id: UUID
    metrics: Optional[Dict[str, Any]] = None
    artifact_uri: Optional[str] = None
    visualizations: Optional[Dict[str, Any]] = None
    feature_importance: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

class HyperparameterConfig(BaseModel):
    type: str  # 'number', 'select', 'boolean'
    min: Optional[float] = None
    max: Optional[float] = None
    default: Any
    options: Optional[List[Any]] = None
    description: str

class AlgorithmInfo(BaseModel):
    name: str
    display_name: str
    description: str
    supports_classification: bool
    supports_regression: bool
    hyperparameters: Dict[str, Dict[str, Any]] 