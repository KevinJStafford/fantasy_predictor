"""DELETE /api/v1/leagues/<id> removes child rows before the league row."""
from config import app, db
from models import League, LeagueMembership, LeagueWeekWinner


def test_delete_league_removes_memberships_and_week_winners(client, member_setup):
    league_id = member_setup['league_id']
    user_id = member_setup['user_id']
    headers = member_setup['headers']

    with app.app_context():
        db.session.add(LeagueWeekWinner(league_id=league_id, fixture_round=1, user_id=user_id))
        db.session.commit()
        assert LeagueMembership.query.filter_by(league_id=league_id).count() >= 1
        assert LeagueWeekWinner.query.filter_by(league_id=league_id).count() == 1

    resp = client.delete(f'/api/v1/leagues/{league_id}', headers=headers)
    assert resp.status_code == 200

    with app.app_context():
        assert db.session.get(League, league_id) is None
        assert LeagueMembership.query.filter_by(league_id=league_id).count() == 0
        assert LeagueWeekWinner.query.filter_by(league_id=league_id).count() == 0


def test_delete_league_forbidden_for_non_admin(client, member_setup, outsider_setup):
    league_id = member_setup['league_id']
    resp = client.delete(f'/api/v1/leagues/{league_id}', headers=outsider_setup['headers'])
    assert resp.status_code == 403
