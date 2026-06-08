"""Tests for group prediction save and bracket resolution."""
from datetime import datetime

import app as flask_app
from models import BracketEntry, BracketPick, GroupPrediction, TournamentEdition, TournamentGroupTeam, User


def _auth_headers(user_id):
    token = flask_app.generate_token(user_id)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


def _create_tables():
    from config import db

    for table in (
        TournamentEdition.__table__,
        TournamentGroupTeam.__table__,
        BracketEntry.__table__,
        GroupPrediction.__table__,
        BracketPick.__table__,
    ):
        table.create(db.engine, checkfirst=True)


def _drop_tables():
    from config import db

    for table in (
        BracketPick.__table__,
        GroupPrediction.__table__,
        BracketEntry.__table__,
        TournamentGroupTeam.__table__,
        TournamentEdition.__table__,
    ):
        table.drop(db.engine, checkfirst=True)


def _seed_group_a_edition():
    from config import db

    edition = TournamentEdition(
        competition_slug='fifa.world',
        year=2026,
        slug='fifa-world-2026',
        name='FIFA World Cup 2026',
        num_groups=12,
        third_place_advance=8,
        bracket_lock_at=datetime(2026, 6, 11, 19, 0, 0),
        is_active=True,
    )
    db.session.add(edition)
    db.session.flush()
    for team in ('Mexico', 'South Africa', 'Korea Republic', 'Czechia'):
        db.session.add(TournamentGroupTeam(edition_id=edition.id, group_key='A', team_name=team))
    user = User(email='groups@smoke.test')
    user.password_hash = 'password'
    db.session.add(user)
    db.session.commit()
    return edition, user


GROUP_A_PAYLOAD = {
    'groups': [{
        'group_key': 'A',
        'winner': {'team': 'Korea Republic', 'points': 9, 'goal_diff': 4, 'goals_scored': 10},
        'runner_up_1': {'team': 'Mexico', 'points': 4, 'goal_diff': 3, 'goals_scored': 11},
        'runner_up_2': {'team': 'South Africa', 'points': 4, 'goal_diff': 1, 'goals_scored': 5},
    }],
}


def test_put_groups_rejects_tied_runner_ups(client):
    _create_tables()
    try:
        with client.application.app_context():
            _, user = _seed_group_a_edition()
            headers = _auth_headers(user.id)

        bad = {
            'groups': [{
                'group_key': 'A',
                'winner': {'team': 'Korea Republic', 'points': 9, 'goal_diff': 4, 'goals_scored': 10},
                'runner_up_1': {'team': 'Mexico', 'points': 4, 'goal_diff': 1, 'goals_scored': 5},
                'runner_up_2': {'team': 'South Africa', 'points': 4, 'goal_diff': 1, 'goals_scored': 5},
            }],
        }
        resp = client.put('/api/v1/tournaments/fifa-world-2026/bracket/groups', json=bad, headers=headers)
        assert resp.status_code == 422
        assert 'tied' in str(resp.get_json()['groups']['A']).lower()
    finally:
        _drop_tables()


def test_put_groups_saves_and_returns_entry(client):
    _create_tables()
    try:
        with client.application.app_context():
            _, user = _seed_group_a_edition()
            headers = _auth_headers(user.id)

        resp = client.put(
            '/api/v1/tournaments/fifa-world-2026/bracket/groups',
            json=GROUP_A_PAYLOAD,
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['entry']['status'] == 'draft'
        assert data['entry']['groups_complete'] == 1
        assert data['entry']['groups_required'] == 1
        assert data['group_predictions'][0]['winner']['team'] == 'Korea Republic'

        me = client.get('/api/v1/tournaments/fifa-world-2026/bracket/me', headers=headers)
        assert me.status_code == 200
        assert me.get_json()['entry']['groups_complete'] == 1
    finally:
        _drop_tables()


def test_resolved_bracket_requires_all_twelve_groups(client):
    _create_tables()
    try:
        with client.application.app_context():
            _, user = _seed_group_a_edition()
            headers = _auth_headers(user.id)

        client.put(
            '/api/v1/tournaments/fifa-world-2026/bracket/groups',
            json=GROUP_A_PAYLOAD,
            headers=headers,
        )
        resp = client.get('/api/v1/tournaments/fifa-world-2026/bracket/resolved', headers=headers)
        assert resp.status_code == 400
        data = resp.get_json()
        assert 'Incomplete group predictions' in data['error'] or '12 groups' in data['error']
    finally:
        _drop_tables()
