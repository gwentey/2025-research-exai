from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, Text, UUID, ARRAY, ForeignKey, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
import uuid

# Base declarative pour tous nos modèles SQLAlchemy.
# C'est la classe de base que nos modèles ORM hériteront.
Base = declarative_base()

class Dataset(Base):
    """
    Modèle SQLAlchemy pour la table principale des datasets.
    
    Cette table contient toutes les métadonnées d'un dataset, organisées en sections :
    - Identification & Informations Générales
    - Caractéristiques Techniques  
    - Critères Éthiques
    - Timestamps
    """
    __tablename__ = "datasets"

    # === IDENTIFICATION & PK ===
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
    dataset_name = Column(String(255), nullable=False, index=True)
    year = Column(Integer, nullable=True)
    objective = Column(Text, nullable=True)
    access = Column(String(100), nullable=True)
    availability = Column(String(100), nullable=True)
    num_citations = Column(Integer, nullable=True, default=0)
    citation_link = Column(Text, nullable=True)
    sources = Column(Text, nullable=True)
    storage_uri = Column(String(500), nullable=True)
    
    # === CARACTÉRISTIQUES TECHNIQUES ===
    instances_number = Column(Integer, nullable=True)
    features_description = Column(Text, nullable=True)
    features_number = Column(Integer, nullable=True)
    domain = Column(ARRAY(Text), nullable=True)  # Liste de domaines
    representativity_description = Column(Text, nullable=True)
    representativity_level = Column(String(50), nullable=True)
    sample_balance_description = Column(Text, nullable=True)
    sample_balance_level = Column(String(50), nullable=True)
    split = Column(Boolean, nullable=True, default=False)
    missing_values_description = Column(Text, nullable=True)
    has_missing_values = Column(Boolean, nullable=True, default=False)
    global_missing_percentage = Column(Float, nullable=True)
    missing_values_handling_method = Column(String(100), nullable=True)
    temporal_factors = Column(Boolean, nullable=True, default=False)
    metadata_provided_with_dataset = Column(Boolean, nullable=True, default=False)
    external_documentation_available = Column(Boolean, nullable=True, default=False)
    documentation_link = Column(Text, nullable=True)
    task = Column(ARRAY(Text), nullable=True)  # Liste de tâches ML
    
    # === CRITÈRES ÉTHIQUES ===
    informed_consent = Column(Boolean, nullable=True, default=False)
    transparency = Column(Boolean, nullable=True, default=False)
    user_control = Column(Boolean, nullable=True, default=False)
    equity_non_discrimination = Column(Boolean, nullable=True, default=False)
    security_measures_in_place = Column(Boolean, nullable=True, default=False)
    data_quality_documented = Column(Boolean, nullable=True, default=False)
    data_errors_description = Column(Text, nullable=True)
    anonymization_applied = Column(Boolean, nullable=True, default=False)
    record_keeping_policy_exists = Column(Boolean, nullable=True, default=False)
    purpose_limitation_respected = Column(Boolean, nullable=True, default=False)
    accountability_defined = Column(Boolean, nullable=True, default=False)
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # === RELATIONS ===
    files = relationship("DatasetFile", back_populates="dataset", cascade="all, delete-orphan")
    relationships_from = relationship("DatasetRelationship", back_populates="dataset", cascade="all, delete-orphan")


class DatasetFile(Base):
    """
    Modèle SQLAlchemy pour les fichiers associés à un dataset.
    
    Un dataset peut avoir plusieurs fichiers (ex: train.csv, test.csv, metadata.json).
    Cette table décrit chaque fichier individuellement.
    """
    __tablename__ = "dataset_files"

    # === IDENTIFICATION ===
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === CLÉ ÉTRANGÈRE ===
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False, index=True)
    
    # === PROPRIÉTÉS ===
    file_name_in_storage = Column(String(255), nullable=False)
    logical_role = Column(String(255), nullable=True)  # Ex: "training_data", "test_data", "metadata"
    format = Column(String(50), nullable=True)  # Ex: "csv", "json", "parquet"
    mime_type = Column(String(100), nullable=True)  # Ex: "text/csv", "application/json"
    size_bytes = Column(BigInteger, nullable=True)
    row_count = Column(BigInteger, nullable=True)
    description = Column(Text, nullable=True)
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # === RELATIONS ===
    dataset = relationship("Dataset", back_populates="files")
    columns = relationship("FileColumn", back_populates="dataset_file", cascade="all, delete-orphan")
    relationships_from = relationship("DatasetRelationship", foreign_keys="DatasetRelationship.from_file_id", back_populates="from_file")
    relationships_to = relationship("DatasetRelationship", foreign_keys="DatasetRelationship.to_file_id", back_populates="to_file")


