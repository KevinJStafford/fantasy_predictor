"""add starting eleven lineup tables

Revision ID: v9w0x1y2z3a4
Revises: u8v9w0x1y2z3
Create Date: 2026-09-27

"""
from alembic import op
import sqlalchemy as sa


revision = 'v9w0x1y2z3a4'
down_revision = 'u8v9w0x1y2z3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'lineup_players',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('image_bytes', sa.LargeBinary(), nullable=False),
        sa.Column('content_type', sa.String(), nullable=False),
        sa.Column('image_token', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('image_token'),
    )
    op.create_index('ix_lineup_players_user_id', 'lineup_players', ['user_id'], unique=False)
    op.create_table(
        'user_lineups',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('formation', sa.String(), nullable=False),
        sa.Column('assignments', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade():
    op.drop_table('user_lineups')
    op.drop_index('ix_lineup_players_user_id', table_name='lineup_players')
    op.drop_table('lineup_players')
