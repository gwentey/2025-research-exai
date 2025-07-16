from pydantic import BaseModel, Field, UUID4
from typing import List, Optional, Dict, Any
from datetime import datetime
import re

# === SCHÉMAS POUR DATASET ===

class DatasetBase(BaseModel):
    """Schéma de base pour un Dataset"""
    dataset_name: str = Field(..., description="Nom du dataset")
    year: Optional[int] = Field(None, description="Année du dataset")
    objective: Optional[str] = Field(None, description="Objectif du dataset")
    access: Optional[str] = Field(None, description="Type d'accès")
    availability: Optional[str] = Field(None, description="Disponibilité")
    num_citations: Optional[int] = Field(0, description="Nombre de citations")
    citation_link: Optional[str] = Field(None, description="Lien vers les citations")
    sources: Optional[str] = Field(None, description="Sources")
    storage_uri: Optional[str] = Field(None, description="URI de stockage")
    
    # Caractéristiques techniques
    instances_number: Optional[int] = Field(None, description="Nombre d'instances")
    features_description: Optional[str] = Field(None, description="Description des features")
    features_number: Optional[int] = Field(None, description="Nombre de features")
    domain: Optional[List[str]] = Field(None, description="Domaines d'application")
    representativity_description: Optional[str] = Field(None, description="Description de la représentativité")
    representativity_level: Optional[str] = Field(None, description="Niveau de représentativité")
    sample_balance_description: Optional[str] = Field(None, description="Description de l'équilibre des échantillons")
    sample_balance_level: Optional[str] = Field(None, description="Niveau d'équilibre des échantillons")
    split: Optional[bool] = Field(False, description="Dataset déjà splité")
    missing_values_description: Optional[str] = Field(None, description="Description des valeurs manquantes")
    has_missing_values: Optional[bool] = Field(False, description="Présence de valeurs manquantes")
    global_missing_percentage: Optional[float] = Field(None, description="Pourcentage global de valeurs manquantes")
    missing_values_handling_method: Optional[str] = Field(None, description="Méthode de gestion des valeurs manquantes")
    temporal_factors: Optional[bool] = Field(False, description="Facteurs temporels")
    metadata_provided_with_dataset: Optional[bool] = Field(False, description="Métadonnées fournies avec le dataset")
    external_documentation_available: Optional[bool] = Field(False, description="Documentation externe disponible")
    documentation_link: Optional[str] = Field(None, description="Lien vers la documentation")
    task: Optional[List[str]] = Field(None, description="Tâches ML")
    
    # Critères éthiques
    informed_consent: Optional[bool] = Field(False, description="Consentement éclairé")
    transparency: Optional[bool] = Field(False, description="Transparence")
    user_control: Optional[bool] = Field(False, description="Contrôle utilisateur")
    equity_non_discrimination: Optional[bool] = Field(False, description="Équité et non-discrimination")
    security_measures_in_place: Optional[bool] = Field(False, description="Mesures de sécurité en place")
    data_quality_documented: Optional[bool] = Field(False, description="Qualité des données documentée")
    data_errors_description: Optional[str] = Field(None, description="Description des erreurs de données")
    anonymization_applied: Optional[bool] = Field(False, description="Anonymisation appliquée")
    record_keeping_policy_exists: Optional[bool] = Field(False, description="Politique de conservation des enregistrements")
    purpose_limitation_respected: Optional[bool] = Field(False, description="Limitation d'objectif respectée")
    accountability_defined: Optional[bool] = Field(False, description="Responsabilité définie")


class DatasetCreate(DatasetBase):
    """Schéma pour créer un nouveau Dataset"""
    pass


