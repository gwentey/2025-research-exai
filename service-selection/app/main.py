from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

# Approche hybride pour gérer les imports en local et dans Docker
try:
    # Imports relatifs pour le développement local
    from . import models
    from . import database
except ImportError:
    # Imports absolus pour le conteneur Docker
    import models
    import database
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# --- Configuration de l'application FastAPI ---

# On initialise notre application FastAPI.
# On lui donne un titre et une description qui apparaîtront dans la documentation automatique (Swagger UI / ReDoc).
app = FastAPI(
    title="Service de Sélection de Datasets",
    description="API pour la gestion des datasets pour le projet EXAI, avec un focus sur les métadonnées techniques et éthiques.",
    version="1.0.0"
)

# On configure le middleware CORS (Cross-Origin Resource Sharing).
# Cela permet à notre frontend (qui tournera sur une origine différente, ex: localhost:4200)
# de faire des requêtes vers cette API (ex: localhost:8081).
# Pour la production, il faudra restreindre `allow_origins` à l'URL du frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Attention: Très permissif pour le dev, à changer en prod !
    allow_credentials=True,
    allow_methods=["*"], # Autorise toutes les méthodes HTTP (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Autorise tous les en-têtes HTTP
)

# --- Modèles Pydantic (Schémas de données API) ---
# Ces modèles définissent la structure des données attendues dans les requêtes
# et renvoyées dans les réponses de notre API. Ils assurent la validation des données.

class DatasetBase(BaseModel):
    """ Modèle Pydantic de base pour un Dataset. Contient les champs communs. """
    name: str
    description: Optional[str] = None
    file_path: str
    file_type: Optional[str] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    technical_metadata: Optional[dict] = None
    ethical_metadata: Optional[dict] = None
    is_public: bool = False
    created_by: Optional[str] = None

class DatasetCreate(DatasetBase):
    """ Modèle Pydantic utilisé pour la création d'un nouveau Dataset. Hérite de DatasetBase. """
    # Pour l'instant, identique à DatasetBase, mais pourrait avoir des champs spécifiques plus tard.
    pass

class Dataset(DatasetBase):
    """
    Modèle Pydantic utilisé pour renvoyer un Dataset complet dans les réponses API.
    Inclut les champs générés automatiquement par la base de données (id, timestamps).
    """
    id: int
    created_at: datetime
    updated_at: datetime
    last_modified_by: Optional[str] = None

    # `Config.from_attributes = True` permet à Pydantic de lire les données directement
    # depuis un objet modèle SQLAlchemy (mode ORM).
    class Config:
        from_attributes = True

# --- Routes de l'API ---

@app.get("/")
async def root():
    """ Route racine simple pour vérifier que l'API est en ligne. """
    return {
        "message": "Bienvenue sur l'API du Service de Sélection de Datasets",
        "version": app.version,
        "documentation": ["/docs", "/redoc"]
    }

@app.get("/datasets", response_model=List[Dataset])
def list_datasets(
    skip: int = Query(0, ge=0, description="Nombre d'éléments à sauter (pour la pagination)"),
    limit: int = Query(100, ge=1, le=200, description="Nombre maximal d'éléments à retourner"),
    db: Session = Depends(database.get_db)
):
    """
    Récupère une liste paginée de tous les datasets disponibles.

    Args:
        skip: Le nombre de datasets à ignorer depuis le début.
        limit: Le nombre maximum de datasets à retourner.
        db: La session de base de données injectée par FastAPI.

    Returns:
        Une liste d'objets Dataset.
    """
    datasets = db.query(models.Dataset).offset(skip).limit(limit).all()
    return datasets

@app.post("/datasets", response_model=Dataset, status_code=201)
def create_dataset(dataset: DatasetCreate, db: Session = Depends(database.get_db)):
    """
    Crée un nouvel enregistrement de dataset dans la base de données.

    Args:
        dataset: Les données du dataset à créer (validées par Pydantic).
        db: La session de base de données.

    Returns:
        Le dataset nouvellement créé, incluant son ID et timestamps.
    """
    # On crée une instance du modèle SQLAlchemy à partir des données Pydantic
    db_dataset = models.Dataset(**dataset.dict())
    # On ajoute le nouvel objet à la session
    db.add(db_dataset)
    # On commit la transaction pour sauvegarder en base
    db.commit()
    # On rafraîchit l'objet pour obtenir les valeurs générées par la DB (comme l'ID)
    db.refresh(db_dataset)
    return db_dataset

@app.get("/datasets/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: int, db: Session = Depends(database.get_db)):
    """
    Récupère les détails d'un dataset spécifique par son ID.

    Args:
        dataset_id: L'ID du dataset à récupérer.
        db: La session de base de données.

    Raises:
        HTTPException(404): Si aucun dataset avec cet ID n'est trouvé.

    Returns:
        Les détails du dataset trouvé.
    """
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        # Si on ne trouve pas le dataset, on lève une exception HTTP 404.
        raise HTTPException(status_code=404, detail=f"Dataset avec l'ID {dataset_id} non trouvé")
    return dataset

@app.put("/datasets/{dataset_id}", response_model=Dataset)
def update_dataset(
    dataset_id: int,
    dataset_update: DatasetCreate, # On utilise DatasetCreate car l'ID n'est pas modifiable
    db: Session = Depends(database.get_db)
):
    """
    Met à jour les informations d'un dataset existant.

    Args:
        dataset_id: L'ID du dataset à mettre à jour.
        dataset_update: Les nouvelles données pour le dataset.
        db: La session de base de données.

    Raises:
        HTTPException(404): Si le dataset à mettre à jour n'existe pas.

    Returns:
        Le dataset mis à jour.
    """
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if db_dataset is None:
        raise HTTPException(status_code=404, detail=f"Impossible de mettre à jour : Dataset avec l'ID {dataset_id} non trouvé")

    # On met à jour les champs de l'objet SQLAlchemy avec les nouvelles données
    update_data = dataset_update.dict(exclude_unset=True) # exclude_unset pour ne pas écraser avec None si non fourni
    for key, value in update_data.items():
        setattr(db_dataset, key, value)

    # On met à jour manuellement le timestamp de modification (si on ne veut pas se fier uniquement à onupdate)
    # db_dataset.updated_at = datetime.utcnow() # SQLAlchemy le fait déjà avec onupdate

    db.commit() # Sauvegarde les changements
    db.refresh(db_dataset) # Rafraîchit l'objet depuis la DB
    return db_dataset

@app.delete("/datasets/{dataset_id}", status_code=200)
def delete_dataset(dataset_id: int, db: Session = Depends(database.get_db)):
    """
    Supprime un dataset de la base de données par son ID.

    Args:
        dataset_id: L'ID du dataset à supprimer.
        db: La session de base de données.

    Raises:
        HTTPException(404): Si le dataset à supprimer n'existe pas.

    Returns:
        Un message de confirmation.
    """
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Impossible de supprimer : Dataset avec l'ID {dataset_id} non trouvé")

    db.delete(dataset) # Marque l'objet pour suppression
    db.commit() # Exécute la suppression en base
    return {"message": f"Dataset avec l'ID {dataset_id} supprimé avec succès"}

# --- Point d'entrée pour Uvicorn (si on lance avec `python main.py`) ---
# Bien que l'on utilise généralement `uvicorn main:app --reload`,
# cela permet de lancer l'application avec un simple `python main.py`.
if __name__ == "__main__":
    import uvicorn
    # On utilise les paramètres host='0.0.0.0' pour le rendre accessible
    # depuis l'extérieur du conteneur Docker, et le port 8081.
    uvicorn.run(app, host="0.0.0.0", port=8081)
