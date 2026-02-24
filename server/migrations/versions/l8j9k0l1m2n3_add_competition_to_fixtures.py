"""add competition_slug and external_id to fixtures

Revision ID: l8j9k0l1m2n3
Revises: k7i8j9k0l1m2
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'l8j9k0l1m2n3'
down_revision = 'k7i8j9k0l1m2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('fixtures', schema=None) as batch_op:
        batch_op.add_column(sa.Column('competition_slug', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('external_id', sa.String(), nullable=True))
        batch_op.create_index('ix_fixtures_competition_slug', ['competition_slug'], unique=False)
        batch_op.create_index('ix_fixtures_external_id', ['external_id'], unique=False)


def downgrade():
    with op.batch_alter_table('fixtures', schema=None) as batch_op:
        batch_op.drop_index('ix_fixtures_external_id', table_name='fixtures')
        batch_op.drop_index('ix_fixtures_competition_slug', table_name='fixtures')
        batch_op.drop_column('external_id')
        batch_op.drop_column('competition_slug')
