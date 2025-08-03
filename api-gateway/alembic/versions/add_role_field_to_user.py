"""Add role field to user table

Revision ID: add_role_field
Revises: add_date_claim
Create Date: 2025-01-26 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_role_field'
down_revision: Union[str, None] = 'add_date_claim'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Ajouter le champ role avec valeur par défaut 'user'
    op.add_column('user', sa.Column('role', sa.String(length=20), nullable=False, server_default=sa.text("'user'")))
    
    # Créer un index pour optimiser les requêtes sur le rôle
    op.create_index('idx_user_role', 'user', ['role'])


def downgrade() -> None:
    """Downgrade schema."""
    # Supprimer l'index d'abord
    op.drop_index('idx_user_role', 'user')
    
    # Supprimer la colonne
    op.drop_column('user', 'role')