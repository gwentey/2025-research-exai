from pydantic import BaseModel, Field, UUID4
from typing import Optional, Dict, Any, List
from datetime import datetime

# =====================================================
# SCHÉMAS POUR DATASET (Table principale)
# =====================================================

class DatasetBase(BaseModel):
    """Schéma de base pour Dataset contenant les champs communs."""
    # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
    dataset_name: str = Field(..., min_length=1, max_length=255, description="Nom du dataset")
    year: Optional[int] = Field(None, ge=1900, le=2100, description="Année de création/publication")
    objective: Optional[str] = Field(None, description="Objectif et description du dataset")
    access: Optional[str] = Field(None, max_length=100, description="Niveau d'accès (public, privé, etc.)")
    availability: Optional[str] = Field(None, max_length=100, description="Disponibilité du dataset")
    num_citations: Optional[int] = Field(None, ge=0, description="Nombre de citations")
    citation_link: Optional[str] = Field(None, description="Lien vers les informations de citation")
    sources: Optional[str] = Field(None, description="Sources et origines du dataset")
    storage_uri: Optional[str] = Field(None, max_length=500, description="URI de stockage du dataset")
    
    # === CARACTÉRISTIQUES TECHNIQUES ===
    instances_number: Optional[int] = Field(None, ge=0, description="Nombre d'instances/lignes")
    features_description: Optional[str] = Field(None, description="Description des caractéristiques")
    features_number: Optional[int] = Field(None, ge=0, description="Nombre de caractéristiques/colonnes")
    domain: Optional[List[str]] = Field(None, description="Domaines d'application")
    representativity_description: Optional[str] = Field(None, description="Description de la représentativité")
    representativity_level: Optional[str] = Field(None, max_length=50, description="Niveau de représentativité")
    sample_balance_description: Optional[str] = Field(None, description="Description de l'équilibre des échantillons")
    sample_balance_level: Optional[str] = Field(None, max_length=50, description="Niveau d'équilibre des échantillons")
    split: Optional[bool] = Field(False, description="Dataset déjà divisé en train/test")
    missing_values_description: Optional[str] = Field(None, description="Description des valeurs manquantes")
    has_missing_values: Optional[bool] = Field(False, description="Présence de valeurs manquantes")
    global_missing_percentage: Optional[float] = Field(None, ge=0, le=100, description="Pourcentage global de valeurs manquantes")
    missing_values_handling_method: Optional[str] = Field(None, max_length=100, description="Méthode de traitement des valeurs manquantes")
    temporal_factors: Optional[bool] = Field(False, description="Présence de facteurs temporels")
    metadata_provided_with_dataset: Optional[bool] = Field(False, description="Métadonnées fournies avec le dataset")
    external_documentation_available: Optional[bool] = Field(False, description="Documentation externe disponible")
    documentation_link: Optional[str] = Field(None, description="Lien vers la documentation")
    task: Optional[List[str]] = Field(None, description="Types de tâches ML supportées")
    
    # === CRITÈRES ÉTHIQUES ===
    informed_consent: Optional[bool] = Field(False, description="Consentement éclairé obtenu")
    transparency: Optional[bool] = Field(False, description="Transparence des données")
    user_control: Optional[bool] = Field(False, description="Contrôle utilisateur")
    equity_non_discrimination: Optional[bool] = Field(False, description="Équité et non-discrimination")
    security_measures_in_place: Optional[bool] = Field(False, description="Mesures de sécurité en place")
    data_quality_documented: Optional[bool] = Field(False, description="Qualité des données documentée")
    data_errors_description: Optional[str] = Field(None, description="Description des erreurs de données")
    anonymization_applied: Optional[bool] = Field(False, description="Anonymisation appliquée")
    record_keeping_policy_exists: Optional[bool] = Field(False, description="Politique de conservation des données")
    purpose_limitation_respected: Optional[bool] = Field(False, description="Limitation d'usage respectée")
    accountability_defined: Optional[bool] = Field(False, description="Responsabilités définies")


