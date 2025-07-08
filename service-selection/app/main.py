from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from datetime import datetime
import math

# Approche hybride pour gérer les imports en local et dans Docker
try:
    # Imports relatifs pour le développement local
    from . import models
    from . import database
    from . import schemas
except ImportError:
    # Imports absolus pour le conteneur Docker
    import models
    import database
    import schemas
from fastapi.middleware.cors import CORSMiddleware

# --- Configuration de l'application FastAPI ---

app = FastAPI(
    title="Service de Sélection de Datasets EXAI",
    description="API pour la gestion des datasets avec métadonnées techniques et éthiques.",
    version="2.0.0"
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # À restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Utilitaires pour les requêtes ---

def apply_filters(query, filters: schemas.DatasetFilterCriteria):
    """
    Applique les filtres à une requête SQLAlchemy.
    Version complète supportant tous les filtres du frontend, y compris alias et raccourcis.
    """
    # --- FILTRES TEXTUELS ---
    if filters.dataset_name:
        query = query.filter(models.Dataset.dataset_name.ilike(f"%{filters.dataset_name}%"))
    
    if filters.objective:
        query = query.filter(models.Dataset.objective.ilike(f"%{filters.objective}%"))
    
    # --- FILTRES DE LISTES (domaines et tâches) ---
    if filters.domain:
        query = query.filter(models.Dataset.domain.op("&&")(filters.domain))
    
    if filters.task:
        query = query.filter(models.Dataset.task.op("&&")(filters.task))
    
    # --- FILTRES CATÉGORIELS ---
    if filters.access:
        query = query.filter(models.Dataset.access == filters.access)
    
    if filters.availability:
        query = query.filter(models.Dataset.availability == filters.availability)
    
    # --- FILTRES NUMÉRIQUES AVEC PLAGES ---
    # Année
    if filters.year_min:
        query = query.filter(models.Dataset.year >= filters.year_min)
    
    if filters.year_max:
        query = query.filter(models.Dataset.year <= filters.year_max)
    
    # Instances (avec alias frontend)
    instances_min = filters.instances_min or filters.instances_number_min
    instances_max = filters.instances_max or filters.instances_number_max
    
    if instances_min:
        query = query.filter(models.Dataset.instances_number >= instances_min)
    
    if instances_max:
        query = query.filter(models.Dataset.instances_number <= instances_max)
    
    # Features (avec alias frontend)
    features_min = filters.features_min or filters.features_number_min
    features_max = filters.features_max or filters.features_number_max
    
    if features_min:
        query = query.filter(models.Dataset.features_number >= features_min)
    
    if features_max:
        query = query.filter(models.Dataset.features_number <= features_max)
    
    # Citations
    if filters.citations_min:
        query = query.filter(models.Dataset.num_citations >= filters.citations_min)
    
    if filters.citations_max:
        query = query.filter(models.Dataset.num_citations <= filters.citations_max)
    
    # --- FILTRES DE SCORES ---
    if filters.ethical_score_min:
        # Filtre par score éthique calculé
        # Nous devons créer une sous-requête pour calculer le score
        from sqlalchemy import case, cast, Float
        
        # Calculer le score éthique comme pourcentage
        ethical_criteria = [
            models.Dataset.informed_consent,
            models.Dataset.transparency,
            models.Dataset.user_control,
            models.Dataset.equity_non_discrimination,
            models.Dataset.security_measures_in_place,
            models.Dataset.data_quality_documented,
            models.Dataset.anonymization_applied,
            models.Dataset.record_keeping_policy_exists,
            models.Dataset.purpose_limitation_respected,
            models.Dataset.accountability_defined
        ]
        
        # Somme des critères vrais
        true_count = sum(case([(criterion == True, 1)], else_=0) for criterion in ethical_criteria)
        total_criteria = len(ethical_criteria)
        ethical_score_percent = cast(true_count * 100.0 / total_criteria, Float)
        
        query = query.filter(ethical_score_percent >= filters.ethical_score_min)
    
    # --- FILTRES BOOLÉENS TECHNIQUES ---
    if filters.has_missing_values is not None:
        query = query.filter(models.Dataset.has_missing_values == filters.has_missing_values)
    
    # Split (avec alias)
    split_filter = filters.split if filters.split is not None else filters.is_split
    if split_filter is not None:
        query = query.filter(models.Dataset.split == split_filter)
    
    if filters.metadata_provided_with_dataset is not None:
        query = query.filter(models.Dataset.metadata_provided_with_dataset == filters.metadata_provided_with_dataset)
    
    if filters.external_documentation_available is not None:
        query = query.filter(models.Dataset.external_documentation_available == filters.external_documentation_available)
    
    # Facteurs temporels (avec alias)
    temporal_filter = filters.temporal_factors if filters.temporal_factors is not None else filters.has_temporal_factors
    if temporal_filter is not None:
        query = query.filter(models.Dataset.temporal_factors == temporal_filter)
    
    # --- FILTRES DE RACCOURCIS ---
    # Anonymisation (raccourci)
    if filters.is_anonymized is not None:
        query = query.filter(models.Dataset.anonymization_applied == filters.is_anonymized)
    
    # Accès public (raccourci)
    if filters.is_public is not None:
        if filters.is_public:
            query = query.filter(models.Dataset.access == 'public')
        else:
            query = query.filter(models.Dataset.access != 'public')
    
    # --- FILTRES BOOLÉENS ÉTHIQUES ---
    if filters.informed_consent is not None:
        query = query.filter(models.Dataset.informed_consent == filters.informed_consent)
    
    if filters.transparency is not None:
        query = query.filter(models.Dataset.transparency == filters.transparency)
    
    if filters.user_control is not None:
        query = query.filter(models.Dataset.user_control == filters.user_control)
    
    if filters.equity_non_discrimination is not None:
        query = query.filter(models.Dataset.equity_non_discrimination == filters.equity_non_discrimination)
    
    if filters.security_measures_in_place is not None:
        query = query.filter(models.Dataset.security_measures_in_place == filters.security_measures_in_place)
    
    if filters.data_quality_documented is not None:
        query = query.filter(models.Dataset.data_quality_documented == filters.data_quality_documented)
    
    if filters.anonymization_applied is not None:
        query = query.filter(models.Dataset.anonymization_applied == filters.anonymization_applied)
    
    if filters.record_keeping_policy_exists is not None:
        query = query.filter(models.Dataset.record_keeping_policy_exists == filters.record_keeping_policy_exists)
    
    if filters.purpose_limitation_respected is not None:
        query = query.filter(models.Dataset.purpose_limitation_respected == filters.purpose_limitation_respected)
    
    if filters.accountability_defined is not None:
        query = query.filter(models.Dataset.accountability_defined == filters.accountability_defined)
    
    return query


def apply_sorting(query, sort_by: str, sort_order: str):
    """Applique le tri à une requête SQLAlchemy."""
    # Mapping des noms de champs pour le tri
    sort_mapping = {
        "dataset_name": models.Dataset.dataset_name,
        "year": models.Dataset.year,
        "instances_number": models.Dataset.instances_number,
        "features_number": models.Dataset.features_number,
        "num_citations": models.Dataset.num_citations,
        "created_at": models.Dataset.created_at,
        "updated_at": models.Dataset.updated_at,
    }
    
    sort_field = sort_mapping.get(sort_by, models.Dataset.dataset_name)
    
    if sort_order.lower() == "desc":
        query = query.order_by(sort_field.desc())
    else:
        query = query.order_by(sort_field.asc())
    
    return query


# --- Routes de l'API ---

@app.get("/")
async def root():
    """Route racine simple pour vérifier que l'API est en ligne."""
    return {
        "message": "Bienvenue sur l'API du Service de Sélection de Datasets EXAI",
        "version": app.version,
        "documentation": ["/docs", "/redoc"]
    }

@app.get("/health")
async def health_check():
    """Vérification de la santé du service."""
    return {"status": "healthy", "service": "service-selection"}

@app.get("/datasets", response_model=schemas.DatasetListResponse)
def list_datasets(
    page: int = Query(1, ge=1, description="Numéro de page"),
    page_size: int = Query(12, ge=1, le=100, description="Nombre d'éléments par page"),
    sort_by: str = Query("dataset_name", description="Champ de tri"),
    sort_order: str = Query("asc", description="Ordre de tri (asc/desc)"),
    # Filtres textuels
    dataset_name: Optional[str] = Query(None, description="Filtrer par nom"),
    objective: Optional[str] = Query(None, description="Filtrer par objectif"),
    # Filtres de listes
    domain: Optional[str] = Query(None, description="Filtrer par domaine (séparés par virgule)"),
    task: Optional[str] = Query(None, description="Filtrer par tâche (séparés par virgule)"),
    # Filtres catégoriels
    access: Optional[str] = Query(None, description="Filtrer par accès"),
    availability: Optional[str] = Query(None, description="Filtrer par disponibilité"),
    # Filtres numériques avec plages
    year_min: Optional[int] = Query(None, description="Année minimale"),
    year_max: Optional[int] = Query(None, description="Année maximale"),
    instances_min: Optional[int] = Query(None, description="Nombre minimum d'instances"),
    instances_max: Optional[int] = Query(None, description="Nombre maximum d'instances"),
    # Alias frontend pour instances
    instances_number_min: Optional[int] = Query(None, description="Nombre minimum d'instances (alias)"),
    instances_number_max: Optional[int] = Query(None, description="Nombre maximum d'instances (alias)"),
    features_min: Optional[int] = Query(None, description="Nombre minimum de features"),
    features_max: Optional[int] = Query(None, description="Nombre maximum de features"),
    # Alias frontend pour features  
    features_number_min: Optional[int] = Query(None, description="Nombre minimum de features (alias)"),
    features_number_max: Optional[int] = Query(None, description="Nombre maximum de features (alias)"),
    citations_min: Optional[int] = Query(None, description="Nombre minimum de citations"),
    citations_max: Optional[int] = Query(None, description="Nombre maximum de citations"),
    # Filtres de scores
    ethical_score_min: Optional[int] = Query(None, ge=0, le=100, description="Score éthique minimum (0-100%)"),
    # Filtres booléens techniques
    has_missing_values: Optional[bool] = Query(None, description="Présence de valeurs manquantes"),
    split: Optional[bool] = Query(None, description="Dataset déjà splité"),
    is_split: Optional[bool] = Query(None, description="Dataset déjà splité (alias)"),
    metadata_provided_with_dataset: Optional[bool] = Query(None, description="Métadonnées fournies"),
    external_documentation_available: Optional[bool] = Query(None, description="Documentation externe disponible"),
    temporal_factors: Optional[bool] = Query(None, description="Facteurs temporels"),
    has_temporal_factors: Optional[bool] = Query(None, description="Facteurs temporels (alias)"),
    # Filtres de raccourcis
    is_anonymized: Optional[bool] = Query(None, description="Anonymisation appliquée (raccourci)"),
    is_public: Optional[bool] = Query(None, description="Accès public (raccourci)"),
    # Critères éthiques
    informed_consent: Optional[bool] = Query(None, description="Consentement éclairé"),
    transparency: Optional[bool] = Query(None, description="Transparence"),
    user_control: Optional[bool] = Query(None, description="Contrôle utilisateur"),
    equity_non_discrimination: Optional[bool] = Query(None, description="Équité et non-discrimination"),
    security_measures_in_place: Optional[bool] = Query(None, description="Mesures de sécurité"),
    data_quality_documented: Optional[bool] = Query(None, description="Qualité documentée"),
    anonymization_applied: Optional[bool] = Query(None, description="Anonymisation appliquée"),
    record_keeping_policy_exists: Optional[bool] = Query(None, description="Politique de conservation"),
    purpose_limitation_respected: Optional[bool] = Query(None, description="Limitation d'objectif"),
    accountability_defined: Optional[bool] = Query(None, description="Responsabilité définie"),
    db: Session = Depends(database.get_db)
):
    """Récupère une liste paginée et filtrée de datasets avec support complet des filtres frontend."""
    # Construire les filtres avec support des alias et raccourcis
    filters = schemas.DatasetFilterCriteria(
        # Filtres textuels
        dataset_name=dataset_name,
        objective=objective,
        # Filtres de listes
        domain=domain.split(",") if domain else None,
        task=task.split(",") if task else None,
        # Filtres catégoriels
        access=access,
        availability=availability,
        # Filtres numériques avec plages
        year_min=year_min,
        year_max=year_max,
        instances_min=instances_min,
        instances_max=instances_max,
        instances_number_min=instances_number_min,
        instances_number_max=instances_number_max,
        features_min=features_min,
        features_max=features_max,
        features_number_min=features_number_min,
        features_number_max=features_number_max,
        citations_min=citations_min,
        citations_max=citations_max,
        # Filtres de scores
        ethical_score_min=ethical_score_min,
        # Filtres booléens techniques
        has_missing_values=has_missing_values,
        split=split,
        is_split=is_split,
        metadata_provided_with_dataset=metadata_provided_with_dataset,
        external_documentation_available=external_documentation_available,
        temporal_factors=temporal_factors,
        has_temporal_factors=has_temporal_factors,
        # Filtres de raccourcis
        is_anonymized=is_anonymized,
        is_public=is_public,
        # Critères éthiques
        informed_consent=informed_consent,
        transparency=transparency,
        user_control=user_control,
        equity_non_discrimination=equity_non_discrimination,
        security_measures_in_place=security_measures_in_place,
        data_quality_documented=data_quality_documented,
        anonymization_applied=anonymization_applied,
        record_keeping_policy_exists=record_keeping_policy_exists,
        purpose_limitation_respected=purpose_limitation_respected,
        accountability_defined=accountability_defined,
    )
    
    # Construire la requête de base
    query = db.query(models.Dataset)
    
    # Appliquer les filtres
    query = apply_filters(query, filters)
    
    # Compter le total
    total_count = query.count()
    
    # Appliquer le tri
    query = apply_sorting(query, sort_by, sort_order)
    
    # Appliquer la pagination
    offset = (page - 1) * page_size
    datasets = query.offset(offset).limit(page_size).all()
    
    # Calculer le nombre total de pages
    total_pages = math.ceil(total_count / page_size)
    
    return schemas.DatasetListResponse(
        datasets=datasets,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

# Routes spécifiques AVANT la route générique pour éviter les conflits
@app.get("/datasets/domains", response_model=schemas.DomainResponse)
def get_domains(db: Session = Depends(database.get_db)):
    """Récupère la liste unique de tous les domaines d'application."""
    # Récupérer tous les domaines non-null
    domains_query = db.query(models.Dataset.domain).filter(models.Dataset.domain.isnot(None))
    
    # Extraire et aplatir la liste des domaines
    all_domains = set()
    for row in domains_query.all():
        if row.domain:
            all_domains.update(row.domain)
    
    # Trier les domaines
    sorted_domains = sorted(list(all_domains))
    
    return schemas.DomainResponse(domains=sorted_domains)

@app.get("/datasets/tasks", response_model=schemas.TaskResponse)
def get_tasks(db: Session = Depends(database.get_db)):
    """Récupère la liste unique de toutes les tâches ML."""
    # Récupérer toutes les tâches non-null
    tasks_query = db.query(models.Dataset.task).filter(models.Dataset.task.isnot(None))
    
    # Extraire et aplatir la liste des tâches
    all_tasks = set()
    for row in tasks_query.all():
        if row.task:
            all_tasks.update(row.task)
    
    # Trier les tâches
    sorted_tasks = sorted(list(all_tasks))
    
    return schemas.TaskResponse(tasks=sorted_tasks)

# Route générique APRÈS les routes spécifiques
@app.get("/datasets/{dataset_id}", response_model=schemas.DatasetRead)
def get_dataset(dataset_id: str, db: Session = Depends(database.get_db)):
    """Récupère les détails d'un dataset spécifique par son ID."""
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    return dataset

@app.post("/datasets", response_model=schemas.DatasetRead, status_code=201)
def create_dataset(dataset: schemas.DatasetCreate, db: Session = Depends(database.get_db)):
    """Crée un nouvel enregistrement de dataset dans la base de données."""
    # Créer une instance du modèle SQLAlchemy
    db_dataset = models.Dataset(**dataset.dict())
    
    # Ajouter à la session et sauvegarder
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    
    return db_dataset

@app.put("/datasets/{dataset_id}", response_model=schemas.DatasetRead)
def update_dataset(
    dataset_id: str,
    dataset_update: schemas.DatasetUpdate,
    db: Session = Depends(database.get_db)
):
    """Met à jour les informations d'un dataset existant."""
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if db_dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Mettre à jour les champs
    update_data = dataset_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_dataset, key, value)
    
    db.commit()
    db.refresh(db_dataset)
    
    return db_dataset

@app.delete("/datasets/{dataset_id}", status_code=200)
def delete_dataset(dataset_id: str, db: Session = Depends(database.get_db)):
    """Supprime un dataset de la base de données par son ID."""
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if db_dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    db.delete(db_dataset)
    db.commit()
    
    return {"message": f"Dataset avec l'ID {dataset_id} supprimé avec succès"}


# --- FONCTIONS UTILITAIRES POUR LE SCORING ---

def calculate_ethical_score(dataset: models.Dataset) -> float:
    """
    Calcule le score éthique d'un dataset basé sur les critères éthiques.
    
    Args:
        dataset: L'instance du dataset
    
    Returns:
        float: Score éthique entre 0.0 et 1.0
    """
    ethical_criteria = [
        dataset.informed_consent,
        dataset.transparency,
        dataset.user_control,
        dataset.equity_non_discrimination,
        dataset.security_measures_in_place,
        dataset.data_quality_documented,
        dataset.anonymization_applied,
        dataset.record_keeping_policy_exists,
        dataset.purpose_limitation_respected,
        dataset.accountability_defined
    ]
    
    # Compte les critères respectés (True)
    positive_count = sum(1 for criterion in ethical_criteria if criterion is True)
    total_criteria = len(ethical_criteria)
    
    return positive_count / total_criteria if total_criteria > 0 else 0.0


def calculate_technical_score(dataset: models.Dataset) -> float:
    """
    Calcule le score technique d'un dataset basé sur les caractéristiques techniques.
    
    Args:
        dataset: L'instance du dataset
    
    Returns:
        float: Score technique entre 0.0 et 1.0
    """
    score = 0.0
    max_score = 0.0
    
    # Documentation (poids: 0.3)
    if dataset.metadata_provided_with_dataset is not None:
        max_score += 0.15
        if dataset.metadata_provided_with_dataset:
            score += 0.15
    
    if dataset.external_documentation_available is not None:
        max_score += 0.15
        if dataset.external_documentation_available:
            score += 0.15
    
    # Qualité des données (poids: 0.4)
    if dataset.has_missing_values is not None:
        max_score += 0.2
        # Moins de valeurs manquantes = meilleur score
        if not dataset.has_missing_values:
            score += 0.2
        elif dataset.global_missing_percentage is not None:
            # Score dégressif selon le pourcentage de valeurs manquantes
            missing_score = max(0, (100 - dataset.global_missing_percentage) / 100)
            score += 0.2 * missing_score
    
    if dataset.split is not None:
        max_score += 0.2
        if dataset.split:
            score += 0.2
    
    # Taille et richesse (poids: 0.3)
    if dataset.instances_number is not None:
        max_score += 0.15
        # Score logarithmique pour le nombre d'instances
        if dataset.instances_number > 0:
            # Score max pour 100k+ instances, score min pour <100 instances
            log_instances = math.log10(max(1, dataset.instances_number))
            normalized_score = min(1.0, max(0.0, (log_instances - 2) / 3))  # log10(100) = 2, log10(100000) = 5
            score += 0.15 * normalized_score
    
    if dataset.features_number is not None:
        max_score += 0.15
        if dataset.features_number > 0:
            # Score optimal entre 10 et 100 features
            if 10 <= dataset.features_number <= 100:
                score += 0.15
            elif dataset.features_number > 100:
                # Score dégressif pour trop de features
                excess_score = max(0.5, 1 - (dataset.features_number - 100) / 1000)
                score += 0.15 * excess_score
            else:
                # Score progressif pour peu de features
                score += 0.15 * (dataset.features_number / 10)
    
    return score / max_score if max_score > 0 else 0.0


def calculate_popularity_score(dataset: models.Dataset) -> float:
    """
    Calcule le score de popularité d'un dataset basé sur les citations.
    
    Args:
        dataset: L'instance du dataset
    
    Returns:
        float: Score de popularité entre 0.0 et 1.0
    """
    if dataset.num_citations is None or dataset.num_citations <= 0:
        return 0.0
    
    # Score logarithmique pour les citations
    # Score max pour 1000+ citations, score min pour 1 citation
    log_citations = math.log10(dataset.num_citations)
    normalized_score = min(1.0, max(0.0, log_citations / 3))  # log10(1000) = 3
    
    return normalized_score


def calculate_relevance_score(dataset: models.Dataset, weights: List[schemas.CriterionWeight]) -> float:
    """
    Calcule le score de pertinence d'un dataset selon les critères pondérés.
    
    Args:
        dataset: L'instance du dataset
        weights: Liste des critères et leurs poids
    
    Returns:
        float: Score de pertinence entre 0.0 et 1.0
    """
    total_score = 0.0
    total_weight = 0.0
    
    # Dictionnaire des fonctions de calcul disponibles
    score_calculators = {
        'ethical_score': lambda: calculate_ethical_score(dataset),
        'technical_score': lambda: calculate_technical_score(dataset),
        'popularity_score': lambda: calculate_popularity_score(dataset),
        'anonymization': lambda: 1.0 if dataset.anonymization_applied else 0.0,
        'transparency': lambda: 1.0 if dataset.transparency else 0.0,
        'informed_consent': lambda: 1.0 if dataset.informed_consent else 0.0,
        'documentation': lambda: 1.0 if dataset.metadata_provided_with_dataset or dataset.external_documentation_available else 0.0,
        'data_quality': lambda: 1.0 if not dataset.has_missing_values else (
            (100 - (dataset.global_missing_percentage or 0)) / 100 if dataset.global_missing_percentage is not None else 0.5
        ),
        'instances_count': lambda: min(1.0, math.log10(max(1, dataset.instances_number or 1)) / 5) if dataset.instances_number else 0.0,
        'features_count': lambda: min(1.0, (dataset.features_number or 0) / 100) if dataset.features_number else 0.0,
        'citations': lambda: calculate_popularity_score(dataset),
        'year': lambda: min(1.0, max(0.0, ((dataset.year or 2000) - 2000) / 24)) if dataset.year else 0.0,  # Score basé sur la nouveauté (2000-2024)
    }
    
    for weight_item in weights:
        criterion_name = weight_item.criterion_name
        weight = weight_item.weight
        
        if criterion_name in score_calculators:
            criterion_score = score_calculators[criterion_name]()
            total_score += criterion_score * weight
            total_weight += weight
    
    # Si aucun poids n'est fourni, utiliser des poids par défaut équilibrés
    if total_weight == 0.0:
        default_weights = [
            schemas.CriterionWeight(criterion_name='ethical_score', weight=0.4),
            schemas.CriterionWeight(criterion_name='technical_score', weight=0.4),
            schemas.CriterionWeight(criterion_name='popularity_score', weight=0.2),
        ]
        return calculate_relevance_score(dataset, default_weights)
    
    return total_score / total_weight


def calculate_criterion_scores(dataset: models.Dataset) -> dict:
    """
    Calcule les scores détaillés par critère pour un dataset.
    Utilisé pour la visualisation heatmap dans l'interface utilisateur.
    
    Args:
        dataset: L'instance du dataset
    
    Returns:
        dict: Dictionnaire avec les scores par critère
    """
    return {
        'ethical_score': calculate_ethical_score(dataset),
        'technical_score': calculate_technical_score(dataset),
        'popularity_score': calculate_popularity_score(dataset),
        'anonymization': 1.0 if dataset.anonymization_applied else 0.0,
        'transparency': 1.0 if dataset.transparency else 0.0,
        'informed_consent': 1.0 if dataset.informed_consent else 0.0,
        'documentation': 1.0 if dataset.metadata_provided_with_dataset or dataset.external_documentation_available else 0.0,
        'data_quality': 1.0 if not dataset.has_missing_values else (
            (100 - (dataset.global_missing_percentage or 0)) / 100 if dataset.global_missing_percentage is not None else 0.5
        ),
        'instances_count': min(1.0, math.log10(max(1, dataset.instances_number or 1)) / 5) if dataset.instances_number else 0.0,
        'features_count': min(1.0, (dataset.features_number or 0) / 100) if dataset.features_number else 0.0,
        'citations': calculate_popularity_score(dataset),
        'year': min(1.0, max(0.0, ((dataset.year or 2000) - 2000) / 24)) if dataset.year else 0.0,
    }


# === ENDPOINTS POUR LES PROJETS ===

@app.get("/projects", response_model=schemas.ProjectListResponse)
def list_projects(
    page: int = Query(1, ge=1, description="Numéro de page"),
    page_size: int = Query(12, ge=1, le=100, description="Nombre d'éléments par page"),
    # TODO: Ajouter current_user: User = Depends(current_active_user) quand l'authentification sera configurée
    db: Session = Depends(database.get_db)
):
    """
    Liste les projets de l'utilisateur connecté avec pagination.
    """
    # TODO: Filtrer par user_id quand l'authentification sera disponible
    # user_id = current_user.id
    
    # Pour l'instant, récupérer tous les projets (à modifier avec l'authentification)
    offset = (page - 1) * page_size
    
    query = db.query(models.Project)
    total_count = query.count()
    projects = query.offset(offset).limit(page_size).all()
    
    total_pages = math.ceil(total_count / page_size)
    
    return schemas.ProjectListResponse(
        projects=projects,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@app.post("/projects", response_model=schemas.ProjectRead, status_code=201)
def create_project(
    project: schemas.ProjectCreate,
    # TODO: Ajouter current_user: User = Depends(current_active_user) quand l'authentification sera configurée
    db: Session = Depends(database.get_db)
):
    """
    Créer un nouveau projet.
    """
    # TODO: Utiliser current_user.id quand l'authentification sera disponible
    # user_id = current_user.id
    import uuid
    user_id = uuid.uuid4()  # Temporaire
    
    # Convertir les critères et poids en JSON pour stockage JSONB
    criteria_dict = project.criteria.dict() if project.criteria else None
    weights_dict = [weight.dict() for weight in project.weights] if project.weights else None
    
    db_project = models.Project(
        user_id=user_id,
        name=project.name,
        description=project.description,
        criteria=criteria_dict,
        weights=weights_dict
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return db_project


@app.get("/projects/{project_id}", response_model=schemas.ProjectRead)
def get_project(
    project_id: str,
    # TODO: Ajouter current_user: User = Depends(current_active_user) quand l'authentification sera configurée
    db: Session = Depends(database.get_db)
):
    """
    Récupérer un projet spécifique.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # TODO: Vérifier que le projet appartient à l'utilisateur connecté
    # if project.user_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="Accès non autorisé à ce projet")
    
    return project


@app.put("/projects/{project_id}", response_model=schemas.ProjectRead)
def update_project(
    project_id: str,
    project_update: schemas.ProjectUpdate,
    # TODO: Ajouter current_user: User = Depends(current_active_user) quand l'authentification sera configurée
    db: Session = Depends(database.get_db)
):
    """
    Mettre à jour un projet.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # TODO: Vérifier que le projet appartient à l'utilisateur connecté
    # if project.user_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="Accès non autorisé à ce projet")
    
    # Mettre à jour les champs modifiés
    update_data = project_update.dict(exclude_unset=True)
    
    # Convertir les critères et poids en JSON si fournis
    if 'criteria' in update_data and update_data['criteria']:
        update_data['criteria'] = update_data['criteria'].dict()
    
    if 'weights' in update_data and update_data['weights']:
        update_data['weights'] = [weight.dict() for weight in update_data['weights']]
    
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(project)
    
    return project


@app.delete("/projects/{project_id}", status_code=200)
def delete_project(
    project_id: str,
    # TODO: Ajouter current_user: User = Depends(current_active_user) quand l'authentification sera configurée
    db: Session = Depends(database.get_db)
):
    """
    Supprimer un projet.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # TODO: Vérifier que le projet appartient à l'utilisateur connecté
    # if project.user_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="Accès non autorisé à ce projet")
    
    db.delete(project)
    db.commit()
    
    return {"message": "Projet supprimé avec succès"}


@app.get("/projects/{project_id}/recommendations", response_model=schemas.ProjectRecommendationResponse)
def get_project_recommendations(
    project_id: str,
    # TODO: Ajouter current_user: User = Depends(current_active_user) quand l'authentification sera configurée
    db: Session = Depends(database.get_db)
):
    """
    Obtenir les datasets recommandés pour un projet avec leurs scores détaillés.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # TODO: Vérifier que le projet appartient à l'utilisateur connecté
    # if project.user_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="Accès non autorisé à ce projet")
    
    # 1. Construire la requête de base
    query = db.query(models.Dataset)
    
    # 2. Appliquer les filtres du projet si définis
    if project.criteria:
        # Convertir le dict JSON en objet DatasetFilterCriteria
        criteria = schemas.DatasetFilterCriteria(**project.criteria)
        query = apply_filters(query, criteria)
    
    # 3. Récupérer les datasets filtrés
    datasets = query.all()
    
    # 4. Préparer les poids pour le scoring
    weights = []
    if project.weights:
        weights = [schemas.CriterionWeight(**weight) for weight in project.weights]
    
    # 5. Calculer les scores pour chaque dataset
    scored_datasets = []
    for dataset in datasets:
        # Calculer le score de pertinence
        score = calculate_relevance_score(dataset, weights)
        
        # Calculer les scores détaillés par critère pour la heatmap
        criterion_scores = calculate_criterion_scores(dataset)
        
        # Créer une instance DatasetScoredWithDetails
        dataset_scored = schemas.DatasetScoredWithDetails(
            id=dataset.id,
            created_at=dataset.created_at,
            updated_at=dataset.updated_at,
            dataset_name=dataset.dataset_name,
            year=dataset.year,
            objective=dataset.objective,
            access=dataset.access,
            availability=dataset.availability,
            num_citations=dataset.num_citations,
            citation_link=dataset.citation_link,
            sources=dataset.sources,
            storage_uri=dataset.storage_uri,
            instances_number=dataset.instances_number,
            features_description=dataset.features_description,
            features_number=dataset.features_number,
            domain=dataset.domain,
            representativity_description=dataset.representativity_description,
            representativity_level=dataset.representativity_level,
            sample_balance_description=dataset.sample_balance_description,
            sample_balance_level=dataset.sample_balance_level,
            split=dataset.split,
            missing_values_description=dataset.missing_values_description,
            has_missing_values=dataset.has_missing_values,
            global_missing_percentage=dataset.global_missing_percentage,
            missing_values_handling_method=dataset.missing_values_handling_method,
            temporal_factors=dataset.temporal_factors,
            metadata_provided_with_dataset=dataset.metadata_provided_with_dataset,
            external_documentation_available=dataset.external_documentation_available,
            documentation_link=dataset.documentation_link,
            task=dataset.task,
            informed_consent=dataset.informed_consent,
            transparency=dataset.transparency,
            user_control=dataset.user_control,
            equity_non_discrimination=dataset.equity_non_discrimination,
            security_measures_in_place=dataset.security_measures_in_place,
            data_quality_documented=dataset.data_quality_documented,
            data_errors_description=dataset.data_errors_description,
            anonymization_applied=dataset.anonymization_applied,
            record_keeping_policy_exists=dataset.record_keeping_policy_exists,
            purpose_limitation_respected=dataset.purpose_limitation_respected,
            accountability_defined=dataset.accountability_defined,
            score=score,
            criterion_scores=criterion_scores
        )
        scored_datasets.append(dataset_scored)
    
    # 6. Trier par score décroissant
    scored_datasets.sort(key=lambda x: x.score, reverse=True)
    
    return schemas.ProjectRecommendationResponse(
        project=project,
        datasets=scored_datasets,
        total_count=len(scored_datasets)
    )


@app.post("/datasets/score", response_model=List[schemas.DatasetScoredRead])
def score_datasets(
    score_request: schemas.DatasetScoreRequest,
    db: Session = Depends(database.get_db)
):
    """
    Score et retourne les datasets selon les critères pondérés.
    
    Args:
        score_request: Critères de filtrage et poids pour le scoring
        db: Session de base de données
    
    Returns:
        List[DatasetScoredRead]: Liste des datasets scorés triés par score décroissant
    """
    # 1. Construire la requête de base
    query = db.query(models.Dataset)
    
    # 2. Appliquer les filtres si fournis
    if score_request.filters:
        query = apply_filters(query, score_request.filters)
    
    # 3. Récupérer les datasets filtrés
    datasets = query.all()
    
    # 4. Calculer les scores pour chaque dataset
    scored_datasets = []
    for dataset in datasets:
        score = calculate_relevance_score(dataset, score_request.weights)
        
        # Créer une instance DatasetScoredRead
        dataset_scored = schemas.DatasetScoredRead(
            id=dataset.id,
            created_at=dataset.created_at,
            updated_at=dataset.updated_at,
            dataset_name=dataset.dataset_name,
            year=dataset.year,
            objective=dataset.objective,
            access=dataset.access,
            availability=dataset.availability,
            num_citations=dataset.num_citations,
            citation_link=dataset.citation_link,
            sources=dataset.sources,
            storage_uri=dataset.storage_uri,
            instances_number=dataset.instances_number,
            features_description=dataset.features_description,
            features_number=dataset.features_number,
            domain=dataset.domain,
            representativity_description=dataset.representativity_description,
            representativity_level=dataset.representativity_level,
            sample_balance_description=dataset.sample_balance_description,
            sample_balance_level=dataset.sample_balance_level,
            split=dataset.split,
            missing_values_description=dataset.missing_values_description,
            has_missing_values=dataset.has_missing_values,
            global_missing_percentage=dataset.global_missing_percentage,
            missing_values_handling_method=dataset.missing_values_handling_method,
            temporal_factors=dataset.temporal_factors,
            metadata_provided_with_dataset=dataset.metadata_provided_with_dataset,
            external_documentation_available=dataset.external_documentation_available,
            documentation_link=dataset.documentation_link,
            task=dataset.task,
            informed_consent=dataset.informed_consent,
            transparency=dataset.transparency,
            user_control=dataset.user_control,
            equity_non_discrimination=dataset.equity_non_discrimination,
            security_measures_in_place=dataset.security_measures_in_place,
            data_quality_documented=dataset.data_quality_documented,
            data_errors_description=dataset.data_errors_description,
            anonymization_applied=dataset.anonymization_applied,
            record_keeping_policy_exists=dataset.record_keeping_policy_exists,
            purpose_limitation_respected=dataset.purpose_limitation_respected,
            accountability_defined=dataset.accountability_defined,
            score=score
        )
        scored_datasets.append(dataset_scored)
    
    # 5. Trier par score décroissant
    scored_datasets.sort(key=lambda x: x.score, reverse=True)
    
    return scored_datasets

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 