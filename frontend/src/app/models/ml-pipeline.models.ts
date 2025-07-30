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
    };
    scaling: boolean;
    encoding: string;
    test_size: number;
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