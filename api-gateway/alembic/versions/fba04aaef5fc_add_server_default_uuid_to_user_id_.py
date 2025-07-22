"""Add server default UUID to user id column

Revision ID: fba04aaef5fc
Revises: a3e2d8e1f51b
Create Date: 2025-04-28 00:37:14.034212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fba04aaef5fc'
down_revision: Union[str, None] = 'a3e2d8e1f51b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('user', 'id',
               server_default=sa.text('gen_random_uuid()'),
               existing_type=sa.UUID(),
               existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('user', 'id',
               server_default=None,
               existing_type=sa.UUID(),
               existing_nullable=False)