class DatasetRead(DatasetBase):
    """Schéma pour lire un Dataset"""
    id: UUID4
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DatasetUpdate(BaseModel):
    """Schéma pour mettre à jour un Dataset"""
    dataset_name: Optional[str] = None
    year: Optional[int] = None
    objective: Optional[str] = None
    access: Optional[str] = None
    availability: Optional[str] = None
    num_citations: Optional[int] = None
    citation_link: Optional[str] = None
    sources: Optional[str] = None
    storage_uri: Optional[str] = None
    instances_number: Optional[int] = None
    features_description: Optional[str] = None
    features_number: Optional[int] = None
    domain: Optional[List[str]] = None
    representativity_description: Optional[str] = None
    representativity_level: Optional[str] = None
    sample_balance_description: Optional[str] = None
    sample_balance_level: Optional[str] = None
    split: Optional[bool] = None
    missing_values_description: Optional[str] = None
    has_missing_values: Optional[bool] = None
    global_missing_percentage: Optional[float] = None
    missing_values_handling_method: Optional[str] = None
    temporal_factors: Optional[bool] = None
    metadata_provided_with_dataset: Optional[bool] = None
    external_documentation_available: Optional[bool] = None
    documentation_link: Optional[str] = None
    task: Optional[List[str]] = None
    informed_consent: Optional[bool] = None
    transparency: Optional[bool] = None
    user_control: Optional[bool] = None
    equity_non_discrimination: Optional[bool] = None
    security_measures_in_place: Optional[bool] = None
    data_quality_documented: Optional[bool] = None
    data_errors_description: Optional[str] = None
    anonymization_applied: Optional[bool] = None
    record_keeping_policy_exists: Optional[bool] = None
    purpose_limitation_respected: Optional[bool] = None
    accountability_defined: Optional[bool] = None


# === SCHÉMAS POUR LES FILTRES ===

class DatasetFilterCriteria(BaseModel):
    """Schéma pour les critères de filtrage des datasets"""
    # Filtres textuels
    dataset_name: Optional[str] = Field(None, description="Filtrer par nom (recherche textuelle)")
    objective: Optional[str] = Field(None, description="Filtrer par objectif (recherche textuelle)")
    
    # Filtres de listes
    domain: Optional[List[str]] = Field(None, description="Filtrer par domaines")
    task: Optional[List[str]] = Field(None, description="Filtrer par tâches ML")
    
    # Filtres catégoriels
    access: Optional[str] = Field(None, description="Filtrer par type d'accès")
    availability: Optional[str] = Field(None, description="Filtrer par disponibilité")
    
    # Filtres numériques avec plages
    year_min: Optional[int] = Field(None, description="Année minimale")
    year_max: Optional[int] = Field(None, description="Année maximale")
    instances_min: Optional[int] = Field(None, description="Nombre minimum d'instances")
    instances_max: Optional[int] = Field(None, description="Nombre maximum d'instances")
    # Alias pour compatibilité avec le frontend
    instances_number_min: Optional[int] = Field(None, description="Nombre minimum d'instances (alias)")
    instances_number_max: Optional[int] = Field(None, description="Nombre maximum d'instances (alias)")
    features_min: Optional[int] = Field(None, description="Nombre minimum de features")
    features_max: Optional[int] = Field(None, description="Nombre maximum de features")
    # Alias pour compatibilité avec le frontend
    features_number_min: Optional[int] = Field(None, description="Nombre minimum de features (alias)")
    features_number_max: Optional[int] = Field(None, description="Nombre maximum de features (alias)")
    citations_min: Optional[int] = Field(None, description="Nombre minimum de citations")
    citations_max: Optional[int] = Field(None, description="Nombre maximum de citations")
    
    # Filtres de scores
    ethical_score_min: Optional[int] = Field(None, ge=0, le=100, description="Score éthique minimum (0-100%)")
    
    # Filtres booléens techniques
    has_missing_values: Optional[bool] = Field(None, description="Présence de valeurs manquantes")
    split: Optional[bool] = Field(None, description="Dataset déjà splité")
    is_split: Optional[bool] = Field(None, description="Dataset déjà splité (alias)")
    metadata_provided_with_dataset: Optional[bool] = Field(None, description="Métadonnées fournies")
    external_documentation_available: Optional[bool] = Field(None, description="Documentation externe disponible")
    temporal_factors: Optional[bool] = Field(None, description="Facteurs temporels")
    has_temporal_factors: Optional[bool] = Field(None, description="Facteurs temporels (alias)")
    
    # Filtres de raccourcis pour le frontend
    is_anonymized: Optional[bool] = Field(None, description="Anonymisation appliquée (raccourci)")
    is_public: Optional[bool] = Field(None, description="Accès public (raccourci)")
    
    # Critères éthiques
    informed_consent: Optional[bool] = Field(None, description="Consentement éclairé")
    transparency: Optional[bool] = Field(None, description="Transparence")
    user_control: Optional[bool] = Field(None, description="Contrôle utilisateur")
    equity_non_discrimination: Optional[bool] = Field(None, description="Équité et non-discrimination")
    security_measures_in_place: Optional[bool] = Field(None, description="Mesures de sécurité")
    data_quality_documented: Optional[bool] = Field(None, description="Qualité documentée")
    anonymization_applied: Optional[bool] = Field(None, description="Anonymisation appliquée")
    record_keeping_policy_exists: Optional[bool] = Field(None, description="Politique de conservation")
    purpose_limitation_respected: Optional[bool] = Field(None, description="Limitation d'objectif")
    accountability_defined: Optional[bool] = Field(None, description="Responsabilité définie")


