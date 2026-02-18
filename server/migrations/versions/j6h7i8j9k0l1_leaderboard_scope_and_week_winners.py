"""add leaderboard_scope to leagues and league_week_winners table

Revision ID: j6h7i8j9k0l1
Revises: i5g6h7i8j9k0
Create Date: 2025-02-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'j6h7i8j9k0l1'
down_revision = 'i5g6h7i8j9k0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.add_column(sa.Column('leaderboard_scope', sa.String(), nullable=False, server_default='full_season'))

    op.create_table(
        'league_week_winners',
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('fixture_round', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('league_id', 'fixture_round', 'user_id')
    )


def downgrade():
    op.drop_table('league_week_winners')
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.drop_column('leaderboard_scope')
