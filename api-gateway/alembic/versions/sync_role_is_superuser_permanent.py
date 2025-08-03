"""Synchronisation permanente role et is_superuser

Revision ID: sync_role_is_superuser_permanent
Revises: fix_is_superuser_default
Create Date: 2025-08-03 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'sync_role_is_superuser_permanent'
down_revision: Union[str, None] = 'fix_is_superuser_default'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Migration permanente pour synchroniser role et is_superuser.
    
    Cette migration :
    1. Synchronise tous les utilisateurs existants
    2. Corrige définitivement l'incohérence entre role et is_superuser
    3. N'a besoin d'être exécutée qu'une seule fois
    """
    
    # Étape 1 : Synchroniser is_superuser basé sur role
    # Si role = 'admin' alors is_superuser = TRUE
    op.execute("""
        UPDATE "user" 
        SET is_superuser = TRUE 
        WHERE role = 'admin' AND is_superuser = FALSE;
    """)
    
    # Étape 2 : Synchroniser is_superuser pour les non-admins  
    # Si role != 'admin' alors is_superuser = FALSE
    op.execute("""
        UPDATE "user" 
        SET is_superuser = FALSE 
        WHERE role != 'admin' AND is_superuser = TRUE;
    """)
    
    # Étape 3 : Synchroniser role basé sur is_superuser (cas edge)
    # Si is_superuser = TRUE mais role != 'admin' 
    op.execute("""
        UPDATE "user" 
        SET role = 'admin' 
        WHERE is_superuser = TRUE AND role != 'admin';
    """)
    
    # Étape 4 : Ajouter une contrainte pour maintenir la cohérence future
    # Cette contrainte empêchera les incohérences au niveau base de données
    op.execute("""
        CREATE OR REPLACE FUNCTION check_role_superuser_consistency() 
        RETURNS TRIGGER AS $$
        BEGIN
            -- Si role = 'admin', forcer is_superuser = TRUE
            IF NEW.role = 'admin' AND NEW.is_superuser = FALSE THEN
                NEW.is_superuser = TRUE;
            END IF;
            
            -- Si is_superuser = TRUE, forcer role = 'admin'  
            IF NEW.is_superuser = TRUE AND NEW.role != 'admin' THEN
                NEW.role = 'admin';
            END IF;
            
            -- Si role != 'admin', forcer is_superuser = FALSE
            IF NEW.role != 'admin' AND NEW.is_superuser = TRUE THEN
                NEW.is_superuser = FALSE;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Créer le trigger qui maintient automatiquement la cohérence
    # Séparer les commandes pour éviter l'erreur asyncpg
    op.execute('DROP TRIGGER IF EXISTS ensure_role_superuser_consistency ON "user";')
    
    op.execute("""
        CREATE TRIGGER ensure_role_superuser_consistency
            BEFORE INSERT OR UPDATE ON "user"
            FOR EACH ROW
            EXECUTE FUNCTION check_role_superuser_consistency();
    """)


def downgrade() -> None:
    """
    Supprime les triggers et fonctions ajoutés.
    Attention : ne remet pas les données dans l'état incohérent précédent.
    """
    # Supprimer le trigger
    op.execute('DROP TRIGGER IF EXISTS ensure_role_superuser_consistency ON "user";')
    
    # Supprimer la fonction
    op.execute('DROP FUNCTION IF EXISTS check_role_superuser_consistency();')