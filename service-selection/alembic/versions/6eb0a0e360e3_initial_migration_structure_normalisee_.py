"""Initial migration: structure normalisee avec 5 tables

Revision ID: 6eb0a0e360e3
Revises: 
Create Date: 2025-07-06 22:39:15.324522

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB


# revision identifiers, used by Alembic.
revision: str = '6eb0a0e360e3'
down_revision: Union[str, None] = None  # Migration initiale
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial database schema with normalized structure."""
    
    # === CRÉATION DES TABLES ===
    
    # 1. Table principale : datasets
    op.create_table(
        'datasets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        
        # Identification & Informations Générales
        sa.Column('dataset_name', sa.String(255), nullable=False),
        sa.Column('year', sa.Integer, nullable=True),
        sa.Column('objective', sa.Text, nullable=True),
        sa.Column('access', sa.String(100), nullable=True),
        sa.Column('availability', sa.String(100), nullable=True),
        sa.Column('num_citations', sa.Integer, nullable=True, default=0),
        sa.Column('citation_link', sa.Text, nullable=True),
        sa.Column('sources', sa.Text, nullable=True),
        sa.Column('storage_uri', sa.String(500), nullable=True),
        
        # Caractéristiques Techniques
        sa.Column('instances_number', sa.Integer, nullable=True),
        sa.Column('features_description', sa.Text, nullable=True),
        sa.Column('features_number', sa.Integer, nullable=True),
        sa.Column('domain', ARRAY(sa.Text), nullable=True),
        sa.Column('representativity_description', sa.Text, nullable=True),
        sa.Column('representativity_level', sa.String(50), nullable=True),
        sa.Column('sample_balance_description', sa.Text, nullable=True),
        sa.Column('sample_balance_level', sa.String(50), nullable=True),
        sa.Column('split', sa.Boolean, nullable=True, default=False),
        sa.Column('missing_values_description', sa.Text, nullable=True),
        sa.Column('has_missing_values', sa.Boolean, nullable=True, default=False),
        sa.Column('global_missing_percentage', sa.Float, nullable=True),
        sa.Column('missing_values_handling_method', sa.String(100), nullable=True),
        sa.Column('temporal_factors', sa.Boolean, nullable=True, default=False),
        sa.Column('metadata_provided_with_dataset', sa.Boolean, nullable=True, default=False),
        sa.Column('external_documentation_available', sa.Boolean, nullable=True, default=False),
        sa.Column('documentation_link', sa.Text, nullable=True),
        sa.Column('task', ARRAY(sa.Text), nullable=True),
        
        # Critères Éthiques
        sa.Column('informed_consent', sa.Boolean, nullable=True, default=False),
        sa.Column('transparency', sa.Boolean, nullable=True, default=False),
        sa.Column('user_control', sa.Boolean, nullable=True, default=False),
        sa.Column('equity_non_discrimination', sa.Boolean, nullable=True, default=False),
        sa.Column('security_measures_in_place', sa.Boolean, nullable=True, default=False),
        sa.Column('data_quality_documented', sa.Boolean, nullable=True, default=False),
        sa.Column('data_errors_description', sa.Text, nullable=True),
        sa.Column('anonymization_applied', sa.Boolean, nullable=True, default=False),
        sa.Column('record_keeping_policy_exists', sa.Boolean, nullable=True, default=False),
        sa.Column('purpose_limitation_respected', sa.Boolean, nullable=True, default=False),
        sa.Column('accountability_defined', sa.Boolean, nullable=True, default=False),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    )
    
    # 2. Table dataset_files
    op.create_table(
        'dataset_files',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('dataset_id', UUID(as_uuid=True), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('file_name_in_storage', sa.String(255), nullable=False),
        sa.Column('logical_role', sa.String(255), nullable=True),
        sa.Column('format', sa.String(50), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('size_bytes', sa.BigInteger, nullable=True),
        sa.Column('row_count', sa.BigInteger, nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    )
    
    # 3. Table file_columns
    op.create_table(
        'file_columns',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('dataset_file_id', UUID(as_uuid=True), sa.ForeignKey('dataset_files.id'), nullable=False),
        sa.Column('column_name', sa.String(255), nullable=False),
        sa.Column('data_type_original', sa.String(100), nullable=True),
        sa.Column('data_type_interpreted', sa.String(50), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_primary_key_component', sa.Boolean, nullable=False, default=False),
        sa.Column('is_nullable', sa.Boolean, nullable=False, default=True),
        sa.Column('is_pii', sa.Boolean, nullable=False, default=False),
        sa.Column('example_values', ARRAY(sa.Text), nullable=True),
        sa.Column('position', sa.Integer, nullable=False),
        sa.Column('stats', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    )
    
    # 4. Table dataset_relationships
    op.create_table(
        'dataset_relationships',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('dataset_id', UUID(as_uuid=True), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('from_file_id', UUID(as_uuid=True), sa.ForeignKey('dataset_files.id'), nullable=False),
        sa.Column('to_file_id', UUID(as_uuid=True), sa.ForeignKey('dataset_files.id'), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    )
    
    # 5. Table dataset_relationship_column_links
    op.create_table(
        'dataset_relationship_column_links',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('relationship_id', UUID(as_uuid=True), sa.ForeignKey('dataset_relationships.id'), nullable=False),
        sa.Column('from_column_id', UUID(as_uuid=True), sa.ForeignKey('file_columns.id'), nullable=False),
        sa.Column('to_column_id', UUID(as_uuid=True), sa.ForeignKey('file_columns.id'), nullable=False),
        sa.Column('link_order', sa.Integer, nullable=False, default=1)
    )
    
    # === CRÉATION DES INDEX ===
    
    # Index pour datasets
    op.create_index('ix_datasets_id', 'datasets', ['id'])
    op.create_index('ix_datasets_dataset_name', 'datasets', ['dataset_name'])
    
    # Index pour dataset_files
    op.create_index('ix_dataset_files_id', 'dataset_files', ['id'])
    op.create_index('ix_dataset_files_dataset_id', 'dataset_files', ['dataset_id'])
    
    # Index pour file_columns
    op.create_index('ix_file_columns_id', 'file_columns', ['id'])
    op.create_index('ix_file_columns_dataset_file_id', 'file_columns', ['dataset_file_id'])
    op.create_index('ix_file_columns_column_name', 'file_columns', ['column_name'])
    
    # Index pour dataset_relationships
    op.create_index('ix_dataset_relationships_id', 'dataset_relationships', ['id'])
    op.create_index('ix_dataset_relationships_dataset_id', 'dataset_relationships', ['dataset_id'])
    op.create_index('ix_dataset_relationships_from_file_id', 'dataset_relationships', ['from_file_id'])
    op.create_index('ix_dataset_relationships_to_file_id', 'dataset_relationships', ['to_file_id'])
    
    # Index pour dataset_relationship_column_links
    op.create_index('ix_dataset_relationship_column_links_id', 'dataset_relationship_column_links', ['id'])
    op.create_index('ix_dataset_relationship_column_links_relationship_id', 'dataset_relationship_column_links', ['relationship_id'])
    op.create_index('ix_dataset_relationship_column_links_from_column_id', 'dataset_relationship_column_links', ['from_column_id'])
    op.create_index('ix_dataset_relationship_column_links_to_column_id', 'dataset_relationship_column_links', ['to_column_id'])


def downgrade() -> None:
    """Drop all tables."""
    
    # Suppression dans l'ordre inverse pour respecter les contraintes FK
    op.drop_table('dataset_relationship_column_links')
    op.drop_table('dataset_relationships')
    op.drop_table('file_columns')
    op.drop_table('dataset_files')
    op.drop_table('datasets')
