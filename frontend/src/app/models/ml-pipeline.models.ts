export interface Experiment {
  id: string;
  user_id: string;
  project_id: string;
  dataset_id: string;
  algorithm: string;
  hyperparameters: Record<string, any>;
  preprocessing_config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  metrics?: Record<string, any>;
  model_uri?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

// Version étendue pour la lecture depuis l'API
export interface ExperimentRead extends Experiment {
  training_duration?: number;
  training_time?: number;
  artifact_uri?: string;
  algorithm_info?: AlgorithmInfo;
  dataset_info?: {
    name: string;
    n_rows: number;
    n_cols: number;
  };
  cross_validation_scores?: number[];
  best_params?: Record<string, any>;
  preprocessing_info?: Record<string, any>;
}

export interface ExperimentCreate {
  project_id: string;
  dataset_id: string;
  algorithm: string;
  hyperparameters: Record<string, any>;
  preprocessing_config: {
    target_column: string;
    task_type: 'classification' | 'regression';
    missing_values: {
      strategy: string;
      knn_neighbors?: number;
      max_iterative_iter?: number;
    };
    scaling: {
      enabled: boolean;
      method: string;
    };
    encoding: string;
    outlier_detection: {
      enabled: boolean;
      method: string;
      threshold: number;
    };
    test_size: number;
    column_cleaning_configs?: any[];
    manual_overrides?: Record<string, any>;
  };
}

export interface ExperimentStatus {
  id: string;
  status: string;
  progress: number;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface ExperimentResults {
  id: string;
  metrics: TrainingMetrics;
  model_uri?: string;
  visualizations: Record<string, string>;
  feature_importance: Record<string, number>;
  created_at: string;
  completed_at: string;
}

export interface TrainingMetrics {
  // Classification metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  confusion_matrix?: number[][];
  roc_auc?: number;
  classification_report?: any;
  
  // Regression metrics
  mae?: number;
  mse?: number;
  rmse?: number;
  r2?: number;
}

export interface AlgorithmInfo {
  name: string;
  display_name: string;
  description: string;
  supports_classification: boolean;
  supports_regression: boolean;
  hyperparameters: Record<string, HyperparameterConfig>;
}

export interface HyperparameterConfig {
  type: 'number' | 'select' | 'boolean';
  min?: number;
  max?: number;
  default: any;
  options?: any[];
  description: string;
}

export interface ModelArtifact {
  model_uri: string;
  created_at: string;
  size_bytes: number;
  format: string;
}

// Nouveaux modèles pour l'analyse de qualité des données
export interface DataQualityAnalysisRequest {
  dataset_id: string;
  target_column?: string;
  sample_size?: number;
}

export interface ColumnMissingInfo {
  missing_count: number;
  missing_percentage: number;
  data_type: string;
  unique_values: number;
  is_categorical: boolean;
  distribution_type: string;
  recommended_strategy: {
    primary_strategy: string;
    alternative_strategies: string[];
    explanation: string;
    confidence: number;
  };
}

export interface MissingDataAnalysis {
  total_rows: number;
  total_columns: number;
  columns_with_missing: { [key: string]: ColumnMissingInfo };
  missing_patterns: {
    completely_missing_rows: number;
    completely_missing_columns: string[];
    correlated_missing: any[];
  };
  severity_assessment: {
    overall_score: number;
    level: 'none' | 'low' | 'medium' | 'high' | 'critical';
    main_issues: string[];
    action_required: boolean;
  };
}

export interface OutlierInfo {
  method: string;
  outliers_count: number;
  outliers_percentage: number;
  threshold?: number;
  lower_bound?: number;
  upper_bound?: number;
  max_zscore?: number;
}

export interface OutliersAnalysis {
  iqr_method: { [key: string]: OutlierInfo };
  zscore_method: { [key: string]: OutlierInfo };
}

export interface PreprocessingRecommendations {
  priority_actions: Array<{
    action: string;
    priority: string;
    description: string;
  }>;
  missing_values_strategy: { [key: string]: any };
  outlier_handling: {
    affected_columns?: string[];
    recommended_methods?: string[];
    explanation?: string;
  };
  feature_engineering: string[];
  scaling_recommendation: string;
  encoding_recommendation: string;
}

export interface DataQualityAnalysis {
  dataset_overview: {
    total_rows: number;
    total_columns: number;
    memory_usage_mb: number;
    target_column?: string;
  };
  column_types: {
    numeric: string[];
    categorical: string[];
    datetime: string[];
  };
  missing_data_analysis: MissingDataAnalysis;
  outliers_analysis: OutliersAnalysis;
  data_quality_score: number;
  preprocessing_recommendations: PreprocessingRecommendations;
}

export interface PreprocessingStrategyRequest {
  dataset_id: string;
  target_column: string;
  task_type: 'classification' | 'regression';
  custom_config?: any;
}

export interface PreprocessingStrategy {
  missing_values: { [key: string]: string };
  outlier_handling: { [key: string]: string };
  scaling_method: string;
  encoding_method: string;
  feature_selection?: string[];
  estimated_impact: {
    expected_improvement: string;
    training_time_factor: number;
    data_retention_rate: number;
    confidence_score: number;
  };
} 