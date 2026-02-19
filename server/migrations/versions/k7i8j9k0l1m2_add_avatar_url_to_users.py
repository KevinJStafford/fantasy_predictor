"""add avatar_url to users

Revision ID: k7i8j9k0l1m2
Revises: j6h7i8j9k0l1
Create Date: 2025-02-09 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'k7i8j9k0l1m2'
down_revision = 'j6h7i8j9k0l1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('avatar_url', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('avatar_url')
