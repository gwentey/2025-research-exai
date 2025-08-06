from fastapi import FastAPI, Depends, HTTPException, Query, Header, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional, Dict
from datetime import datetime
import math
import logging
import uuid
import pandas as pd
import io
import json
from pydantic import UUID4

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Approche hybride pour gérer les imports en local et dans Docker
try:
    # Imports relatifs pour le développement local
    from . import models
    from . import database
    from . import schemas
    from . import auto_init
except ImportError:
    # Imports absolus pour le conteneur Docker
    import models
    import database
    import schemas
    import auto_init

# Import du client de stockage commun
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from common.storage_client import get_storage_client, StorageClientError
from fastapi.middleware.cors import CORSMiddleware

# --- Configuration de l'application FastAPI ---

app = FastAPI(
    title="Service de Sélection de Datasets IBIS-X",
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

# Event handler pour l'auto-initialisation au démarrage
@app.on_event("startup")
async def startup_event():
    """
    Event handler de démarrage - lance l'auto-initialisation des vrais datasets
    si la variable d'environnement AUTO_INIT_DATA=true.
    """
    logger.info("Démarrage de l'application Service Selection")
    await auto_init.auto_init_startup()

# --- Fonctions utilitaires pour le stockage ---

def convert_to_parquet(file_content: bytes, filename: str) -> bytes:
    """
    Convertit un fichier (CSV, Excel, JSON, XML) en format Parquet.
    
    Args:
        file_content: Contenu du fichier en bytes
        filename: Nom original du fichier
        
    Returns:
        Contenu du fichier Parquet en bytes
    """
    try:
        file_extension = filename.lower().split('.')[-1] if '.' in filename else 'csv'
        logger.info(f"Conversion vers Parquet : {filename} (format: {file_extension})")
        
        # Lecture selon le format du fichier
        if file_extension == 'csv':
            df = pd.read_csv(io.BytesIO(file_content))
        elif file_extension in ['xlsx', 'xls']:
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=0)  # Première feuille par défaut
        elif file_extension == 'json':
            # Essayer de lire comme JSON structuré
            json_data = json.loads(file_content.decode('utf-8'))
            if isinstance(json_data, list):
                df = pd.DataFrame(json_data)
            elif isinstance(json_data, dict):
                # Si c'est un dictionnaire, essayer de le transformer en DataFrame
                df = pd.DataFrame([json_data])
            else:
                raise ValueError("Format JSON non supporté - doit être un array ou un objet")
        elif file_extension == 'xml':
            # Support XML simple - peut être étendu selon les besoins
            import xml.etree.ElementTree as ET
            root = ET.fromstring(file_content.decode('utf-8'))
            # Conversion simple XML vers DataFrame (à améliorer selon structure)
            records = []
            for child in root:
                record = {subchild.tag: subchild.text for subchild in child}
                records.append(record)
            df = pd.DataFrame(records)
        elif file_extension == 'parquet':
            # Si c'est déjà un Parquet, on le retourne tel quel
            return file_content
        else:
            raise ValueError(f"Format de fichier non supporté: {file_extension}")
        
        # Validation de base
        if df.empty:
            raise ValueError("Le fichier est vide ou ne contient pas de données valides")
        
        # Convertir en Parquet
        parquet_buffer = io.BytesIO()
        df.to_parquet(parquet_buffer, index=False, compression='snappy')
        parquet_buffer.seek(0)
        
        original_size = len(file_content) / 1024  # KB
        parquet_size = len(parquet_buffer.getvalue()) / 1024  # KB
        compression_ratio = original_size / parquet_size if parquet_size > 0 else 1
        
        logger.info(f"Conversion réussie: {filename} ({original_size:.1f}KB → {parquet_size:.1f}KB, ratio: {compression_ratio:.1f}x)")
        
        return parquet_buffer.read()
        
    except Exception as e:
        logger.error(f"Erreur lors de la conversion {filename} vers Parquet: {str(e)}")
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible de convertir le fichier {filename} en Parquet: {str(e)}"
        )

def upload_dataset_files(dataset_id: str, files: List[UploadFile]) -> tuple[str, list]:
    """
    Upload les fichiers d'un dataset vers le stockage d'objets avec noms UUID.
    
    Args:
        dataset_id: UUID du dataset
        files: Liste des fichiers à uploader
        
    Returns:
        tuple: (storage_path_prefix, file_metadata_list)
            - storage_path: Préfixe du dossier de stockage (ex: 'ibis-x-datasets/uuid/')
            - file_metadata_list: Liste des métadonnées des fichiers uploadés
    """
    import uuid
    
    try:
        storage_client = get_storage_client()
        storage_path_prefix = f"ibis-x-datasets/{dataset_id}/"
        file_metadata_list = []
        
        for file in files:
            # Générer un UUID unique pour ce fichier
            file_uuid = str(uuid.uuid4())
            
            # Lire le contenu du fichier
            file_content = file.file.read()
            file.file.seek(0)  # Reset pour usage ultérieur si nécessaire
            
            # Déterminer l'extension et le format final
            original_filename = file.filename
            file_size = len(file_content)
            
            # Convertir en Parquet si c'est un CSV
            if file.filename.lower().endswith('.csv'):
                parquet_content = convert_to_parquet(file_content, file.filename)
                storage_filename = f"{file_uuid}.parquet"
                final_format = 'parquet'
                mime_type = 'application/octet-stream'
                final_content = parquet_content
                logger.info(f"Fichier converti: {original_filename} -> {storage_filename}")
            else:
                # Upload direct pour les autres formats
                file_extension = original_filename.split('.')[-1].lower() if '.' in original_filename else 'bin'
                storage_filename = f"{file_uuid}.{file_extension}"
                final_format = file_extension
                mime_type = file.content_type or 'application/octet-stream'
                final_content = file_content
                logger.info(f"Fichier préparé: {original_filename} -> {storage_filename}")
            
            # Upload vers MinIO avec le nom UUID
            object_path = f"{storage_path_prefix}{storage_filename}"
            storage_client.upload_file(final_content, object_path)
            
            # Ajouter les métadonnées pour la création en base
            file_metadata_list.append({
                'file_name_in_storage': storage_filename,
                'original_filename': original_filename,
                'format': final_format,
                'mime_type': mime_type,
                'size_bytes': file_size,
                'logical_role': 'data_file'  # Rôle par défaut
            })
            
            logger.info(f"Fichier uploadé avec succès: {original_filename} -> {storage_filename}")
        
        return storage_path_prefix, file_metadata_list
        
    except StorageClientError as e:
        logger.error(f"Erreur de stockage pour dataset {dataset_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Erreur lors de l'upload des fichiers: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Erreur inattendue lors de l'upload pour dataset {dataset_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Erreur inattendue lors de l'upload: {str(e)}"
        )

def cleanup_dataset_storage(storage_path: str):
    """
    Nettoie les fichiers de stockage d'un dataset.
    
    Args:
        storage_path: Préfixe du dossier de stockage à nettoyer
    """
    try:
        storage_client = get_storage_client()
        
        # Lister et supprimer tous les fichiers dans le préfixe
        files = storage_client.list_files(prefix=storage_path)
        for file_path in files:
            success = storage_client.delete_file(file_path)
            if success:
                logger.info(f"Fichier de stockage supprimé: {file_path}")
            else:
                logger.warning(f"Échec de suppression du fichier: {file_path}")
                
    except StorageClientError as e:
        logger.error(f"Erreur lors du nettoyage du stockage {storage_path}: {str(e)}")
        # Ne pas lever d'exception ici car la suppression en BDD est prioritaire
    except Exception as e:
        logger.error(f"Erreur inattendue lors du nettoyage {storage_path}: {str(e)}")

# --- Authentification via headers ---

def get_current_user_id(x_user_id: str = Header(..., alias="X-User-ID")) -> UUID4:
    """
    Extrait l'ID de l'utilisateur connecté depuis les headers envoyés par l'API Gateway.
    """
    try:
        user_id = uuid.UUID(x_user_id)
        return user_id
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="ID utilisateur invalide dans les headers"
        )


def get_current_user_role(x_user_role: str = Header(..., alias="X-User-Role")) -> str:
    """
    Extrait le rôle de l'utilisateur connecté depuis les headers envoyés par l'API Gateway.
    """
    allowed_roles = ['admin', 'contributor', 'user']
    if x_user_role not in allowed_roles:
        raise HTTPException(
            status_code=401,
            detail="Rôle utilisateur invalide dans les headers"
        )
    return x_user_role


def verify_upload_permissions(user_role: str = Depends(get_current_user_role)) -> str:
    """
    Vérifie que l'utilisateur a les permissions pour uploader des datasets.
    Seuls les admin et contributeurs peuvent uploader.
    """
    if user_role not in ['admin', 'contributor']:
        raise HTTPException(
            status_code=403,
            detail="Accès refusé. Seuls les administrateurs et contributeurs peuvent ajouter des datasets."
        )
    return user_role

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
    # Logique AND : le dataset doit contenir TOUS les domaines sélectionnés
    if filters.domain:
        query = query.filter(models.Dataset.domain.op("@>")(filters.domain))
    
    # Logique AND : le dataset doit contenir TOUTES les tâches sélectionnées
    if filters.task:
        query = query.filter(models.Dataset.task.op("@>")(filters.task))
    
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
        
        # Créer l'expression SQLAlchemy pour calculer le score
        # Additionner tous les critères vrais avec la syntaxe SQLAlchemy correcte
        true_count_expr = (
            case((models.Dataset.informed_consent == True, 1), else_=0) +
            case((models.Dataset.transparency == True, 1), else_=0) +
            case((models.Dataset.user_control == True, 1), else_=0) +
            case((models.Dataset.equity_non_discrimination == True, 1), else_=0) +
            case((models.Dataset.security_measures_in_place == True, 1), else_=0) +
            case((models.Dataset.data_quality_documented == True, 1), else_=0) +
            case((models.Dataset.anonymization_applied == True, 1), else_=0) +
            case((models.Dataset.record_keeping_policy_exists == True, 1), else_=0) +
            case((models.Dataset.purpose_limitation_respected == True, 1), else_=0) +
            case((models.Dataset.accountability_defined == True, 1), else_=0)
        )
        
        total_criteria = len(ethical_criteria)
        ethical_score_percent = cast(true_count_expr * 100.0 / total_criteria, Float)
        
        query = query.filter(ethical_score_percent >= filters.ethical_score_min)
    
    # --- FILTRES BOOLÉENS TECHNIQUES ---
    if filters.has_missing_values is not None:
        query = query.filter(models.Dataset.has_missing_values == filters.has_missing_values)
    
    # Split (avec alias) - Filtre SEULEMENT si True
    split_filter = filters.split if filters.split is not None else filters.is_split
    if split_filter is True:
        query = query.filter(models.Dataset.split == True)
    
    if filters.metadata_provided_with_dataset is True:
        query = query.filter(models.Dataset.metadata_provided_with_dataset == True)
    
    if filters.external_documentation_available is True:
        query = query.filter(models.Dataset.external_documentation_available == True)
    
    # Facteurs temporels (avec alias) - Filtre SEULEMENT si True
    temporal_filter = filters.temporal_factors if filters.temporal_factors is not None else filters.has_temporal_factors
    if temporal_filter is True:
        query = query.filter(models.Dataset.temporal_factors == True)
    
    # --- FILTRES DE RACCOURCIS ---
    # Anonymisation (raccourci) - Filtre SEULEMENT si True
    if filters.is_anonymized is True:
        query = query.filter(models.Dataset.anonymization_applied == True)
    
    # Accès public (raccourci) - Filtre SEULEMENT si True
    if filters.is_public is True:
        query = query.filter(models.Dataset.access == 'public')
    
    # --- FILTRES BOOLÉENS ÉTHIQUES - Filtre SEULEMENT si True ---
    if filters.informed_consent is True:
        query = query.filter(models.Dataset.informed_consent == True)
    
    if filters.transparency is True:
        query = query.filter(models.Dataset.transparency == True)
    
    if filters.user_control is True:
        query = query.filter(models.Dataset.user_control == True)
    
    if filters.equity_non_discrimination is True:
        query = query.filter(models.Dataset.equity_non_discrimination == True)
    
    if filters.security_measures_in_place is True:
        query = query.filter(models.Dataset.security_measures_in_place == True)
    
    if filters.data_quality_documented is True:
        query = query.filter(models.Dataset.data_quality_documented == True)
    
    if filters.anonymization_applied is True:
        query = query.filter(models.Dataset.anonymization_applied == True)
    
    if filters.record_keeping_policy_exists is True:
        query = query.filter(models.Dataset.record_keeping_policy_exists == True)
    
    if filters.purpose_limitation_respected is True:
        query = query.filter(models.Dataset.purpose_limitation_respected == True)
    
    if filters.accountability_defined is True:
        query = query.filter(models.Dataset.accountability_defined == True)
    
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
        "message": "Bienvenue sur l'API du Service de Sélection de Datasets IBIS-X",
        "version": app.version,
        "documentation": ["/docs", "/redoc"]
    }

