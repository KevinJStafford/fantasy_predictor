"""add manual_round_override to fixtures

Revision ID: p3q4r5s6t7u8
Revises: o1p2q3r4s5t6
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa


revision = 'p3q4r5s6t7u8'
down_revision = 'o1p2q3r4s5t6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('fixtures', schema=None) as batch_op:
        batch_op.add_column(sa.Column('manual_round_override', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('fixtures', schema=None) as batch_op:
        batch_op.drop_column('manual_round_override')