# === SCHÉMAS POUR LES PARAMÈTRES DE PAGINATION ===

class PaginationParams(BaseModel):
    """Schéma pour les paramètres de pagination"""
    page: int = Field(1, ge=1, description="Numéro de page")
    page_size: int = Field(12, ge=1, le=100, description="Nombre d'éléments par page")
    sort_by: str = Field("dataset_name", description="Champ de tri")
    sort_order: str = Field("asc", description="Ordre de tri")


# === SCHÉMAS POUR LES RÉPONSES ===

class DatasetListResponse(BaseModel):
    """Schéma pour la réponse de liste des datasets"""
    datasets: List[DatasetRead]
    total_count: int
    page: int
    page_size: int
    total_pages: int


class DomainResponse(BaseModel):
    """Schéma pour la réponse des domaines"""
    domains: List[str]


class TaskResponse(BaseModel):
    """Schéma pour la réponse des tâches"""
    tasks: List[str]


# === SCHÉMAS POUR LE SCORING ===

class CriterionWeight(BaseModel):
    """Schéma pour un critère et son poids"""
    criterion_name: str
    weight: float = Field(ge=0.0, le=1.0)


class DatasetScoreRequest(BaseModel):
    """Schéma pour la requête de scoring des datasets"""
    filters: Optional[DatasetFilterCriteria] = None
    weights: List[CriterionWeight] = Field(default_factory=list)


class DatasetScoredRead(DatasetRead):
    """Schéma pour un dataset avec son score"""
    score: float = Field(ge=0.0, le=1.0, description="Score calculé") 


# === SCHÉMAS POUR LES PROJETS ===

class ProjectBase(BaseModel):
    """Schéma de base pour un Project"""
    name: str = Field(..., max_length=255, description="Nom du projet")
    description: Optional[str] = Field(None, description="Description du projet")
    criteria: Optional[DatasetFilterCriteria] = Field(None, description="Critères de filtrage des datasets")
    weights: Optional[List[CriterionWeight]] = Field(None, description="Poids des critères pour le scoring")


class ProjectCreate(ProjectBase):
    """Schéma pour créer un nouveau Project"""
    pass


class ProjectUpdate(BaseModel):
    """Schéma pour mettre à jour un Project"""
    name: Optional[str] = Field(None, max_length=255, description="Nom du projet")
    description: Optional[str] = Field(None, description="Description du projet")
    criteria: Optional[DatasetFilterCriteria] = Field(None, description="Critères de filtrage des datasets")
    weights: Optional[List[CriterionWeight]] = Field(None, description="Poids des critères pour le scoring")


