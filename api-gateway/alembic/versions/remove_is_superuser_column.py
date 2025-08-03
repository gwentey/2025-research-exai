"""Remove is_superuser column - role is single source of truth

Revision ID: remove_is_superuser_column
Revises: sync_role_is_superuser_permanent
Create Date: 2025-08-03 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_is_superuser_column'
down_revision: Union[str, None] = 'sync_role_is_superuser_permanent'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Supprime la colonne is_superuser car elle est maintenant une propriété calculée.
    
    ARCHITECTURE SIMPLIFIÉE :
    - role = single source of truth ("user", "admin", "contributor")  
    - is_superuser = propriété calculée (role == "admin")
    - Plus de redondance, plus de conflits
    """
    
    # Étape 1 : Supprimer les triggers créés précédemment (plus nécessaires)
    op.execute('DROP TRIGGER IF EXISTS ensure_role_superuser_consistency ON "user";')
    op.execute('DROP FUNCTION IF EXISTS check_role_superuser_consistency();')
    
    # Étape 2 : Supprimer la colonne is_superuser
    # Note: Alembic peut avoir des problèmes avec cette opération sur PostgreSQL
    # donc on utilise du SQL brut pour plus de fiabilité
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS is_superuser;')


def downgrade() -> None:
    """
    Recrée la colonne is_superuser si nécessaire.
    ATTENTION: Cette opération peut perdre des données en cas de rollback.
    """
    
    # Recréer la colonne is_superuser
    op.add_column('user', sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))
    
    # Synchroniser les données : is_superuser = TRUE si role = 'admin'
    op.execute("""
        UPDATE "user" 
        SET is_superuser = CASE 
            WHEN role = 'admin' THEN TRUE 
            ELSE FALSE 
        END;
    """)