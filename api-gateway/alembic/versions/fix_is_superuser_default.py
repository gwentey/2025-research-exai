"""Fix is_superuser column default value

Revision ID: fix_is_superuser_default
Revises: add_role_field
Create Date: 2025-08-03 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_is_superuser_default'
down_revision: Union[str, None] = 'add_role_field'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Ajouter une valeur par défaut FALSE à la colonne is_superuser
    # et synchroniser avec le champ role existant
    op.alter_column('user', 'is_superuser',
                   server_default=sa.text('FALSE'),
                   existing_type=sa.Boolean(),
                   existing_nullable=False)
    
    # Mettre à jour les enregistrements existants : 
    # is_superuser = TRUE si role = 'admin', sinon FALSE
    op.execute("""
        UPDATE "user" 
        SET is_superuser = CASE 
            WHEN role = 'admin' THEN TRUE 
            ELSE FALSE 
        END
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Supprimer la valeur par défaut
    op.alter_column('user', 'is_superuser',
                   server_default=None,
                   existing_type=sa.Boolean(),
                   existing_nullable=False)