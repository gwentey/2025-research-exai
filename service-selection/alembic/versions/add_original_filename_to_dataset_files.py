"""Add original_filename to dataset_files

Revision ID: c9d0e1f2g3h4
Revises: b8c9d0e1f2g3
Create Date: 2025-08-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2g3h4'
down_revision: Union[str, None] = 'b8c9d0e1f2g3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add original_filename column to dataset_files table."""
    
    # === AJOUT DU CHAMP ORIGINAL_FILENAME ===
    op.add_column('dataset_files', sa.Column('original_filename', sa.String(255), nullable=True))
    
    # === MIGRATION DES DONNÉES EXISTANTES ===
    # Copier les valeurs de file_name_in_storage vers original_filename
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE dataset_files SET original_filename = file_name_in_storage WHERE original_filename IS NULL")
    )
    
    # === RENDRE LE CHAMP NON-NULL APRÈS MIGRATION ===
    op.alter_column('dataset_files', 'original_filename', nullable=False)


def downgrade() -> None:
    """Remove original_filename column from dataset_files table."""
    
    # === SUPPRESSION DU CHAMP ORIGINAL_FILENAME ===
    op.drop_column('dataset_files', 'original_filename')