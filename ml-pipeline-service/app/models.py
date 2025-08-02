from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, Text, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from datetime import datetime
import uuid

# Base declarative pour tous nos modèles SQLAlchemy.
# C'est la classe de base que nos modèles ORM hériteront.
Base = declarative_base()

class Experiment(Base):
    """
    Modèle SQLAlchemy pour la table des expériences ML.
    
    Cette table contient toutes les métadonnées d'une expérience d'entraînement ML :
    - Configuration de l'expérience (algorithme, hyperparamètres, preprocessing)
    - Statut et progression de l'entraînement
    - Résultats et métriques
    - Liens vers les artefacts (modèle, visualisations)
    """
    __tablename__ = "experiments"

    # === IDENTIFICATION & PK ===
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === IDENTIFICATION DE L'EXPÉRIENCE ===
    user_id = Column(PostgreSQLUUID(as_uuid=True), nullable=False, index=True)
    project_id = Column(PostgreSQLUUID(as_uuid=True), nullable=False, index=True)  
    dataset_id = Column(PostgreSQLUUID(as_uuid=True), nullable=False, index=True)
    
    # === CONFIGURATION ML ===
    algorithm = Column(String(50), nullable=False)
    hyperparameters = Column(JSONB, nullable=False)
    preprocessing_config = Column(JSONB, nullable=False)
    
    # === STATUT ET PROGRESSION ===
    status = Column(String(20), nullable=False, default='pending', index=True)
    progress = Column(Integer, nullable=True, default=0)
    task_id = Column(String(100), nullable=True)  # ID de la tâche Celery
    error_message = Column(Text, nullable=True)
    
    # === RÉSULTATS ET ARTEFACTS ===
    metrics = Column(JSONB, nullable=True)
    artifact_uri = Column(String(500), nullable=True)
    visualizations = Column(JSONB, nullable=True)
    feature_importance = Column(JSONB, nullable=True)
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class DataQualityAnalysis(Base):
    """
    Cache des analyses de qualité des données pour éviter de recalculer à chaque fois.
    
    Cette table stocke :
    - L'analyse complète des données manquantes et outliers
    - Les stratégies recommandées par colonne
    - Un score de qualité global
    """
    __tablename__ = "data_quality_analyses"
    
    # === IDENTIFICATION ===
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    dataset_id = Column(PostgreSQLUUID(as_uuid=True), nullable=False, index=True)
    dataset_version = Column(String(50), nullable=True)  # Hash ou version pour invalider le cache
    
    # === ANALYSE ===
    analysis_data = Column(JSONB, nullable=False)  # Analyse complète sérialisée
    column_strategies = Column(JSONB, nullable=True)  # Stratégies recommandées {column: {strategy, reason}}
    quality_score = Column(Integer, nullable=False)  # Score de 0 à 100
    
    # === MÉTADONNÉES ===
    total_rows = Column(Integer, nullable=False)
    total_columns = Column(Integer, nullable=False)
    analysis_duration_seconds = Column(Float, nullable=True)
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Pour gérer l'expiration du cache 