@app.get("/health")
async def health_check():
    """Endpoint de vérification de santé du service."""
    return {"status": "healthy", "service": "service-selection"}

@app.get("/debug/datasets-count")
async def debug_datasets_count():
    """
    ENDPOINT TEMPORAIRE - Retourne le nombre total de datasets
    À SUPPRIMER en production !
    """
    try:
        session = next(database.get_db())
        datasets = session.query(models.Dataset).all()
        
        # Compter par nom unique pour détecter les doublons
        unique_names = set()
        dataset_details = []
        
        for dataset in datasets:
            unique_names.add(dataset.dataset_name)
            dataset_details.append({
                "id": dataset.id,
                "name": dataset.dataset_name,
                "instances": dataset.instances_number,
                "storage_path": dataset.storage_path
            })
        
        return {
            "total_datasets": len(datasets),
            "unique_dataset_names": len(unique_names),
            "status": "✅ OK" if len(datasets) <= 10 else f"⚠️  TROP DE DOUBLONS ({len(datasets)})",
            "datasets": dataset_details
        }
        
    except Exception as e:
        logger.error(f"Erreur lors du debug datasets: {e}")
        return {
            "error": str(e),
            "total_datasets": "unknown"
        }

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
@app.get("/datasets/{dataset_id}", response_model=schemas.DatasetWithFiles)
def get_dataset(dataset_id: str, db: Session = Depends(database.get_db)):
    """Récupère les détails d'un dataset spécifique par son ID avec storage_path et files."""
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Récupérer les fichiers associés au dataset
    files = db.query(models.DatasetFile).filter(models.DatasetFile.dataset_id == dataset_id).all()
    
    # Convertir les fichiers au format attendu
    files_metadata = []
    for file in files:
        files_metadata.append(schemas.DatasetFileMetadata(
            file_name_in_storage=file.file_name_in_storage,
            original_filename=file.original_filename or file.file_name_in_storage,
            format=file.format,
            size_bytes=file.size_bytes or 0,
            row_count=file.row_count or 0,
            description=file.description,
            columns=[]  # Les colonnes peuvent être ajoutées plus tard si nécessaire
        ))
    
    # Construire la réponse avec storage_path et files
    return schemas.DatasetWithFiles(
        id=dataset.id,
        dataset_name=dataset.dataset_name,
        year=dataset.year,
        objective=dataset.objective,
        access=dataset.access,
        availability=dataset.availability,
        num_citations=dataset.num_citations,
        citation_link=dataset.citation_link,
        sources=dataset.sources,
        storage_uri=dataset.storage_uri,
        storage_path=dataset.storage_path,
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
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
        files=files_metadata
    )


@app.get("/datasets/{dataset_id}/details", response_model=schemas.DatasetDetailResponse)
def get_dataset_details(dataset_id: str, db: Session = Depends(database.get_db)):
    """Récupère les détails complets d'un dataset avec métriques de qualité et métadonnées enrichies."""
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Générer les métriques de qualité
    quality_metrics = generate_quality_metrics(dataset)
    
    # Générer l'analyse de distribution
    distribution_analysis = generate_distribution_analysis(dataset)
    
    # Générer les métadonnées des fichiers
    files_metadata = generate_files_metadata(dataset, db)
    
    return schemas.DatasetDetailResponse(
        id=dataset.id,
        dataset_name=dataset.dataset_name,
        display_name=dataset.display_name,
        year=dataset.year,
        objective=dataset.objective,
        access=dataset.access,
        availability=dataset.availability,
        num_citations=dataset.num_citations,
        sources=dataset.sources,
        instances_number=dataset.instances_number,
        features_number=dataset.features_number,
        domain=dataset.domain,
        task=dataset.task,
        global_missing_percentage=dataset.global_missing_percentage,
        split=dataset.split,
        has_missing_values=dataset.has_missing_values,
        temporal_factors=dataset.temporal_factors,
        metadata_provided_with_dataset=dataset.metadata_provided_with_dataset,
        anonymization_applied=dataset.anonymization_applied,
        informed_consent=dataset.informed_consent,
        transparency=dataset.transparency,
        user_control=dataset.user_control,
        equity_non_discrimination=dataset.equity_non_discrimination,
        security_measures_in_place=dataset.security_measures_in_place,
        accountability_defined=dataset.accountability_defined,
        files=files_metadata,
        quality_metrics=quality_metrics,
        distribution_analysis=distribution_analysis,
        created_at=dataset.created_at,
        updated_at=dataset.updated_at
    )


@app.get("/datasets/{dataset_id}/preview", response_model=schemas.DatasetPreviewResponse)
def get_dataset_preview(dataset_id: str, db: Session = Depends(database.get_db)):
    """Récupère un aperçu des données d'un dataset avec échantillon et statistiques des colonnes."""
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Générer l'aperçu des données depuis MinIO
    preview_data = generate_dataset_preview(dataset, db)
    
    return preview_data


@app.get("/datasets/{dataset_id}/similar", response_model=schemas.DatasetSimilarResponse)
def get_similar_datasets(dataset_id: str, limit: int = 5, db: Session = Depends(database.get_db)):
    """Récupère une liste de datasets similaires au dataset spécifié."""
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Trouver des datasets similaires basés sur le domaine et les tâches
    similar_datasets = find_similar_datasets(dataset, db, limit)
    
    # Générer les explications de similarité
    similarity_explanation = {}
    for similar in similar_datasets:
        explanation_parts = []
        
        # Similarité par domaine
        if dataset.domain and similar.domain:
            common_domains = set(dataset.domain) & set(similar.domain)
            if common_domains:
                explanation_parts.append(f"Domaines communs: {', '.join(common_domains)}")
        
        # Similarité par tâches
        if dataset.task and similar.task:
            common_tasks = set(dataset.task) & set(similar.task)
            if common_tasks:
                explanation_parts.append(f"Tâches communes: {', '.join(common_tasks)}")
        
        # Similarité par taille
        if dataset.instances_number and similar.instances_number:
            ratio = min(dataset.instances_number, similar.instances_number) / max(dataset.instances_number, similar.instances_number)
            if ratio > 0.5:
                explanation_parts.append("Taille similaire")
        
        similarity_explanation[str(similar.id)] = " • ".join(explanation_parts) if explanation_parts else "Caractéristiques générales similaires"
    
    return schemas.DatasetSimilarResponse(
        similar_datasets=similar_datasets,
        similarity_explanation=similarity_explanation
    )

