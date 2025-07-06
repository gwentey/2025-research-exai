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
    """Applique les filtres à une requête SQLAlchemy."""
    if filters.dataset_name:
        query = query.filter(models.Dataset.dataset_name.ilike(f"%{filters.dataset_name}%"))
    
    if filters.objective:
        query = query.filter(models.Dataset.objective.ilike(f"%{filters.objective}%"))
    
    if filters.domain:
        query = query.filter(models.Dataset.domain.op("&&")(filters.domain))
    
    if filters.task:
        query = query.filter(models.Dataset.task.op("&&")(filters.task))
    
    if filters.access:
        query = query.filter(models.Dataset.access == filters.access)
    
    if filters.availability:
        query = query.filter(models.Dataset.availability == filters.availability)
    
    if filters.year_min:
        query = query.filter(models.Dataset.year >= filters.year_min)
    
    if filters.year_max:
        query = query.filter(models.Dataset.year <= filters.year_max)
    
    if filters.instances_min:
        query = query.filter(models.Dataset.instances_number >= filters.instances_min)
    
    if filters.instances_max:
        query = query.filter(models.Dataset.instances_number <= filters.instances_max)
    
    if filters.features_min:
        query = query.filter(models.Dataset.features_number >= filters.features_min)
    
    if filters.features_max:
        query = query.filter(models.Dataset.features_number <= filters.features_max)
    
    if filters.citations_min:
        query = query.filter(models.Dataset.num_citations >= filters.citations_min)
    
    if filters.citations_max:
        query = query.filter(models.Dataset.num_citations <= filters.citations_max)
    
    if filters.has_missing_values is not None:
        query = query.filter(models.Dataset.has_missing_values == filters.has_missing_values)
    
    if filters.split is not None:
        query = query.filter(models.Dataset.split == filters.split)
    
    if filters.metadata_provided_with_dataset is not None:
        query = query.filter(models.Dataset.metadata_provided_with_dataset == filters.metadata_provided_with_dataset)
    
    if filters.external_documentation_available is not None:
        query = query.filter(models.Dataset.external_documentation_available == filters.external_documentation_available)
    
    # Critères éthiques
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
    # Filtres
    dataset_name: Optional[str] = Query(None, description="Filtrer par nom"),
    objective: Optional[str] = Query(None, description="Filtrer par objectif"),
    domain: Optional[str] = Query(None, description="Filtrer par domaine (séparés par virgule)"),
    task: Optional[str] = Query(None, description="Filtrer par tâche (séparés par virgule)"),
    access: Optional[str] = Query(None, description="Filtrer par accès"),
    availability: Optional[str] = Query(None, description="Filtrer par disponibilité"),
    year_min: Optional[int] = Query(None, description="Année minimale"),
    year_max: Optional[int] = Query(None, description="Année maximale"),
    instances_min: Optional[int] = Query(None, description="Nombre minimum d'instances"),
    instances_max: Optional[int] = Query(None, description="Nombre maximum d'instances"),
    features_min: Optional[int] = Query(None, description="Nombre minimum de features"),
    features_max: Optional[int] = Query(None, description="Nombre maximum de features"),
    citations_min: Optional[int] = Query(None, description="Nombre minimum de citations"),
    citations_max: Optional[int] = Query(None, description="Nombre maximum de citations"),
    has_missing_values: Optional[bool] = Query(None, description="Présence de valeurs manquantes"),
    split: Optional[bool] = Query(None, description="Dataset déjà splité"),
    metadata_provided_with_dataset: Optional[bool] = Query(None, description="Métadonnées fournies"),
    external_documentation_available: Optional[bool] = Query(None, description="Documentation externe disponible"),
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
    """Récupère une liste paginée et filtrée de datasets."""
    # Construire les filtres
    filters = schemas.DatasetFilterCriteria(
        dataset_name=dataset_name,
        objective=objective,
        domain=domain.split(",") if domain else None,
        task=task.split(",") if task else None,
        access=access,
        availability=availability,
        year_min=year_min,
        year_max=year_max,
        instances_min=instances_min,
        instances_max=instances_max,
        features_min=features_min,
        features_max=features_max,
        citations_min=citations_min,
        citations_max=citations_max,
        has_missing_values=has_missing_values,
        split=split,
        metadata_provided_with_dataset=metadata_provided_with_dataset,
        external_documentation_available=external_documentation_available,
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 