class FileColumn(Base):
    """
    Modèle SQLAlchemy pour les colonnes d'un fichier de dataset.
    
    Décrit chaque colonne/feature d'un fichier de données avec ses métadonnées,
    types, statistiques et propriétés.
    """
    __tablename__ = "file_columns"

    # === IDENTIFICATION ===
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === CLÉ ÉTRANGÈRE ===
    dataset_file_id = Column(UUID(as_uuid=True), ForeignKey("dataset_files.id"), nullable=False, index=True)
    
    # === PROPRIÉTÉS ===
    column_name = Column(String(255), nullable=False, index=True)
    data_type_original = Column(String(100), nullable=True)  # Type original dans le fichier
    data_type_interpreted = Column(String(50), nullable=True)  # Type interprété (categorical, numerical, text, etc.)
    description = Column(Text, nullable=True)
    is_primary_key_component = Column(Boolean, nullable=False, default=False)
    is_nullable = Column(Boolean, nullable=False, default=True)
    is_pii = Column(Boolean, nullable=False, default=False)  # Personally Identifiable Information
    example_values = Column(ARRAY(Text), nullable=True)  # Exemples de valeurs
    position = Column(Integer, nullable=False)  # Position de la colonne dans le fichier
    stats = Column(JSONB, nullable=True)  # Statistiques calculées (min, max, mean, etc.)
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # === RELATIONS ===
    dataset_file = relationship("DatasetFile", back_populates="columns")
    links_from = relationship("DatasetRelationshipColumnLink", foreign_keys="DatasetRelationshipColumnLink.from_column_id", back_populates="from_column")
    links_to = relationship("DatasetRelationshipColumnLink", foreign_keys="DatasetRelationshipColumnLink.to_column_id", back_populates="to_column")


class DatasetRelationship(Base):
    """
    Modèle SQLAlchemy pour les relations entre fichiers de datasets.
    
    Décrit les relations logiques entre fichiers (ex: foreign key, join, etc.).
    """
    __tablename__ = "dataset_relationships"

    # === IDENTIFICATION ===
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === CLÉS ÉTRANGÈRES ===
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False, index=True)
    from_file_id = Column(UUID(as_uuid=True), ForeignKey("dataset_files.id"), nullable=False, index=True)
    to_file_id = Column(UUID(as_uuid=True), ForeignKey("dataset_files.id"), nullable=False, index=True)
    
    # === PROPRIÉTÉS ===
    relationship_type = Column(String(50), nullable=False)  # Ex: "foreign_key", "join", "reference"
    description = Column(Text, nullable=True)
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # === RELATIONS ===
    dataset = relationship("Dataset", back_populates="relationships_from")
    from_file = relationship("DatasetFile", foreign_keys="DatasetRelationship.from_file_id", back_populates="relationships_from")
    to_file = relationship("DatasetFile", foreign_keys="DatasetRelationship.to_file_id", back_populates="relationships_to")
    column_links = relationship("DatasetRelationshipColumnLink", back_populates="dataset_relationship", cascade="all, delete-orphan")


class DatasetRelationshipColumnLink(Base):
    """
    Modèle SQLAlchemy pour les liens entre colonnes dans une relation.
    
    Décrit précisément quelles colonnes sont liées dans une relation entre fichiers.
    """
    __tablename__ = "dataset_relationship_column_links"

    # === IDENTIFICATION ===
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === CLÉS ÉTRANGÈRES ===
    relationship_id = Column(UUID(as_uuid=True), ForeignKey("dataset_relationships.id"), nullable=False, index=True)
    from_column_id = Column(UUID(as_uuid=True), ForeignKey("file_columns.id"), nullable=False, index=True)
    to_column_id = Column(UUID(as_uuid=True), ForeignKey("file_columns.id"), nullable=False, index=True)
    
    # === PROPRIÉTÉS ===
    link_order = Column(Integer, nullable=False, default=1)  # Ordre du lien dans la relation (pour les clés composites)
    
    # === RELATIONS ===
    dataset_relationship = relationship("DatasetRelationship", back_populates="column_links")
    from_column = relationship("FileColumn", foreign_keys="DatasetRelationshipColumnLink.from_column_id", back_populates="links_from")
    to_column = relationship("FileColumn", foreign_keys="DatasetRelationshipColumnLink.to_column_id", back_populates="links_to")


class Project(Base):
    """
    Modèle SQLAlchemy pour la table des projets utilisateur.
    
    Cette table contient les projets créés par les utilisateurs avec leurs critères
    de filtrage personnalisés et les poids pour le scoring des datasets.
    """
    __tablename__ = "projects"

    # === IDENTIFICATION & PK ===
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # === CLÉ ÉTRANGÈRE ===
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Foreign key vers la table users de l'api-gateway
    
    # === INFORMATIONS DU PROJET ===
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # === CRITÈRES ET CONFIGURATION ===
    criteria = Column(JSONB, nullable=True)  # Critères de filtrage stockés au format DatasetFilterCriteria
    weights = Column(JSONB, nullable=True)  # Poids des critères pour le scoring
    
    # === TIMESTAMPS ===
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
