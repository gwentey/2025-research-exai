"""Add display_name to datasets

Revision ID: d1e2f3g4h5i6
Revises: c9d0e1f2g3h4
Create Date: 2025-08-04 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3g4h5i6'
down_revision: Union[str, None] = 'c9d0e1f2g3h4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add display_name column to datasets table."""
    
    # === AJOUT DU CHAMP DISPLAY_NAME ===
    op.add_column('datasets', sa.Column('display_name', sa.String(255), nullable=True))
    
    # === MIGRATION DES DONNÉES EXISTANTES ===
    # Mapper les dataset_name vers leurs vrais noms d'affichage
    connection = op.get_bind()
    
    display_name_mapping = {
        'student_performance': 'Students Performance in Exams',
        'student_stress': 'Student Stress Factors', 
        'student_depression': 'Student Depression Dataset',
        'social_media_addiction': "Students' Social Media Addiction",
        'oulad_dataset': 'OULAD',
        'riiid_answer_prediction': 'EdNet (Riiid Answer Correctness)',
        'academic_performance': 'Student Academic Performance Dataset'
    }
    
    # Appliquer les mappings
    for dataset_name, display_name in display_name_mapping.items():
        connection.execute(
            sa.text("UPDATE datasets SET display_name = :display_name WHERE dataset_name = :dataset_name"),
            {"display_name": display_name, "dataset_name": dataset_name}
        )
    
    # Pour les datasets non mappés, utiliser le dataset_name comme fallback
    connection.execute(
        sa.text("UPDATE datasets SET display_name = dataset_name WHERE display_name IS NULL")
    )
    
    # === RENDRE LE CHAMP NON-NULL APRÈS MIGRATION ===
    op.alter_column('datasets', 'display_name', nullable=False)


def downgrade() -> None:
    """Remove display_name column from datasets table."""
    
    # === SUPPRESSION DU CHAMP DISPLAY_NAME ===
    op.drop_column('datasets', 'display_name')