"""merge fixture override and missing round heads

Revision ID: q4r5s6t7u8v9
Revises: p2q3r4s5t6u7, p3q4r5s6t7u8
Create Date: 2026-04-28

"""
from alembic import op


revision = 'q4r5s6t7u8v9'
down_revision = ('p2q3r4s5t6u7', 'p3q4r5s6t7u8')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
