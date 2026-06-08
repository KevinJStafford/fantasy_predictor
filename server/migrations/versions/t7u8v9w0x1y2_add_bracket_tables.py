"""add bracket entry tables

Revision ID: t7u8v9w0x1y2
Revises: s6t7u8v9w0x1
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa


revision = 't7u8v9w0x1y2'
down_revision = 's6t7u8v9w0x1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tournament_editions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('competition_slug', sa.String(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('num_groups', sa.Integer(), nullable=False),
        sa.Column('third_place_advance', sa.Integer(), nullable=False),
        sa.Column('bracket_lock_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('competition_slug', 'year', name='uq_tournament_edition_comp_year'),
        sa.UniqueConstraint('slug'),
    )

    op.create_table(
        'tournament_group_teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('edition_id', sa.Integer(), nullable=False),
        sa.Column('group_key', sa.String(length=2), nullable=False),
        sa.Column('team_name', sa.String(), nullable=False),
        sa.Column('fifa_ranking', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['edition_id'], ['tournament_editions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('edition_id', 'group_key', 'team_name', name='uq_tournament_group_team'),
    )

    op.create_table(
        'bracket_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('edition_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), server_default='draft', nullable=False),
        sa.Column('champion_pick', sa.String(), nullable=True),
        sa.Column('group_points', sa.Integer(), server_default='0', nullable=False),
        sa.Column('bracket_points', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_points', sa.Integer(), server_default='0', nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['edition_id'], ['tournament_editions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'edition_id', name='uq_bracket_entry_user_edition'),
    )
    op.create_index('ix_bracket_entries_edition_status', 'bracket_entries', ['edition_id', 'status'], unique=False)

    op.create_table(
        'group_predictions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bracket_entry_id', sa.Integer(), nullable=False),
        sa.Column('group_key', sa.String(length=2), nullable=False),
        sa.Column('winner_team', sa.String(), nullable=True),
        sa.Column('winner_points', sa.Integer(), nullable=True),
        sa.Column('winner_goal_diff', sa.Integer(), nullable=True),
        sa.Column('winner_goals_scored', sa.Integer(), nullable=True),
        sa.Column('runner_up_1_team', sa.String(), nullable=True),
        sa.Column('runner_up_1_points', sa.Integer(), nullable=True),
        sa.Column('runner_up_1_goal_diff', sa.Integer(), nullable=True),
        sa.Column('runner_up_1_goals_scored', sa.Integer(), nullable=True),
        sa.Column('runner_up_2_team', sa.String(), nullable=True),
        sa.Column('runner_up_2_points', sa.Integer(), nullable=True),
        sa.Column('runner_up_2_goal_diff', sa.Integer(), nullable=True),
        sa.Column('runner_up_2_goals_scored', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['bracket_entry_id'], ['bracket_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bracket_entry_id', 'group_key', name='uq_group_prediction_entry_group'),
    )

    op.create_table(
        'bracket_picks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bracket_entry_id', sa.Integer(), nullable=False),
        sa.Column('match_key', sa.String(), nullable=False),
        sa.Column('picked_team', sa.String(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('points_earned', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['bracket_entry_id'], ['bracket_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bracket_entry_id', 'match_key', name='uq_bracket_pick_entry_match'),
    )

    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.add_column(sa.Column('format', sa.String(), server_default='score_prediction', nullable=False))
        batch_op.add_column(sa.Column('edition_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_leagues_edition_id', 'tournament_editions', ['edition_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('leagues', schema=None) as batch_op:
        batch_op.drop_constraint('fk_leagues_edition_id', type_='foreignkey')
        batch_op.drop_column('edition_id')
        batch_op.drop_column('format')

    op.drop_table('bracket_picks')
    op.drop_table('group_predictions')
    op.drop_index('ix_bracket_entries_edition_status', table_name='bracket_entries')
    op.drop_table('bracket_entries')
    op.drop_table('tournament_group_teams')
    op.drop_table('tournament_editions')