class ProjectRead(ProjectBase):
    """Schéma pour lire un Project"""
    id: UUID4
    user_id: UUID4
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Schéma pour la réponse de liste des projets"""
    projects: List[ProjectRead]
    total_count: int
    page: int
    page_size: int
    total_pages: int


class DatasetScoredWithDetails(DatasetScoredRead):
    """Schéma pour un dataset avec son score et le détail des sous-scores par critère"""
    criterion_scores: Dict[str, float] = Field(default_factory=dict, description="Scores détaillés par critère pour la heatmap")


class ProjectRecommendationResponse(BaseModel):
    """Schéma pour la réponse des recommandations d'un projet"""
    project: ProjectRead
    datasets: List[DatasetScoredWithDetails]
    total_count: int


# === NOUVEAUX SCHÉMAS POUR LES ENDPOINTS DE DATASET DETAIL ===

class DataQualityAlert(BaseModel):
    """Schéma pour une alerte de qualité des données"""
    type: str = Field(..., description="Type d'alerte (error, warning, info)")
    title: str = Field(..., description="Titre de l'alerte")
    description: str = Field(..., description="Description de l'alerte")
    severity: int = Field(..., ge=1, le=10, description="Niveau de sévérité (1-10)")
    recommendation: str = Field(..., description="Recommandation pour résoudre le problème")


class DatasetQualityMetrics(BaseModel):
    """Schéma pour les métriques de qualité d'un dataset"""
    overall_score: float = Field(..., ge=0.0, le=1.0, description="Score global de qualité")
    completeness: float = Field(..., ge=0.0, le=1.0, description="Score de complétude")
    consistency: float = Field(..., ge=0.0, le=1.0, description="Score de consistance")
    accuracy: float = Field(..., ge=0.0, le=1.0, description="Score de précision")
    ethical_compliance: float = Field(..., ge=0.0, le=1.0, description="Score de conformité éthique")
    outliers_percentage: float = Field(..., ge=0.0, le=1.0, description="Pourcentage de valeurs aberrantes")
    pii_risk_score: float = Field(..., ge=0.0, le=1.0, description="Score de risque PII")


class ColumnMetadata(BaseModel):
    """Schéma pour les métadonnées d'une colonne"""
    column_name: str = Field(..., description="Nom de la colonne")
    position: int = Field(..., description="Position de la colonne")
    data_type_original: str = Field(..., description="Type de données original")
    data_type_interpreted: Optional[str] = Field(None, description="Type de données interprété")
    is_nullable: bool = Field(False, description="Colonne peut contenir des valeurs nulles")
    is_primary_key_component: bool = Field(False, description="Fait partie de la clé primaire")
    is_pii: bool = Field(False, description="Contient des données personnelles identifiables")
    description: Optional[str] = Field(None, description="Description de la colonne")
    example_values: Optional[List[str]] = Field(None, description="Exemples de valeurs")


class DatasetFileMetadata(BaseModel):
    """Schéma pour les métadonnées d'un fichier de dataset"""
    file_name_in_storage: str = Field(..., description="Nom du fichier dans le stockage")
    format: str = Field(..., description="Format du fichier (csv, json, parquet, etc.)")
    size_bytes: int = Field(..., description="Taille du fichier en bytes")
    row_count: int = Field(..., description="Nombre de lignes")
    description: Optional[str] = Field(None, description="Description du fichier")
    columns: List[ColumnMetadata] = Field(default_factory=list, description="Métadonnées des colonnes")


class FeatureCorrelation(BaseModel):
    """Schéma pour une corrélation entre features"""
    feature1: str = Field(..., description="Première feature")
    feature2: str = Field(..., description="Deuxième feature")
    correlation: float = Field(..., ge=-1.0, le=1.0, description="Coefficient de corrélation")
    correlation_type: str = Field(..., description="Type de corrélation (forte, moyenne, faible)")


