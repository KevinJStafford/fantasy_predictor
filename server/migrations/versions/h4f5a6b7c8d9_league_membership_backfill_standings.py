"""add backfill standings to league_memberships (wins/draws/losses/points from sheet import)

Revision ID: h4f5a6b7c8d9
Revises: g3e4f5a6b7c8
Create Date: 2025-02-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'h4f5a6b7c8d9'
down_revision = 'g3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('league_memberships', schema=None) as batch_op:
        batch_op.add_column(sa.Column('backfill_wins', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('backfill_draws', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('backfill_losses', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('backfill_points', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('league_memberships', schema=None) as batch_op:
        batch_op.drop_column('backfill_points')
        batch_op.drop_column('backfill_losses')
        batch_op.drop_column('backfill_draws')
        batch_op.drop_column('backfill_wins')
