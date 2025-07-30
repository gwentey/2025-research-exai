"""Initial migration for ML Pipeline service - Create experiments table

Revision ID: 001_initial_migration
Revises: 
Create Date: 2025-07-29 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_migration'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create experiments table for ML Pipeline service"""
    
    # Create experiments table
    op.create_table('experiments',
        # Identification & PK
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Identification de l'expérience
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Configuration ML
        sa.Column('algorithm', sa.String(length=50), nullable=False),
        sa.Column('hyperparameters', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('preprocessing_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        
        # Statut et progression
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('progress', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('task_id', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        
        # Résultats et artefacts
        sa.Column('metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('model_uri', sa.String(length=500), nullable=True),
        sa.Column('visualizations', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('feature_importance', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        
        # Primary key
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for optimal query performance
    op.create_index('ix_experiments_id', 'experiments', ['id'], unique=False)
    op.create_index('ix_experiments_user_id', 'experiments', ['user_id'], unique=False)
    op.create_index('ix_experiments_project_id', 'experiments', ['project_id'], unique=False)
    op.create_index('ix_experiments_dataset_id', 'experiments', ['dataset_id'], unique=False)
    op.create_index('ix_experiments_status', 'experiments', ['status'], unique=False)
    op.create_index('ix_experiments_created_at', 'experiments', ['created_at'], unique=False)


def downgrade() -> None:
    """Drop experiments table and its indexes"""
    
    # Drop indexes first
    op.drop_index('ix_experiments_created_at', table_name='experiments')
    op.drop_index('ix_experiments_status', table_name='experiments')
    op.drop_index('ix_experiments_dataset_id', table_name='experiments')
    op.drop_index('ix_experiments_project_id', table_name='experiments')
    op.drop_index('ix_experiments_user_id', table_name='experiments')
    op.drop_index('ix_experiments_id', table_name='experiments')
    
    # Drop table
    op.drop_table('experiments') 