"""add is_open to leagues (open to anyone vs invite only)

Revision ID: i5g6h7i8j9k0
Revises: h4f5a6b7c8d9
Create Date: 2025-02-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'i5g6h7i8j9k0'
down_revision = 'h4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_open', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.drop_column('is_open')