class DatasetCreate(DatasetBase):
    """Schéma pour la création d'un nouveau dataset."""
    pass  # Hérite de tous les champs de DatasetBase


class DatasetUpdate(BaseModel):
    """Schéma pour la mise à jour d'un dataset (tous champs optionnels)."""
    # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
    dataset_name: Optional[str] = Field(None, min_length=1, max_length=255)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    objective: Optional[str] = None
    access: Optional[str] = Field(None, max_length=100)
    availability: Optional[str] = Field(None, max_length=100)
    num_citations: Optional[int] = Field(None, ge=0)
    citation_link: Optional[str] = None
    sources: Optional[str] = None
    storage_uri: Optional[str] = Field(None, max_length=500)
    
    # === CARACTÉRISTIQUES TECHNIQUES ===
    instances_number: Optional[int] = Field(None, ge=0)
    features_description: Optional[str] = None
    features_number: Optional[int] = Field(None, ge=0)
    domain: Optional[List[str]] = None
    representativity_description: Optional[str] = None
    representativity_level: Optional[str] = Field(None, max_length=50)
    sample_balance_description: Optional[str] = None
    sample_balance_level: Optional[str] = Field(None, max_length=50)
    split: Optional[bool] = None
    missing_values_description: Optional[str] = None
    has_missing_values: Optional[bool] = None
    global_missing_percentage: Optional[float] = Field(None, ge=0, le=100)
    missing_values_handling_method: Optional[str] = Field(None, max_length=100)
    temporal_factors: Optional[bool] = None
    metadata_provided_with_dataset: Optional[bool] = None
    external_documentation_available: Optional[bool] = None
    documentation_link: Optional[str] = None
    task: Optional[List[str]] = None
    
    # === CRITÈRES ÉTHIQUES ===
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


class DatasetRead(DatasetBase):
    """Schéma pour la lecture d'un dataset (inclut les champs générés)."""
    id: UUID4 = Field(..., description="Identifiant unique UUID du dataset")
    created_at: datetime = Field(..., description="Date de création")
    updated_at: datetime = Field(..., description="Date de dernière modification")
    
    class Config:
        from_attributes = True  # Pour SQLAlchemy v2


# =====================================================
# SCHÉMAS POUR DATASET_FILE
# =====================================================

class DatasetFileBase(BaseModel):
    """Schéma de base pour DatasetFile."""
    file_name_in_storage: str = Field(..., min_length=1, max_length=255, description="Nom du fichier en stockage")
    logical_role: Optional[str] = Field(None, max_length=255, description="Rôle logique (training_data, test_data, etc.)")
    format: Optional[str] = Field(None, max_length=50, description="Format du fichier (csv, json, etc.)")
    mime_type: Optional[str] = Field(None, max_length=100, description="Type MIME")
    size_bytes: Optional[int] = Field(None, ge=0, description="Taille en octets")
    row_count: Optional[int] = Field(None, ge=0, description="Nombre de lignes")
    description: Optional[str] = Field(None, description="Description du fichier")


class DatasetFileCreate(DatasetFileBase):
    """Schéma pour la création d'un fichier de dataset."""
    dataset_id: UUID4 = Field(..., description="ID du dataset parent")


class DatasetFileUpdate(BaseModel):
    """Schéma pour la mise à jour d'un fichier de dataset."""
    file_name_in_storage: Optional[str] = Field(None, min_length=1, max_length=255)
    logical_role: Optional[str] = Field(None, max_length=255)
    format: Optional[str] = Field(None, max_length=50)
    mime_type: Optional[str] = Field(None, max_length=100)
    size_bytes: Optional[int] = Field(None, ge=0)
    row_count: Optional[int] = Field(None, ge=0)
    description: Optional[str] = None


class DatasetFileRead(DatasetFileBase):
    """Schéma pour la lecture d'un fichier de dataset."""
    id: UUID4 = Field(..., description="Identifiant unique UUID du fichier")
    dataset_id: UUID4 = Field(..., description="ID du dataset parent")
    created_at: datetime = Field(..., description="Date de création")
    updated_at: datetime = Field(..., description="Date de dernière modification")
    
    class Config:
        from_attributes = True


