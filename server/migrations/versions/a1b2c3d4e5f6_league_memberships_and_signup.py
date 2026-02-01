"""league_memberships and signup (email+password, per-league display_name)

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2025-01-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create league_memberships table
    op.create_table('league_memberships',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_league_memberships_user_id_users')),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], name=op.f('fk_league_memberships_league_id_leagues')),
        sa.PrimaryKeyConstraint('user_id', 'league_id', name=op.f('pk_league_memberships')),
        sa.UniqueConstraint('league_id', 'display_name', name='uq_league_display_name')
    )

    # 2. Migrate data from user_league to league_memberships (display_name from users.username or fallback)
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        SELECT ul.user_id, ul.league_id, COALESCE(NULLIF(TRIM(u.username), ''), 'Member' || ul.user_id) AS base_name
        FROM user_league ul
        JOIN users u ON u.id = ul.user_id
    """))
    rows = result.fetchall()
    seen = {}
    for row in rows:
        user_id, league_id, base_name = row[0], row[1], (row[2] or "Member")
        key = (league_id, base_name)
        seen[key] = seen.get(key, 0) + 1
        display_name = base_name if seen[key] == 1 else f"{base_name}{seen[key]}"
        connection.execute(
            sa.text("INSERT INTO league_memberships (user_id, league_id, display_name) VALUES (:uid, :lid, :dn)"),
            {"uid": user_id, "lid": league_id, "dn": display_name}
        )

    # 3. Drop user_league
    op.drop_table('user_league')

    # 4. users: email unique and not null, username nullable
    connection = op.get_bind()
    # Fill NULL/empty emails so we can set NOT NULL (e.g. legacy users)
    connection.execute(sa.text("""
        UPDATE users SET email = 'user_' || id || '@migrated.local'
        WHERE email IS NULL OR TRIM(email) = ''
    """))
    # De-duplicate emails: keep one row per email (smallest id), make others unique
    connection.execute(sa.text("""
        UPDATE users SET email = 'user_' || id || '@migrated.local'
        WHERE id IN (
            SELECT u.id FROM users u
            WHERE EXISTS (
                SELECT 1 FROM users u2
                WHERE u2.email = u.email AND u2.id < u.id
            )
        )
    """))
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('email', existing_type=sa.String(), nullable=False)
        batch_op.alter_column('username', existing_type=sa.String(), nullable=True)
        batch_op.create_unique_constraint('uq_users_email', ['email'])


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('uq_users_email', type_='unique')
        batch_op.alter_column('username', existing_type=sa.String(), nullable=False)
        batch_op.alter_column('email', existing_type=sa.String(), nullable=True)

    op.create_table('user_league',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_league_user_id_users')),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], name=op.f('fk_user_league_league_id_leagues')),
        sa.PrimaryKeyConstraint('user_id', 'league_id', name=op.f('pk_user_league'))
    )
    connection = op.get_bind()
    connection.execute(sa.text("INSERT INTO user_league (user_id, league_id) SELECT user_id, league_id FROM league_memberships"))
    op.drop_table('league_memberships')
