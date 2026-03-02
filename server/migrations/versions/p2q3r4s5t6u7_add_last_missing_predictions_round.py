"""add last_missing_predictions_round to league_memberships

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = 'p2q3r4s5t6u7'
down_revision = 'o1p2q3r4s5t6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('league_memberships', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_missing_predictions_round', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('league_memberships', schema=None) as batch_op:
        batch_op.drop_column('last_missing_predictions_round')
