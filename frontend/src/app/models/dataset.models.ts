/**
 * Modèles TypeScript pour les datasets
 * Basés sur les schémas Python du service service-selection
 */

/**
 * Interface pour un dataset (lecture)
 */
export interface Dataset {
  id: string;
  // === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
  dataset_name: string;
  year?: number;
  objective?: string;
  access?: string;
  availability?: string;
  num_citations?: number;
  citation_link?: string;
  sources?: string;
  storage_uri?: string;
  
  // === CARACTÉRISTIQUES TECHNIQUES ===
  instances_number?: number;
  features_description?: string;
  features_number?: number;
  domain?: string[];
  representativity_description?: string;
  representativity_level?: string;
  sample_balance_description?: string;
  sample_balance_level?: string;
  split?: boolean;
  missing_values_description?: string;
  has_missing_values?: boolean;
  global_missing_percentage?: number;
  missing_values_handling_method?: string;
  temporal_factors?: boolean;
  metadata_provided_with_dataset?: boolean;
  external_documentation_available?: boolean;
  documentation_link?: string;
  task?: string[];
  
  // === CRITÈRES ÉTHIQUES ===
  informed_consent?: boolean;
  transparency?: boolean;
  user_control?: boolean;
  equity_non_discrimination?: boolean;
  security_measures_in_place?: boolean;
  data_quality_documented?: boolean;
  data_errors_description?: string;
  anonymization_applied?: boolean;
  record_keeping_policy_exists?: boolean;
  purpose_limitation_respected?: boolean;
  accountability_defined?: boolean;
  
  // === TIMESTAMPS ===
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour un fichier de dataset
 */
export interface DatasetFile {
  id: string;
  dataset_id: string;
  file_name_in_storage: string;
  logical_role?: string;
  format?: string;
  mime_type?: string;
  size_bytes?: number;
  row_count?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour une colonne de fichier
 */
export interface FileColumn {
  id: string;
  dataset_file_id: string;
  column_name: string;
  data_type_original?: string;
  data_type_interpreted?: string;
  description?: string;
  is_primary_key_component: boolean;
  is_nullable: boolean;
  is_pii: boolean;
  example_values?: string[];
  position: number;
  stats?: { [key: string]: any };
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour un fichier avec ses colonnes
 */
export interface DatasetFileWithColumns extends DatasetFile {
  columns: FileColumn[];
}

/**
 * Interface pour un dataset avec ses fichiers et colonnes
 */
export interface DatasetComplete extends Dataset {
  files: DatasetFileWithColumns[];
}

/**
 * Interface pour un dataset avec score calculé
 */
export interface DatasetScored extends Dataset {
  score: number;
}

/**
 * Interface pour les critères de filtrage
 */
export interface DatasetFilterCriteria {
  // Filtres textuels
  dataset_name?: string;
  objective?: string;
  domain?: string[];
  task?: string[];
  
  // Filtres numériques
  instances_number_min?: number;
  instances_number_max?: number;
  features_number_min?: number;
  features_number_max?: number;
  year_min?: number;
  year_max?: number;
  
  // Filtres de qualité et éthique
  ethical_score_min?: number;
  representativity_level?: string;
  
  // Filtres booléens techniques
  has_missing_values?: boolean;
  split?: boolean;
  anonymization_applied?: boolean;
  
  // Filtres éthiques booléens
  informed_consent?: boolean;
  transparency?: boolean;
  user_control?: boolean;
  equity_non_discrimination?: boolean;
  security_measures_in_place?: boolean;
  data_quality_documented?: boolean;
  record_keeping_policy_exists?: boolean;
  purpose_limitation_respected?: boolean;
  accountability_defined?: boolean;
  
