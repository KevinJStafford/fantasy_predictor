"""add competition_slug to leagues

Revision ID: m9k0l1m2n3o4
Revises: l8j9k0l1m2n3
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'm9k0l1m2n3o4'
down_revision = 'l8j9k0l1m2n3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.add_column(sa.Column('competition_slug', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.drop_column('competition_slug')
