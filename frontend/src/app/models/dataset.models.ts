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
  
  // Filtres booléens
  has_missing_values?: boolean;
  split?: boolean;
  anonymization_applied?: boolean;
  informed_consent?: boolean;
  transparency?: boolean;
  
  // Nouveaux filtres booléens pour l'interface moderne
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
  { key: 'dataset_name', label: 'Nom', default_order: 'asc' },
  { key: 'year', label: 'Année', default_order: 'desc' },
  { key: 'instances_number', label: 'Nombre d\'instances', default_order: 'desc' },
  { key: 'features_number', label: 'Nombre de features', default_order: 'desc' },
  { key: 'num_citations', label: 'Citations', default_order: 'desc' },
  { key: 'created_at', label: 'Date de création', default_order: 'desc' },
  { key: 'updated_at', label: 'Dernière modification', default_order: 'desc' }
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