  // Filtres raccourcis pour l'interface moderne
  is_split?: boolean;
  is_anonymized?: boolean;
  has_temporal_factors?: boolean;
  is_public?: boolean;
}

/**
 * Interface pour les critères de scoring
 */
export interface CriterionWeight {
  criterion_name: string;
  weight: number;
}

/**
 * Interface pour la requête de scoring
 */
export interface DatasetScoreRequest {
  filters: DatasetFilterCriteria;
  weights: CriterionWeight[];
}

/**
 * Interface pour la réponse de listing des datasets
 */
export interface DatasetListResponse {
  datasets: Dataset[];
  total_count: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

/**
 * Interface pour les paramètres de pagination
 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Énumération des types de tâches ML
 */
export enum MLTaskType {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  CLUSTERING = 'clustering',
  DIMENSIONALITY_REDUCTION = 'dimensionality_reduction',
  ASSOCIATION_RULES = 'association_rules',
  ANOMALY_DETECTION = 'anomaly_detection',
  REINFORCEMENT_LEARNING = 'reinforcement_learning',
  TIME_SERIES = 'time_series',
  NLP = 'nlp',
  COMPUTER_VISION = 'computer_vision'
}

/**
 * Énumération des domaines d'application
 */
export enum ApplicationDomain {
  EDUCATION = 'éducation',
  HEALTHCARE = 'santé',
  FINANCE = 'finance',
  ECOMMERCE = 'e-commerce',
  SOCIAL_MEDIA = 'réseaux sociaux',
  GOVERNMENT = 'gouvernement',
  TRANSPORTATION = 'transport',
  ENTERTAINMENT = 'divertissement',
  AGRICULTURE = 'agriculture',
  ENERGY = 'énergie',
  MANUFACTURING = 'manufacturing',
  TELECOMMUNICATIONS = 'télécommunications',
  REAL_ESTATE = 'immobilier',
  RETAIL = 'retail',
  SPORTS = 'sport',
  WEATHER = 'météo',
  ENVIRONMENT = 'environnement',
  SECURITY = 'sécurité'
}

/**
 * Interface pour les options de tri
 */
export interface SortOption {
  key: string;
  label: string;
  default_order: 'asc' | 'desc';
}

/**
 * Options de tri disponibles
 */
export const SORT_OPTIONS: SortOption[] = [
  { key: 'dataset_name', label: 'DATASETS.SORT.DATASET_NAME', default_order: 'asc' },
  { key: 'year', label: 'DATASETS.SORT.YEAR', default_order: 'desc' },
  { key: 'instances_number', label: 'DATASETS.SORT.INSTANCES_NUMBER', default_order: 'desc' },
  { key: 'features_number', label: 'DATASETS.SORT.FEATURES_NUMBER', default_order: 'desc' },
  { key: 'num_citations', label: 'DATASETS.SORT.NUM_CITATIONS', default_order: 'desc' },
  { key: 'created_at', label: 'DATASETS.SORT.CREATED_AT', default_order: 'desc' },
  { key: 'updated_at', label: 'DATASETS.SORT.UPDATED_AT', default_order: 'desc' }
];

/**
 * Interface pour les statistiques d'un dataset
 */
export interface DatasetStats {
  totalDatasets: number;
  totalInstances: number;
  totalFiles: number;
  avgInstancesPerDataset: number;
  avgFeaturesPerDataset: number;
  domainDistribution: { [domain: string]: number };
  taskDistribution: { [task: string]: number };
}

/**
 * Interface pour l'aperçu des données d'un dataset
 */
export interface DatasetPreview {
  dataset_id: string;
  file_name: string;
  sample_data: { [column: string]: any }[];
  total_rows: number;
  columns_info: {
    name: string;
    type: string;
    sample_values: any[];
    non_null_count: number;
    unique_count?: number;
    mean?: number;
    std?: number;
    min?: number;
    max?: number;
    percentiles?: { [key: string]: number };
  }[];
}

/**
 * Interface pour les statistiques détaillées d'une colonne
 */
export interface ColumnStatistics {
  column_name: string;
  data_type: string;
  non_null_count: number;
  null_count: number;
  unique_count?: number;
  is_pii: boolean;
  
  // Statistiques numériques
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  median?: number;
  q1?: number;
  q3?: number;
  
  // Statistiques catégorielles
  top_values?: { value: any; count: number; percentage: number }[];
  
  // Distribution
  histogram?: { bins: number[]; counts: number[] };
  
  // Exemples de valeurs
  sample_values: any[];
}

/**
 * Interface pour les métadonnées d'un fichier de dataset
 */
export interface DatasetFileMetadata extends DatasetFile {
  columns: FileColumn[];
  column_statistics: ColumnStatistics[];
  preview_data?: { [column: string]: any }[];
  data_quality_score?: number;
  completeness_percentage?: number;
}

/**
 * Interface pour les métriques de qualité du dataset
 */
export interface DatasetQualityMetrics {
  overall_score: number;
  completeness: number;
  consistency: number;
  accuracy: number;
  timeliness: number;
  ethical_compliance: number;
  
  // Détails par critère
  missing_data_impact: number;
  outliers_percentage: number;
  duplicate_rows: number;
  schema_violations: number;
  pii_exposure_risk: number;
}

/**
 * Interface pour les corrélations entre features
 */
export interface FeatureCorrelation {
  feature1: string;
  feature2: string;
  correlation: number;
  correlation_type: 'pearson' | 'spearman' | 'kendall';
}

/**
 * Interface pour l'analyse de distribution des données
 */
export interface DataDistributionAnalysis {
  target_column?: string;
  class_distribution?: { [key: string]: number };
  feature_importance?: { feature: string; importance: number }[];
  correlations: FeatureCorrelation[];
  missing_patterns: { pattern: string; count: number; percentage: number }[];
}

/**
 * Interface complète pour les détails d'un dataset (vue Kaggle-like)
 */
export interface DatasetDetailView extends Dataset {
  files: DatasetFileMetadata[];
  quality_metrics: DatasetQualityMetrics;
  distribution_analysis: DataDistributionAnalysis;
  usage_examples?: {
    title: string;
    description: string;
    code_snippet?: string;
    notebook_link?: string;
  }[];
  related_datasets?: {
    id: string;
    name: string;
    similarity_score: number;
    reason: string;
  }[];
  download_stats?: {
    total_downloads: number;
    recent_downloads: number;
    popularity_rank: number;
  };
}

/**
 * Interface pour les options de visualisation des données
 */
export interface DataVisualizationOptions {
  chart_type: 'histogram' | 'scatter' | 'correlation' | 'distribution' | 'missing_pattern';
  x_column?: string;
  y_column?: string;
  color_column?: string;
  aggregation?: 'count' | 'mean' | 'sum' | 'max' | 'min';
}

/**
 * Interface pour les alertes de qualité des données
 */
export interface DataQualityAlert {
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  affected_columns?: string[];
  severity: number; // 1-10
  recommendation?: string;
} 