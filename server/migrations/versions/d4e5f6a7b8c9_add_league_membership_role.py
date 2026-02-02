"""add role to league_memberships (admin / player)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2025-01-10 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('league_memberships', sa.Column('role', sa.String(), nullable=True, server_default='player'))
    connection = op.get_bind()
    # Backfill: set admin for league creators (works in SQLite and PostgreSQL)
    connection.execute(sa.text("""
        UPDATE league_memberships SET role = 'admin'
        WHERE (league_id, user_id) IN (SELECT id, created_by FROM leagues)
    """))
    op.alter_column('league_memberships', 'role', nullable=False, existing_type=sa.String(), server_default='player')


def downgrade():
    op.drop_column('league_memberships', 'role')