@app.post("/datasets/preview", response_model=dict)
def preview_dataset_files(
    files: List[UploadFile] = File(...),
    db: Session = Depends(database.get_db),
    current_user_role: str = Depends(verify_upload_permissions)
):
    """
    Analyse les fichiers uploadés sans les sauvegarder.
    Retourne les métadonnées extraites, suggestions et prévisualisation des données.
    """
    logger.info(f"[PREVIEW] Début de l'analyse de {len(files)} fichiers pour l'utilisateur avec rôle: {current_user_role}")
    
    # Log détaillé des fichiers reçus
    for i, file in enumerate(files):
        logger.info(f"[PREVIEW] Fichier {i+1}: {file.filename} ({file.content_type})")
    
    try:
        preview_results = []
        total_rows = 0
        total_size = 0
        detected_domains = set()
        detected_tasks = set()
        
        for file in files:
            # Lire le contenu du fichier
            file_content = file.file.read()
            file.file.seek(0)  # Reset pour usage ultérieur si nécessaire
            
            file_size = len(file_content)
            total_size += file_size
            
            # Analyser le fichier
            try:
                # Tenter la conversion pour analyser la structure
                if file.filename.lower().endswith('.csv'):
                    df = pd.read_csv(io.BytesIO(file_content))
                elif file.filename.lower().endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(io.BytesIO(file_content), sheet_name=0)
                elif file.filename.lower().endswith('.json'):
                    json_data = json.loads(file_content.decode('utf-8'))
                    if isinstance(json_data, list):
                        df = pd.DataFrame(json_data)
                    elif isinstance(json_data, dict):
                        df = pd.DataFrame([json_data])
                    else:
                        raise ValueError("Format JSON non supporté")
                else:
                    # Pour les autres formats, on va juste indiquer qu'ils sont supportés
                    df = None
                
                if df is not None:
                    # Analyser les colonnes
                    columns_analysis = []
                    for idx, col_name in enumerate(df.columns):
                        col_data = df[col_name]
                        col_type = _interpret_column_type(col_data)
                        
                        # Suggestions de domaine basées sur les noms de colonnes
                        if any(keyword in col_name.lower() for keyword in ['score', 'grade', 'performance', 'achievement']):
                            detected_domains.add('education')
                        elif any(keyword in col_name.lower() for keyword in ['price', 'cost', 'revenue', 'profit']):
                            detected_domains.add('finance')
                        elif any(keyword in col_name.lower() for keyword in ['age', 'gender', 'health', 'medical']):
                            detected_domains.add('healthcare')
                        
                        # Suggestions de tâche ML
                        if col_name.lower() in ['target', 'label', 'class', 'outcome', 'result']:
                            if col_type in ['categorical']:
                                detected_tasks.add('classification')
                            elif col_type in ['numerical_integer', 'numerical_float']:
                                detected_tasks.add('regression')
                        
                        columns_analysis.append({
                            'column_name': col_name,
                            'position': idx,
                            'data_type_interpreted': col_type,
                            'is_nullable': bool(col_data.isnull().any().item()),
                            'unique_values': int(col_data.nunique().item()) if hasattr(col_data.nunique(), 'item') else int(col_data.nunique()),
                            'missing_count': int(col_data.isnull().sum().item()) if hasattr(col_data.isnull().sum(), 'item') else int(col_data.isnull().sum()),
                            'example_values': col_data.dropna().head(3).astype(str).tolist()
                        })
                    
                    row_count = len(df)
                    total_rows += row_count
                    
                    # Prévisualisation des premières lignes - Conversion des types numpy
                    if not df.empty:
                        preview_df = df.head(10)
                        # Convertir tous les types numpy en types Python natifs
                        preview_data = []
                        for record in preview_df.to_dict('records'):
                            converted_record = {}
                            for key, value in record.items():
                                if hasattr(value, 'item'):  # C'est un type numpy
                                    converted_record[key] = value.item()
                                elif pd.isna(value):
                                    converted_record[key] = None
                                else:
                                    converted_record[key] = value
                            preview_data.append(converted_record)
                    else:
                        preview_data = []
                    
                    # Analyse de la qualité des données - Conversion des types numpy
                    missing_percentage = float((df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100)
                    has_duplicates = bool(df.duplicated().any().item()) if hasattr(df.duplicated().any(), 'item') else bool(df.duplicated().any())
                    
                else:
                    # Pour les fichiers non analysables directement
                    row_count = 0
                    columns_analysis = []
                    preview_data = []
                    missing_percentage = 0
                    has_duplicates = False
                
                file_analysis = {
                    'filename': file.filename,
                    'size_bytes': file_size,
                    'size_mb': round(file_size / (1024 * 1024), 2),
                    'format': file.filename.split('.')[-1].lower() if '.' in file.filename else 'unknown',
                    'row_count': row_count,
                    'column_count': len(columns_analysis),
                    'columns_analysis': columns_analysis,
                    'preview_data': preview_data,
                    'quality_metrics': {
                        'missing_percentage': round(missing_percentage, 2),
                        'has_duplicates': has_duplicates,
                        'is_empty': row_count == 0
                    },
                    'analysis_status': 'success'
                }
                
            except Exception as e:
                logger.error(f"Erreur lors de l'analyse de {file.filename}: {str(e)}")
                file_analysis = {
                    'filename': file.filename,
                    'size_bytes': file_size,
                    'size_mb': round(file_size / (1024 * 1024), 2),
                    'format': file.filename.split('.')[-1].lower() if '.' in file.filename else 'unknown',
                    'analysis_status': 'error',
                    'error_message': str(e)
                }
            
            preview_results.append(file_analysis)
        
        # Suggestions automatiques basées sur l'analyse
        suggestions = {
            'suggested_domains': list(detected_domains) if detected_domains else ['general'],
            'suggested_tasks': list(detected_tasks) if detected_tasks else ['classification'],
            'suggested_dataset_name': files[0].filename.split('.')[0].replace('_', ' ').title() if files else 'Nouveau Dataset',
            'total_instances': total_rows,
            'total_features': max([fa.get('column_count', 0) for fa in preview_results if fa.get('analysis_status') == 'success'] + [0]),
            'recommended_split': total_rows > 1000,  # Recommander un split si plus de 1000 lignes
            'quality_score': _calculate_quality_score(preview_results)
        }
        
        response_data = {
            'files_analysis': preview_results,
            'suggestions': suggestions,
            'summary': {
                'total_files': len(files),
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'total_rows': total_rows,
                'analysis_timestamp': datetime.utcnow().isoformat()
            }
        }
        
        # Convertir tous les types numpy en types Python natifs
        return _convert_numpy_types(response_data)
        
    except Exception as e:
        logger.error(f"Erreur lors de la prévisualisation des datasets: {str(e)}")
        
        # Import du module d'erreurs avec gestion des imports hybrides
        try:
            from . import errors
        except ImportError:
            import errors
        
        # Utiliser le gestionnaire d'erreurs centralisé
        raise errors.handle_upload_error(error=e)


def _convert_numpy_types(obj):
    """
    Convertit récursivement tous les types numpy en types Python natifs pour la sérialisation JSON.
    """
    if hasattr(obj, 'item'):  # Type numpy avec méthode .item()
        return obj.item()
    elif isinstance(obj, dict):
        return {key: _convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy_types(item) for item in obj]
    elif pd.isna(obj):
        return None
    else:
        return obj

def _interpret_column_type(col_data: pd.Series) -> str:
    """Détermine le type sémantique d'une colonne."""
    if pd.api.types.is_numeric_dtype(col_data):
        return "numerical_integer" if pd.api.types.is_integer_dtype(col_data) else "numerical_float"
    
    try:
        # Tente de convertir une partie en datetime
        pd.to_datetime(col_data.dropna().head(100), errors='raise')
        return "temporal"
    except (ValueError, TypeError):
        pass

    # Si le ratio de valeurs uniques est faible, c'est probablement catégoriel
    nunique_val = int(col_data.nunique().item()) if hasattr(col_data.nunique(), 'item') else int(col_data.nunique())
    unique_ratio = nunique_val / len(col_data) if len(col_data) > 0 else 0
    if unique_ratio < 0.1 and nunique_val < 50:
        return "categorical"
        
    return "text"


def _calculate_quality_score(files_analysis: List[dict]) -> float:
    """Calcule un score de qualité global basé sur l'analyse des fichiers."""
    if not files_analysis:
        return 0.0
    
    total_score = 0
    valid_files = 0
    
    for file_analysis in files_analysis:
        if file_analysis.get('analysis_status') != 'success':
            continue
            
        valid_files += 1
        file_score = 100
        
        # Pénaliser pour les valeurs manquantes
        missing_pct = file_analysis.get('quality_metrics', {}).get('missing_percentage', 0)
        file_score -= missing_pct
        
        # Pénaliser pour les fichiers vides
        if file_analysis.get('quality_metrics', {}).get('is_empty', False):
            file_score = 0
        
        # Bonus pour les fichiers avec beaucoup de données
        row_count = file_analysis.get('row_count', 0)
        if row_count > 10000:
            file_score += 10
        elif row_count > 1000:
            file_score += 5
        
        total_score += max(0, min(100, file_score))
    
    return round(total_score / valid_files if valid_files > 0 else 0, 1)


@app.post("/datasets", response_model=schemas.DatasetRead, status_code=201)
def create_dataset(
    dataset_name: str = Form(...),
    display_name: str = Form(...),
    year: Optional[int] = Form(None),
    objective: Optional[str] = Form(None),
    access: Optional[str] = Form(None),
    availability: Optional[str] = Form(None),
    num_citations: Optional[int] = Form(0),
    citation_link: Optional[str] = Form(None),
    sources: Optional[str] = Form(None),
    storage_uri: Optional[str] = Form(None),
    instances_number: Optional[int] = Form(None),
    features_description: Optional[str] = Form(None),
    features_number: Optional[int] = Form(None),
    domain: Optional[str] = Form(None),  # JSON string pour les arrays
    representativity_description: Optional[str] = Form(None),
    representativity_level: Optional[str] = Form(None),
    sample_balance_description: Optional[str] = Form(None),
    sample_balance_level: Optional[str] = Form(None),
    split: Optional[bool] = Form(False),
    missing_values_description: Optional[str] = Form(None),
    has_missing_values: Optional[bool] = Form(False),
    global_missing_percentage: Optional[float] = Form(None),
    missing_values_handling_method: Optional[str] = Form(None),
    temporal_factors: Optional[bool] = Form(False),
    metadata_provided_with_dataset: Optional[bool] = Form(False),
    external_documentation_available: Optional[bool] = Form(False),
    documentation_link: Optional[str] = Form(None),
    task: Optional[str] = Form(None),  # JSON string pour les arrays
    # Critères éthiques
    informed_consent: Optional[bool] = Form(False),
    transparency: Optional[bool] = Form(False),
    user_control: Optional[bool] = Form(False),
    equity_non_discrimination: Optional[bool] = Form(False),
    security_measures_in_place: Optional[bool] = Form(False),
    data_quality_documented: Optional[bool] = Form(False),
    data_errors_description: Optional[str] = Form(None),
    anonymization_applied: Optional[bool] = Form(False),
    record_keeping_policy_exists: Optional[bool] = Form(False),
    purpose_limitation_respected: Optional[bool] = Form(False),
    accountability_defined: Optional[bool] = Form(False),
    # Fichiers
    files: List[UploadFile] = File(...),
    db: Session = Depends(database.get_db),
    current_user_role: str = Depends(verify_upload_permissions),
    current_user_id: UUID4 = Depends(get_current_user_id)
):
    """
    Crée un nouvel enregistrement de dataset avec upload de fichiers.
    Supporte le format multipart/form-data avec métadonnées et fichiers.
    """
    dataset_id = str(uuid.uuid4())
    storage_path = None
    
    try:
        # Import du module d'erreurs avec gestion des imports hybrides
        try:
            from . import errors
        except ImportError:
            import errors
        
        # Validation des fichiers avant upload
        supported_formats = ['csv', 'xlsx', 'xls', 'json', 'xml', 'parquet']
        max_file_size = 100 * 1024 * 1024  # 100MB
        
        for file in files:
            errors.validate_file_format(file.filename, supported_formats)
            file_content = file.file.read()
            file.file.seek(0)  # Reset
            errors.validate_file_size(len(file_content), max_file_size, file.filename)
        
        # Validation des métadonnées obligatoires
        metadata = {'dataset_name': dataset_name}
        errors.validate_metadata_required_fields(metadata)
        
        logger.info(f"Starting dataset creation: {dataset_id} with {len(files)} files")
        
        # Upload des fichiers vers le stockage d'objets avec UUID
        storage_path, file_metadata_list = upload_dataset_files(dataset_id, files)
        
        # Parser les arrays JSON si nécessaires
        domain_list = None
        if domain:
            try:
                import json
                domain_list = json.loads(domain)
            except:
                domain_list = [domain]  # Fallback si c'est une string simple
        
        task_list = None
        if task:
            try:
                import json
                task_list = json.loads(task)
            except:
                task_list = [task]  # Fallback si c'est une string simple
        
        # Créer l'instance du modèle SQLAlchemy avec l'UUID fixe et storage_path
        db_dataset = models.Dataset(
            id=dataset_id,
            dataset_name=dataset_name,
            display_name=display_name,
            year=year,
            objective=objective,
            access=access,
            availability=availability,
            num_citations=num_citations,
            citation_link=citation_link,
            sources=sources,
            storage_uri=storage_uri,
            storage_path=storage_path,
            instances_number=instances_number,
            features_description=features_description,
            features_number=features_number,
            domain=domain_list,
            representativity_description=representativity_description,
            representativity_level=representativity_level,
            sample_balance_description=sample_balance_description,
            sample_balance_level=sample_balance_level,
            split=split,
            missing_values_description=missing_values_description,
            has_missing_values=has_missing_values,
            global_missing_percentage=global_missing_percentage,
            missing_values_handling_method=missing_values_handling_method,
            temporal_factors=temporal_factors,
            metadata_provided_with_dataset=metadata_provided_with_dataset,
            external_documentation_available=external_documentation_available,
            documentation_link=documentation_link,
            task=task_list,
            informed_consent=informed_consent,
            transparency=transparency,
            user_control=user_control,
            equity_non_discrimination=equity_non_discrimination,
            security_measures_in_place=security_measures_in_place,
            data_quality_documented=data_quality_documented,
            data_errors_description=data_errors_description,
            anonymization_applied=anonymization_applied,
            record_keeping_policy_exists=record_keeping_policy_exists,
            purpose_limitation_respected=purpose_limitation_respected,
            accountability_defined=accountability_defined
        )
        
        # Ajouter à la session et sauvegarder
        db.add(db_dataset)
        db.commit()
        db.refresh(db_dataset)
        
        # Créer les enregistrements DatasetFile avec métadonnées UUID
        for file_metadata in file_metadata_list:
            db_file = models.DatasetFile(
                dataset_id=db_dataset.id,
                file_name_in_storage=file_metadata['file_name_in_storage'],    # UUID + extension
                original_filename=file_metadata['original_filename'],          # Nom original utilisateur
                logical_role=file_metadata['logical_role'],
                format=file_metadata['format'],
                mime_type=file_metadata['mime_type'],
                size_bytes=file_metadata['size_bytes']
            )
            db.add(db_file)
        
        db.commit()
        
        # Analyser les fichiers et créer les métadonnées des colonnes
        try:
            _analyze_and_save_file_columns(db_dataset, db)
            logger.info(f"Métadonnées des colonnes analysées et sauvegardées pour {len(files)} fichiers")
        except Exception as e:
            logger.warning(f"Erreur lors de l'analyse des colonnes pour {dataset_id}: {str(e)}")
            # Ne pas faire échouer la création du dataset pour cela
        
        logger.info(f"Dataset créé avec succès: {dataset_id} avec {len(files)} fichiers")
        return db_dataset
        
    except Exception as e:
        # Rollback de la base de données
        db.rollback()
        logger.error(f"Error during dataset creation {dataset_id}: {str(e)}")
        
        # Utiliser le gestionnaire d'erreurs centralisé
        raise errors.handle_upload_error(
            error=e,
            dataset_id=dataset_id,
            storage_path=storage_path,
            cleanup_func=cleanup_dataset_storage
        )

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
    """Supprime un dataset de la base de données et du stockage d'objets."""
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if db_dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Nettoyer le stockage d'objets si un storage_path existe
    if db_dataset.storage_path:
        cleanup_dataset_storage(db_dataset.storage_path)
        logger.info(f"Stockage nettoyé pour dataset {dataset_id}: {db_dataset.storage_path}")
    
    # Supprimer de la base de données (cascade supprime automatiquement les fichiers associés)
    db.delete(db_dataset)
    db.commit()
    
    return {"message": f"Dataset avec l'ID {dataset_id} supprimé avec succès du stockage et de la base de données"}

@app.get("/datasets/{dataset_id}/download/{filename}")
def download_dataset_file(
    dataset_id: str, 
    filename: str, 
    db: Session = Depends(database.get_db)
):
    """
    Télécharge un fichier spécifique d'un dataset depuis le stockage d'objets.
    """
    # Vérifier que le dataset existe
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if db_dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    if not db_dataset.storage_path:
        raise HTTPException(status_code=404, detail="Aucun fichier de stockage associé à ce dataset")
    
    # Vérifier que le fichier existe dans les métadonnées (recherche par nom original)
    db_file = db.query(models.DatasetFile).filter(
        models.DatasetFile.dataset_id == dataset_id,
        models.DatasetFile.original_filename == filename
    ).first()
    
    if db_file is None:
        raise HTTPException(status_code=404, detail=f"Fichier {filename} non trouvé pour ce dataset")
    
    try:
        # Télécharger depuis le stockage d'objets (utilise le nom UUID)
        storage_client = get_storage_client()
        object_path = f"{db_dataset.storage_path}{db_file.file_name_in_storage}"
        
        file_data = storage_client.download_file(object_path)
        
        # Retourner le fichier avec les headers appropriés
        from fastapi.responses import Response
        
        return Response(
            content=file_data,
            media_type=db_file.mime_type or 'application/octet-stream',
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(file_data))
            }
        )
        
    except StorageClientError as e:
        logger.error(f"Erreur de téléchargement pour {dataset_id}/{filename}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du téléchargement du fichier: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Erreur inattendue lors du téléchargement {dataset_id}/{filename}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur inattendue lors du téléchargement: {str(e)}"
        )

