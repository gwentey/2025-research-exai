"""Add storage_path to datasets

Revision ID: b8c9d0e1f2g3
Revises: a7b8c9d0e1f2
Create Date: 2025-01-21 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2g3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add storage_path column to datasets table."""
    
    # === AJOUT DU CHAMP STORAGE_PATH ===
    op.add_column('datasets', sa.Column('storage_path', sa.String(500), nullable=True))


def downgrade() -> None:
    """Remove storage_path column from datasets table."""
    
    # === SUPPRESSION DU CHAMP STORAGE_PATH ===
    op.drop_column('datasets', 'storage_path') 
