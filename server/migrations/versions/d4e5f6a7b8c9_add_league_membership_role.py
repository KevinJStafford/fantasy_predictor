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
    connection = op.get_bind()
    # Skip if role column already exists (e.g. migration ran partially before)
    if connection.dialect.name == 'sqlite':
        r = connection.execute(sa.text("PRAGMA table_info(league_memberships)"))
        cols = [row[1] for row in r.fetchall()]
        has_role = 'role' in cols
    else:
        r = connection.execute(sa.text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'league_memberships' AND column_name = 'role'"
        ))
        has_role = r.fetchone() is not None

    if not has_role:
        op.add_column('league_memberships', sa.Column('role', sa.String(), nullable=True, server_default='player'))

    # Backfill: set admin for league creators (works in SQLite and PostgreSQL)
    connection.execute(sa.text("""
        UPDATE league_memberships SET role = 'admin'
        WHERE (league_id, user_id) IN (SELECT id, created_by FROM leagues)
    """))

    if not has_role:
        # batch_alter_table required for SQLite (it doesn't support ALTER COLUMN)
        with op.batch_alter_table('league_memberships', schema=None) as batch_op:
            batch_op.alter_column('role', nullable=False, existing_type=sa.String(), server_default='player')


def downgrade():
    op.drop_column('league_memberships', 'role')
