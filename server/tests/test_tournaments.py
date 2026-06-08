"""Smoke tests for tournament/bracket discovery endpoints."""
from datetime import datetime

from models import (
    BracketEntry,
    TournamentEdition,
    TournamentGroupTeam,
    User,
)


def _create_bracket_tables():
    from config import db

    for table in (
        TournamentEdition.__table__,
        TournamentGroupTeam.__table__,
        BracketEntry.__table__,
    ):
        table.create(db.engine, checkfirst=True)


def _drop_bracket_tables():
    from config import db

    for table in (
        BracketEntry.__table__,
        TournamentGroupTeam.__table__,
        TournamentEdition.__table__,
    ):
        table.drop(db.engine, checkfirst=True)


def _seed_edition():
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
    for team in ('Mexico', 'South Africa', 'Korea Republic', 'Czech Republic'):
        db.session.add(
            TournamentGroupTeam(edition_id=edition.id, group_key='A', team_name=team)
        )
    db.session.commit()
    return edition


def test_active_tournaments_empty(client):
    _create_bracket_tables()
    try:
        resp = client.get('/api/v1/tournaments/active')
        assert resp.status_code == 200
        assert resp.get_json()['editions'] == []
    finally:
        _drop_bracket_tables()


def test_active_tournaments_lists_edition(client):
    _create_bracket_tables()
    try:
        with client.application.app_context():
            _seed_edition()
        resp = client.get('/api/v1/tournaments/active')
        assert resp.status_code == 200
        editions = resp.get_json()['editions']
        assert len(editions) == 1
        assert editions[0]['slug'] == 'fifa-world-2026'
        assert editions[0]['is_active'] is True
        assert editions[0]['submission_count'] == 0
    finally:
        _drop_bracket_tables()


def test_get_tournament_edition_with_groups(client):
    _create_bracket_tables()
    try:
        with client.application.app_context():
            _seed_edition()
        resp = client.get('/api/v1/tournaments/fifa-world-2026')
        assert resp.status_code == 200
        edition = resp.get_json()['edition']
        assert edition['name'] == 'FIFA World Cup 2026'
        assert edition['num_groups'] == 12
        assert set(edition['groups']['A']) == {
            'Mexico', 'South Africa', 'Korea Republic', 'Czech Republic',
        }
    finally:
        _drop_bracket_tables()


def test_get_tournament_edition_not_found(client):
    _create_bracket_tables()
    try:
        resp = client.get('/api/v1/tournaments/does-not-exist')
        assert resp.status_code == 404
    finally:
        _drop_bracket_tables()


def test_bracket_me_requires_auth(client):
    _create_bracket_tables()
    try:
        resp = client.get('/api/v1/tournaments/fifa-world-2026/bracket/me')
        assert resp.status_code == 401
    finally:
        _drop_bracket_tables()


def test_bracket_me_not_started(client):
    import app as flask_app

    _create_bracket_tables()
    try:
        with client.application.app_context():
            from config import db

            _seed_edition()
            user = User(email='bracket@smoke.test')
            user.password_hash = 'password'
            db.session.add(user)
            db.session.commit()
            token = flask_app.generate_token(user.id)
            if isinstance(token, bytes):
                token = token.decode('utf-8')
            headers = {'Authorization': f'Bearer {token}'}

        resp = client.get('/api/v1/tournaments/fifa-world-2026/bracket/me', headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'not_started'
        assert data['entry'] is None
        assert data['group_predictions'] == []
    finally:
        _drop_bracket_tables()
