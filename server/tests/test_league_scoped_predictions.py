"""Regression tests for predictions leaking between leagues."""
from datetime import datetime, timedelta, timezone

from config import app, db
from models import Fixture, Game, League, LeagueMembership


def _add_second_league(user_id):
    league = League(
        name='Second Bundesliga League',
        invite_code='SECOND1',
        created_by=user_id,
        competition_slug='ger.1',
    )
    db.session.add(league)
    db.session.flush()
    db.session.add(LeagueMembership(
        user_id=user_id,
        league_id=league.id,
        display_name='second_league_player',
        role='admin',
    ))
    db.session.commit()
    return league.id


def test_get_predictions_only_returns_games_owned_by_requested_league(client, member_setup):
    with app.app_context():
        first_league_id = member_setup['league_id']
        second_league_id = _add_second_league(member_setup['user_id'])
        game = Game(
            user_id=member_setup['user_id'],
            league_id=first_league_id,
            home_team='Tottenham Hotspur FC',
            away_team='Newcastle United FC',
            home_team_score=1,
            away_team_score=2,
            game_week=datetime.now(timezone.utc) + timedelta(days=3),
        )
        db.session.add(game)
        db.session.commit()

    first = client.get(
        f'/api/v1/predictions?league_id={first_league_id}',
        headers=member_setup['headers'],
    )
    second = client.get(
        f'/api/v1/predictions?league_id={second_league_id}',
        headers=member_setup['headers'],
    )

    assert first.status_code == 200
    assert len(first.get_json()['predictions']) == 1
    assert second.status_code == 200
    assert second.get_json()['predictions'] == []


def test_same_fixture_can_be_saved_independently_in_two_leagues(client, member_setup):
    with app.app_context():
        first_league_id = member_setup['league_id']
        second_league_id = _add_second_league(member_setup['user_id'])
        fixture = Fixture(
            fixture_round=2,
            fixture_date=datetime.now(timezone.utc) + timedelta(days=3),
            fixture_home_team='Sunderland AFC',
            fixture_away_team='Fulham FC',
            competition_slug='ger.1',
        )
        db.session.add(fixture)
        db.session.commit()
        fixture_id = fixture.id

    for league_id, scores in (
        (first_league_id, (2, 1)),
        (second_league_id, (0, 0)),
    ):
        response = client.post(
            '/api/v1/predictions',
            headers=member_setup['headers'],
            json={
                'fixture_id': fixture_id,
                'league_id': league_id,
                'home_team_score': scores[0],
                'away_team_score': scores[1],
            },
        )
        assert response.status_code == 201

    with app.app_context():
        games = Game.query.filter_by(user_id=member_setup['user_id']).order_by(Game.league_id).all()
        assert len(games) == 2
        assert {g.league_id for g in games} == {first_league_id, second_league_id}
        assert {(g.home_team_score, g.away_team_score) for g in games} == {(2, 1), (0, 0)}


def test_previous_season_pick_does_not_fill_or_replace_current_fixture(client, member_setup):
    with app.app_context():
        league = db.session.get(League, member_setup['league_id'])
        league.season_started_at = datetime.now(timezone.utc)
        old_kickoff = datetime.now(timezone.utc) - timedelta(days=365)
        new_kickoff = datetime.now(timezone.utc) + timedelta(days=3)
        old_fixture = Fixture(
            fixture_round=2,
            fixture_date=old_kickoff,
            fixture_home_team='Tottenham Hotspur FC',
            fixture_away_team='Newcastle United FC',
            competition_slug='ger.1',
        )
        new_fixture = Fixture(
            fixture_round=2,
            fixture_date=new_kickoff,
            fixture_home_team='Tottenham Hotspur FC',
            fixture_away_team='Newcastle United FC',
            competition_slug='ger.1',
        )
        old_game = Game(
            user_id=member_setup['user_id'],
            league_id=member_setup['league_id'],
            home_team='Tottenham Hotspur FC',
            away_team='Newcastle United FC',
            home_team_score=1,
            away_team_score=2,
            game_week=old_kickoff,
        )
        db.session.add_all([old_fixture, new_fixture, old_game])
        db.session.commit()
        new_fixture_id = new_fixture.id

    before = client.get(
        f"/api/v1/predictions?league_id={member_setup['league_id']}",
        headers=member_setup['headers'],
    )
    assert before.status_code == 200
    assert before.get_json()['predictions'] == []

    saved = client.post(
        '/api/v1/predictions',
        headers=member_setup['headers'],
        json={
            'fixture_id': new_fixture_id,
            'league_id': member_setup['league_id'],
            'home_team_score': 0,
            'away_team_score': 0,
        },
    )
    assert saved.status_code == 201

    with app.app_context():
        games = Game.query.filter_by(
            user_id=member_setup['user_id'],
            league_id=member_setup['league_id'],
        ).order_by(Game.game_week).all()
        assert len(games) == 2
        assert (games[0].home_team_score, games[0].away_team_score) == (1, 2)
        assert (games[1].home_team_score, games[1].away_team_score) == (0, 0)
