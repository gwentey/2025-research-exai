"""Add onboarding fields to user table

Revision ID: add_onboarding_fields
Revises: 1ff696f09d6e
Create Date: 2025-01-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_onboarding_fields'
down_revision: Union[str, None] = '1ff696f09d6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('education_level', sa.String(length=50), nullable=True))
    op.add_column('user', sa.Column('age', sa.SmallInteger(), nullable=True))
    op.add_column('user', sa.Column('ai_familiarity', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'ai_familiarity')
    op.drop_column('user', 'age')
    op.drop_column('user', 'education_level') 
