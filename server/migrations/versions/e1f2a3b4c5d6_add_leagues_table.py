"""add leagues table

Revision ID: e1f2a3b4c5d6
Revises: 44d3ca27214f
Create Date: 2025-01-09 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = '78b25607af51'  # Latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create leagues table
    op.create_table('leagues',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_leagues_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_leagues'))
    )
    
    # Create user_league association table
    op.create_table('user_league',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_league_user_id_users')),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], name=op.f('fk_user_league_league_id_leagues')),
        sa.PrimaryKeyConstraint('user_id', 'league_id', name=op.f('pk_user_league'))
    )


def downgrade():
    op.drop_table('user_league')
    op.drop_table('leagues')
