"""Tests for POST /api/v1/leagues/<id>/start-new-season."""

from datetime import datetime, timezone
from types import SimpleNamespace


def test_game_for_fixture_ignores_prior_season_games():
    from app import _game_for_fixture

    season_start = datetime(2026, 8, 1, tzinfo=timezone.utc)
    fixture = SimpleNamespace(fixture_home_team='Arsenal', fixture_away_team='Chelsea')
    old_game = SimpleNamespace(
        home_team='Arsenal',
        away_team='Chelsea',
        game_week=datetime(2025, 8, 1, tzinfo=timezone.utc),
    )
    new_game = SimpleNamespace(
        home_team='Arsenal',
        away_team='Chelsea',
        game_week=datetime(2026, 8, 20, tzinfo=timezone.utc),
    )

    assert _game_for_fixture(fixture, [old_game], league_created_at=season_start) is None
    assert _game_for_fixture(fixture, [old_game, new_game], league_created_at=season_start) is new_game


def test_start_new_season_requires_auth(client):
    resp = client.post('/api/v1/leagues/1/start-new-season', json={})
    assert resp.status_code == 401


def test_start_new_season_forbidden_for_non_admin(client, member_setup, outsider_setup):
    league_id = member_setup['league_id']
    resp = client.post(
        f'/api/v1/leagues/{league_id}/start-new-season',
        json={},
        headers=outsider_setup['headers'],
    )
    assert resp.status_code == 403


def test_start_new_season_resets_standings(client, member_setup):
    from config import db
    from models import League, LeagueMembership, LeagueWeekWinner

    league_id = member_setup['league_id']
    headers = member_setup['headers']

    with client.application.app_context():
        league = db.session.get(League, league_id)
        lm = LeagueMembership.query.filter_by(league_id=league_id, user_id=member_setup['user_id']).first()
        lm.backfill_wins = 3
        lm.backfill_draws = 1
        lm.backfill_losses = 2
        lm.backfill_points = 10
        lm.last_missing_predictions_round = 5
        db.session.add(LeagueWeekWinner(league_id=league_id, fixture_round=1, user_id=member_setup['user_id']))
        db.session.commit()

    resp = client.post(
        f'/api/v1/leagues/{league_id}/start-new-season',
        json={'sync_fixtures': False},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'season_started_at' in data
    assert data.get('members_reset', 0) >= 1
    assert data.get('week_winners_cleared', 0) >= 1

    with client.application.app_context():
        league = db.session.get(League, league_id)
        assert league.season_started_at is not None
        lm = LeagueMembership.query.filter_by(league_id=league_id, user_id=member_setup['user_id']).first()
        assert lm.backfill_wins is None
        assert lm.backfill_draws is None
        assert lm.backfill_losses is None
        assert lm.backfill_points is None
        assert lm.last_missing_predictions_round is None
        assert LeagueWeekWinner.query.filter_by(league_id=league_id).count() == 0

    league_resp = client.get(f'/api/v1/leagues/{league_id}', headers=headers)
    assert league_resp.get_json()['league']['season_started_at'] is not None