# =====================================================
# SCHÉMAS POUR FILE_COLUMN
# =====================================================

class FileColumnBase(BaseModel):
    """Schéma de base pour FileColumn."""
    column_name: str = Field(..., min_length=1, max_length=255, description="Nom de la colonne")
    data_type_original: Optional[str] = Field(None, max_length=100, description="Type de données original")
    data_type_interpreted: Optional[str] = Field(None, max_length=50, description="Type de données interprété")
    description: Optional[str] = Field(None, description="Description de la colonne")
    is_primary_key_component: bool = Field(False, description="Fait partie de la clé primaire")
    is_nullable: bool = Field(True, description="Peut contenir des valeurs nulles")
    is_pii: bool = Field(False, description="Contient des informations personnelles")
    example_values: Optional[List[str]] = Field(None, description="Exemples de valeurs")
    position: int = Field(..., ge=0, description="Position dans le fichier")
    stats: Optional[Dict[str, Any]] = Field(None, description="Statistiques calculées")


class FileColumnCreate(FileColumnBase):
    """Schéma pour la création d'une colonne de fichier."""
    dataset_file_id: UUID4 = Field(..., description="ID du fichier parent")


class FileColumnUpdate(BaseModel):
    """Schéma pour la mise à jour d'une colonne de fichier."""
    column_name: Optional[str] = Field(None, min_length=1, max_length=255)
    data_type_original: Optional[str] = Field(None, max_length=100)
    data_type_interpreted: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_primary_key_component: Optional[bool] = None
    is_nullable: Optional[bool] = None
    is_pii: Optional[bool] = None
    example_values: Optional[List[str]] = None
    position: Optional[int] = Field(None, ge=0)
    stats: Optional[Dict[str, Any]] = None


class FileColumnRead(FileColumnBase):
    """Schéma pour la lecture d'une colonne de fichier."""
    id: UUID4 = Field(..., description="Identifiant unique UUID de la colonne")
    dataset_file_id: UUID4 = Field(..., description="ID du fichier parent")
    created_at: datetime = Field(..., description="Date de création")
    updated_at: datetime = Field(..., description="Date de dernière modification")
    
    class Config:
        from_attributes = True


# =====================================================
# SCHÉMAS POUR DATASET_RELATIONSHIP
# =====================================================

class DatasetRelationshipBase(BaseModel):
    """Schéma de base pour DatasetRelationship."""
    relationship_type: str = Field(..., min_length=1, max_length=50, description="Type de relation")
    description: Optional[str] = Field(None, description="Description de la relation")


class DatasetRelationshipCreate(DatasetRelationshipBase):
    """Schéma pour la création d'une relation entre datasets."""
    dataset_id: UUID4 = Field(..., description="ID du dataset")
    from_file_id: UUID4 = Field(..., description="ID du fichier source")
    to_file_id: UUID4 = Field(..., description="ID du fichier cible")


class DatasetRelationshipUpdate(BaseModel):
    """Schéma pour la mise à jour d'une relation."""
    relationship_type: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None


class DatasetRelationshipRead(DatasetRelationshipBase):
    """Schéma pour la lecture d'une relation."""
    id: UUID4 = Field(..., description="Identifiant unique UUID de la relation")
    dataset_id: UUID4 = Field(..., description="ID du dataset")
    from_file_id: UUID4 = Field(..., description="ID du fichier source")
    to_file_id: UUID4 = Field(..., description="ID du fichier cible")
    created_at: datetime = Field(..., description="Date de création")
    updated_at: datetime = Field(..., description="Date de dernière modification")
    
    class Config:
        from_attributes = True


# =====================================================
# SCHÉMAS POUR DATASET_RELATIONSHIP_COLUMN_LINK
# =====================================================

class DatasetRelationshipColumnLinkBase(BaseModel):
    """Schéma de base pour DatasetRelationshipColumnLink."""
    link_order: int = Field(1, ge=1, description="Ordre du lien dans la relation")


