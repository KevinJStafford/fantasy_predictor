"""scope games to leagues

Revision ID: u8v9w0x1y2z3
Revises: t7u8v9w0x1y2
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa


revision = 'u8v9w0x1y2z3'
down_revision = 't7u8v9w0x1y2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('league_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_games_league_id_leagues',
            'leagues',
            ['league_id'],
            ['id'],
        )
        batch_op.create_index('ix_games_league_id', ['league_id'], unique=False)

    # Legacy games did not record their source league. Assign each to the oldest
    # league that existed for that user when the game was saved. This preserves
    # the most likely original league without copying one prediction into every
    # league. Games with no eligible league remain standalone (league_id NULL).
    bind = op.get_bind()
    games = sa.table(
        'games',
        sa.column('id', sa.Integer()),
        sa.column('user_id', sa.Integer()),
        sa.column('league_id', sa.Integer()),
        sa.column('home_team', sa.String()),
        sa.column('away_team', sa.String()),
        sa.column('created_at', sa.DateTime()),
    )
    memberships = sa.table(
        'league_memberships',
        sa.column('user_id', sa.Integer()),
        sa.column('league_id', sa.Integer()),
    )
    leagues = sa.table(
        'leagues',
        sa.column('id', sa.Integer()),
        sa.column('competition_slug', sa.String()),
        sa.column('created_at', sa.DateTime()),
    )
    fixtures = sa.table(
        'fixtures',
        sa.column('fixture_home_team', sa.String()),
        sa.column('fixture_away_team', sa.String()),
        sa.column('competition_slug', sa.String()),
    )

    for game in bind.execute(
        sa.select(
            games.c.id,
            games.c.user_id,
            games.c.home_team,
            games.c.away_team,
            games.c.created_at,
        )
        .where(games.c.league_id.is_(None))
    ):
        eligible = (
            sa.select(leagues.c.id)
            .select_from(
                memberships.join(leagues, memberships.c.league_id == leagues.c.id)
            )
            .where(memberships.c.user_id == game.user_id)
        )
        fixture_competitions = {
            row[0] or 'eng.1'
            for row in bind.execute(
                sa.select(fixtures.c.competition_slug)
                .where(fixtures.c.fixture_home_team == game.home_team)
                .where(fixtures.c.fixture_away_team == game.away_team)
                .distinct()
            )
        }
        if fixture_competitions:
            competition_filters = []
            for competition_slug in fixture_competitions:
                if competition_slug == 'eng.1':
                    competition_filters.append(sa.or_(
                        leagues.c.competition_slug == 'eng.1',
                        leagues.c.competition_slug.is_(None),
                        leagues.c.competition_slug == '',
                    ))
                else:
                    competition_filters.append(
                        leagues.c.competition_slug == competition_slug
                    )
            eligible = eligible.where(sa.or_(*competition_filters))
        if game.created_at is not None:
            eligible = eligible.where(
                sa.or_(
                    leagues.c.created_at.is_(None),
                    leagues.c.created_at <= game.created_at,
                )
            )
        league_id = bind.execute(
            eligible.order_by(leagues.c.created_at.asc(), leagues.c.id.asc()).limit(1)
        ).scalar()
        if league_id is not None:
            bind.execute(
                games.update()
                .where(games.c.id == game.id)
                .values(league_id=league_id)
            )


def downgrade():
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_index('ix_games_league_id')
        batch_op.drop_constraint('fk_games_league_id_leagues', type_='foreignkey')
        batch_op.drop_column('league_id')
