from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

# Schéma de base pour les données d'un dataset
# Contient les champs communs partagés par la création et la lecture.
class DatasetBase(BaseModel):
    name: str = Field(..., max_length=100, description="Nom lisible du jeu de données.")
    description: Optional[str] = Field(None, max_length=500, description="Description détaillée du contenu et de l'objectif du dataset.")
    source: Optional[str] = Field(None, max_length=255, description="Source du dataset (URL, nom de fichier uploadé, etc.).")
    file_path: str = Field(..., max_length=255, description="Chemin d'accès au fichier du dataset.")
    file_type: Optional[str] = Field(None, max_length=50, description="Type de fichier (ex: csv, json).")
    row_count: Optional[int] = Field(None, description="Nombre de lignes.")
    column_count: Optional[int] = Field(None, description="Nombre de colonnes.")
    size_bytes: Optional[int] = Field(None, description="Taille du fichier en octets.")
    task_type: Optional[str] = Field(None, max_length=50, description="Type de tâche ML principale (classification, régression).")
    technical_metadata: Optional[Dict[str, Any]] = Field(None, description="Métadonnées techniques (encodage, séparateur, types colonnes...). Format JSON.")
    ethical_metadata: Optional[Dict[str, Any]] = Field(None, description="Métadonnées éthiques (biais, confidentialité, licence, tags...). Format JSON.")
    preview_data: Optional[Dict[str, Any]] = Field(None, description="Aperçu/échantillon des données. Format JSON.")
    is_public: bool = Field(False, description="Indicateur si le dataset est public.")
    # quality_score n'est pas dans Base car souvent calculé après création

# Schéma pour la création d'un nouveau dataset (hérite de Base)
# Les champs requis pour créer un nouveau dataset.
class DatasetCreate(DatasetBase):
    # Tous les champs de DatasetBase sont potentiellement utiles à la création,
    # certains comme file_path et name sont obligatoires (marqués par ... dans Base).
    # Les champs Optionnels peuvent être fournis ou non.
    pass # Aucune modification nécessaire par rapport à Base pour l'instant

# Schéma pour la mise à jour d'un dataset (hérite de Base)
# Tous les champs sont optionnels lors d'une mise à jour.
class DatasetUpdate(DatasetBase):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=255)
    file_path: Optional[str] = Field(None, max_length=255)
    file_type: Optional[str] = Field(None, max_length=50)
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    size_bytes: Optional[int] = None
    task_type: Optional[str] = Field(None, max_length=50)
    technical_metadata: Optional[Dict[str, Any]] = None
    ethical_metadata: Optional[Dict[str, Any]] = None
    preview_data: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    quality_score: Optional[float] = Field(None, description="Score de qualité/pertinence calculé.") # Peut être mis à jour


# Schéma pour lire les données d'un dataset (hérite de Base)
# Inclut les champs générés par la base de données comme id, created_at.
class DatasetRead(DatasetBase):
    id: int = Field(..., description="Identifiant unique du dataset.")
    quality_score: Optional[float] = Field(None, description="Score de qualité/pertinence calculé.")
    created_at: datetime = Field(..., description="Date de création de l'enregistrement.")
    updated_at: datetime = Field(..., description="Date de dernière modification.")
    created_by: Optional[str] = Field(None, max_length=100, description="Utilisateur créateur.")
    last_modified_by: Optional[str] = Field(None, max_length=100, description="Dernier utilisateur modificateur.")

    # Configuration pour permettre à Pydantic de lire les données depuis des modèles ORM (SQLAlchemy)
    class Config:
        orm_mode = True 