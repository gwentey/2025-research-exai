"""Add projects table

Revision ID: a7b8c9d0e1f2
Revises: 6eb0a0e360e3
Create Date: 2025-01-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = '6eb0a0e360e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add projects table for user project management."""
    
    # === CRÉATION DE LA TABLE PROJECTS ===
    op.create_table(
        'projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),  # Foreign key vers la table users de l'api-gateway
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('criteria', JSONB, nullable=True),  # Critères de filtrage stockés au format DatasetFilterCriteria
        sa.Column('weights', JSONB, nullable=True),  # Poids des critères pour le scoring
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    )
    
    # === CRÉATION DES INDEX ===
    op.create_index('ix_projects_id', 'projects', ['id'])
    op.create_index('ix_projects_user_id', 'projects', ['user_id'])
    op.create_index('ix_projects_name', 'projects', ['name'])
    op.create_index('ix_projects_created_at', 'projects', ['created_at'])


def downgrade() -> None:
    """Drop projects table."""
    
    op.drop_table('projects') 