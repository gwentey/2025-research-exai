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
    dataset_name: Optional[str] = Field(None, description="Filtrer par nom (recherche textuelle)")
    objective: Optional[str] = Field(None, description="Filtrer par objectif (recherche textuelle)")
    domain: Optional[List[str]] = Field(None, description="Filtrer par domaines")
    task: Optional[List[str]] = Field(None, description="Filtrer par tâches ML")
    access: Optional[str] = Field(None, description="Filtrer par type d'accès")
    availability: Optional[str] = Field(None, description="Filtrer par disponibilité")
    year_min: Optional[int] = Field(None, description="Année minimale")
    year_max: Optional[int] = Field(None, description="Année maximale")
    instances_min: Optional[int] = Field(None, description="Nombre minimum d'instances")
    instances_max: Optional[int] = Field(None, description="Nombre maximum d'instances")
    features_min: Optional[int] = Field(None, description="Nombre minimum de features")
    features_max: Optional[int] = Field(None, description="Nombre maximum de features")
    citations_min: Optional[int] = Field(None, description="Nombre minimum de citations")
    citations_max: Optional[int] = Field(None, description="Nombre maximum de citations")
    has_missing_values: Optional[bool] = Field(None, description="Présence de valeurs manquantes")
    split: Optional[bool] = Field(None, description="Dataset déjà splité")
    metadata_provided_with_dataset: Optional[bool] = Field(None, description="Métadonnées fournies")
    external_documentation_available: Optional[bool] = Field(None, description="Documentation externe disponible")
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