class DatasetRelationshipColumnLinkCreate(DatasetRelationshipColumnLinkBase):
    """Schéma pour la création d'un lien entre colonnes."""
    relationship_id: UUID4 = Field(..., description="ID de la relation")
    from_column_id: UUID4 = Field(..., description="ID de la colonne source")
    to_column_id: UUID4 = Field(..., description="ID de la colonne cible")


class DatasetRelationshipColumnLinkUpdate(BaseModel):
    """Schéma pour la mise à jour d'un lien entre colonnes."""
    link_order: Optional[int] = Field(None, ge=1)


class DatasetRelationshipColumnLinkRead(DatasetRelationshipColumnLinkBase):
    """Schéma pour la lecture d'un lien entre colonnes."""
    id: UUID4 = Field(..., description="Identifiant unique UUID du lien")
    relationship_id: UUID4 = Field(..., description="ID de la relation")
    from_column_id: UUID4 = Field(..., description="ID de la colonne source")
    to_column_id: UUID4 = Field(..., description="ID de la colonne cible")
    
    class Config:
        from_attributes = True


# =====================================================
# SCHÉMAS COMPOSÉS ET UTILITAIRES
# =====================================================

class DatasetWithFiles(DatasetRead):
    """Schéma Dataset avec ses fichiers associés."""
    files: List[DatasetFileRead] = Field(default_factory=list, description="Fichiers associés")


class DatasetFileWithColumns(DatasetFileRead):
    """Schéma DatasetFile avec ses colonnes associées."""
    columns: List[FileColumnRead] = Field(default_factory=list, description="Colonnes du fichier")


class DatasetComplete(DatasetRead):
    """Schéma Dataset complet avec fichiers et colonnes."""
    files: List[DatasetFileWithColumns] = Field(default_factory=list, description="Fichiers avec leurs colonnes")


# =====================================================
# SCHÉMAS POUR FILTRAGE ET RECHERCHE
# =====================================================

class DatasetFilterCriteria(BaseModel):
    """Critères de filtrage pour la recherche de datasets."""
    # Filtres textuels (recherche par similarité)
    dataset_name: Optional[str] = Field(None, description="Filtrer par nom (recherche partielle)")
    objective: Optional[str] = Field(None, description="Filtrer par objectif (recherche partielle)")
    domain: Optional[List[str]] = Field(None, description="Filtrer par domaines")
    task: Optional[List[str]] = Field(None, description="Filtrer par types de tâches")
    
    # Filtres numériques
    instances_number_min: Optional[int] = Field(None, ge=0, description="Nombre minimum d'instances")
    instances_number_max: Optional[int] = Field(None, ge=0, description="Nombre maximum d'instances")
    features_number_min: Optional[int] = Field(None, ge=0, description="Nombre minimum de features")
    features_number_max: Optional[int] = Field(None, ge=0, description="Nombre maximum de features")
    year_min: Optional[int] = Field(None, ge=1900, description="Année minimum")
    year_max: Optional[int] = Field(None, le=2100, description="Année maximum")
    
    # Filtres booléens
    has_missing_values: Optional[bool] = Field(None, description="Filtrer par présence de valeurs manquantes")
    split: Optional[bool] = Field(None, description="Filtrer par datasets déjà divisés")
    anonymization_applied: Optional[bool] = Field(None, description="Filtrer par anonymisation")
    informed_consent: Optional[bool] = Field(None, description="Filtrer par consentement éclairé")
    transparency: Optional[bool] = Field(None, description="Filtrer par transparence")


class CriterionWeight(BaseModel):
    """Poids d'un critère pour le scoring."""
    criterion_name: str = Field(..., description="Nom du critère")
    weight: float = Field(..., ge=0, description="Poids du critère (>=0)")


class DatasetScoreRequest(BaseModel):
    """Requête de scoring des datasets."""
    filters: DatasetFilterCriteria = Field(default_factory=DatasetFilterCriteria, description="Critères de filtrage")
    weights: List[CriterionWeight] = Field(..., min_items=1, description="Poids des critères")


class DatasetScoredRead(DatasetRead):
    """Dataset avec son score calculé."""
    score: float = Field(..., description="Score calculé selon les critères") 