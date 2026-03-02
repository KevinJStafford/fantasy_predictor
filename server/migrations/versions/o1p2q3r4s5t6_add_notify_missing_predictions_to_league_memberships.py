"""add notify_missing_predictions to league_memberships

Revision ID: o1p2q3r4s5t6
Revises: n0p1q2r3s4t5
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


revision = 'o1p2q3r4s5t6'
down_revision = 'n0p1q2r3s4t5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('league_memberships', schema=None) as batch_op:
        batch_op.add_column(sa.Column('notify_missing_predictions', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('league_memberships', schema=None) as batch_op:
        batch_op.drop_column('notify_missing_predictions')
