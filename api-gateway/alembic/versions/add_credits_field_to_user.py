"""Add credits field to user table

Revision ID: add_credits_field
Revises: add_onboarding_fields
Create Date: 2025-01-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_credits_field'
down_revision: Union[str, None] = 'add_onboarding_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('credits', sa.SmallInteger(), nullable=False, server_default=sa.text('10')))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'credits')