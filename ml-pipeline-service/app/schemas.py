from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import UUID

class ExperimentCreate(BaseModel):
    project_id: UUID
    dataset_id: UUID
    algorithm: str = Field(..., pattern="^(decision_tree|random_forest|logistic_regression|svm|knn|neural_network)$")
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
        elif algorithm == 'logistic_regression':
            allowed_params = {'penalty', 'C', 'solver', 'max_iter'}
        elif algorithm == 'svm':
            allowed_params = {'kernel', 'C', 'gamma', 'degree'}
        elif algorithm == 'knn':
            allowed_params = {'n_neighbors', 'weights', 'algorithm', 'metric'}
        elif algorithm == 'neural_network':
            allowed_params = {'hidden_layer_sizes', 'activation', 'solver', 'alpha', 'learning_rate', 'max_iter'}
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
    algorithm: str  # ⚠️ FIX : Ajouter l'algorithme manquant
    task_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ExperimentResults(BaseModel):
    id: UUID
    metrics: Optional[Dict[str, Any]] = None
    model_uri: Optional[str] = None  # Renommé pour cohérence avec l'API
    visualizations: Optional[Dict[str, Any]] = None
    feature_importance: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: datetime

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

# Schemas pour l'analyse de qualité des données
class DataQualityAnalysisRequest(BaseModel):
    dataset_id: str
    target_column: Optional[str] = None
    sample_size: Optional[int] = 10000  # Pour les gros datasets
    force_refresh: Optional[bool] = False  # Pour forcer une nouvelle analyse même si cache existe

class ColumnMissingInfo(BaseModel):
    missing_count: int
    missing_percentage: float
    data_type: str
    unique_values: int
    is_categorical: bool
    distribution_type: str
    recommended_strategy: Dict[str, Any]

class MissingDataAnalysis(BaseModel):
    total_rows: int
    total_columns: int
    columns_with_missing: Dict[str, ColumnMissingInfo]
    missing_patterns: Dict[str, Any]
    severity_assessment: Dict[str, Any]

class OutlierInfo(BaseModel):
    method: str
    outliers_count: int
    outliers_percentage: float
    threshold: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    max_zscore: Optional[float] = None

class OutliersAnalysis(BaseModel):
    iqr_method: Dict[str, OutlierInfo]
    zscore_method: Dict[str, OutlierInfo]

class DatasetOverview(BaseModel):
    total_rows: int
    total_columns: int
    memory_usage_mb: float
    target_column: Optional[str] = None

class ColumnTypes(BaseModel):
    numeric: List[str]
    categorical: List[str]
    datetime: List[str]

class PreprocessingRecommendations(BaseModel):
    priority_actions: List[Dict[str, Any]]
    missing_values_strategy: Dict[str, Dict[str, Any]]
    outlier_handling: Dict[str, Any]
    feature_engineering: List[str]
    scaling_recommendation: str
    encoding_recommendation: str

class DataQualityAnalysis(BaseModel):
    dataset_overview: DatasetOverview
    column_types: ColumnTypes
    missing_data_analysis: MissingDataAnalysis
    outliers_analysis: OutliersAnalysis
    data_quality_score: int
    preprocessing_recommendations: PreprocessingRecommendations

# Schema pour les suggestions de stratégies
class PreprocessingStrategyRequest(BaseModel):
    dataset_id: str
    target_column: str
    task_type: str = Field(..., pattern="^(classification|regression)$")
    custom_config: Optional[Dict[str, Any]] = None

class PreprocessingStrategy(BaseModel):
    missing_values: Dict[str, str]  # column -> strategy
    outlier_handling: Dict[str, str]  # column -> method
    scaling_method: str
    encoding_method: str
    feature_selection: Optional[List[str]] = None
    estimated_impact: Dict[str, Any] 