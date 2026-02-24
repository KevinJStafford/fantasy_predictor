"""add ai_predictions_enabled to leagues

Revision ID: n0p1q2r3s4t5
Revises: m9k0l1m2n3o4
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'n0p1q2r3s4t5'
down_revision = 'm9k0l1m2n3o4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ai_predictions_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.drop_column('ai_predictions_enabled')
