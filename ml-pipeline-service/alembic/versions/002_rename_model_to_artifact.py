"""Rename model_uri column to artifact_uri to avoid Pydantic namespace conflict

Revision ID: 002_rename_model_to_artifact
Revises: 001_initial_migration
Create Date: 2025-07-29 18:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_rename_model_to_artifact'
down_revision: Union[str, None] = '001_initial_migration'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename model_uri column to artifact_uri"""
    op.alter_column('experiments', 'model_uri', new_column_name='artifact_uri')


def downgrade() -> None:
    """Rename artifact_uri column back to model_uri"""
    op.alter_column('experiments', 'artifact_uri', new_column_name='model_uri') 