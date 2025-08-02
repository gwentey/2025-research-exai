"""Add data quality analysis cache table

Revision ID: add_data_quality_analysis
Revises: 002_rename_model_to_artifact
Create Date: 2025-01-29 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_data_quality_analysis'
down_revision: Union[str, None] = '002_rename_model_to_artifact'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create data quality analysis cache table"""
    
    # Create data_quality_analyses table
    op.create_table('data_quality_analyses',
        # Identification
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_version', sa.String(50), nullable=True),  # Pour invalider le cache si le dataset change
        
        # Analyse stockée
        sa.Column('analysis_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('column_strategies', postgresql.JSONB(astext_type=sa.Text()), nullable=True),  # Stratégies recommandées par colonne
        sa.Column('quality_score', sa.Integer(), nullable=False),
        
        # Métadonnées
        sa.Column('total_rows', sa.Integer(), nullable=False),
        sa.Column('total_columns', sa.Integer(), nullable=False),
        sa.Column('analysis_duration_seconds', sa.Float(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),  # Pour gérer l'expiration du cache
        
        # Primary key
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_data_quality_analyses_dataset_id', 'data_quality_analyses', ['dataset_id'], unique=False)
    op.create_index('ix_data_quality_analyses_created_at', 'data_quality_analyses', ['created_at'], unique=False)


def downgrade() -> None:
    """Drop data quality analysis cache table"""
    
    # Drop indexes
    op.drop_index('ix_data_quality_analyses_created_at', table_name='data_quality_analyses')
    op.drop_index('ix_data_quality_analyses_dataset_id', table_name='data_quality_analyses')
    
    # Drop table
    op.drop_table('data_quality_analyses')