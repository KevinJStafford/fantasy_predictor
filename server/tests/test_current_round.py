"""Tests for GET /api/v1/fixtures/current-round (default week/day selection)."""
from datetime import datetime

from config import app, db
from models import Fixture


def _ensure_fixture_table():
    # SQLite tests: unnamed indexes on Fixture break create(); columns only is enough.
    table = Fixture.__table__
    table.indexes.clear()
    table.create(db.engine, checkfirst=True)


def _clear_fixtures():
    Fixture.query.delete()
    db.session.commit()


def test_world_cup_current_round_ignores_espn_zero_zero_placeholders(client):
    """Upcoming ESPN fixtures use 0-0 scores; default day must still be the lowest incomplete round."""
    _ensure_fixture_table()
    with app.app_context():
        _clear_fixtures()
        base = datetime(2026, 6, 11, 19, 0, 0)
        # Day 1 complete
        db.session.add(
            Fixture(
                competition_slug='fifa.world',
                fixture_round=1,
                fixture_date=base,
                fixture_home_team='A',
                fixture_away_team='B',
                actual_home_score=1,
                actual_away_score=0,
                is_completed=True,
            )
        )
        # Day 2 upcoming with ESPN-style 0-0 placeholder
        db.session.add(
            Fixture(
                competition_slug='fifa.world',
                fixture_round=2,
                fixture_date=datetime(2026, 6, 12, 19, 0, 0),
                fixture_home_team='C',
                fixture_away_team='D',
                actual_home_score=0,
                actual_away_score=0,
                is_completed=False,
            )
        )
        # Day 34 also upcoming
        db.session.add(
            Fixture(
                competition_slug='fifa.world',
                fixture_round=34,
                fixture_date=datetime(2026, 7, 15, 19, 0, 0),
                fixture_home_team='E',
                fixture_away_team='F',
                actual_home_score=0,
                actual_away_score=0,
                is_completed=False,
            )
        )
        db.session.commit()

    resp = client.get('/api/v1/fixtures/current-round?competition=fifa.world')
    assert resp.status_code == 200
    assert resp.get_json()['round'] == 2

    with app.app_context():
        Fixture.__table__.drop(db.engine, checkfirst=True)
