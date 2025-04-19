from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

# Base declarative pour tous nos modèles SQLAlchemy.
# C'est la classe de base que nos modèles ORM hériteront.
Base = declarative_base()

class Dataset(Base):
    """
    Modèle SQLAlchemy représentant un jeu de données (dataset) dans notre base.

    Chaque instance de cette classe correspond à une ligne dans la table 'datasets'.
    Elle contient toutes les informations pertinentes sur un jeu de données,
    y compris ses métadonnées techniques et éthiques.
    """
    __tablename__ = "datasets"

    # Identifiant unique du dataset (clé primaire).
    id = Column(Integer, primary_key=True, index=True)

    # Nom lisible du jeu de données. Obligatoire.
    name = Column(String(100), nullable=False)

    # Description détaillée du contenu et de l'objectif du dataset.
    description = Column(String(500))

    # Source du dataset (ex: URL, nom de fichier uploadé, base de données source).
    source = Column(String(255))

    # Chemin d'accès au fichier du dataset (par exemple, sur un stockage partagé). Obligatoire.
    file_path = Column(String(255), nullable=False)

    # Type de fichier (ex: 'csv', 'json', 'parquet'). Aide à déterminer comment le lire.
    file_type = Column(String(50))

    # Nombre de lignes dans le dataset. Utile pour un aperçu rapide.
    row_count = Column(Integer)

    # Nombre de colonnes (caractéristiques) dans le dataset.
    column_count = Column(Integer)

    # Taille du fichier en octets.
    size_bytes = Column(Integer)

    # Type de tâche ML principale pour laquelle ce dataset est adapté.
    task_type = Column(String(50), index=True)

    # Score de qualité/pertinence calculé pour ce dataset.
    quality_score = Column(Float)

    # Aperçu des premières lignes ou d'un échantillon des données, stocké en JSON.
    preview_data = Column(JSON)

    # Métadonnées techniques stockées au format JSON.
    # Peut inclure des infos sur l'encodage, le séparateur (pour CSV), les types de colonnes, etc.
    technical_metadata = Column(JSON)

    # Métadonnées éthiques stockées au format JSON.
    # Crucial pour notre projet EXAI. Peut inclure des infos sur les biais potentiels,
    # le niveau de confidentialité, la provenance, les licences d'utilisation, etc.
    ethical_metadata = Column(JSON)

    # Indicateur booléen pour savoir si le dataset est public ou privé.
    is_public = Column(Boolean, default=False)

    # Date et heure de création de l'enregistrement du dataset. Automatiquement défini.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Date et heure de la dernière modification. Mis à jour automatiquement.
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Identifiant (ou nom) de l'utilisateur qui a ajouté le dataset.
    created_by = Column(String(100))

    # Identifiant (ou nom) de l'utilisateur qui a effectué la dernière modification.
    last_modified_by = Column(String(100))
