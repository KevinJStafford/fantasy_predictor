"""Pytest fixtures: in-memory SQLite + Flask test client."""
import os
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-smoke-tests')
os.environ.setdefault('FLASK_ENV', 'testing')

from config import app, db, bcrypt  # noqa: E402
import app as flask_app  # noqa: E402, F401 — registers routes on config.app

from models import User, League, LeagueMembership  # noqa: E402

# Only tables needed for league endpoint tests (avoid sqlite + unnamed Fixture indexes).
_TEST_TABLES = (User.__table__, League.__table__, LeagueMembership.__table__)


def _create_test_tables():
    for table in _TEST_TABLES:
        table.create(db.engine, checkfirst=True)


def _drop_test_tables():
    for table in reversed(_TEST_TABLES):
        table.drop(db.engine, checkfirst=True)


@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SIGNUP_LEAGUE_ID'] = None
    with app.test_client() as test_client:
        with app.app_context():
            _create_test_tables()
            yield test_client
            db.session.remove()
            _drop_test_tables()


def auth_headers(user_id):
    token = flask_app.generate_token(user_id)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def member_setup(client):
    """User who belongs to a ger.1 league (admin)."""
    with app.app_context():
        user = User(email='member@smoke.test')
        user.password_hash = 'password'
        db.session.add(user)
        db.session.flush()

        league = League(
            name='Bundesliga Smoke League',
            invite_code='SMOKE1',
            created_by=user.id,
            competition_slug='ger.1',
            leaderboard_scope='weekly',
        )
        db.session.add(league)
        db.session.flush()

        db.session.add(
            LeagueMembership(
                user_id=user.id,
                league_id=league.id,
                display_name='smoke_player',
                role='admin',
            )
        )
        db.session.commit()

        return {
            'user_id': user.id,
            'league_id': league.id,
            'headers': auth_headers(user.id),
        }


@pytest.fixture
def outsider_setup(client):
    """Authenticated user who is not in member_setup's league."""
    with app.app_context():
        user = User(email='outsider@smoke.test')
        user.password_hash = 'password'
        db.session.add(user)
        db.session.commit()
        return {'user_id': user.id, 'headers': auth_headers(user.id)}