@app.get("/datasets/{dataset_id}/files")
def list_dataset_files(dataset_id: str, db: Session = Depends(database.get_db)):
    """Liste les fichiers disponibles pour un dataset."""
    # Vérifier que le dataset existe
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if db_dataset is None:
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    
    # Récupérer tous les fichiers du dataset
    files = db.query(models.DatasetFile).filter(models.DatasetFile.dataset_id == dataset_id).all()
    
    file_list = []
    for file in files:
        file_list.append({
            "filename": file.original_filename,                                   # Nom original pour l'utilisateur
            "storage_filename": file.file_name_in_storage,                        # UUID pour référence interne
            "format": file.format,
            "size_bytes": file.size_bytes,
            "logical_role": file.logical_role,
            "mime_type": file.mime_type,
            "download_url": f"/datasets/{dataset_id}/download/{file.original_filename}"  # URL avec nom original
        })
    
    return {
        "dataset_id": dataset_id,
        "files": file_list,
        "total_files": len(file_list)
    }


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
    import logging
    logger = logging.getLogger(__name__)
    
    total_score = 0.0
    total_weight = 0.0
    
    # DEBUG: Log du début du calcul
    logger.info(f"📊 Calcul score pour '{dataset.dataset_name}' avec {len(weights)} critères")
    
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
            logger.info(f"   {criterion_name}: {criterion_score:.3f} (poids: {weight:.1f}) = {criterion_score * weight:.3f}")
        else:
            logger.warning(f"   ⚠️ Critère inconnu: {criterion_name}")
    
    # Si aucun poids n'est fourni, utiliser des poids par défaut équilibrés
    if total_weight == 0.0:
        logger.info("   Aucun poids valide, utilisation des poids par défaut")
        default_weights = [
            schemas.CriterionWeight(criterion_name='ethical_score', weight=0.4),
            schemas.CriterionWeight(criterion_name='technical_score', weight=0.4),
            schemas.CriterionWeight(criterion_name='popularity_score', weight=0.2),
        ]
        return calculate_relevance_score(dataset, default_weights)
    
    final_score = total_score / total_weight
    logger.info(f"   Score final: {total_score:.3f} / {total_weight:.1f} = {final_score:.3f}")
    
    return final_score


# --- FONCTIONS UTILITAIRES POUR LES NOUVEAUX ENDPOINTS ---

def generate_quality_metrics(dataset: models.Dataset) -> schemas.DatasetQualityMetrics:
    """Génère les métriques de qualité pour un dataset."""
    import random
    
    # Calcul de la complétude basé sur les données existantes
    completeness = 1.0 - (dataset.global_missing_percentage or 0.0) / 100.0
    
    # Calcul du score éthique
    ethical_score = calculate_ethical_score(dataset)
    
    # Simulation des autres métriques basées sur les données existantes
    consistency = 0.8 + random.uniform(-0.1, 0.15)  # Score de base élevé avec variation
    accuracy = 0.85 + random.uniform(-0.1, 0.1)
    
    # Simulation du pourcentage d'outliers basé sur la qualité des données
    base_outliers = 0.02 if dataset.has_missing_values else 0.01
    outliers_percentage = base_outliers + random.uniform(0, 0.03)
    
    # Score de risque PII basé sur le domaine
    pii_risk = 0.1  # Valeur par défaut faible
    if dataset.domain:
        high_pii_domains = ['healthcare', 'finance', 'education', 'social']
        if any(domain.lower() in high_pii_domains for domain in dataset.domain):
            pii_risk = 0.3 + random.uniform(0, 0.2)
    
    # Score global calculé
    overall_score = (completeness * 0.3 + consistency * 0.25 + accuracy * 0.25 + ethical_score * 0.2)
    
    return schemas.DatasetQualityMetrics(
        overall_score=min(1.0, max(0.0, overall_score)),
        completeness=min(1.0, max(0.0, completeness)),
        consistency=min(1.0, max(0.0, consistency)),
        accuracy=min(1.0, max(0.0, accuracy)),
        ethical_compliance=ethical_score,
        outliers_percentage=min(1.0, max(0.0, outliers_percentage)),
        pii_risk_score=min(1.0, max(0.0, pii_risk))
    )


