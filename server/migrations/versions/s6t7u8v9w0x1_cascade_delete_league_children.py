"""cascade delete league_memberships and league_week_winners when league is deleted

Revision ID: s6t7u8v9w0x1
Revises: r5s6t7u8v9w0
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa


revision = 's6t7u8v9w0x1'
down_revision = 'r5s6t7u8v9w0'
branch_labels = None
depends_on = None

MEMBERSHIPS_FK = op.f('fk_league_memberships_league_id_leagues')
WEEK_WINNERS_FK = 'fk_league_week_winners_league_id_leagues'


def _league_fk_name(connection, table_name, default_name):
    if connection.dialect.name != 'postgresql':
        return default_name
    r = connection.execute(
        sa.text(
            """
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_schema = kcu.constraint_schema
             AND tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = :table
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'league_id'
            """
        ),
        {"table": table_name},
    )
    row = r.fetchone()
    return row[0] if row else default_name


def _recreate_league_fk(table_name, constraint_name, ondelete=None):
    with op.batch_alter_table(table_name, schema=None) as batch_op:
        batch_op.drop_constraint(constraint_name, type_='foreignkey')
        kwargs = {}
        if ondelete:
            kwargs['ondelete'] = ondelete
        batch_op.create_foreign_key(
            constraint_name,
            'leagues',
            ['league_id'],
            ['id'],
            **kwargs,
        )


def upgrade():
    conn = op.get_bind()
    _recreate_league_fk(
        'league_memberships',
        _league_fk_name(conn, 'league_memberships', MEMBERSHIPS_FK),
        ondelete='CASCADE',
    )
    _recreate_league_fk(
        'league_week_winners',
        _league_fk_name(conn, 'league_week_winners', WEEK_WINNERS_FK),
        ondelete='CASCADE',
    )


def downgrade():
    conn = op.get_bind()
    _recreate_league_fk(
        'league_memberships',
        _league_fk_name(conn, 'league_memberships', MEMBERSHIPS_FK),
    )
    _recreate_league_fk(
        'league_week_winners',
        _league_fk_name(conn, 'league_week_winners', WEEK_WINNERS_FK),
    )