class MissingDataPattern(BaseModel):
    """Schéma pour un pattern de données manquantes"""
    columns: List[str] = Field(..., description="Colonnes concernées")
    missing_count: int = Field(..., description="Nombre de lignes avec ce pattern")
    percentage: float = Field(..., ge=0.0, le=1.0, description="Pourcentage de lignes affectées")
    pattern_description: str = Field(..., description="Description du pattern")


class DataDistributionAnalysis(BaseModel):
    """Schéma pour l'analyse de distribution des données"""
    feature_correlations: List[FeatureCorrelation] = Field(default_factory=list, description="Corrélations entre features")
    missing_data_patterns: List[MissingDataPattern] = Field(default_factory=list, description="Patterns de données manquantes")
    class_distribution: Optional[Dict[str, int]] = Field(None, description="Distribution des classes (si applicable)")
    feature_importance: Optional[Dict[str, float]] = Field(None, description="Importance des features (si disponible)")


class ColumnStatistics(BaseModel):
    """Schéma pour les statistiques d'une colonne"""
    name: str = Field(..., description="Nom de la colonne")
    type: str = Field(..., description="Type de données")
    non_null_count: int = Field(..., description="Nombre de valeurs non-null")
    unique_count: Optional[int] = Field(None, description="Nombre de valeurs uniques")
    mean: Optional[float] = Field(None, description="Moyenne (pour colonnes numériques)")
    std: Optional[float] = Field(None, description="Écart-type (pour colonnes numériques)")
    min_value: Optional[str] = Field(None, description="Valeur minimale")
    max_value: Optional[str] = Field(None, description="Valeur maximale")
    top_values: Optional[List[str]] = Field(None, description="Valeurs les plus fréquentes")


class DatasetPreviewResponse(BaseModel):
    """Schéma pour l'aperçu des données d'un dataset"""
    file_name: str = Field(..., description="Nom du fichier prévisualisé")
    total_rows: int = Field(..., description="Nombre total de lignes")
    sample_data: List[Dict[str, Any]] = Field(..., description="Échantillon des données")
    columns_info: List[ColumnStatistics] = Field(..., description="Informations sur les colonnes")


class DatasetDetailResponse(BaseModel):
    """Schéma pour les détails complets d'un dataset"""
    # Informations de base du dataset
    id: UUID4
    dataset_name: str
    year: Optional[int]
    objective: Optional[str]
    access: Optional[str]
    availability: Optional[str]
    num_citations: Optional[int]
    sources: Optional[str]
    instances_number: Optional[int]
    features_number: Optional[int]
    domain: Optional[List[str]]
    task: Optional[List[str]]
    global_missing_percentage: Optional[float]
    
    # Métadonnées booléennes
    split: Optional[bool]
    has_missing_values: Optional[bool]
    temporal_factors: Optional[bool]
    metadata_provided_with_dataset: Optional[bool]
    anonymization_applied: Optional[bool]
    
    # Critères éthiques
    informed_consent: Optional[bool]
    transparency: Optional[bool]
    user_control: Optional[bool]
    equity_non_discrimination: Optional[bool]
    security_measures_in_place: Optional[bool]
    accountability_defined: Optional[bool]
    
    # Nouveaux champs pour les détails
    files: List[DatasetFileMetadata] = Field(default_factory=list, description="Métadonnées des fichiers")
    quality_metrics: DatasetQualityMetrics
    distribution_analysis: DataDistributionAnalysis
    
    # Timestamps
    created_at: datetime
    updated_at: datetime


class DatasetSimilarResponse(BaseModel):
    """Schéma pour les datasets similaires"""
    similar_datasets: List[DatasetRead] = Field(..., description="Liste des datasets similaires")
    similarity_explanation: Dict[str, str] = Field(default_factory=dict, description="Explication des similarités") 