def generate_distribution_analysis(dataset: models.Dataset) -> schemas.DataDistributionAnalysis:
    """Génère l'analyse de distribution des données pour un dataset."""
    import random
    
    feature_correlations = []
    missing_patterns = []
    
    # Générer des corrélations fictives si on a des features
    if dataset.features_number and dataset.features_number > 1:
        num_correlations = min(10, dataset.features_number * (dataset.features_number - 1) // 4)
        
        for i in range(num_correlations):
            correlation_value = random.uniform(-0.9, 0.9)
            abs_corr = abs(correlation_value)
            
            if abs_corr > 0.7:
                corr_type = "forte"
            elif abs_corr > 0.3:
                corr_type = "moyenne"
            else:
                corr_type = "faible"
            
            feature_correlations.append(schemas.FeatureCorrelation(
                feature1=f"feature_{i+1}",
                feature2=f"feature_{i+2 if i+2 <= dataset.features_number else 1}",
                correlation=correlation_value,
                correlation_type=corr_type
            ))
    
    # Générer des patterns de données manquantes si applicable
    if dataset.has_missing_values and dataset.global_missing_percentage:
        num_patterns = random.randint(1, 3)
        remaining_percentage = dataset.global_missing_percentage / 100.0
        
        for i in range(num_patterns):
            if remaining_percentage <= 0:
                break
                
            pattern_percentage = min(remaining_percentage, random.uniform(0.05, remaining_percentage))
            remaining_percentage -= pattern_percentage
            
            num_columns = random.randint(1, 3)
            columns = [f"feature_{j+1}" for j in range(num_columns)]
            
            missing_patterns.append(schemas.MissingDataPattern(
                columns=columns,
                missing_count=int((dataset.instances_number or 1000) * pattern_percentage),
                percentage=pattern_percentage,
                pattern_description=f"Valeurs manquantes simultanées dans {', '.join(columns)}"
            ))
    
    # Générer une distribution des classes simple pour les tâches de classification
    class_distribution = None
    if dataset.task and any('classification' in task.lower() for task in dataset.task):
        num_classes = random.randint(2, 5)
        total_instances = dataset.instances_number or 1000
        
        # Générer une distribution déséquilibrée réaliste
        weights = [random.uniform(0.5, 2.0) for _ in range(num_classes)]
        weight_sum = sum(weights)
        normalized_weights = [w / weight_sum for w in weights]
        
        class_distribution = {}
        for i, weight in enumerate(normalized_weights):
            class_name = f"class_{i}"
            class_count = int(total_instances * weight)
            class_distribution[class_name] = class_count
    
    return schemas.DataDistributionAnalysis(
        feature_correlations=feature_correlations,
        missing_data_patterns=missing_patterns,
        class_distribution=class_distribution,
        feature_importance=None  # Pourrait être ajouté plus tard
    )


def generate_files_metadata(dataset: models.Dataset, db: Session = None) -> List[schemas.DatasetFileMetadata]:
    """
    Génère les métadonnées des fichiers pour un dataset en lisant depuis la base de données.
    
    Args:
        dataset: Instance du dataset
        db: Session de base de données pour accéder aux fichiers et colonnes
    
    Returns:
        List[DatasetFileMetadata]: Liste des métadonnées des fichiers
    """
    
    # Si pas de session DB fournie, générer des données simulées (fallback)
    if db is None:
        return generate_fallback_files_metadata(dataset)
    
    # Récupérer les fichiers du dataset depuis la base de données
    dataset_files = db.query(models.DatasetFile).filter(
        models.DatasetFile.dataset_id == dataset.id
    ).order_by(models.DatasetFile.created_at).all()
    
    # Si aucun fichier trouvé, retourner des métadonnées simulées
    if not dataset_files:
        logger.warning(f"Aucun fichier trouvé pour dataset {dataset.id}, génération de métadonnées simulées")
        return generate_fallback_files_metadata(dataset)
    
    files_metadata = []
    
    for dataset_file in dataset_files:
        # Récupérer les colonnes du fichier depuis la base de données
        file_columns = db.query(models.FileColumn).filter(
            models.FileColumn.dataset_file_id == dataset_file.id
        ).order_by(models.FileColumn.position).all()
        
        # Convertir les colonnes en schémas ColumnMetadata
        columns_metadata = []
        for file_column in file_columns:
            columns_metadata.append(schemas.ColumnMetadata(
                column_name=file_column.column_name,
                position=file_column.position,
                data_type_original=file_column.data_type_original or "unknown",
                data_type_interpreted=file_column.data_type_interpreted or file_column.data_type_original or "unknown",
                is_nullable=file_column.is_nullable,
                is_primary_key_component=file_column.is_primary_key_component,
                is_pii=file_column.is_pii,
                description=file_column.description,
                example_values=file_column.example_values or []
            ))
        
        # Créer les métadonnées du fichier
        file_metadata = schemas.DatasetFileMetadata(
            file_name_in_storage=dataset_file.file_name_in_storage,
            original_filename=dataset_file.original_filename or dataset_file.file_name_in_storage,
            format=dataset_file.format or "unknown",
            size_bytes=dataset_file.size_bytes or 0,
            row_count=dataset_file.row_count or 0,
            description=dataset_file.description,
            columns=columns_metadata
        )
        
        files_metadata.append(file_metadata)
        logger.info(f"Métadonnées chargées pour fichier {dataset_file.file_name_in_storage}: {len(columns_metadata)} colonnes")
    
    return files_metadata


def generate_fallback_files_metadata(dataset: models.Dataset) -> List[schemas.DatasetFileMetadata]:
    """Génère des métadonnées de fichiers simulées en cas d'erreur lors de la lecture des vraies données."""
    import random
    
    # Nombre de fichiers basé sur la taille du dataset
    if dataset.instances_number and dataset.instances_number > 50000:
        num_files = random.randint(2, 4)
    else:
        num_files = 1
    
    files = []
    total_instances = dataset.instances_number or 1000
    features_per_file = dataset.features_number or 10
    
    for i in range(num_files):
        if num_files == 1:
            filename = f"{dataset.dataset_name.lower().replace(' ', '_')}.csv"
            file_instances = total_instances
        else:
            if i == 0:
                filename = f"{dataset.dataset_name.lower().replace(' ', '_')}_train.csv"
                file_instances = int(total_instances * 0.7)
            elif i == 1:
                filename = f"{dataset.dataset_name.lower().replace(' ', '_')}_test.csv"
                file_instances = int(total_instances * 0.2)
            else:
                filename = f"{dataset.dataset_name.lower().replace(' ', '_')}_val.csv"
                file_instances = total_instances - int(total_instances * 0.9)
        
        # Générer les colonnes
        columns = []
        for j in range(features_per_file):
            # Types de données variés
            data_types = ['int64', 'float64', 'object', 'bool', 'datetime64']
            data_type = random.choice(data_types)
            
            # Exemples de valeurs basés sur le type
            if data_type == 'int64':
                examples = [str(random.randint(1, 1000)) for _ in range(3)]
            elif data_type == 'float64':
                examples = [f"{random.uniform(0, 100):.2f}" for _ in range(3)]
            elif data_type == 'bool':
                examples = [str(random.choice([True, False])) for _ in range(3)]
            elif data_type == 'datetime64':
                examples = ['2023-01-15', '2023-02-20', '2023-03-10']
            else:  # object
                examples = [f"value_{k}" for k in range(1, 4)]
            
            # Déterminer si c'est PII basé sur le nom de la colonne
            column_name = f"feature_{j+1}"
            is_pii = False
            if j == 0 and any(domain.lower() in ['healthcare', 'finance', 'education'] for domain in (dataset.domain or [])):
                is_pii = random.choice([True, False])
                if is_pii:
                    column_name = random.choice(['user_id', 'email', 'patient_id', 'ssn'])
            
            columns.append(schemas.ColumnMetadata(
                column_name=column_name,
                position=j,
                data_type_original=data_type,
                data_type_interpreted=data_type,
                is_nullable=random.choice([True, False]),
                is_primary_key_component=(j == 0),
                is_pii=is_pii,
                description=f"Description de la feature {j+1}" if j < 5 else None,
                example_values=examples
            ))
        
        # Taille du fichier estimée (très approximative)
        avg_bytes_per_row = features_per_file * 20  # Estimation grossière
        file_size = file_instances * avg_bytes_per_row
        
        files.append(schemas.DatasetFileMetadata(
            file_name_in_storage=filename,
            original_filename=filename,
            format="csv",
            size_bytes=file_size,
            row_count=file_instances,
            description=f"Fichier principal du dataset" if i == 0 else f"Fichier de {'test' if i == 1 else 'validation'}",
            columns=columns
        ))
    
    return files


def generate_dataset_preview(dataset: models.Dataset, db: Session = None) -> schemas.DatasetPreviewResponse:
    """
    Génère un aperçu des données réelles pour un dataset en lisant depuis MinIO.
    
    Args:
        dataset: Instance du dataset
        db: Session de base de données pour accéder aux fichiers
    
    Returns:
        DatasetPreviewResponse: Aperçu avec vraies données tronquées
    """
    
    # Si pas de session DB fournie, générer des données simulées (fallback)
    if db is None:
        return generate_fallback_preview(dataset)
    
    # Récupérer les fichiers du dataset depuis la base de données
    dataset_files = db.query(models.DatasetFile).filter(
        models.DatasetFile.dataset_id == dataset.id,
        models.DatasetFile.format == 'parquet'  # Prioriser les fichiers Parquet
    ).all()
    
    # Si aucun fichier Parquet, essayer avec tous les formats
    if not dataset_files:
        dataset_files = db.query(models.DatasetFile).filter(
            models.DatasetFile.dataset_id == dataset.id
        ).all()
    
    # Si toujours aucun fichier, retourner un aperçu simulé
    if not dataset_files:
        logger.warning(f"Aucun fichier trouvé pour dataset {dataset.id}, génération d'un aperçu simulé")
        return generate_fallback_preview(dataset)
    
    # Prendre le premier fichier de données (généralement le fichier principal)
    main_file = None
    for file in dataset_files:
        if file.logical_role in ['data_file', 'training_data', None]:
            main_file = file
            break
    
    if main_file is None:
        main_file = dataset_files[0]  # Prendre le premier fichier disponible
    
    try:
        # Télécharger le fichier depuis MinIO
        storage_client = get_storage_client()
        
        # Construire le chemin complet vers le fichier
        if dataset.storage_path:
            object_path = f"{dataset.storage_path.rstrip('/')}/{main_file.file_name_in_storage}"
        else:
            object_path = f"ibis-x-datasets/{dataset.id}/{main_file.file_name_in_storage}"
        
        logger.info(f"Téléchargement du fichier pour aperçu: {object_path}")
        file_data = storage_client.download_file(object_path)
        
        # Lire le fichier Parquet avec pandas
        parquet_buffer = io.BytesIO(file_data)
        df = pd.read_parquet(parquet_buffer)
        
        logger.info(f"Données lues avec succès: {len(df)} lignes, {len(df.columns)} colonnes")
        
        # Limiter le nombre de lignes pour l'aperçu (performance)
        sample_rows = min(100, len(df))  # Maximum 100 lignes pour l'aperçu
        max_columns = min(20, len(df.columns))  # Maximum 20 colonnes pour l'affichage
        
        # Prendre un échantillon aléatoire des données
        if len(df) > sample_rows:
            df_sample = df.sample(n=sample_rows, random_state=42)
        else:
            df_sample = df.copy()
        
        # Limiter le nombre de colonnes si nécessaire
        if len(df.columns) > max_columns:
            df_sample = df_sample.iloc[:, :max_columns]
            logger.info(f"Aperçu limité aux {max_columns} premières colonnes")
        
        # Générer les statistiques des colonnes
        columns_info = []
        for col in df_sample.columns:
            col_data = df[col]  # Utiliser le dataset complet pour les statistiques
            
            # Déterminer le type de données
            if pd.api.types.is_numeric_dtype(col_data):
                col_type = 'numeric'
                mean_val = float(col_data.mean()) if not col_data.mean() != col_data.mean() else None  # Vérifier NaN
                std_val = float(col_data.std()) if not col_data.std() != col_data.std() else None
                min_val = str(col_data.min()) if not pd.isna(col_data.min()) else None
                max_val = str(col_data.max()) if not pd.isna(col_data.max()) else None
            elif pd.api.types.is_bool_dtype(col_data):
                col_type = 'boolean'
                mean_val = None
                std_val = None
                min_val = str(col_data.min()) if not pd.isna(col_data.min()) else None
                max_val = str(col_data.max()) if not pd.isna(col_data.max()) else None
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                col_type = 'datetime'
                mean_val = None
                std_val = None
                min_val = str(col_data.min()) if not pd.isna(col_data.min()) else None
                max_val = str(col_data.max()) if not pd.isna(col_data.max()) else None
            else:
                col_type = 'categorical' if col_data.nunique() < len(col_data) * 0.5 else 'text'
                mean_val = None
                std_val = None
                min_val = None
                max_val = None
            
            # Calculer les valeurs les plus fréquentes pour les colonnes catégorielles
            top_values = None
            if col_type in ['categorical', 'text']:
                value_counts = col_data.value_counts().head(3)
                if len(value_counts) > 0:
                    top_values = [str(val) for val in value_counts.index.tolist()]
            
            columns_info.append(schemas.ColumnStatistics(
                name=col,
                type=col_type,
                non_null_count=int(col_data.notna().sum()),
                unique_count=int(col_data.nunique()),
                mean=mean_val,
                std=std_val,
                min_value=min_val,
                max_value=max_val,
                top_values=top_values
            ))
        
        # Convertir les données en format dict pour l'API
        sample_data = []
        for _, row in df_sample.iterrows():
            row_dict = {}
            for col in df_sample.columns:
                value = row[col]
                # Convertir les valeurs pandas/numpy en types Python natifs
                if pd.isna(value):
                    row_dict[col] = None
                elif isinstance(value, (pd.Timestamp, pd.Period)):
                    row_dict[col] = str(value)
                elif hasattr(value, 'item'):  # numpy types
                    row_dict[col] = value.item()
                else:
                    row_dict[col] = value
            sample_data.append(row_dict)
        
        return schemas.DatasetPreviewResponse(
            file_name=main_file.file_name_in_storage,
            total_rows=len(df),
            sample_data=sample_data,
            columns_info=columns_info
        )
        
    except StorageClientError as e:
        logger.error(f"Erreur de stockage lors de la génération d'aperçu pour {dataset.id}: {str(e)}")
        return generate_fallback_preview(dataset)
    except Exception as e:
        logger.error(f"Erreur lors de la génération d'aperçu pour {dataset.id}: {str(e)}")
        return generate_fallback_preview(dataset)


def generate_fallback_preview(dataset: models.Dataset) -> schemas.DatasetPreviewResponse:
    """Génère un aperçu simulé en cas d'erreur lors de la lecture des vraies données."""
    import random
    import string
    
    features_count = min(dataset.features_number or 10, 8)  # Limiter à 8 colonnes pour l'affichage
    sample_rows = min(50, dataset.instances_number or 50)
    
    # Générer les informations sur les colonnes
    columns_info = []
    sample_data = []
    
    # Créer les colonnes
    column_names = []
    for i in range(features_count):
        column_name = f"feature_{i+1}"
        column_names.append(column_name)
        
        # Type de données aléatoire
        data_types = ['numeric', 'categorical', 'text', 'boolean']
        data_type = random.choice(data_types)
        
        # Statistiques basées sur le type
        if data_type == 'numeric':
            mean_val = random.uniform(10, 100)
            std_val = random.uniform(5, 20)
            min_val = f"{mean_val - 2 * std_val:.2f}"
            max_val = f"{mean_val + 2 * std_val:.2f}"
            unique_count = int(sample_rows * random.uniform(0.6, 0.9))
        else:
            mean_val = None
            std_val = None
            min_val = None
            max_val = None
            unique_count = random.randint(2, min(20, sample_rows))
        
        columns_info.append(schemas.ColumnStatistics(
            name=column_name,
            type=data_type,
            non_null_count=int(sample_rows * (1 - (dataset.global_missing_percentage or 0) / 100)),
            unique_count=unique_count,
            mean=mean_val,
            std=std_val,
            min_value=min_val,
            max_value=max_val,
            top_values=[f"value_{j}" for j in range(1, 4)] if data_type == 'categorical' else None
        ))
    
    # Générer les données d'exemple
    for row_idx in range(sample_rows):
        row_data = {}
        for col_idx, column_name in enumerate(column_names):
            column_info = columns_info[col_idx]
            
            # Générer une valeur selon le type
            if column_info.type == 'numeric':
                if column_info.mean and column_info.std:
                    value = random.gauss(column_info.mean, column_info.std)
                    row_data[column_name] = round(value, 2)
                else:
                    row_data[column_name] = random.randint(1, 100)
            elif column_info.type == 'categorical':
                categories = ['A', 'B', 'C', 'D', 'E']
                row_data[column_name] = random.choice(categories)
            elif column_info.type == 'boolean':
                row_data[column_name] = random.choice([True, False])
            else:  # text
                length = random.randint(5, 15)
                row_data[column_name] = ''.join(random.choices(string.ascii_lowercase, k=length))
            
            # Introduire des valeurs manquantes selon le pourcentage global
            if dataset.global_missing_percentage and random.random() < (dataset.global_missing_percentage / 100):
                row_data[column_name] = None
        
        sample_data.append(row_data)
    
    return schemas.DatasetPreviewResponse(
        file_name=f"{dataset.dataset_name.lower().replace(' ', '_')}.csv",
        total_rows=dataset.instances_number or 1000,
        sample_data=sample_data,
        columns_info=columns_info
    )


def find_similar_datasets(dataset: models.Dataset, db: Session, limit: int = 5) -> List[models.Dataset]:
    """Trouve des datasets similaires basés sur les domaines, tâches et caractéristiques."""
    
    # Requête de base excluant le dataset actuel
    query = db.query(models.Dataset).filter(models.Dataset.id != dataset.id)
    
    # Sous-requêtes pour différents critères de similarité
    similar_by_domain = query
    similar_by_task = query
    similar_by_size = query
    
    # Filtrer par domaine si disponible
    if dataset.domain:
        similar_by_domain = query.filter(
            models.Dataset.domain.op('&&')(dataset.domain)  # Opérateur d'intersection pour ARRAY
        )
    
    # Filtrer par tâche si disponible
    if dataset.task:
        similar_by_task = query.filter(
            models.Dataset.task.op('&&')(dataset.task)
        )
    
    # Filtrer par taille similaire (±50% de la taille originale)
    if dataset.instances_number:
        min_size = int(dataset.instances_number * 0.5)
        max_size = int(dataset.instances_number * 1.5)
        similar_by_size = query.filter(
            and_(
                models.Dataset.instances_number >= min_size,
                models.Dataset.instances_number <= max_size
            )
        )
    
    # Combiner les résultats avec priorité
    similar_datasets = []
    seen_ids = set()
    
    # Priorité 1: Même domaine ET même tâche
    if dataset.domain and dataset.task:
        domain_task_similar = query.filter(
            and_(
                models.Dataset.domain.op('&&')(dataset.domain),
                models.Dataset.task.op('&&')(dataset.task)
            )
        ).limit(limit).all()
        
        for ds in domain_task_similar:
            if ds.id not in seen_ids:
                similar_datasets.append(ds)
                seen_ids.add(ds.id)
    
    # Priorité 2: Même domaine
    if len(similar_datasets) < limit and dataset.domain:
        for ds in similar_by_domain.limit(limit * 2).all():
            if ds.id not in seen_ids and len(similar_datasets) < limit:
                similar_datasets.append(ds)
                seen_ids.add(ds.id)
    
    # Priorité 3: Même tâche
    if len(similar_datasets) < limit and dataset.task:
        for ds in similar_by_task.limit(limit * 2).all():
            if ds.id not in seen_ids and len(similar_datasets) < limit:
                similar_datasets.append(ds)
                seen_ids.add(ds.id)
    
    # Priorité 4: Taille similaire
    if len(similar_datasets) < limit:
        for ds in similar_by_size.limit(limit * 2).all():
            if ds.id not in seen_ids and len(similar_datasets) < limit:
                similar_datasets.append(ds)
                seen_ids.add(ds.id)
    
    # Priorité 5: Datasets récents si toujours pas assez
    if len(similar_datasets) < limit:
        recent_datasets = query.order_by(models.Dataset.created_at.desc()).limit(limit * 2).all()
        for ds in recent_datasets:
            if ds.id not in seen_ids and len(similar_datasets) < limit:
                similar_datasets.append(ds)
                seen_ids.add(ds.id)
    
    return similar_datasets[:limit]


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
    current_user_id: UUID4 = Depends(get_current_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Liste les projets de l'utilisateur connecté avec pagination.
    SÉCURISÉ : Filtre automatiquement par user_id.
    """
    offset = (page - 1) * page_size
    
    # SÉCURITÉ : Filtrer OBLIGATOIREMENT par user_id de l'utilisateur connecté
    query = db.query(models.Project).filter(models.Project.user_id == current_user_id)
    total_count = query.count()
    projects = query.offset(offset).limit(page_size).all()
    
    total_pages = math.ceil(total_count / page_size)
    
    logger.info(f"✅ Utilisateur {current_user_id} - Liste de {len(projects)} projets sur {total_count}")
    
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
    current_user_id: UUID4 = Depends(get_current_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Créer un nouveau projet pour l'utilisateur connecté.
    SÉCURISÉ : Associe automatiquement le projet à l'utilisateur connecté.
    """
    # Convertir les critères et poids en JSON pour stockage JSONB
    criteria_dict = project.criteria.dict() if project.criteria else None
    weights_dict = [weight.dict() for weight in project.weights] if project.weights else None
    
    # SÉCURITÉ : Utiliser OBLIGATOIREMENT l'user_id de l'utilisateur connecté
    db_project = models.Project(
        user_id=current_user_id,
        name=project.name,
        description=project.description,
        criteria=criteria_dict,
        weights=weights_dict
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    logger.info(f"✅ Utilisateur {current_user_id} - Nouveau projet créé: {db_project.id} '{project.name}'")
    
    return db_project


@app.get("/projects/{project_id}", response_model=schemas.ProjectRead)
def get_project(
    project_id: str,
    current_user_id: UUID4 = Depends(get_current_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Récupérer un projet spécifique appartenant à l'utilisateur connecté.
    SÉCURISÉ : Vérifie l'appartenance du projet à l'utilisateur.
    """
    # SÉCURITÉ : Filtrer par projet ET user_id pour empêcher l'accès à d'autres projets
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user_id
    ).first()
    
    if not project:
        # Ne pas révéler si le projet existe ou non pour un autre utilisateur
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    logger.info(f"✅ Utilisateur {current_user_id} - Accès au projet: {project_id}")
    
    return project


@app.put("/projects/{project_id}", response_model=schemas.ProjectRead)
def update_project(
    project_id: str,
    project_update: schemas.ProjectUpdate,
    current_user_id: UUID4 = Depends(get_current_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Mettre à jour un projet appartenant à l'utilisateur connecté.
    SÉCURISÉ : Vérifie l'appartenance du projet à l'utilisateur.
    """
    # SÉCURITÉ : Filtrer par projet ET user_id pour empêcher la modification d'autres projets
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user_id
    ).first()
    
    if not project:
        # Ne pas révéler si le projet existe ou non pour un autre utilisateur
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Mettre à jour les champs modifiés
    update_data = project_update.dict(exclude_unset=True)
    
    # Convertir les critères et poids en JSON si fournis
    if 'criteria' in update_data and update_data['criteria']:
        criteria = update_data['criteria']
        if hasattr(criteria, 'dict'):
            # C'est un objet Pydantic
            update_data['criteria'] = criteria.dict()
        elif isinstance(criteria, dict):
            # C'est déjà un dictionnaire
            update_data['criteria'] = criteria
        else:
            # Autre cas, essayer la conversion
            update_data['criteria'] = dict(criteria)
    
    if 'weights' in update_data and update_data['weights']:
        weights = update_data['weights']
        converted_weights = []
        for weight in weights:
            if hasattr(weight, 'dict'):
                # C'est un objet Pydantic
                converted_weights.append(weight.dict())
            elif isinstance(weight, dict):
                # C'est déjà un dictionnaire
                converted_weights.append(weight)
            else:
                # Autre cas, essayer la conversion
                converted_weights.append(dict(weight))
        
        # Normaliser les poids si leur somme dépasse 1.0
        total_weight = sum(w.get('weight', 0) for w in converted_weights)
        if total_weight > 1.0:
            logger.warning(f"Normalisation des poids: somme {total_weight} > 1.0")
            for weight in converted_weights:
                weight['weight'] = weight.get('weight', 0) / total_weight
        
        update_data['weights'] = converted_weights
    
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(project)
    
    logger.info(f"✅ Utilisateur {current_user_id} - Projet mis à jour: {project_id} '{project.name}'")
    
    return project


@app.delete("/projects/{project_id}", status_code=200)
def delete_project(
    project_id: str,
    current_user_id: UUID4 = Depends(get_current_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Supprimer un projet appartenant à l'utilisateur connecté.
    SÉCURISÉ : Vérifie l'appartenance du projet à l'utilisateur.
    """
    # SÉCURITÉ : Filtrer par projet ET user_id pour empêcher la suppression d'autres projets
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user_id
    ).first()
    
    if not project:
        # Ne pas révéler si le projet existe ou non pour un autre utilisateur
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    project_name = project.name  # Sauvegarder pour le log
    
    db.delete(project)
    db.commit()
    
    logger.info(f"✅ Utilisateur {current_user_id} - Projet supprimé: {project_id} '{project_name}'")
    
    return {"message": "Projet supprimé avec succès"}


@app.get("/projects/{project_id}/recommendations", response_model=schemas.ProjectRecommendationResponse)
def get_project_recommendations(
    project_id: str,
    current_user_id: UUID4 = Depends(get_current_user_id),
    db: Session = Depends(database.get_db)
):
    """
    Obtenir les datasets recommandés pour un projet appartenant à l'utilisateur connecté.
    SÉCURISÉ : Vérifie l'appartenance du projet à l'utilisateur.
    """
    # SÉCURITÉ : Filtrer par projet ET user_id pour empêcher l'accès aux recommandations d'autres projets
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user_id
    ).first()
    
    if not project:
        # Ne pas révéler si le projet existe ou non pour un autre utilisateur
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
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
    
    logger.info(f"✅ Utilisateur {current_user_id} - Recommandations pour projet {project_id}: {len(scored_datasets)} datasets")
    
    return schemas.ProjectRecommendationResponse(
        project=project,
        datasets=scored_datasets,
        total_count=len(scored_datasets)
    )


@app.post("/datasets/score", response_model=List[schemas.DatasetScoredRead])
def score_datasets(
    score_request: schemas.DatasetScoreRequest,
    current_user_id: UUID4 = Depends(get_current_user_id),
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
    import logging
    logger = logging.getLogger(__name__)
    
    # DEBUG: Log des paramètres de la requête
    logger.info(f"🔍 DEBUG - Utilisateur {current_user_id} - Requête scoring reçue:")
    logger.info(f"   Filtres: {score_request.filters}")
    logger.info(f"   Poids: {score_request.weights}")
    
    # 1. Construire la requête de base
    query = db.query(models.Dataset)
    total_datasets_before_filter = query.count()
    logger.info(f"   Total datasets en base: {total_datasets_before_filter}")
    
    # 2. Appliquer les filtres si fournis
    if score_request.filters:
        logger.info(f"   Application des filtres...")
        query = apply_filters(query, score_request.filters)
    
    # 3. Récupérer les datasets filtrés
    datasets = query.all()
    logger.info(f"   Datasets après filtrage: {len(datasets)}")
    
    if len(datasets) == 0:
        logger.warning("⚠️  Aucun dataset trouvé après filtrage - retour d'une liste vide")
        return []
    
    # 4. Calculer les scores pour chaque dataset
    scored_datasets = []
    for i, dataset in enumerate(datasets):
        score = calculate_relevance_score(dataset, score_request.weights)
        logger.info(f"   Dataset '{dataset.dataset_name}': score = {score}")
        
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
    
    logger.info(f"✅ Retour de {len(scored_datasets)} datasets scorés")
    if scored_datasets:
        logger.info(f"   Meilleur score: {scored_datasets[0].score} ({scored_datasets[0].dataset_name})")
    
    return scored_datasets


# =====================================
# ENDPOINTS MÉTADONNÉES - COMPLETION
# =====================================

@app.get("/datasets/metadata/{dataset_id}/completion-status")
def get_completion_status(dataset_id: str, db: Session = Depends(database.get_db)):
    """
    Retourne le statut de complétude des métadonnées d'un dataset.
    
    Indique quels champs sont vides, lesquels ont des valeurs par défaut,
    et lesquels nécessitent une validation humaine.
    """
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset non trouvé")
    
    # Champs obligatoires pour la validation
    required_fields = {
        'ethical': [
            'informed_consent',
            'transparency', 
            'anonymization_applied',
            'data_quality_documented'
        ],
        'technical': [
            'instances_number',
            'features_number',
            'domain',
            'task'
        ],
        'general': [
            'dataset_name',
            'objective',
            'sources'
        ]
    }
    
    # Analyser la complétude
    completion_status = {
        'overall_completion': 0,
        'missing_fields': [],
        'default_values': [],
        'needs_review': [],
        'complete_fields': []
    }
    
    total_fields = 0
    complete_fields = 0
    
    # Vérifier chaque catégorie
    for category, fields in required_fields.items():
        for field in fields:
            total_fields += 1
            value = getattr(dataset, field, None)
            
            if value is None or value == '' or value == []:
                completion_status['missing_fields'].append({
                    'field': field,
                    'category': category,
                    'description': get_field_description(field)
                })
            elif is_default_value(field, value):
                completion_status['default_values'].append({
                    'field': field,
                    'category': category,
                    'value': value,
                    'description': get_field_description(field)
                })
                complete_fields += 0.5  # Demi-point pour valeur par défaut
            else:
                completion_status['complete_fields'].append({
                    'field': field,
                    'category': category,
                    'value': value
                })
                complete_fields += 1
    
    # Champs spéciaux qui nécessitent toujours une révision humaine
    review_fields = [
        'informed_consent',
        'anonymization_applied', 
        'equity_non_discrimination'
    ]
    
    for field in review_fields:
        value = getattr(dataset, field, None)
        if value is not None:
            completion_status['needs_review'].append({
                'field': field,
                'value': value,
                'reason': 'Validation humaine requise pour ce critère éthique'
            })
    
    completion_status['overall_completion'] = int((complete_fields / total_fields) * 100)
    
    return completion_status


@app.get("/datasets/metadata/{dataset_id}/metadata-form")
def get_metadata_form(dataset_id: str, db: Session = Depends(database.get_db)):
    """
    Retourne un formulaire pré-rempli pour compléter les métadonnées.
    
    Structure le formulaire par sections pour faciliter la saisie.
    """
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset non trouvé")
    
    # Structurer le formulaire par sections
    form_structure = {
        'dataset_info': {
            'title': 'Informations Générales',
            'fields': [
                {
                    'name': 'dataset_name',
                    'label': 'Nom du Dataset',
                    'type': 'text',
                    'required': True,
                    'current_value': dataset.dataset_name,
                    'help': 'Nom descriptif et unique du dataset'
                },
                {
                    'name': 'objective',
                    'label': 'Objectif',
                    'type': 'textarea',
                    'required': True,
                    'current_value': dataset.objective,
                    'help': 'Description de l\'objectif et du contexte du dataset'
                },
                {
                    'name': 'domain',
                    'label': 'Domaines',
                    'type': 'multi-select',
                    'required': True,
                    'current_value': dataset.domain or [],
                    'options': ['education', 'healthcare', 'finance', 'social', 'business', 'technology'],
                    'help': 'Domaines d\'application (plusieurs possibles)'
                }
            ]
        },
        'technical_info': {
            'title': 'Caractéristiques Techniques',
            'fields': [
                {
                    'name': 'representativity_level',
                    'label': 'Niveau de Représentativité',
                    'type': 'select',
                    'current_value': dataset.representativity_level,
                    'options': ['high', 'medium', 'low', 'unknown'],
                    'help': 'Dans quelle mesure ce dataset représente la population cible'
                },
                {
                    'name': 'sample_balance_level',
                    'label': 'Équilibre des Classes',
                    'type': 'select',
                    'current_value': dataset.sample_balance_level,
                    'options': ['balanced', 'moderate', 'imbalanced', 'severely_imbalanced'],
                    'help': 'Distribution des classes dans le dataset'
                },
                {
                    'name': 'missing_values_handling_method',
                    'label': 'Traitement des Valeurs Manquantes',
                    'type': 'select',
                    'current_value': dataset.missing_values_handling_method,
                    'options': ['none', 'drop', 'impute_mean', 'impute_median', 'impute_mode', 'forward_fill'],
                    'help': 'Méthode recommandée pour traiter les valeurs manquantes'
                }
            ]
        },
        'ethical_criteria': {
            'title': 'Critères Éthiques (OBLIGATOIRE)',
            'fields': [
                {
                    'name': 'informed_consent',
                    'label': 'Consentement Éclairé',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.informed_consent,
                    'options': [
                        {'value': True, 'label': 'Oui - Consentement obtenu'},
                        {'value': False, 'label': 'Non - Données publiques/anonymes'},
                        {'value': None, 'label': 'À vérifier'}
                    ],
                    'help': 'Les sujets ont-ils donné leur consentement éclairé ?'
                },
                {
                    'name': 'anonymization_applied',
                    'label': 'Anonymisation Appliquée',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.anonymization_applied,
                    'options': [
                        {'value': True, 'label': 'Oui - Données anonymisées'},
                        {'value': False, 'label': 'Non - Identifiants préservés'},
                        {'value': None, 'label': 'À vérifier'}
                    ],
                    'help': 'Les données personnelles ont-elles été anonymisées ?'
                },
                {
                    'name': 'transparency',
                    'label': 'Transparence',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.transparency,
                    'options': [
                        {'value': True, 'label': 'Oui - Méthode de collecte documentée'},
                        {'value': False, 'label': 'Non - Collecte non documentée'},
                        {'value': None, 'label': 'À vérifier'}
                    ],
                    'help': 'La méthode de collecte est-elle transparente et documentée ?'
                },
                {
                    'name': 'equity_non_discrimination',
                    'label': 'Équité et Non-Discrimination',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.equity_non_discrimination,
                    'options': [
                        {'value': True, 'label': 'Oui - Pas de biais discriminatoire'},
                        {'value': False, 'label': 'Non - Biais potentiels identifiés'},
                        {'value': None, 'label': 'À évaluer'}
                    ],
                    'help': 'Le dataset est-il exempt de biais discriminatoires ?'
                }
            ]
        }
    }
    
    return {
        'dataset_id': dataset_id,
        'dataset_name': dataset.dataset_name,
        'form_structure': form_structure,
        'completion_status': get_completion_status(dataset_id, db)
    }


@app.put("/datasets/metadata/{dataset_id}/complete")
def complete_metadata(
    dataset_id: str,
    updates: dict,
    db: Session = Depends(database.get_db)
):
    """
    Met à jour les métadonnées d'un dataset.
    
    Permet de compléter les champs manquants ou corriger les valeurs existantes.
    """
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset non trouvé")
    
    # Valider que les champs obligatoires sont présents
    required_ethical_fields = [
        'informed_consent',
        'transparency',
        'anonymization_applied',
        'equity_non_discrimination'
    ]
    
    for field in required_ethical_fields:
        if field in updates and updates[field] is None:
            raise HTTPException(
                status_code=400,
                detail=f"Le champ éthique '{field}' est obligatoire et ne peut pas être vide"
            )
    
    # Appliquer les mises à jour
    update_count = 0
    for field, value in updates.items():
        if hasattr(dataset, field):
            setattr(dataset, field, value)
            update_count += 1
    
    db.commit()
    
    # Recalculer le statut de complétude
    new_status = get_completion_status(dataset_id, db)
    
    return {
        'message': f'{update_count} champs mis à jour avec succès',
        'completion_status': new_status,
        'dataset_id': dataset_id
    }


def get_field_description(field: str) -> str:
    """Retourne une description d'aide pour un champ."""
    descriptions = {
        'informed_consent': 'Indique si les sujets ont donné leur consentement éclairé pour l\'utilisation des données',
        'transparency': 'Documente si la méthode de collecte des données est transparente et accessible',
        'anonymization_applied': 'Précise si des techniques d\'anonymisation ont été appliquées aux données',
        'data_quality_documented': 'Indique si la qualité des données a été évaluée et documentée',
        'equity_non_discrimination': 'Évalue si le dataset est exempt de biais discriminatoires',
        'instances_number': 'Nombre total de lignes/observations dans le dataset',
        'features_number': 'Nombre total de colonnes/variables dans le dataset',
        'domain': 'Domaines d\'application du dataset (éducation, santé, finance, etc.)',
        'task': 'Types de tâches de machine learning possibles (classification, régression, etc.)'
    }
    
    return descriptions.get(field, 'Description non disponible')


def is_default_value(field: str, value) -> bool:
    """Détermine si une valeur est une valeur par défaut qui nécessite validation."""
    # Valeurs par défaut typiques qui nécessitent révision
    default_patterns = {
        'representativity_level': ['medium'],
        'sample_balance_level': ['balanced', 'moderate'],
        'informed_consent': [True],  # Vrai par défaut mais doit être vérifié
        'transparency': [True],
    }
    
    return field in default_patterns and value in default_patterns[field]


# =====================================
# ENDPOINTS ADMIN - TEMPLATES ÉTHIQUES
# =====================================

@app.get("/admin/ethical-templates")
def get_ethical_templates():
    """
    Récupère tous les templates éthiques depuis le fichier YAML.
    """
    try:
        import yaml
        from pathlib import Path
        
        # Chemin vers le fichier de templates
        templates_path = Path(__file__).parent.parent.parent / "datasets" / "kaggle-import" / "templates" / "ethical_defaults.yaml"
        
        if not templates_path.exists():
            # Retourner des templates par défaut si le fichier n'existe pas
            default_templates = _get_default_templates()
            return {"templates": default_templates}
        
        # Charger le fichier YAML
        with open(templates_path, 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
        
        # Convertir en format API
        templates = []
        for domain, config in yaml_data.items():
            template = {
                "domain": domain,
                "ethical": config.get("ethical", {}),
                "technical": config.get("technical", {}),
                "quality": config.get("quality", {})
            }
            templates.append(template)
        
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des templates: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des templates: {str(e)}")


@app.put("/admin/ethical-templates")
def save_ethical_templates(request: dict):
    """
    Sauvegarde les templates éthiques dans le fichier YAML.
    """
    try:
        import yaml
        from pathlib import Path
        
        templates = request.get("templates", [])
        
        # Valider les templates
        validation_result = _validate_templates(templates)
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=422, 
                detail=f"Templates invalides: {', '.join(validation_result['errors'])}"
            )
        
        # Convertir en format YAML
        yaml_data = {}
        for template in templates:
            domain = template["domain"]
            yaml_data[domain] = {
                "ethical": template["ethical"],
                "technical": template["technical"],
                "quality": template["quality"]
            }
        
        # Sauvegarder dans le fichier YAML
        templates_path = Path(__file__).parent.parent.parent / "datasets" / "kaggle-import" / "templates" / "ethical_defaults.yaml"
        templates_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(templates_path, 'w', encoding='utf-8') as f:
            yaml.dump(yaml_data, f, default_flow_style=False, allow_unicode=True, indent=2)
        
        logger.info(f"Templates éthiques sauvegardés: {len(templates)} domaines")
        
        return {
            "message": f"Templates sauvegardés avec succès",
            "templates_count": len(templates),
            "domains": [t["domain"] for t in templates]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde des templates: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la sauvegarde: {str(e)}")


@app.post("/admin/ethical-templates/reset")
def reset_ethical_templates():
    """
    Restaure les templates éthiques par défaut.
    """
    try:
        import yaml
        from pathlib import Path
        
        # Obtenir les templates par défaut
        default_templates = _get_default_templates_yaml()
        
        # Sauvegarder dans le fichier YAML
        templates_path = Path(__file__).parent.parent.parent / "datasets" / "kaggle-import" / "templates" / "ethical_defaults.yaml"
        templates_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(templates_path, 'w', encoding='utf-8') as f:
            f.write(default_templates)
        
        logger.info("Templates éthiques restaurés par défaut")
        
        return {
            "message": "Templates restaurés par défaut avec succès",
            "templates_restored": True
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la restauration des templates: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la restauration: {str(e)}")


@app.get("/admin/ethical-templates/validate")
def validate_ethical_templates():
    """
    Valide les templates éthiques actuels.
    """
    try:
        # Récupérer les templates actuels
        current_templates = get_ethical_templates()
        templates = current_templates["templates"]
        
        # Valider
        validation_result = _validate_templates(templates)
        
        return {
            "valid": validation_result["valid"],
            "templates_count": len(templates),
            "errors": validation_result["errors"],
            "warnings": validation_result["warnings"]
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la validation des templates: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la validation: {str(e)}")


def _validate_templates(templates: List[dict]) -> dict:
    """Valide la structure des templates."""
    errors = []
    warnings = []
    
    required_ethical_fields = [
        'informed_consent', 'transparency', 'equity_non_discrimination',
        'security_measures_in_place', 'data_quality_documented',
        'anonymization_applied', 'record_keeping_policy_exists',
        'purpose_limitation_respected', 'accountability_defined'
    ]
    
    required_technical_fields = ['representativity_level', 'sample_balance_level']
    
    valid_representativity = ['high', 'medium', 'low', 'unknown']
    valid_balance = ['balanced', 'moderate', 'imbalanced', 'severely_imbalanced']
    
    for template in templates:
        domain = template.get("domain", "unknown")
        
        # Vérifier la section éthique
        if "ethical" not in template:
            errors.append(f"Template '{domain}': Section 'ethical' manquante")
        else:
            ethical = template["ethical"]
            for field in required_ethical_fields:
                if field not in ethical:
                    errors.append(f"Template '{domain}': Champ éthique '{field}' manquant")
                elif not isinstance(ethical[field], bool):
                    errors.append(f"Template '{domain}': Champ éthique '{field}' doit être booléen")
        
        # Vérifier la section technique
        if "technical" not in template:
            errors.append(f"Template '{domain}': Section 'technical' manquante")
        else:
            technical = template["technical"]
            for field in required_technical_fields:
                if field not in technical:
                    errors.append(f"Template '{domain}': Champ technique '{field}' manquant")
            
            if "representativity_level" in technical and technical["representativity_level"] not in valid_representativity:
                errors.append(f"Template '{domain}': 'representativity_level' doit être dans {valid_representativity}")
            
            if "sample_balance_level" in technical and technical["sample_balance_level"] not in valid_balance:
                errors.append(f"Template '{domain}': 'sample_balance_level' doit être dans {valid_balance}")
        
        # Avertissements
        if domain == "default" and template.get("ethical", {}).get("informed_consent", False):
            warnings.append(f"Template '{domain}': Le consentement par défaut devrait probablement être False")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def _get_default_templates() -> List[dict]:
    """Retourne les templates par défaut au format API."""
    return [
        {
            "domain": "default",
            "ethical": {
                "informed_consent": False,
                "transparency": True,
                "user_control": False,
                "equity_non_discrimination": True,
                "security_measures_in_place": True,
                "data_quality_documented": True,
                "anonymization_applied": False,
                "record_keeping_policy_exists": True,
                "purpose_limitation_respected": True,
                "accountability_defined": True
            },
            "technical": {
                "representativity_level": "medium",
                "sample_balance_level": "moderate"
            },
            "quality": {
                "data_errors_description": "Qualité à vérifier selon la source"
            }
        },
        {
            "domain": "education",
            "ethical": {
                "informed_consent": True,
                "transparency": True,
                "user_control": False,
                "equity_non_discrimination": True,
                "security_measures_in_place": True,
                "data_quality_documented": True,
                "anonymization_applied": True,
                "record_keeping_policy_exists": True,
                "purpose_limitation_respected": True,
                "accountability_defined": True
            },
            "technical": {
                "representativity_level": "high",
                "sample_balance_level": "balanced"
            },
            "quality": {
                "data_errors_description": "Dataset éducatif - qualité académique attendue"
            }
        },
        {
            "domain": "healthcare",
            "ethical": {
                "informed_consent": True,
                "transparency": True,
                "user_control": True,
                "equity_non_discrimination": True,
                "security_measures_in_place": True,
                "data_quality_documented": True,
                "anonymization_applied": True,
                "record_keeping_policy_exists": True,
                "purpose_limitation_respected": True,
                "accountability_defined": True
            },
            "technical": {
                "representativity_level": "high",
                "sample_balance_level": "moderate"
            },
            "quality": {
                "data_errors_description": "Dataset santé - qualité médicale vérifiée obligatoire"
            }
        }
    ]


def _get_default_templates_yaml() -> str:
    """Retourne les templates par défaut au format YAML."""
    return """# Templates de métadonnées éthiques par défaut
# Générés automatiquement par l'interface d'administration

default:
  ethical:
    informed_consent: false
    transparency: true
    user_control: false
    equity_non_discrimination: true
    security_measures_in_place: true
    data_quality_documented: true
    anonymization_applied: false
    record_keeping_policy_exists: true
    purpose_limitation_respected: true
    accountability_defined: true
  technical:
    representativity_level: "medium"
    sample_balance_level: "moderate"
  quality:
    data_errors_description: "Qualité à vérifier selon la source"

education:
  ethical:
    informed_consent: true
    transparency: true
    user_control: false
    equity_non_discrimination: true
    security_measures_in_place: true
    data_quality_documented: true
    anonymization_applied: true
    record_keeping_policy_exists: true
    purpose_limitation_respected: true
    accountability_defined: true
  technical:
    representativity_level: "high"
    sample_balance_level: "balanced"
  quality:
    data_errors_description: "Dataset éducatif - qualité académique attendue"

healthcare:
  ethical:
    informed_consent: true
    transparency: true
    user_control: true
    equity_non_discrimination: true
    security_measures_in_place: true
    data_quality_documented: true
    anonymization_applied: true
    record_keeping_policy_exists: true
    purpose_limitation_respected: true
    accountability_defined: true
  technical:
    representativity_level: "high"
    sample_balance_level: "moderate"
  quality:
    data_errors_description: "Dataset santé - qualité médicale vérifiée obligatoire"
"""


# === ENDPOINT POUR L'ANALYSE DES DONNÉES MANQUANTES ===

@app.get("/datasets/{dataset_id}/missing-data-analysis")
def get_missing_data_analysis(
    dataset_id: str,
    db: Session = Depends(database.get_db)
):
    """
    Analyse les données manquantes pour un dataset donné.
    
    Args:
        dataset_id: ID du dataset à analyser
        
    Returns:
        Analyse complète des données manquantes avec score et suggestions
    """
    try:
        # Import du service d'analyse
        try:
            from .services.missing_data_analysis import missing_data_analyzer
        except ImportError:
            import sys
            import os
            sys.path.append(os.path.dirname(__file__))
            from services.missing_data_analysis import missing_data_analyzer
        
        # Vérifier que le dataset existe
        dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} non trouvé")
        
        # Effectuer l'analyse
        analysis_result = missing_data_analyzer.analyze_dataset_missing_data(dataset_id, db)
        
        logger.info(f"[MISSING DATA] Analyse terminée pour dataset {dataset_id} - Score: {analysis_result['missingDataScore']['overallScore']}")
        
        return analysis_result
        
    except ValueError as e:
        logger.error(f"[MISSING DATA] Erreur de validation pour dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"[MISSING DATA] Erreur lors de l'analyse pour dataset {dataset_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Erreur lors de l'analyse des données manquantes"
        )


def _analyze_and_save_file_columns(dataset: models.Dataset, db: Session):
    """
    Analyse les fichiers d'un dataset et sauvegarde les métadonnées des colonnes.
    
    Args:
        dataset: Instance du dataset créé
        db: Session de base de données
    """
    storage_client = get_storage_client()
    
    # Récupérer tous les fichiers du dataset
    dataset_files = db.query(models.DatasetFile).filter(
        models.DatasetFile.dataset_id == dataset.id
    ).all()
    
    for dataset_file in dataset_files:
        try:
            # Télécharger le fichier depuis le stockage
            object_path = f"{dataset.storage_path}{dataset_file.file_name_in_storage}"
            file_data = storage_client.download_file(object_path)
            
            # Analyser le fichier selon son format
            if dataset_file.format.lower() in ['csv', 'parquet']:
                columns_metadata = _analyze_tabular_file(file_data, dataset_file.format.lower())
                
                # Sauvegarder les métadonnées des colonnes
                for i, col_meta in enumerate(columns_metadata):
                    file_column = models.FileColumn(
                        dataset_file_id=dataset_file.id,
                        column_name=col_meta['name'],
                        data_type_original=col_meta.get('dtype_original', 'unknown'),
                        data_type_interpreted=col_meta.get('dtype_interpreted', 'unknown'),
                        is_nullable=col_meta.get('has_nulls', True),
                        is_pii=False,  # TODO: Détection automatique PII
                        example_values=col_meta.get('examples', [])[:10],  # Limiter à 10 exemples
                        position=i,
                        stats=col_meta.get('stats', {})
                    )
                    db.add(file_column)
                
                # Mettre à jour le row_count du fichier
                if 'row_count' in columns_metadata[0] if columns_metadata else False:
                    dataset_file.row_count = columns_metadata[0]['row_count']
                
                logger.info(f"Analysé {len(columns_metadata)} colonnes pour fichier {dataset_file.file_name_in_storage}")
                
        except Exception as e:
            logger.error(f"Erreur lors de l'analyse du fichier {dataset_file.file_name_in_storage}: {str(e)}")
            continue
    
    # Calculer les statistiques agrégées du dataset
    total_instances = 0
    total_features = 0
    
    # Récupérer les statistiques depuis les fichiers analysés
    for dataset_file in dataset_files:
        if dataset_file.row_count:
            # Prendre le maximum des instances (cas où les fichiers contiennent les mêmes données)
            total_instances = max(total_instances, dataset_file.row_count)
        
        # Compter les colonnes de ce fichier
        file_columns_count = db.query(models.FileColumn).filter(
            models.FileColumn.dataset_file_id == dataset_file.id
        ).count()
        total_features += file_columns_count
    
    # Mettre à jour le dataset avec les statistiques calculées
    if total_instances > 0:
        dataset.instances_number = total_instances
        logger.info(f"Dataset {dataset.id} mis à jour - Instances: {total_instances}")
    
    if total_features > 0:
        dataset.features_number = total_features
        logger.info(f"Dataset {dataset.id} mis à jour - Features: {total_features}")
    
    # Commit les nouvelles FileColumn + les statistiques du dataset
    db.commit()


def _analyze_tabular_file(file_data: bytes, file_format: str) -> List[Dict]:
    """
    Analyse un fichier tabulaire (CSV ou Parquet) et extrait les métadonnées des colonnes.
    
    Args:
        file_data: Données du fichier en bytes
        file_format: Format du fichier ('csv' ou 'parquet')
        
    Returns:
        Liste des métadonnées des colonnes
    """
    try:
        # Lire le fichier selon son format
        if file_format == 'parquet':
            df = pd.read_parquet(io.BytesIO(file_data))
        else:  # csv
            df = pd.read_csv(io.BytesIO(file_data))
        
        columns_metadata = []
        row_count = len(df)
        
        for col_name in df.columns:
            col_data = df[col_name]
            
            # Statistiques de base
            has_nulls = col_data.isnull().any()
            null_count = col_data.isnull().sum()
            
            # Type de données
            dtype_original = str(col_data.dtype)
            dtype_interpreted = _interpret_column_type(col_data)
            
            # Exemples de valeurs (non nulles)
            examples = col_data.dropna().head(5).astype(str).tolist()
            
            # Statistiques avancées
            stats = {
                'null_count': int(null_count),
                'null_percentage': float(null_count / row_count * 100) if row_count > 0 else 0,
                'unique_count': int(col_data.nunique()),
                'row_count': row_count
            }
            
            # Statistiques numériques si applicable
            if pd.api.types.is_numeric_dtype(col_data):
                stats.update({
                    'min': float(col_data.min()) if not col_data.empty else None,
                    'max': float(col_data.max()) if not col_data.empty else None,
                    'mean': float(col_data.mean()) if not col_data.empty else None,
                    'std': float(col_data.std()) if not col_data.empty else None
                })
            
            columns_metadata.append({
                'name': col_name,
                'dtype_original': dtype_original,
                'dtype_interpreted': dtype_interpreted,
                'has_nulls': has_nulls,
                'examples': examples,
                'stats': stats,
                'row_count': row_count
            })
            
        return columns_metadata
        
    except Exception as e:
        logger.error(f"Erreur lors de l'analyse du fichier {file_format}: {str(e)}")
        return []


def _interpret_column_type(col_data: pd.Series) -> str:
    """
    Interprète le type sémantique d'une colonne pandas.
    
    Args:
        col_data: Série pandas
        
    Returns:
        Type interprété ('numerical', 'categorical', 'text', 'datetime', 'boolean')
    """
    if pd.api.types.is_bool_dtype(col_data):
        return 'boolean'
    elif pd.api.types.is_numeric_dtype(col_data):
        return 'numerical'
    elif pd.api.types.is_datetime64_any_dtype(col_data):
        return 'datetime'
    else:
        # Pour les chaînes, déterminer si c'est catégoriel ou textuel
        unique_ratio = col_data.nunique() / len(col_data.dropna()) if len(col_data.dropna()) > 0 else 0
        if unique_ratio < 0.5:  # Moins de 50% de valeurs uniques → catégoriel
            return 'categorical'
        else:
            return 'text'


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
