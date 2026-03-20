#!/usr/bin/env python3

# Standard library imports
import json
import os
import secrets
import smtplib
import threading
import unicodedata
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import parseaddr
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from datetime import datetime, timedelta, timezone, date, time
import jwt

# Remote library imports
from flask import request, make_response, session, send_from_directory
from flask_restful import Resource

# Local imports
from config import app, db, api, bcrypt
# Add your model imports
from models import User, Game, Prediction, Fixture, League, LeagueMembership, LeagueWeekWinner
from sqlalchemy import func, or_, select


def _normalize_team_name(s):
    """Normalize team name for matching (e.g. 'Brighton & Hove Albion' vs 'Brighton and Hove Albion')."""
    if s is None:
        return ''
    t = (s or '').strip().lower()
    t = t.replace('&', 'and').replace('  ', ' ')
    while '  ' in t:
        t = t.replace('  ', ' ')
    return t


# Common short names / aliases for Premier League teams (normalized key -> normalized canonical name)
_TEAM_ALIASES = {
    'wolves': 'wolverhampton wanderers',
    'spurs': 'tottenham hotspur',
    'tottenham': 'tottenham hotspur',
    'man utd': 'manchester united',
    'man united': 'manchester united',
    'man utd.': 'manchester united',
    "man u": 'manchester united',
    'man city': 'manchester city',
    'city': 'manchester city',
    'west ham': 'west ham united',
    'forest': 'nottingham forest',
    'notts forest': 'nottingham forest',
    'newcastle': 'newcastle united',
    'brighton': 'brighton and hove albion',
    'villa': 'aston villa',
    'bournemouth': 'afc bournemouth',
    'utd': 'manchester united',  # risky but common
}


def _team_names_equivalent(a, b):
    """True if both team names refer to the same team (normalized + aliases)."""
    an = _normalize_team_name(a)
    bn = _normalize_team_name(b)
    if an == bn:
        return True
    ac = _TEAM_ALIASES.get(an, an)
    bc = _TEAM_ALIASES.get(bn, bn)
    return ac == bc


def _fixture_matches_game(fixture, home_team, away_team):
    """True if fixture's teams match the given home/away (exact, case-insensitive, normalized, or alias).
    Uses _normalize_team_name_for_match so 'Chelsea FC' matches 'Chelsea' (leaderboard and predictions)."""
    if not fixture or not fixture.fixture_home_team or not fixture.fixture_away_team:
        return False
    f_h = (fixture.fixture_home_team or '').strip()
    f_a = (fixture.fixture_away_team or '').strip()
    g_h = (home_team or '').strip()
    g_a = (away_team or '').strip()
    if f_h == g_h and f_a == g_a:
        return True
    if f_h.lower() == g_h.lower() and f_a.lower() == g_a.lower():
        return True
    if _normalize_team_name(f_h) == _normalize_team_name(g_h) and _normalize_team_name(f_a) == _normalize_team_name(g_a):
        return True
    if _team_names_equivalent(f_h, g_h) and _team_names_equivalent(f_a, g_a):
        return True
    if _normalize_team_name_for_match(f_h) == _normalize_team_name_for_match(g_h) and _normalize_team_name_for_match(f_a) == _normalize_team_name_for_match(g_a):
        return True
    return False


def _game_for_fixture(fixture, games_list):
    """Return the first Game in games_list that matches this fixture (by team names). Used for fixture-first leaderboard so we don't rely on game->fixture resolution."""
    if not fixture or not games_list:
        return None
    for g in games_list:
        if _fixture_matches_game(fixture, g.home_team, g.away_team):
            return g
    return None


def _verify_password(user_id, password_str):
    """Verify password without touching User.authenticate (avoids recursion with ORM).
    Fetches hash via a simple column query."""
    if not user_id or not password_str:
        return False
    try:
        stmt = select(User._password_hash).where(User.id == user_id)
        result = db.session.execute(stmt)
        row = result.scalar() if result else None
        if row is None:
            print(f"Login: user_id={user_id} no hash in DB")
            return False
        if isinstance(row, bytes):
            hash_str = row.decode('utf-8', errors='replace')
        else:
            hash_str = str(row) if row else None
        # Normalize: DB or driver may add whitespace; bcrypt is sensitive to it
        hash_str = (hash_str or '').strip()
        if not hash_str or not hash_str.startswith('$2'):
            print(f"Login: user_id={user_id} hash invalid (len={len(hash_str) if hash_str else 0}, starts_with_2b={hash_str.startswith('$2') if hash_str else False})")
            return False
        password_clean = (str(password_str) or '').strip()
        ok = bcrypt.check_password_hash(hash_str, password_clean)
        if not ok:
            # Fallback: try underlying bcrypt with bytes (handles encoding edge cases)
            try:
                import bcrypt as bcrypt_lib
                ok = bcrypt_lib.checkpw(
                    password_clean.encode('utf-8'),
                    hash_str.encode('utf-8')
                )
            except Exception:
                pass
        if not ok:
            print(f"Login: user_id={user_id} hash_len={len(hash_str)} bcrypt_check=False")
        return ok
    except Exception as e:
        print(f"Login: _verify_password user_id={user_id} error={e}")
        return False


def _is_dev_origin(origin):
    """True if origin is a common development host (localhost / 127.0.0.1)."""
    if not origin or not isinstance(origin, str):
        return False
    try:
        parsed = urlparse(origin)
        host = (parsed.hostname or '').lower()
        return host in ('localhost', '127.0.0.1')
    except Exception:
        return False


@app.after_request
def add_cors_headers_if_missing(response):
    """Ensure all required CORS headers are on every response (fixes 'missing allow header' on login etc)."""
    try:
        origin = request.headers.get('Origin')
        if not origin:
            return response
        allowed = app.config.get('CORS_ORIGINS_LIST') or []
        # Skip adding headers only if we have a strict list and this origin isn't in it (and not a dev origin)
        if allowed and '*' not in allowed and origin not in allowed and not _is_dev_origin(origin):
            return response
        # Add full set so preflight and actual requests both succeed
        if response.headers.get('Access-Control-Allow-Origin') is None:
            response.headers['Access-Control-Allow-Origin'] = origin
        if response.headers.get('Access-Control-Allow-Credentials') is None:
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        if response.headers.get('Access-Control-Allow-Methods') is None:
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        if response.headers.get('Access-Control-Allow-Headers') is None:
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    except Exception:
        pass
    return response


@app.route('/api/v1/health', methods=['GET'])
def health():
    """Lightweight endpoint for keep-warm cron and load balancers. No auth required."""
    return make_response({'status': 'ok'}, 200)


def _send_missing_predictions_notifications():
    """Find leagues with fixtures in <24h, members who opted in and have no predictions for those fixtures; send reminder email. Returns (sent_count, error_message or None)."""
    now_utc = datetime.now(timezone.utc)
    # Use naive UTC for DB comparison (Fixture.fixture_date is often stored without tz)
    now_naive = now_utc.replace(tzinfo=None) if now_utc.tzinfo else now_utc
    end_naive = now_naive + timedelta(hours=24)
    upcoming = Fixture.query.filter(
        Fixture.fixture_date.isnot(None),
        Fixture.fixture_date > now_naive,
        Fixture.fixture_date <= end_naive,
        or_(Fixture.is_completed == False, Fixture.is_completed.is_(None)),
    ).all()
    if not upcoming:
        return 0, None
    # Group by competition_slug (eng.1 and None treated as same for league matching)
    fixtures_by_comp = {}
    for f in upcoming:
        comp = getattr(f, 'competition_slug', None) or 'eng.1'
        fixtures_by_comp.setdefault(comp, []).append(f)
    base_url = (app.config.get('RESET_PASSWORD_BASE_URL') or '').strip().rstrip('/') or 'https://playfantasypredictor.com'
    sent = 0
    for comp_slug, fixtures in fixtures_by_comp.items():
        # Round we're reminding about (e.g. 28) — send only once per round per (user, league)
        reminder_round = min((f.fixture_round for f in fixtures if f.fixture_round is not None), default=None)
        if reminder_round is None:
            continue
        if comp_slug == 'eng.1':
            leagues = League.query.filter(or_(League.competition_slug == 'eng.1', League.competition_slug.is_(None))).all()
        else:
            leagues = League.query.filter(League.competition_slug == comp_slug).all()
        for league in leagues:
            for lm in league.league_memberships:
                if not getattr(lm, 'notify_missing_predictions', False):
                    continue
                if lm.user.deleted_at:
                    continue
                # Already sent a reminder for this round — only send once per round
                if getattr(lm, 'last_missing_predictions_round', None) == reminder_round:
                    continue
                # Check if member has any prediction (Game) for any of the upcoming fixtures
                has_any = False
                for fixture in fixtures:
                    g = Game.query.filter_by(
                        user_id=lm.user_id,
                        home_team=fixture.fixture_home_team,
                        away_team=fixture.fixture_away_team,
                    ).first()
                    if g:
                        has_any = True
                        break
                    for g in Game.query.filter_by(user_id=lm.user_id).all():
                        if _fixture_matches_game(fixture, g.home_team, g.away_team):
                            has_any = True
                            break
                    if has_any:
                        break
                if has_any:
                    continue
                link = f"{base_url}/#/predictions?league={league.id}"
                subject = f"Reminder: submit predictions for {league.name}"
                body = f"""Hi,

Your league "{league.name}" has fixtures in the next 24 hours and you haven't submitted predictions yet.

Submit your predictions here: {link}

— Fantasy Predictor
"""
                if send_notification_email(str(lm.user.email), subject, body):
                    lm.last_missing_predictions_round = reminder_round
                    db.session.commit()
                    sent += 1
                    print(f"Sent missing-predictions reminder to {lm.user.email} for league {league.name} (round {reminder_round})")
    return sent, None


@app.route('/api/v1/notifications/send-missing-predictions', methods=['GET'])
def send_missing_predictions_cron():
    """Cron endpoint: send email to players who enabled notify_missing_predictions when their league has fixtures in <24h and they have no predictions. Require X-Cron-Secret header."""
    secret = (request.headers.get('X-Cron-Secret') or '').strip()
    if not secret or secret != app.config.get('NOTIFICATION_CRON_SECRET'):
        return make_response({'error': 'Unauthorized'}, 401)
    try:
        sent, err = _send_missing_predictions_notifications()
        if err:
            return make_response({'error': err}, 500)
        return make_response({'sent': sent}, 200)
    except Exception as e:
        print(f"send_missing_predictions_cron failed: {e}")
        import traceback
        traceback.print_exc()
        return make_response({'error': str(e)}, 500)


# JWT token helper functions
def generate_token(user_id):
    """Generate a JWT token for a user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)  # Token expires in 30 days
    }
    return jwt.encode(payload, app.secret_key, algorithm='HS256')

def get_user_id_from_token():
    """Extract user_id from JWT token in Authorization header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        # Support both "Bearer <token>" and just "<token>"
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else auth_header
        payload = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user_id():
    """Get current user ID from token or session (for backward compatibility)"""
    # Try token first (for cross-domain auth)
    user_id = get_user_id_from_token()
    if user_id:
        return user_id
    # Fall back to session (for same-domain auth)
    return session.get('user_id')


def get_active_user_by_id(user_id):
    """Return the User with the given id if they exist and are not soft-deleted; else None."""
    if not user_id:
        return None
    return User.query.filter(User.id == user_id, User.deleted_at.is_(None)).first()


def get_active_user_id_by_email(email):
    """Return user id for the given email (case-insensitive), or None. Does not load full User (avoids recursion)."""
    if not email or not str(email).strip():
        return None
    normalized = str(email).strip().lower()
    stmt = select(User.id).where(func.lower(User.email) == normalized, User.deleted_at.is_(None))
    result = db.session.execute(stmt)
    return result.scalar() if result else None


def get_active_user_id_by_username(username):
    """Return user id for the given username, or None. Does not load full User."""
    if not username or not str(username).strip():
        return None
    stmt = select(User.id).where(User.username == username.strip(), User.username.isnot(None), User.deleted_at.is_(None))
    result = db.session.execute(stmt)
    return result.scalar() if result else None


def get_user_dict_by_id(user_id):
    """Return a plain dict of user fields for API (id, username, email, avatar_url, created_at, updated_at).
    Uses a single column select per field so no User ORM instance is created (avoids recursion)."""
    if not user_id:
        return None
    stmt = select(
        User.id,
        User.username,
        User.email,
        User.avatar_url,
        User.created_at,
        User.updated_at,
    ).where(User.id == user_id, User.deleted_at.is_(None))
    row = db.session.execute(stmt).first()
    if not row:
        return None
    return {
        'id': row[0],
        'username': row[1],
        'email': row[2],
        'avatar_url': row[3],
        'created_at': row[4].isoformat() if row[4] else None,
        'updated_at': row[5].isoformat() if row[5] else None,
    }


def get_active_user_by_email(email):
    """Return the User with the given email if they exist and are not soft-deleted; else None.
    Comparison is case-insensitive so Login and Signup match regardless of casing."""
    if not email or not str(email).strip():
        return None
    normalized = str(email).strip().lower()
    return User.query.filter(func.lower(User.email) == normalized, User.deleted_at.is_(None)).first()


def get_active_user_by_username(username):
    """Return the User with the given username if they exist and are not soft-deleted; else None."""
    if not username or not str(username).strip():
        return None
    return User.query.filter(User.username == username.strip(), User.username.isnot(None), User.deleted_at.is_(None)).first()


def get_league_membership(user_id, league_id):
    """Return LeagueMembership for (user_id, league_id) or None."""
    if not user_id or not league_id:
        return None
    return LeagueMembership.query.filter_by(user_id=user_id, league_id=league_id).first()


def is_league_admin(user_id, league_id):
    """Return True if user is an admin of the league."""
    m = get_league_membership(user_id, league_id)
    return m is not None and m.role == 'admin'


def _send_password_reset_via_sendgrid_api(to_email, from_email, from_name, subject, body, api_key):
    """Send via SendGrid v3 HTTP API. Returns True on 202, False otherwise. Avoids SMTP timeouts."""
    if not REQUESTS_AVAILABLE or not api_key:
        return False
    url = 'https://api.sendgrid.com/v3/mail/send'
    payload = {
        'personalizations': [{'to': [{'email': to_email}]}],
        'from': {'email': from_email, 'name': from_name or None},
        'subject': subject,
        'content': [{'type': 'text/plain', 'value': body}],
    }
    if not payload['from']['name']:
        del payload['from']['name']
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        if r.status_code == 202:
            return True
        print(f"SendGrid API returned {r.status_code}: {r.text[:500]}")
        return False
    except Exception as e:
        print(f"SendGrid API request failed [{type(e).__name__}]: {e}")
        return False


def send_password_reset_email(to_email, reset_link):
    """Send password reset email. Prefers SendGrid HTTP API when using SendGrid (avoids SMTP timeouts)."""
    server = (app.config.get('MAIL_SERVER') or '').strip().lower()
    if not server:
        return False
    sender = app.config.get('MAIL_DEFAULT_SENDER') or app.config.get('MAIL_USERNAME') or 'noreply@localhost'
    from_name, from_email = parseaddr(sender)
    if not from_email:
        from_email = sender if '@' in sender else 'noreply@localhost'
    subject = 'Reset your password'
    body = f'''Someone requested a password reset for your account.

Click the link below to set a new password (link expires in 1 hour):

{reset_link}

If you didn't request this, you can ignore this email.
'''
    # Use SendGrid HTTP API when possible — one fast HTTP request, no SMTP connection timeout
    if 'sendgrid' in server and app.config.get('MAIL_PASSWORD'):
        if _send_password_reset_via_sendgrid_api(to_email, from_email, from_name or 'Fantasy Predictor', subject, body, app.config['MAIL_PASSWORD']):
            return True
        # Fall back to SMTP if API fails (e.g. wrong key format)
    # SMTP path
    port = app.config.get('MAIL_PORT', 587)
    use_tls = app.config.get('MAIL_USE_TLS', True)
    username = app.config.get('MAIL_USERNAME')
    password = app.config.get('MAIL_PASSWORD')
    try:
        with smtplib.SMTP(server, port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.sendmail(from_email, to_email, _make_plain_email_message(sender, to_email, subject, body))
        return True
    except Exception as e:
        print(f"Password reset email failed [{type(e).__name__}]: {e}")
        return False


def _make_plain_email_message(sender, to_email, subject, body):
    """Build a simple RFC-style message for SMTP."""
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = to_email
    msg.attach(MIMEText(body, 'plain'))
    return msg.as_string()


def send_notification_email(to_email, subject, body):
    """Send a transactional email (e.g. missing-predictions reminder). Uses same config as password reset."""
    server = (app.config.get('MAIL_SERVER') or '').strip().lower()
    if not server:
        return False
    sender = app.config.get('MAIL_DEFAULT_SENDER') or app.config.get('MAIL_USERNAME') or 'noreply@localhost'
    from_name, from_email = parseaddr(sender)
    if not from_email:
        from_email = sender if '@' in sender else 'noreply@localhost'
    if 'sendgrid' in server and app.config.get('MAIL_PASSWORD'):
        if _send_password_reset_via_sendgrid_api(to_email, from_email, from_name or 'Fantasy Predictor', subject, body, app.config['MAIL_PASSWORD']):
            return True
    port = app.config.get('MAIL_PORT', 587)
    use_tls = app.config.get('MAIL_USE_TLS', True)
    username = app.config.get('MAIL_USERNAME')
    password = app.config.get('MAIL_PASSWORD')
    try:
        with smtplib.SMTP(server, port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.sendmail(from_email, to_email, _make_plain_email_message(sender, to_email, subject, body))
        return True
    except Exception as e:
        print(f"Notification email failed [{type(e).__name__}]: {e}")
        return False


# Note: Renamed Predictions Resource class to avoid conflict with model
# The endpoint /api/v1/predictions uses the PredictionsResource class below

# Ensure requests module is available
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("=" * 80)
    print("WARNING: 'requests' module is not available!")
    print("The sync fixtures endpoint will not work.")
    print("Please ensure you're running the server with: pipenv run python app.py")
    print("Or activate the virtual environment first: pipenv shell")
    print("=" * 80)

# OpenAI for Ask AI predictions (optional feature)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

# Views go here!
class Users(Resource):
    def post(self):
        try:
            data = request.get_json() or {}
            raw_email = (data.get('email') or '').strip()
            email = raw_email.lower() if raw_email else ''
            password = data.get('password')
            confirm_password = data.get('confirm_password')
            if not email:
                return make_response({'error': 'Email is required'}, 400)
            pw = (str(password) if password is not None else '').strip()
            confirm_pw = (str(confirm_password) if confirm_password is not None else '').strip()
            if not pw:
                return make_response({'error': 'Password is required'}, 400)
            if pw != confirm_pw:
                return make_response({'error': 'Password and confirmation do not match'}, 400)
            if get_active_user_by_email(email):
                return make_response({'error': 'An account with this email already exists'}, 400)
            user = User(email=email)
            user.password_hash = pw
            db.session.add(user)
            db.session.flush()
            # Add new user only to the configured signup league (e.g. Predictor Community / league 11). They can join other open leagues from Browse.
            display_base = email.split('@')[0].strip() or 'Player'
            if not display_base or len(display_base) < 2:
                display_base = 'Player'
            signup_league_id = app.config.get('SIGNUP_LEAGUE_ID')
            if signup_league_id is not None:
                league = League.query.get(signup_league_id)
                if league and not LeagueMembership.query.filter_by(league_id=league.id, user_id=user.id).first():
                    display_name = display_base
                    suffix = 0
                    while LeagueMembership.query.filter_by(league_id=league.id, display_name=display_name).first():
                        suffix += 1
                        display_name = f"{display_base}_{suffix}"
                    db.session.add(LeagueMembership(user_id=user.id, league_id=league.id, display_name=display_name, role='player'))
            db.session.commit()
            user_id = user.id
            session['user_id'] = user_id
            token = generate_token(user_id)
            # Use plain dict (get_user_dict_by_id) to avoid recursion from User.to_dict() serializing leagues/memberships
            user_dict = get_user_dict_by_id(user_id)
            return make_response({
                'user': user_dict or {'id': user_id, 'email': email, 'username': None, 'created_at': None, 'updated_at': None},
                'token': token
            }, 201)
        except RecursionError:
            db.session.rollback()
            print("Signup: recursion during user creation or response serialization")
            return make_response({'error': 'Signup failed. Please try again.'}, 500)
        except Exception as e:
            db.session.rollback()
            print(f"Error creating user: {str(e)}")
            return make_response({'error': str(e)}, 500)
    
api.add_resource(Users, '/api/v1/users')

class Fixtures(Resource):
    def get(self, round_number=None):
        """Get all fixtures or fixtures for a specific round (current season only when competition set). Optional query: ?competition=slug.
        For fifa.world, round_number is Day 1/2/3... (grouped by scheduled calendar day)."""
        competition = request.args.get('competition') or None
        base = Fixture.query
        comp_filter = _fixture_query_competition(competition)
        if comp_filter is not None:
            base = base.filter(comp_filter)
        season_start = _current_season_start_for_competition(comp_filter)
        if season_start is not None:
            base = base.filter(Fixture.fixture_date >= season_start)
        if round_number:
            if competition == 'fifa.world':
                base = base.filter(Fixture.fixture_round == round_number)
            else:
                base = base.filter(Fixture.fixture_round == round_number)
        fixtures = [
            f.to_dict()
            for f in base.order_by(Fixture.fixture_date.asc()).all()
        ]
        return make_response(fixtures, 200)

api.add_resource(Fixtures, '/api/v1/fixtures', '/api/v1/fixtures/<int:round_number>')

# Premier League standings (read-only, for display to help with predictions)
STANDINGS_API_URL = os.getenv(
    'STANDINGS_API_URL',
    'https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v5/competitions/8/seasons/2025/standings?live=false'
)

# Supported competitions for predictions.
# source='football_data' uses api.football-data.org (set FOOTBALL_DATA_ORG_API_KEY); source='espn' uses ESPN API.
# football-data.org free tier: https://www.football-data.org/coverage (includes Premier League = PL)
SUPPORTED_COMPETITIONS = [
    {'slug': 'eng.1', 'name': 'English Premier League', 'source': 'football_data', 'football_data_code': 'PL'},
    {'slug': 'eng.2', 'name': 'EFL Championship', 'source': 'football_data', 'football_data_code': 'ELC'},
    {'slug': 'esp.1', 'name': 'La Liga', 'source': 'espn', 'espn_slug': 'esp.1'},
    {'slug': 'fra.1', 'name': 'Ligue 1', 'source': 'espn', 'espn_slug': 'fra.1'},
    {'slug': 'ger.1', 'name': 'Bundesliga', 'source': 'football_data', 'football_data_code': 'BL1'},
    {'slug': 'ita.1', 'name': 'Serie A', 'source': 'football_data', 'football_data_code': 'SA'},
    {'slug': 'uefa.cl', 'name': 'UEFA Champions League', 'source': 'football_data', 'football_data_code': 'CL'},
    {'slug': 'usa.1', 'name': 'MLS', 'source': 'espn', 'espn_slug': 'usa.1'},
    {'slug': 'fifa.world', 'name': 'FIFA World Cup', 'source': 'espn', 'espn_slug': 'fifa.world'},
]


def _fixture_query_competition(competition_slug):
    """Return base query filter for fixtures by competition. None = all; 'eng.1' includes legacy null and empty string."""
    if not competition_slug:
        return None
    if competition_slug == 'eng.1':
        return or_(
            Fixture.competition_slug == 'eng.1',
            Fixture.competition_slug.is_(None),
            Fixture.competition_slug == '',
        )
    return Fixture.competition_slug == competition_slug


def _world_cup_day_dates(comp_filter, season_start=None):
    """For fifa.world: return ordered list of distinct fixture dates (by calendar day). Used for Day 1/2/3 grouping."""
    q = db.session.query(Fixture.fixture_date).filter(comp_filter).filter(Fixture.fixture_date.isnot(None))
    if season_start is not None:
        q = q.filter(Fixture.fixture_date >= season_start)
    rows = q.all()
    seen = set()
    out = []
    for (dt,) in rows:
        d = dt.date() if hasattr(dt, 'date') else (dt if isinstance(dt, date) else None)
        if d is not None and d not in seen:
            seen.add(d)
            out.append(d)
    out.sort()
    return out


def _current_season_start_for_competition(comp_filter):
    """Return the start date of the 'current' season for the given competition: the season that contains
    the most recent fixture (max fixture_date). European leagues typically run Aug–May; we use August 1.
    Returns None if no fixtures or no dates, so callers can skip the filter. Uses naive datetime to match
    Fixture.fixture_date (no timezone) for DB comparison."""
    q = db.session.query(func.max(Fixture.fixture_date)).filter(Fixture.fixture_date.isnot(None))
    if comp_filter is not None:
        q = q.filter(comp_filter)
    row = q.first()
    if not row or row[0] is None:
        return None
    latest = row[0]
    if hasattr(latest, 'year') and hasattr(latest, 'month'):
        year, month = latest.year, latest.month
    else:
        return None
    if month >= 8:
        season_start = datetime(year, 8, 1)
    else:
        season_start = datetime(year - 1, 8, 1)
    return season_start


@app.route('/api/v1/competitions', methods=['GET'])
def get_competitions():
    """List supported competitions (leagues) for predictions."""
    return make_response({'competitions': SUPPORTED_COMPETITIONS}, 200)


def _fetch_standings_data():
    """Fetch current Premier League standings; returns (standings_list, matchweek) or (None, None) on error."""
    if not REQUESTS_AVAILABLE:
        return None, None
    try:
        resp = requests.get(STANDINGS_API_URL, headers={'Accept': 'application/json'}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        tables = data.get('tables') or []
        entries = tables[0].get('entries', []) if tables else []
        matchweek = data.get('matchweek')
        standings = []
        for e in entries:
            team = e.get('team') or {}
            overall = e.get('overall') or {}
            standings.append({
                'position': overall.get('position'),
                'team': team.get('name') or team.get('shortName') or '—',
                'played': overall.get('played', 0),
                'won': overall.get('won', 0),
                'drawn': overall.get('drawn', 0),
                'lost': overall.get('lost', 0),
                'goalsFor': overall.get('goalsFor', 0),
                'goalsAgainst': overall.get('goalsAgainst', 0),
                'goalDifference': (overall.get('goalsFor', 0) or 0) - (overall.get('goalsAgainst', 0) or 0),
                'points': overall.get('points', 0),
            })
        return standings, matchweek
    except Exception:
        return None, None


def _fetch_standings_football_data(competition_code):
    """Fetch standings from football-data.org for a competition (e.g. BL1, SA). Returns (standings_list, competition_name) or (None, None)."""
    api_key = (os.getenv('FOOTBALL_DATA_ORG_API_KEY') or '').strip()
    if not api_key:
        return None, None
    url = f'{FOOTBALL_DATA_ORG_BASE}/competitions/{competition_code}/standings'
    headers = {'X-Auth-Token': api_key, 'User-Agent': 'FantasyPredictor/1.0'}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException:
        return None, None
    competition_name = (data.get('competition') or {}).get('name') or 'League'
    standings_raw = data.get('standings') or []
    # League has one entry (type TOTAL); LEAGUE_CUP has multiple (groups). Take first table.
    table = []
    for s in standings_raw:
        if isinstance(s, dict) and s.get('type') == 'TOTAL' and isinstance(s.get('table'), list):
            table = s['table']
            break
    if not table and standings_raw and isinstance(standings_raw[0], dict) and isinstance(standings_raw[0].get('table'), list):
        table = standings_raw[0]['table']
    out = []
    for row in table:
        if not isinstance(row, dict):
            continue
        team = row.get('team') or {}
        name = team.get('name') or team.get('shortName') or '—'
        played = row.get('playedGames', 0) or 0
        won = row.get('won', 0) or 0
        draw = row.get('draw', 0) or 0
        lost = row.get('lost', 0) or 0
        gf = row.get('goalsFor', 0) or 0
        ga = row.get('goalsAgainst', 0) or 0
        gd = row.get('goalDifference', 0) or (gf - ga)
        pts = row.get('points', 0) or 0
        out.append({
            'position': row.get('position'),
            'team': name,
            'played': played,
            'won': won,
            'drawn': draw,
            'lost': lost,
            'goalsFor': gf,
            'goalsAgainst': ga,
            'goalDifference': gd,
            'points': pts,
        })
    return out, competition_name


@app.route('/api/v1/standings', methods=['GET'])
def get_standings():
    """Fetch league table from external API. Query: ?competition=slug (default eng.1). No standings for fifa.world."""
    if not REQUESTS_AVAILABLE:
        return make_response({'error': 'Standings unavailable (requests not available).'}, 503)
    competition = (request.args.get('competition') or 'eng.1').strip()
    if competition == 'fifa.world':
        return make_response({'standings': [], 'competition_name': 'FIFA World Cup', 'matchweek': None}, 200)
    try:
        comp = next((c for c in SUPPORTED_COMPETITIONS if c.get('slug') == competition), None)
        if comp and comp.get('source') == 'football_data' and comp.get('football_data_code'):
            standings_list, comp_name = _fetch_standings_football_data(comp['football_data_code'])
            if standings_list is not None:
                return make_response({
                    'matchweek': None,
                    'standings': standings_list,
                    'competition_name': comp_name or comp.get('name', 'League'),
                }, 200)
            return make_response({'error': 'Could not fetch standings (check FOOTBALL_DATA_ORG_API_KEY or competition has no table).', 'standings': [], 'competition_name': comp.get('name', '')}, 502)
        if comp and comp.get('source') == 'espn':
            # ESPN leagues (La Liga, Ligue 1, MLS): no standings API in this app
            return make_response({'standings': [], 'competition_name': comp.get('name', 'League'), 'matchweek': None}, 200)
        # Premier League (eng.1 or default)
        url = request.args.get('api_url') or STANDINGS_API_URL
        resp = requests.get(url, headers={'Accept': 'application/json'}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        tables = data.get('tables') or []
        entries = tables[0].get('entries', []) if tables else []
        matchweek = data.get('matchweek')
        standings = []
        for e in entries:
            team = e.get('team') or {}
            overall = e.get('overall') or {}
            standings.append({
                'position': overall.get('position'),
                'team': team.get('name') or team.get('shortName') or '—',
                'played': overall.get('played', 0),
                'won': overall.get('won', 0),
                'drawn': overall.get('drawn', 0),
                'lost': overall.get('lost', 0),
                'goalsFor': overall.get('goalsFor', 0),
                'goalsAgainst': overall.get('goalsAgainst', 0),
                'goalDifference': (overall.get('goalsFor', 0) or 0) - (overall.get('goalsAgainst', 0) or 0),
                'points': overall.get('points', 0),
            })
        return make_response({
            'matchweek': matchweek,
            'standings': standings,
            'competition_name': 'Premier League',
        }, 200)
    except requests.RequestException as e:
        return make_response({'error': f'Could not fetch standings: {str(e)}'}, 502)
    except (KeyError, IndexError, TypeError) as e:
        return make_response({'error': f'Invalid standings data: {str(e)}'}, 502)

@app.route('/api/v1/fixtures/rounds', methods=['GET'])
def get_available_rounds():
    """Get all available game week rounds from fixtures (current season only). Optional query: ?competition=slug.
    For fifa.world, rounds are Day 1, Day 2, ... by scheduled calendar day."""
    try:
        competition = request.args.get('competition') or None
        comp_filter = _fixture_query_competition(competition)
        season_start = _current_season_start_for_competition(comp_filter)
        base = Fixture.query
        if comp_filter is not None:
            base = base.filter(comp_filter)
        if season_start is not None:
            base = base.filter(Fixture.fixture_date >= season_start)
        if competition == 'fifa.world':
            rounds_q = db.session.query(Fixture.fixture_round).distinct().filter(Fixture.fixture_round.isnot(None))
            if comp_filter is not None:
                rounds_q = rounds_q.filter(comp_filter)
            if season_start is not None:
                rounds_q = rounds_q.filter(Fixture.fixture_date >= season_start)
            rounds = rounds_q.order_by(Fixture.fixture_round).all()
            round_numbers = [r[0] for r in rounds]
        else:
            rounds_q = db.session.query(Fixture.fixture_round).distinct().filter(Fixture.fixture_round.isnot(None))
            if comp_filter is not None:
                rounds_q = rounds_q.filter(comp_filter)
            if season_start is not None:
                rounds_q = rounds_q.filter(Fixture.fixture_date >= season_start)
            rounds = rounds_q.order_by(Fixture.fixture_round).all()
            round_numbers = [r[0] for r in rounds]
        total_fixtures = base.count()
        fixtures_with_rounds = len(round_numbers) if round_numbers else 0
        fixtures_without_rounds = total_fixtures - fixtures_with_rounds

        print(f"DEBUG get_available_rounds: competition={competition!r} Total fixtures: {total_fixtures}, With rounds: {fixtures_with_rounds}, Without rounds: {fixtures_without_rounds}")
        
        # If no rounds found but fixtures exist, get a sample fixture to see what we have
        if len(round_numbers) == 0 and total_fixtures > 0:
            sample_fixture = base.first()
            if sample_fixture:
                print(f"DEBUG: Sample fixture: round={sample_fixture.fixture_round}, home={sample_fixture.fixture_home_team}, away={sample_fixture.fixture_away_team}")
            
            # Return empty rounds with info - frontend can still work if we update it
            return make_response({
                'rounds': [],
                'warning': f'No rounds found in {total_fixtures} fixtures. Check backend console for API structure debug output.',
                'total_fixtures': total_fixtures,
                'fixtures_with_rounds': fixtures_with_rounds,
                'fixtures_without_rounds': fixtures_without_rounds
            }, 200)
        
        return make_response({
            'rounds': round_numbers,
            'total_fixtures': total_fixtures,
            'fixtures_with_rounds': fixtures_with_rounds
        }, 200)
    except Exception as e:
        import traceback
        print(f"Error in get_available_rounds: {str(e)}")
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/fixtures/next-incomplete-round', methods=['GET'])
def get_next_incomplete_round():
    """Return the smallest game week (round) in the current season with at least one fixture not yet completed. Optional: ?competition=slug.
    For fifa.world, round is Day 1/2/3... (first day with an incomplete fixture)."""
    try:
        competition = request.args.get('competition') or None
        comp_filter = _fixture_query_competition(competition)
        season_start = _current_season_start_for_competition(comp_filter)
        if competition == 'fifa.world':
            q = db.session.query(Fixture.fixture_round).filter(Fixture.is_completed == False).filter(Fixture.fixture_round.isnot(None))
            if comp_filter is not None:
                q = q.filter(comp_filter)
            if season_start is not None:
                q = q.filter(Fixture.fixture_date >= season_start)
            next_round_row = q.order_by(Fixture.fixture_round.asc()).first()
            if next_round_row:
                return make_response({'round': next_round_row[0]}, 200)
            max_q = db.session.query(db.func.max(Fixture.fixture_round)).filter(Fixture.fixture_round.isnot(None))
            if comp_filter is not None:
                max_q = max_q.filter(comp_filter)
            if season_start is not None:
                max_q = max_q.filter(Fixture.fixture_date >= season_start)
            max_row = max_q.first()
            return make_response({'round': max_row[0] if max_row and max_row[0] is not None else None}, 200)
        q = db.session.query(Fixture.fixture_round).filter(Fixture.is_completed == False).filter(Fixture.fixture_round.isnot(None))
        if comp_filter is not None:
            q = q.filter(comp_filter)
        if season_start is not None:
            q = q.filter(Fixture.fixture_date >= season_start)
        next_round_row = q.order_by(Fixture.fixture_round.asc()).first()
        if next_round_row:
            return make_response({'round': next_round_row[0]}, 200)
        max_q = db.session.query(db.func.max(Fixture.fixture_round)).filter(Fixture.fixture_round.isnot(None))
        if comp_filter is not None:
            max_q = max_q.filter(comp_filter)
        if season_start is not None:
            max_q = max_q.filter(Fixture.fixture_date >= season_start)
        max_round_row = max_q.first()
        round_num = max_round_row[0] if max_round_row and max_round_row[0] is not None else None
        return make_response({'round': round_num}, 200)
    except Exception as e:
        import traceback
        print(f"Error in get_next_incomplete_round: {str(e)}")
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/fixtures/current-round', methods=['GET'])
def get_current_round():
    """Return the default game week: the lowest round that has at least one non-completed fixture
    in the *current* season (season that contains the most recent fixture). If every round in that
    season is complete, return the last round. Optional: ?competition=slug.
    For fifa.world, round is Day 1/2/3... (first day with an incomplete fixture, or last day)."""
    try:
        from sqlalchemy import distinct
        competition = request.args.get('competition') or None
        comp_filter = _fixture_query_competition(competition)
        season_start = _current_season_start_for_competition(comp_filter)
        if competition == 'fifa.world':
            incomplete_query = (
                db.session.query(distinct(Fixture.fixture_round))
                .filter(Fixture.fixture_round.isnot(None))
                .filter(or_(Fixture.actual_home_score.is_(None), Fixture.actual_away_score.is_(None)))
                .filter(or_(Fixture.is_completed == False, Fixture.is_completed.is_(None)))
            )
            if comp_filter is not None:
                incomplete_query = incomplete_query.filter(comp_filter)
            if season_start is not None:
                incomplete_query = incomplete_query.filter(Fixture.fixture_date >= season_start)
            incomplete_rows = incomplete_query.all()
            incomplete_rounds = sorted([int(r[0]) for r in incomplete_rows if r[0] is not None])
            if incomplete_rounds:
                return make_response({'round': incomplete_rounds[0]}, 200)
            max_q = db.session.query(func.max(Fixture.fixture_round)).filter(Fixture.fixture_round.isnot(None))
            if comp_filter is not None:
                max_q = max_q.filter(comp_filter)
            if season_start is not None:
                max_q = max_q.filter(Fixture.fixture_date >= season_start)
            max_row = max_q.first()
            round_num = max_row[0] if max_row and max_row[0] is not None else None
            return make_response({'round': round_num}, 200)
        incomplete_query = (
            db.session.query(distinct(Fixture.fixture_round))
            .filter(Fixture.fixture_round.isnot(None))
            .filter(or_(Fixture.actual_home_score.is_(None), Fixture.actual_away_score.is_(None)))
            .filter(or_(Fixture.is_completed == False, Fixture.is_completed.is_(None)))
        )
        if comp_filter is not None:
            incomplete_query = incomplete_query.filter(comp_filter)
        if season_start is not None:
            incomplete_query = incomplete_query.filter(Fixture.fixture_date >= season_start)
        incomplete_rows = incomplete_query.all()
        incomplete_rounds = sorted([int(r[0]) for r in incomplete_rows if r[0] is not None])
        max_q = db.session.query(func.max(Fixture.fixture_round)).filter(Fixture.fixture_round.isnot(None))
        if comp_filter is not None:
            max_q = max_q.filter(comp_filter)
        if season_start is not None:
            max_q = max_q.filter(Fixture.fixture_date >= season_start)
        max_row = max_q.first()
        max_r = int(max_row[0]) if max_row and max_row[0] is not None else None
        if incomplete_rounds:
            round_num = incomplete_rounds[0]
        else:
            round_num = max_r
        payload = {'round': round_num}
        if request.args.get('debug'):
            max_for_debug = max_r
            if max_for_debug is None and incomplete_rounds:
                max_q = db.session.query(func.max(Fixture.fixture_round)).filter(Fixture.fixture_round.isnot(None))
                if comp_filter is not None:
                    max_q = max_q.filter(comp_filter)
                max_row = max_q.first()
                max_for_debug = int(max_row[0]) if max_row and max_row[0] is not None else None
            payload['_debug'] = {
                'incomplete_rounds': incomplete_rounds[:15],
                'max_round': max_for_debug,
            }
        resp = make_response(payload, 200)
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        return resp
    except Exception as e:
        import traceback
        print(f"Error in get_current_round: {str(e)}")
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/repair-fixture-completed', methods=['POST'])
@app.route('/api/v1/fixtures/repair-completed', methods=['POST'])
def repair_fixture_completed():
    """Set is_completed=True for fixtures.
    - Default: only fixtures that have both actual_home_score and actual_away_score (and were still false).
    - Optional JSON body: {"round": 24} marks ALL fixtures in that round as completed (use when one game
      has is_completed=False but no scores stored, so the default repair finds 0)."""
    try:
        data = request.get_json(silent=True) or {}
        force_round = data.get('round') if data else None
        if force_round is not None:
            force_round = int(force_round)
        count = 0
        if force_round is not None:
            to_fix = Fixture.query.filter(
                Fixture.fixture_round == force_round,
                or_(Fixture.is_completed == False, Fixture.is_completed.is_(None))
            ).all()
            for f in to_fix:
                f.is_completed = True
                count += 1
            db.session.commit()
            return make_response({
                'message': f'Marked {count} fixture(s) in round {force_round} as completed.',
                'updated': count,
                'round': force_round
            }, 200)
        to_fix = Fixture.query.filter(
            Fixture.actual_home_score.isnot(None),
            Fixture.actual_away_score.isnot(None),
        ).filter(
            or_(Fixture.is_completed == False, Fixture.is_completed.is_(None))
        ).all()
        for f in to_fix:
            f.is_completed = True
            count += 1
        db.session.commit()
        return make_response({
            'message': f'Marked {count} fixture(s) as completed (had scores but is_completed was false).',
            'updated': count
        }, 200)
    except Exception as e:
        db.session.rollback()
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/fixtures/dedupe', methods=['POST'])
def dedupe_fixtures_api():
    """Remove duplicate fixtures (same competition, round, normalized home/away). Use after migrating from Pulselive to football-data.
    Requires auth. Does not touch Game or Prediction; predictions stay because games are matched to fixtures by team names."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'Authentication required'}, 401)
        deleted = _dedupe_fixtures()
        return make_response({
            'removed': deleted,
            'message': f'Removed {deleted} duplicate fixture(s). Predictions unchanged (games matched to fixtures by team names).',
        }, 200)
    except Exception as e:
        db.session.rollback()
        return make_response({'error': str(e)}, 500)


# ESPN does not expose matchday/week on each event. Leagues play N matches per round; we assign round by sorted date.
# Cap events so we don't get extra "rounds" from cup/other competitions (e.g. Ligue 1 calendar can include 80+ dates).
ESPN_MATCHES_PER_ROUND = {
    'ger.1': 9,   # Bundesliga (e.g. matchday 24 = Feb 27–Mar 1: Augsburg–Cologne through Hamburg–RB Leipzig)
    'esp.1': 10,  # La Liga
    'fra.1': 10,  # Ligue 1
    'eng.1': 10,  # EPL (if ever synced via ESPN)
    'usa.1': 15,  # MLS (approx; varies by season)
}
ESPN_MAX_ROUNDS = {
    'ger.1': 34,
    'esp.1': 38,
    'fra.1': 38,
    'eng.1': 38,
    'usa.1': 34,
}
# For fifa.world, assign Day 1/2/3 by calendar day in venue timezone (US Pacific), not UTC.
WORLD_CUP_DAY_TZ = timezone(timedelta(hours=-7))


def _normalize_team_name_for_match(name):
    """Normalize team name for deduplication: casing, accents (Curaçao/Curcao), umlauts (München/Munich), etc."""
    if not name or not isinstance(name, str):
        return ''
    s = name.strip().lower()
    # Strip accents (Curaçao -> curacao, Iran/New Zealand already ascii)
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    # Umlauts -> ascii so München matches Munich
    for char, repl in [('ü', 'ue'), ('ö', 'oe'), ('ä', 'ae'), ('ß', 'ss')]:
        s = s.replace(char, repl)
    # Drop common prefixes so "FC Bayern München" and "Bayern Munich" match
    for prefix in ('fc ', 'afc ', 'ssc ', 'sc ', 'cf ', 'fk ', 'real ', 'atletico '):
        if s.startswith(prefix):
            s = s[len(prefix):].strip()
    # Drop common suffixes so "Chelsea FC" and "Chelsea" match (football-data.org uses suffix style)
    for suffix in (' fc', ' fc.', ' afc', ' afc.'):
        if s.endswith(suffix):
            s = s[:-len(suffix)].strip()
    # Place-name variants (German vs English)
    s = s.replace('muenchen', 'munich')
    s = s.replace('moenchengladbach', 'munchengladbach')
    s = s.replace('&', ' and ')
    while '  ' in s:
        s = s.replace('  ', ' ')
    return s.strip()


def _sync_fixtures_espn(league_slug):
    """Fetch fixtures from ESPN API for a given league (e.g. esp.1, fifa.world). Returns (added, updated, seen, error)."""
    comp = next((c for c in SUPPORTED_COMPETITIONS if c.get('espn_slug') == league_slug or c.get('slug') == league_slug), None)
    competition_slug = (comp or {}).get('slug') or league_slug
    base_url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/scoreboard"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    resp = requests.get(base_url, headers=headers, timeout=15)
    resp.raise_for_status()
    info = resp.json()
    leagues_list = info.get('leagues') or []
    calendar = leagues_list[0].get('calendar') if leagues_list else []
    dates_to_fetch = []
    calendar_entries_by_date = {}  # date_str -> round number from phase (for fifa.world)
    if isinstance(calendar, list) and calendar:
        first = calendar[0]
        if isinstance(first, str):
            for s in calendar:
                if isinstance(s, str) and 'T' in s:
                    try:
                        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
                        dates_to_fetch.append(dt.strftime('%Y%m%d'))
                    except Exception:
                        pass
        elif isinstance(first, dict) and first.get('entries'):
            for entry in first.get('entries', []):
                start_val = entry.get('startDate')
                end_val = entry.get('endDate')
                phase_round = entry.get('value')
                try:
                    phase_round = int(phase_round) if phase_round is not None else None
                except (TypeError, ValueError):
                    phase_round = None
                if start_val and isinstance(start_val, str):
                    try:
                        start_dt = datetime.fromisoformat(start_val.replace('Z', '+00:00'))
                        if start_dt.tzinfo is None:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                        end_dt = start_dt
                        if end_val and isinstance(end_val, str):
                            try:
                                end_dt = datetime.fromisoformat(end_val.replace('Z', '+00:00'))
                                if end_dt.tzinfo is None:
                                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                            except Exception:
                                pass
                        if phase_round is not None and league_slug == 'fifa.world':
                            start_pacific = start_dt.astimezone(WORLD_CUP_DAY_TZ)
                            end_pacific = end_dt.astimezone(WORLD_CUP_DAY_TZ)
                            cur = start_pacific.date()
                            end_date_pacific = end_pacific.date()
                            while cur <= end_date_pacific:
                                calendar_entries_by_date[cur.strftime('%Y%m%d')] = phase_round
                                cur += timedelta(days=1)
                        d = start_dt
                        while d <= end_dt:
                            dstr = d.strftime('%Y%m%d')
                            dates_to_fetch.append(dstr)
                            if phase_round is not None and league_slug != 'fifa.world':
                                calendar_entries_by_date[dstr] = phase_round
                            d += timedelta(days=1)
                    except Exception:
                        pass
    # For leagues with a fixed season length, ensure we include upcoming matchdays (e.g. Bundesliga
    # week 24 = Feb 27–Mar 1). ESPN calendar can be short; extend through end of season.
    _euro_season_leagues = ('ger.1', 'esp.1', 'fra.1', 'eng.1')
    if league_slug in _euro_season_leagues:
        now = datetime.now(timezone.utc)
        if now.month >= 8:
            end_year = now.year + 1
        else:
            end_year = now.year
        end_season = datetime(end_year, 5, 31, tzinfo=timezone.utc)
        d = now.replace(hour=0, minute=0, second=0, microsecond=0)
        while d <= end_season:
            dates_to_fetch.append(d.strftime('%Y%m%d'))
            d += timedelta(days=1)
    if not dates_to_fetch:
        dates_to_fetch = [datetime.now(timezone.utc).strftime('%Y%m%d')]
    dates_to_fetch = sorted(set(dates_to_fetch))[:250]
    matches_per_round = ESPN_MATCHES_PER_ROUND.get(league_slug)
    collected = []
    for date_str in dates_to_fetch:
        url = f"{base_url}?dates={date_str}"
        try:
            r = requests.get(url, headers=headers, timeout=15)
            r.raise_for_status()
            day_data = r.json()
        except Exception as e:
            print(f"ESPN sync: skip date {date_str}: {e}")
            continue
        events = day_data.get('events') or []
        for ev in events:
            external_id = str(ev.get('id') or '')
            comps = ev.get('competitions') or []
            comp0 = comps[0] if comps else {}
            competitors = comp0.get('competitors') or []
            home_team = away_team = None
            home_score = away_score = None
            for c in competitors:
                name = (c.get('team') or {}).get('displayName') or (c.get('team') or {}).get('name') or ''
                if (c.get('homeAway') or '').lower() == 'home':
                    home_team = name
                    try:
                        home_score = int(c.get('score')) if c.get('score') is not None else None
                    except (TypeError, ValueError):
                        home_score = None
                else:
                    away_team = name
                    try:
                        away_score = int(c.get('score')) if c.get('score') is not None else None
                    except (TypeError, ValueError):
                        away_score = None
            if not home_team or not away_team:
                continue
            status = (comp0.get('status') or {}) if comp0 else {}
            is_completed = status.get('type', {}).get('state') == 'post' or status.get('completed') is True
            date_val = ev.get('date')
            fixture_date = None
            if date_val:
                try:
                    fixture_date = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
                    if fixture_date.tzinfo is None:
                        fixture_date = fixture_date.replace(tzinfo=timezone.utc)
                except Exception:
                    pass
            collected.append({
                'external_id': external_id,
                'home_team': home_team,
                'away_team': away_team,
                'fixture_date': fixture_date,
                'home_score': home_score,
                'away_score': away_score,
                'is_completed': is_completed,
                'date_str': date_str,
            })
    def _event_sort_key(x):
        fd = x['fixture_date']
        return (fd if fd else datetime.max.replace(tzinfo=timezone.utc), x['external_id'] or '')
    collected.sort(key=_event_sort_key)
    max_rounds = ESPN_MAX_ROUNDS.get(league_slug) if league_slug else None
    if matches_per_round is not None and max_rounds is not None:
        max_events = max_rounds * matches_per_round
        collected = collected[:max_events]
    fixtures_seen = len(collected)
    if matches_per_round is not None:
        for i, item in enumerate(collected):
            item['fixture_round'] = (i // matches_per_round) + 1
    else:
        if league_slug == 'fifa.world':
            # One Day per calendar day (Pacific): Day 1 = first date, Day 2 = second, etc.
            pacific_dates = []
            for item in collected:
                fd = item.get('fixture_date')
                if fd and hasattr(fd, 'astimezone'):
                    local_d = fd.astimezone(WORLD_CUP_DAY_TZ)
                    d = local_d.date() if hasattr(local_d, 'date') else date(local_d.year, local_d.month, local_d.day)
                    pacific_dates.append(d)
                elif fd and hasattr(fd, 'date'):
                    pacific_dates.append(fd.date())
            unique_dates = sorted(set(pacific_dates))
            date_to_round = {d: (i + 1) for i, d in enumerate(unique_dates)}
            for item in collected:
                fd = item.get('fixture_date')
                if fd and hasattr(fd, 'astimezone'):
                    local_d = fd.astimezone(WORLD_CUP_DAY_TZ)
                    d = local_d.date() if hasattr(local_d, 'date') else date(local_d.year, local_d.month, local_d.day)
                    item['fixture_round'] = date_to_round.get(d, len(unique_dates) + 1)
                elif fd and hasattr(fd, 'date'):
                    item['fixture_round'] = date_to_round.get(fd.date(), len(unique_dates) + 1)
                else:
                    item['fixture_round'] = calendar_entries_by_date.get(item['date_str']) or (len(collected) + 1)
        else:
            for i, item in enumerate(collected):
                item['fixture_round'] = calendar_entries_by_date.get(item['date_str'])
                if item['fixture_round'] is None:
                    item['fixture_round'] = i + 1
    fixtures_added = 0
    fixtures_updated = 0
    for item in collected:
        external_id = item['external_id']
        fixture_round = item['fixture_round']
        existing = Fixture.query.filter_by(competition_slug=competition_slug, external_id=external_id).first() if external_id else None
        if not existing:
            existing = Fixture.query.filter(
                Fixture.competition_slug == competition_slug,
                Fixture.fixture_home_team == item['home_team'],
                Fixture.fixture_away_team == item['away_team'],
                Fixture.fixture_date == item['fixture_date']
            ).first() if item['fixture_date'] else None
        # Match by normalized names so "Iran v New Zealand" and "Iran v new zealand" / "Mexico v South Korea" dupes merge
        if not existing:
            norm_home = _normalize_team_name_for_match(item['home_team'])
            norm_away = _normalize_team_name_for_match(item['away_team'])
            if norm_home and norm_away:
                if fixture_round is not None:
                    candidates = Fixture.query.filter(
                        Fixture.competition_slug == competition_slug,
                        Fixture.fixture_round == fixture_round,
                    ).all()
                elif item.get('fixture_date'):
                    day_start = item['fixture_date'].replace(hour=0, minute=0, second=0, microsecond=0) if hasattr(item['fixture_date'], 'replace') else item['fixture_date']
                    day_end = day_start + timedelta(days=1) if hasattr(day_start, '__add__') else day_start
                    candidates = Fixture.query.filter(
                        Fixture.competition_slug == competition_slug,
                        Fixture.fixture_date >= day_start,
                        Fixture.fixture_date < day_end,
                    ).all()
                else:
                    candidates = []
                for c in candidates:
                    if (_normalize_team_name_for_match(c.fixture_home_team) == norm_home and
                            _normalize_team_name_for_match(c.fixture_away_team) == norm_away):
                        existing = c
                        break
        if existing:
            existing.fixture_round = fixture_round
            if item['fixture_date']:
                existing.fixture_date = item['fixture_date']
            existing.actual_home_score = item['home_score']
            existing.actual_away_score = item['away_score']
            existing.is_completed = item['is_completed']
            if external_id:
                existing.external_id = external_id
            fixtures_updated += 1
        else:
            new_f = Fixture(
                competition_slug=competition_slug,
                external_id=external_id or None,
                fixture_round=fixture_round,
                fixture_date=item['fixture_date'],
                fixture_home_team=item['home_team'],
                fixture_away_team=item['away_team'],
                actual_home_score=item['home_score'],
                actual_away_score=item['away_score'],
                is_completed=item['is_completed'],
            )
            db.session.add(new_f)
            fixtures_added += 1
    return fixtures_added, fixtures_updated, fixtures_seen, None


# football-data.org provides official matchday numbers (e.g. Bundesliga). Requires FOOTBALL_DATA_ORG_API_KEY (free at https://www.football-data.org/).
FOOTBALL_DATA_ORG_BASE = 'https://api.football-data.org/v4'


def _sync_fixtures_football_data(competition_code, competition_slug):
    """Fetch fixtures from football-data.org for a competition (e.g. BL1 = Bundesliga). Returns (added, updated, seen, error)."""
    api_key = (os.getenv('FOOTBALL_DATA_ORG_API_KEY') or '').strip()
    if not api_key:
        return 0, 0, 0, 'FOOTBALL_DATA_ORG_API_KEY is not set. Get a free key at https://www.football-data.org/'
    url = f'{FOOTBALL_DATA_ORG_BASE}/competitions/{competition_code}/matches'
    headers = {'X-Auth-Token': api_key, 'User-Agent': 'FantasyPredictor/1.0'}
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return 0, 0, 0, str(e)
    matches = data.get('matches') if isinstance(data, dict) else []
    if not isinstance(matches, list):
        return 0, 0, 0, 'Unexpected API response: no matches list'
    fixtures_added = 0
    fixtures_updated = 0
    for m in matches:
        if not isinstance(m, dict):
            continue
        external_id = str(m.get('id') or '')
        matchday = m.get('matchday')
        if matchday is not None:
            try:
                fixture_round = int(matchday)
            except (TypeError, ValueError):
                fixture_round = None
        else:
            fixture_round = None
        utc_date_str = m.get('utcDate')
        fixture_date = None
        if utc_date_str:
            try:
                fixture_date = datetime.fromisoformat(utc_date_str.replace('Z', '+00:00'))
                if fixture_date.tzinfo is None:
                    fixture_date = fixture_date.replace(tzinfo=timezone.utc)
            except Exception:
                pass
        home_team = None
        away_team = None
        if isinstance(m.get('homeTeam'), dict):
            home_team = m['homeTeam'].get('name') or m['homeTeam'].get('shortName')
        if isinstance(m.get('awayTeam'), dict):
            away_team = m['awayTeam'].get('name') or m['awayTeam'].get('shortName')
        if not home_team or not away_team:
            continue
        score = m.get('score') or {}
        full_time = score.get('fullTime') if isinstance(score, dict) else None
        home_score = away_score = None
        if isinstance(full_time, dict):
            home_score = full_time.get('homeTeam') or full_time.get('home')
            away_score = full_time.get('awayTeam') or full_time.get('away')
            if home_score is not None:
                try:
                    home_score = int(home_score)
                except (TypeError, ValueError):
                    home_score = None
            if away_score is not None:
                try:
                    away_score = int(away_score)
                except (TypeError, ValueError):
                    away_score = None
        if home_score is None and away_score is None and isinstance(score.get('regularTime'), dict):
            rt = score['regularTime']
            home_score = rt.get('homeTeam') or rt.get('home')
            away_score = rt.get('awayTeam') or rt.get('away')
            if home_score is not None:
                try:
                    home_score = int(home_score)
                except (TypeError, ValueError):
                    home_score = None
            if away_score is not None:
                try:
                    away_score = int(away_score)
                except (TypeError, ValueError):
                    away_score = None
        status = (m.get('status') or '').upper()
        is_completed = status == 'FINISHED'
        existing = Fixture.query.filter_by(competition_slug=competition_slug, external_id=external_id).first() if external_id else None
        if not existing:
            existing = Fixture.query.filter(
                Fixture.competition_slug == competition_slug,
                Fixture.fixture_home_team == home_team,
                Fixture.fixture_away_team == away_team,
                Fixture.fixture_round == fixture_round,
            ).first()
        # Match by normalized names so "FC Bayern München" vs "Bayern Munich" dedupe
        if not existing and fixture_round is not None:
            norm_home = _normalize_team_name_for_match(home_team)
            norm_away = _normalize_team_name_for_match(away_team)
            if norm_home and norm_away:
                candidates = Fixture.query.filter(
                    Fixture.competition_slug == competition_slug,
                    Fixture.fixture_round == fixture_round,
                ).all()
                for c in candidates:
                    if (_normalize_team_name_for_match(c.fixture_home_team) == norm_home and
                            _normalize_team_name_for_match(c.fixture_away_team) == norm_away):
                        existing = c
                        break
                # Legacy Pulselive fixtures may have competition_slug NULL or ''; match so we update instead of duplicating
                if not existing and competition_slug == 'eng.1':
                    legacy = Fixture.query.filter(
                        or_(Fixture.competition_slug.is_(None), Fixture.competition_slug == ''),
                        Fixture.fixture_round == fixture_round,
                    ).all()
                    for c in legacy:
                        if (_normalize_team_name_for_match(c.fixture_home_team) == norm_home and
                                _normalize_team_name_for_match(c.fixture_away_team) == norm_away):
                            existing = c
                            break
        if existing:
            existing.fixture_round = fixture_round
            if fixture_date:
                existing.fixture_date = fixture_date
            existing.actual_home_score = home_score
            existing.actual_away_score = away_score
            existing.is_completed = is_completed
            if external_id:
                existing.external_id = external_id
            existing.competition_slug = competition_slug
            fixtures_updated += 1
        else:
            new_f = Fixture(
                competition_slug=competition_slug,
                external_id=external_id or None,
                fixture_round=fixture_round,
                fixture_date=fixture_date,
                fixture_home_team=home_team,
                fixture_away_team=away_team,
                actual_home_score=home_score,
                actual_away_score=away_score,
                is_completed=is_completed,
            )
            db.session.add(new_f)
            fixtures_added += 1
    return fixtures_added, fixtures_updated, len(matches), None


@app.route('/api/v1/fixtures/sync', methods=['POST'])
def sync_fixtures():
    """
    Fetch fixtures from external API and store them in the database.
    Body: 'api_url' (Premier League), or source='espn' + league_slug (e.g. esp.1, fifa.world).
    """
    try:
        if not REQUESTS_AVAILABLE:
            return make_response({
                'error': 'Requests module is not available. Please run the server with pipenv: pipenv run python app.py'
            }, 500)
        
        data = request.get_json() or {}
        api_url = data.get('api_url') or os.getenv('EXTERNAL_FIXTURES_API_URL')
        source = (data.get('source') or '').strip().lower()
        league_slug = (data.get('league_slug') or data.get('competition') or '').strip()
        
        if source == 'espn' and league_slug:
            comp = next((c for c in SUPPORTED_COMPETITIONS if c.get('espn_slug') == league_slug or c.get('slug') == league_slug), None)
            if not comp:
                return make_response({'error': f'Unknown ESPN league: {league_slug}. Use one of esp.1, fra.1, ger.1, usa.1, fifa.world'}, 400)
            try:
                added, updated, seen, err = _sync_fixtures_espn(league_slug)
                if err:
                    return make_response({'error': err}, 500)
                db.session.commit()
                return make_response({
                    'message': 'Fixtures synced successfully (ESPN)',
                    'source': 'espn',
                    'league_slug': league_slug,
                    'added': added,
                    'updated': updated,
                    'fixtures_seen': seen,
                    'total_written': added + updated,
                }, 200)
            except Exception as e:
                db.session.rollback()
                import traceback
                return make_response({'error': str(e), 'details': traceback.format_exc().split('\n')[-3:]}, 500)
        
        if source == 'football_data' or (league_slug and next((c for c in SUPPORTED_COMPETITIONS if c.get('slug') == league_slug and c.get('source') == 'football_data'), None)):
            comp_slug = league_slug or (data.get('competition') or '').strip()
            comp = next((c for c in SUPPORTED_COMPETITIONS if c.get('slug') == comp_slug and c.get('source') == 'football_data'), None)
            if not comp:
                return make_response({'error': 'Set FOOTBALL_DATA_ORG_API_KEY and use competition=slug (e.g. eng.1, ger.1, eng.2).'}, 400)
            code = comp.get('football_data_code') or 'BL1'
            try:
                added, updated, seen, err = _sync_fixtures_football_data(code, comp_slug)
                if err:
                    return make_response({'error': err}, 500)
                db.session.commit()
                return make_response({
                    'message': 'Fixtures synced successfully (football-data.org)',
                    'source': 'football_data',
                    'competition': comp_slug,
                    'added': added,
                    'updated': updated,
                    'fixtures_seen': seen,
                    'total_written': added + updated,
                }, 200)
            except Exception as e:
                db.session.rollback()
                import traceback
                return make_response({'error': str(e), 'details': traceback.format_exc().split('\n')[-3:]}, 500)
        
        if not api_url:
            return make_response({'error': 'API URL is required. Provide api_url in request body or set EXTERNAL_FIXTURES_API_URL environment variable.'}, 400)
        
        # Fetch fixtures from external API
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        # Force a higher limit so we aren't stuck with the first 100 matches
        # (which often only covers early-season fixtures). We keep the user's
        # URL/filters, but override `_limit` to 400.
        effective_api_url = api_url
        try:
            parsed = urlparse(api_url)
            if (
                parsed.netloc.endswith("premier-league-prod.pulselive.com")
                and parsed.path.endswith("/api/v2/matches")
            ):
                qs = parse_qs(parsed.query)
                # Revert to "bulk sync" behavior: remove any date-window params if present
                # and simply increase the limit.
                qs.pop("startDate", None)
                qs.pop("endDate", None)
                qs.pop("fromDate", None)
                qs.pop("toDate", None)
                qs["_limit"] = ["400"]

                effective_api_url = urlunparse(
                    parsed._replace(query=urlencode(qs, doseq=True))
                )
        except Exception as e:
            print(f"WARNING: could not rewrite api_url for _limit override: {e}")

        # Fetch ALL matches using cursor pagination.
        # This API returns:
        #   { "pagination": { "_limit": 100, "_prev": null, "_next": "TOKEN" }, "data": [...] }
        # The next page is requested by adding `&_next=TOKEN`.

        # Normalize URL: ensure we don't carry a stale `_next` token from earlier runs.
        parsed_eff = urlparse(effective_api_url)
        qs_eff = parse_qs(parsed_eff.query)
        qs_eff.pop("_next", None)
        base_effective_api_url = urlunparse(parsed_eff._replace(query=urlencode(qs_eff, doseq=True)))

        all_items = []
        pages_fetched = 0
        next_token = None
        max_pages = 100  # safety; season is ~380 matches

        while True:
            if pages_fetched == 0:
                page_url = base_effective_api_url
            else:
                # add `_next` token for subsequent pages
                parsed_page = urlparse(base_effective_api_url)
                qs_page = parse_qs(parsed_page.query)
                qs_page["_next"] = [next_token]
                page_url = urlunparse(parsed_page._replace(query=urlencode(qs_page, doseq=True)))

            resp = requests.get(page_url, headers=headers, timeout=30)
            resp.raise_for_status()
            external_data = resp.json()

            if not isinstance(external_data, dict):
                return make_response({'error': 'Unexpected API response type', 'type': str(type(external_data))}, 500)

            page_items = []
            if "data" in external_data and isinstance(external_data["data"], list):
                page_items = external_data["data"]
            elif "content" in external_data and isinstance(external_data["content"], list):
                page_items = external_data["content"]
            elif "matches" in external_data and isinstance(external_data["matches"], list):
                page_items = external_data["matches"]

            all_items.extend(page_items)
            pages_fetched += 1

            pagination = external_data.get("pagination") if isinstance(external_data.get("pagination"), dict) else {}
            next_token = pagination.get("_next")

            if not next_token:
                break
            if pages_fetched >= max_pages:
                print("WARNING: pagination max_pages reached; stopping early")
                break

        external_data = {"data": all_items, "pagination": {"pages_fetched": pages_fetched}}
        
        # Parse and store fixtures (bulk sync)
        # Premier League API typically returns data in 'content' array
        fixtures_added = 0
        fixtures_updated = 0
        fixtures_seen = 0
        fixtures_with_parsed_date = 0
        parsed_min_date_utc = None
        parsed_max_date_utc = None
        
        # Handle Premier League API response structure
        fixtures_data = external_data.get('data', [])
        
        if not fixtures_data:
            return make_response({'error': 'No fixtures found in API response', 'response_structure': str(external_data.keys() if isinstance(external_data, dict) else 'list')}, 400)
        
        # Debug: print first fixture structure to understand API response format
        if fixtures_data and len(fixtures_data) > 0:
            sample = fixtures_data[0]
            print("=" * 80)
            print("DEBUG: Sample fixture structure from Premier League API:")
            print(f"Sample fixture keys: {list(sample.keys()) if isinstance(sample, dict) else 'not a dict'}")
            if isinstance(sample, dict):
                if 'round' in sample:
                    print(f"Round structure: {sample['round']}, type: {type(sample['round'])}")
                    if isinstance(sample['round'], dict):
                        print(f"Round dict keys: {list(sample['round'].keys())}")
                        print(f"Round dict values: {sample['round']}")
                # Print full sample to see structure
                import json
                print(f"Full sample fixture (first 1000 chars):")
                print(json.dumps(sample, indent=2, default=str)[:1000])
            print("=" * 80)
        
        for fixture_data in fixtures_data:
            fixtures_seen += 1
            # Map Premier League API fields to your Fixture model
            # Premier League API structure: round, homeTeam.name, awayTeam.name, kickoff.label
            fixture_round = None
            
            # Try various ways to get the round number from Premier League API
            # The API typically has round information in nested structures
            
            # First try: round.roundNumber (most common Premier League API structure)
            if 'round' in fixture_data:
                round_data = fixture_data['round']
                if isinstance(round_data, dict):
                    # Premier League API often uses 'roundNumber' or 'number' inside round object
                    fixture_round = (round_data.get('roundNumber') or 
                                    round_data.get('number') or 
                                    round_data.get('id') or
                                    round_data.get('matchday') or
                                    round_data.get('value'))
                elif isinstance(round_data, (int, str)):
                    fixture_round = round_data
            # Second try: direct roundNumber field
            elif 'roundNumber' in fixture_data:
                fixture_round = fixture_data['roundNumber']
            # Third try: matchday (common in some APIs)
            elif 'matchday' in fixture_data:
                fixture_round = fixture_data['matchday']
            # Fourth try: gameweek
            elif 'gameweek' in fixture_data:
                fixture_round = fixture_data['gameweek']
            # Fifth try: matchWeek (Premier League API)
            elif 'matchWeek' in fixture_data:
                fixture_round = fixture_data['matchWeek']
            
            # Fifth try: nested match.round structure
            if not fixture_round and 'match' in fixture_data:
                match_data = fixture_data['match']
                if isinstance(match_data, dict):
                    if 'round' in match_data:
                        round_data = match_data['round']
                        if isinstance(round_data, dict):
                            fixture_round = (round_data.get('roundNumber') or 
                                            round_data.get('number') or 
                                            round_data.get('id'))
                        else:
                            fixture_round = round_data
                    # Also check for roundNumber directly in match
                    elif 'roundNumber' in match_data:
                        fixture_round = match_data['roundNumber']
            
            # Sixth try: various other possible field names
            if not fixture_round:
                for key in ['matchWeek', 'matchweek', 'match_week', 'gameWeek', 'gameweek', 'week', 'weekNumber', 'round_id', 'roundId', 'matchRound', 'matchround', 'matchDay', 'match_day']:
                    if key in fixture_data:
                        try:
                            value = fixture_data[key]
                            if isinstance(value, dict):
                                value = value.get('roundNumber') or value.get('number') or value.get('id')
                            fixture_round = int(value) if value is not None else None
                            if fixture_round:
                                break
                        except (ValueError, TypeError):
                            pass
            
            # Seventh try: Look for round in competition or season data if nested
            if not fixture_round:
                for nested_key in ['competition', 'season', 'stage']:
                    if nested_key in fixture_data and isinstance(fixture_data[nested_key], dict):
                        nested_data = fixture_data[nested_key]
                        if 'round' in nested_data:
                            round_data = nested_data['round']
                            if isinstance(round_data, dict):
                                fixture_round = (round_data.get('roundNumber') or 
                                                round_data.get('number') or 
                                                round_data.get('id'))
                            else:
                                fixture_round = round_data
                            if fixture_round:
                                break
            
            # Eighth try: Look in status or metadata fields
            if not fixture_round:
                for meta_key in ['status', 'metadata', 'info', 'details']:
                    if meta_key in fixture_data and isinstance(fixture_data[meta_key], dict):
                        meta_data = fixture_data[meta_key]
                        if 'round' in meta_data:
                            round_val = meta_data['round']
                            if isinstance(round_val, dict):
                                fixture_round = round_val.get('roundNumber') or round_val.get('number') or round_val.get('id')
                            else:
                                fixture_round = round_val
                            if fixture_round:
                                break
            
            # Ninth try: If still no round, check if round info is in homeTeam or awayTeam metadata
            if not fixture_round:
                for team_key in ['homeTeam', 'awayTeam']:
                    if team_key in fixture_data and isinstance(fixture_data[team_key], dict):
                        team_data = fixture_data[team_key]
                        # Sometimes round info is attached to team data
                        if 'round' in team_data or 'matchRound' in team_data:
                            round_val = team_data.get('round') or team_data.get('matchRound')
                            if isinstance(round_val, dict):
                                fixture_round = round_val.get('roundNumber') or round_val.get('number') or round_val.get('id')
                            else:
                                fixture_round = round_val
                            if fixture_round:
                                break
            
            # Debug: If still no round found, log the fixture structure (only for first few)
            if not fixture_round:
                # Only print detailed warning for first 3 fixtures to avoid spam
                if fixtures_data.index(fixture_data) < 3:
                    print(f"WARNING: Could not extract round for fixture {fixtures_data.index(fixture_data) + 1}")
                    print(f"  Available top-level keys: {list(fixture_data.keys())[:15]}")
                    # Print round-related keys if they exist with different casing
                    round_keys = [k for k in fixture_data.keys() if 'round' in k.lower() or 'week' in k.lower() or 'matchday' in k.lower()]
                    if round_keys:
                        print(f"  Round-related keys found: {round_keys}")
                        for rk in round_keys[:3]:  # Check first 3 round-related keys
                            print(f"    {rk}: {fixture_data[rk]}")
            
            # Parse date/time
            fixture_date_str = None
            if 'kickoff' in fixture_data:
                kickoff = fixture_data['kickoff']
                if isinstance(kickoff, dict):
                    # Prefer millis (reliable), fall back to label (often human-readable)
                    fixture_date_str = kickoff.get('millis') or kickoff.get('label')
                else:
                    fixture_date_str = kickoff
            elif 'date' in fixture_data:
                fixture_date_str = fixture_data['date']
            elif 'utcDate' in fixture_data:
                fixture_date_str = fixture_data['utcDate']
            
            # Parse team names
            home_team = None
            away_team = None
            
            if 'homeTeam' in fixture_data:
                home_team_data = fixture_data['homeTeam']
                if isinstance(home_team_data, dict):
                    home_team = home_team_data.get('name') or home_team_data.get('shortName')
                else:
                    home_team = str(home_team_data)
            
            if 'awayTeam' in fixture_data:
                away_team_data = fixture_data['awayTeam']
                if isinstance(away_team_data, dict):
                    away_team = away_team_data.get('name') or away_team_data.get('shortName')
                else:
                    away_team = str(away_team_data)
            
            # Skip only if essential team data is missing
            if not home_team or not away_team:
                print(f"Skipping fixture due to missing team data: round={fixture_round}, home={home_team}, away={away_team}")
                continue
            
            # Try to extract round from additional fields if still missing
            if not fixture_round:
                # Try extracting from roundId or similar fields
                if 'roundId' in fixture_data:
                    try:
                        fixture_round = int(fixture_data['roundId'])
                    except:
                        pass
            
            # Convert fixture_round to integer if it exists, otherwise leave as None (field is nullable)
            if fixture_round is not None:
                try:
                    fixture_round = int(fixture_round)
                except (ValueError, TypeError):
                    print(f"Warning: Could not convert round to integer: {fixture_round}. Saving without round.")
                    fixture_round = None
            else:
                print(f"Info: No round found for fixture: home={home_team}, away={away_team}. Saving without round.")
            
            # Parse date if it's a string
            fixture_date = None
            if fixture_date_str:
                try:
                    # Handle millisecond timestamp
                    if isinstance(fixture_date_str, (int, float)):
                        fixture_date = datetime.fromtimestamp(fixture_date_str / 1000, tz=timezone.utc)
                    elif isinstance(fixture_date_str, str) and fixture_date_str.isdigit():
                        fixture_date = datetime.fromtimestamp(int(fixture_date_str) / 1000, tz=timezone.utc)
                    elif isinstance(fixture_date_str, str):
                        # Try parsing ISO format
                        if 'T' in fixture_date_str:
                            fixture_date_str = fixture_date_str.replace('Z', '+00:00')
                            fixture_date = datetime.fromisoformat(fixture_date_str)
                        else:
                            # Try common date formats
                            for fmt in [
                                '%Y-%m-%d %H:%M:%S',
                                '%Y-%m-%d',
                                '%d/%m/%Y %H:%M',
                                '%a %d %b %Y %H:%M',   # e.g. "Sat 16 Aug 2025 12:30"
                                '%a %d %b %Y %H:%M %Z' # if timezone included
                            ]:
                                try:
                                    fixture_date = datetime.strptime(fixture_date_str, fmt)
                                    break
                                except:
                                    continue
                except Exception as e:
                    print(f"Could not parse date: {fixture_date_str}, error: {str(e)}")

            if fixture_date:
                fixtures_with_parsed_date += 1

                # Track overall parsed date range (UTC)
                if parsed_min_date_utc is None or fixture_date < parsed_min_date_utc:
                    parsed_min_date_utc = fixture_date
                if parsed_max_date_utc is None or fixture_date > parsed_max_date_utc:
                    parsed_max_date_utc = fixture_date

                # Normalize naive datetimes to UTC for storage consistency
                if fixture_date.tzinfo is None:
                    fixture_date = fixture_date.replace(tzinfo=timezone.utc)
            
            # Check if fixture already exists (by teams and round, or teams and date if round is None)
            if fixture_round is not None:
                existing_fixture = Fixture.query.filter_by(
                    fixture_round=fixture_round,
                    fixture_home_team=home_team,
                    fixture_away_team=away_team
                ).first()
            else:
                # If no round, check by teams and date if available
                if fixture_date:
                    existing_fixture = Fixture.query.filter_by(
                        fixture_home_team=home_team,
                        fixture_away_team=away_team,
                        fixture_date=fixture_date
                    ).first()
                else:
                    # Last resort: just check by teams
                    existing_fixture = Fixture.query.filter_by(
                        fixture_home_team=home_team,
                        fixture_away_team=away_team
                    ).first()
            
            if existing_fixture:
                # Update existing fixture
                existing_fixture.competition_slug = 'eng.1'
                if fixture_round is not None and existing_fixture.fixture_round != fixture_round:
                    existing_fixture.fixture_round = fixture_round
                if fixture_date:
                    existing_fixture.fixture_date = fixture_date
                fixtures_updated += 1
            else:
                # Create new fixture
                new_fixture = Fixture(
                    competition_slug='eng.1',
                    fixture_round=fixture_round,
                    fixture_date=fixture_date,
                    fixture_home_team=home_team,
                    fixture_away_team=away_team
                )
                db.session.add(new_fixture)
                fixtures_added += 1
        
        db.session.commit()
        
        return make_response({
            'message': 'Fixtures synced successfully',
            'api_url_used': effective_api_url,
            'added': fixtures_added,
            'updated': fixtures_updated,
            'fixtures_seen': fixtures_seen,
            'fixtures_with_parsed_date': fixtures_with_parsed_date,
            'parsed_min_date_utc': parsed_min_date_utc.isoformat() if parsed_min_date_utc else None,
            'parsed_max_date_utc': parsed_max_date_utc.isoformat() if parsed_max_date_utc else None,
            'pages_fetched': external_data.get('pagination', {}).get('pages_fetched'),
            'total_written': fixtures_added + fixtures_updated
        }, 200)
        
    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error syncing fixtures: {str(e)}")
        print(f"Traceback: {error_details}")
        
        # Check if it's a requests-related error
        if REQUESTS_AVAILABLE and hasattr(requests, 'exceptions') and isinstance(e, requests.exceptions.RequestException):
            error_msg = f'Failed to fetch from external API: {str(e)}'
            return make_response({'error': error_msg, 'type': 'RequestException'}, 500)
        
        # Return JSON error response
        return make_response({'error': str(e), 'type': type(e).__name__, 'details': error_details.split('\n')[-5:]}, 500)

def _fixture_for_game(game, competition_slug=None, fixtures_list=None):
    """Find the fixture matching a game's home/away teams. If competition_slug is given (e.g. from
    league context), prefer the fixture in that competition so Championship/Bundesliga etc.
    fixtures are resolved correctly. Uses normalized name matching (e.g. FC Bayern München vs
    Bayern Munich) for leagues like Bundesliga.
    Pass fixtures_list (e.g. Fixture.query.filter(...).all()) to avoid repeated DB scans when
    resolving many games in a loop."""
    # If we have a pre-loaded list, use it for all fallbacks (no DB hits in loop).
    if fixtures_list is not None:
        for f in fixtures_list:
            if not _fixture_matches_game(f, game.home_team, game.away_team):
                continue
            if competition_slug:
                if competition_slug == 'eng.1' and (f.competition_slug not in ('eng.1', None, '')):
                    continue
                if competition_slug != 'eng.1' and f.competition_slug != competition_slug:
                    continue
            return f
        for f in fixtures_list:
            if _fixture_matches_game(f, game.home_team, game.away_team):
                return f
        return None
    base = Fixture.query.filter_by(
        fixture_home_team=game.home_team,
        fixture_away_team=game.away_team
    )
    if competition_slug:
        if competition_slug == 'eng.1':
            base = base.filter(or_(
                Fixture.competition_slug == 'eng.1',
                Fixture.competition_slug.is_(None),
                Fixture.competition_slug == '',
            ))
        else:
            base = base.filter(Fixture.competition_slug == competition_slug)
    fixture = base.first()
    if not fixture and competition_slug:
        # Fallback: same teams without competition filter (e.g. only one such fixture exists)
        fixture = Fixture.query.filter_by(
            fixture_home_team=game.home_team,
            fixture_away_team=game.away_team
        ).first()
    if not fixture:
        # Case-insensitive exact match
        all_fixtures = Fixture.query.all()
        for f in all_fixtures:
            if (f.fixture_home_team and f.fixture_away_team and
                f.fixture_home_team.lower().strip() == (game.home_team or '').lower().strip() and
                f.fixture_away_team.lower().strip() == (game.away_team or '').lower().strip()):
                if not competition_slug or (competition_slug == 'eng.1' and (f.competition_slug in ('eng.1', None, ''))) or f.competition_slug == competition_slug:
                    return f
        for f in all_fixtures:
            if (f.fixture_home_team and f.fixture_away_team and
                f.fixture_home_team.lower().strip() == (game.home_team or '').lower().strip() and
                f.fixture_away_team.lower().strip() == (game.away_team or '').lower().strip()):
                return f
    if not fixture:
        # Normalized match (umlauts, FC prefix, etc.) so Bundesliga "FC Bayern München" matches "Bayern Munich"
        norm_home = _normalize_team_name_for_match(game.home_team or '')
        norm_away = _normalize_team_name_for_match(game.away_team or '')
        if norm_home and norm_away:
            all_fixtures_list = Fixture.query.all()
            if competition_slug:
                if competition_slug == 'eng.1':
                    candidates = [f for f in all_fixtures_list if f.competition_slug in ('eng.1', None, '')]
                else:
                    candidates = [f for f in all_fixtures_list if f.competition_slug == competition_slug]
            else:
                candidates = all_fixtures_list
            for f in candidates:
                if (f.fixture_home_team and f.fixture_away_team and
                    _normalize_team_name_for_match(f.fixture_home_team) == norm_home and
                    _normalize_team_name_for_match(f.fixture_away_team) == norm_away):
                    return f
            for f in all_fixtures_list:
                if (f.fixture_home_team and f.fixture_away_team and
                    _normalize_team_name_for_match(f.fixture_home_team) == norm_home and
                    _normalize_team_name_for_match(f.fixture_away_team) == norm_away):
                    return f
    return fixture


class PredictionsResource(Resource):
    def get(self):
        """Get all predictions for the current user with their results.
        Optional query: ?league_id= to resolve fixtures in that league's competition (fixes
        Championship etc. so completed predictions show for the correct competition)."""
        try:
            user_id = get_current_user_id()
            
            if not user_id:
                return make_response({'error': 'User not authenticated'}, 401)
            
            competition_slug = None
            league_id = request.args.get('league_id', type=int)
            if league_id:
                league = League.query.get(league_id)
                if league and getattr(league, 'competition_slug', None):
                    competition_slug = league.competition_slug
            
            # Get all user's predictions, sorted by date (oldest first)
            user_games = Game.query.filter_by(user_id=user_id).order_by(Game.game_week.asc()).all()
            
            # Preload fixtures once to avoid N+1: each _fixture_for_game would otherwise do Fixture.query.all()
            comp_filter = _fixture_query_competition(competition_slug) if competition_slug else None
            all_fixtures = Fixture.query.filter(comp_filter).all() if comp_filter is not None else Fixture.query.all()
            
            predictions = []
            fixtures_found = 0
            fixtures_completed = 0
            
            for game in user_games:
                fixture = _fixture_for_game(game, competition_slug, fixtures_list=all_fixtures)
                
                prediction_data = game.to_dict()
                
                # Add fixture and actual score info
                if fixture:
                    fixtures_found += 1
                    if fixture.is_completed:
                        fixtures_completed += 1
                    # For World Cup, round = Day 1/2/3 (calendar day index from sync)
                    display_round = fixture.fixture_round
                    prediction_data['fixture'] = {
                        'id': fixture.id,
                        'round': display_round,
                        'competition_slug': getattr(fixture, 'competition_slug', None),
                        'date': fixture.fixture_date.isoformat() if fixture.fixture_date else None,
                        'is_completed': fixture.is_completed,
                        'actual_home_score': fixture.actual_home_score,
                        'actual_away_score': fixture.actual_away_score
                    }
                    # When fixture has both scores, ensure game_result is set (for Results table and display)
                    if (fixture.actual_home_score is not None and fixture.actual_away_score is not None and
                            game.home_team_score is not None and game.away_team_score is not None):
                        if not game.game_result:
                            pred_home = game.home_team_score
                            pred_away = game.away_team_score
                            actual_home = fixture.actual_home_score
                            actual_away = fixture.actual_away_score
                            if pred_home == actual_home and pred_away == actual_away:
                                game.game_result = 'Win'
                            else:
                                pred_winner = 'home' if pred_home > pred_away else ('away' if pred_away > pred_home else 'draw')
                                actual_winner = 'home' if actual_home > actual_away else ('away' if actual_away > actual_home else 'draw')
                                game.game_result = 'Draw' if pred_winner == actual_winner else 'Loss'
                            db.session.add(game)
                            prediction_data['game_result'] = game.game_result
                        else:
                            prediction_data['game_result'] = game.game_result
                else:
                    prediction_data['fixture'] = None
                    # Debug: print first few unmatched
                    if len(predictions) < 3:
                        print(f"DEBUG GET predictions: No fixture found for prediction: {game.home_team} vs {game.away_team}")
                
                predictions.append(prediction_data)
            
            db.session.commit()
            
            print(f"DEBUG GET predictions: Total predictions: {len(predictions)}, Fixtures found: {fixtures_found}, Completed: {fixtures_completed}")
            
            return make_response({
                'predictions': predictions,
                'debug': {
                    'total_predictions': len(predictions),
                    'fixtures_found': fixtures_found,
                    'fixtures_completed': fixtures_completed
                }
            }, 200)
            
        except Exception as e:
            print(f"Error fetching predictions: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return make_response({'error': str(e)}, 500)
    
    def post(self):
        """Create or update a user's prediction for a fixture"""
        try:
            data = request.get_json()
            user_id = get_current_user_id()
            
            if not user_id:
                return make_response({'error': 'User not authenticated'}, 401)
            
            # Required fields: fixture_id, home_team_score, away_team_score
            fixture_id = data.get('fixture_id')
            home_team_score = data.get('home_team_score')
            away_team_score = data.get('away_team_score')
            
            if not fixture_id or home_team_score is None or away_team_score is None:
                return make_response({'error': 'Missing required fields: fixture_id, home_team_score, away_team_score'}, 400)
            
            # Get the fixture
            fixture = Fixture.query.get(fixture_id)
            if not fixture:
                return make_response({'error': 'Fixture not found'}, 404)
            
            # Lock predictions after kickoff: do not allow create or update once the game has started
            if fixture.fixture_date:
                now_utc = datetime.now(timezone.utc)
                kickoff = fixture.fixture_date
                if getattr(kickoff, 'tzinfo', None) is None:
                    kickoff = kickoff.replace(tzinfo=timezone.utc)
                if now_utc >= kickoff:
                    return make_response({'error': 'Cannot create or update prediction after kickoff'}, 403)
            
            # Check if user already has a prediction for this fixture
            existing_game = Game.query.filter_by(
                user_id=user_id,
                home_team=fixture.fixture_home_team,
                away_team=fixture.fixture_away_team
            ).first()
            
            if existing_game:
                # Update existing prediction
                existing_game.home_team_score = int(home_team_score)
                existing_game.away_team_score = int(away_team_score)
                existing_game.game_week_name = f"Week {fixture.fixture_round}" if fixture.fixture_round else "Unknown Week"
                game = existing_game
            else:
                # Create new game/prediction
                game = Game(
                    user_id=user_id,
                    home_team=fixture.fixture_home_team,
                    away_team=fixture.fixture_away_team,
                    home_team_score=int(home_team_score),
                    away_team_score=int(away_team_score),
                    game_week_name=f"Week {fixture.fixture_round}" if fixture.fixture_round else "Unknown Week",
                    game_week=fixture.fixture_date
                )
                db.session.add(game)
            
            db.session.commit()
            
            # After saving, check if fixture is completed and update result
            if fixture.is_completed and fixture.actual_home_score is not None and fixture.actual_away_score is not None:
                # Determine result immediately
                pred_home = game.home_team_score
                pred_away = game.away_team_score
                actual_home = fixture.actual_home_score
                actual_away = fixture.actual_away_score
                
                if pred_home == actual_home and pred_away == actual_away:
                    game.game_result = 'Win'
                else:
                    pred_winner = 'home' if pred_home > pred_away else ('away' if pred_away > pred_home else 'draw')
                    actual_winner = 'home' if actual_home > actual_away else ('away' if actual_away > actual_home else 'draw')
                    game.game_result = 'Draw' if pred_winner == actual_winner else 'Loss'
                
                db.session.commit()
            
            # Create or update prediction record linking user to game
            prediction = Prediction.query.filter_by(
                user_id=user_id,
                game_id=game.id
            ).first()
            
            if not prediction:
                prediction = Prediction(user_id=user_id, game_id=game.id)
                db.session.add(prediction)
                db.session.commit()
            
            return make_response({'message': 'Prediction saved successfully', 'prediction': prediction.to_dict()}, 201)
            
        except Exception as e:
            db.session.rollback()
            print(f"Error saving prediction: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return make_response({'error': str(e)}, 500)

api.add_resource(PredictionsResource, '/api/v1/predictions')


@app.route('/api/v1/predictions/ask-ai', methods=['POST'])
def ask_ai_prediction():
    """
    Get an AI-generated score prediction for a fixture. No caching; each request
    returns a fresh prediction (e.g. to reflect latest form, injuries, etc.).
    Requires OPENAI_API_KEY and the openai package.
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'Authentication required'}, 401)

        if not OPENAI_AVAILABLE or OpenAI is None:
            return make_response({'error': 'Ask AI is not available (openai package not installed)'}, 503)

        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key or not api_key.strip():
            return make_response({'error': 'Ask AI is not configured (OPENAI_API_KEY not set)'}, 503)

        data = request.get_json() or {}
        fixture_id = data.get('fixture_id')
        league_id = data.get('league_id')
        if not fixture_id:
            return make_response({'error': 'Missing fixture_id'}, 400)
        if not league_id:
            return make_response({'error': 'Missing league_id (required to check if Ask AI is enabled for this league)'}, 400)

        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        if not getattr(league, 'ai_predictions_enabled', False):
            return make_response({'error': 'Ask AI is not enabled for this league'}, 403)

        fixture = Fixture.query.get(fixture_id)
        if not fixture:
            return make_response({'error': 'Fixture not found'}, 404)

        # Lock after kickoff (same as saving a prediction)
        if fixture.fixture_date:
            now_utc = datetime.now(timezone.utc)
            kickoff = fixture.fixture_date
            if getattr(kickoff, 'tzinfo', None) is None:
                kickoff = kickoff.replace(tzinfo=timezone.utc)
            if now_utc >= kickoff:
                return make_response({'error': 'Cannot get AI prediction for a fixture that has already started'}, 403)

        standings_list, matchweek = _fetch_standings_data()
        standings_text = ''
        if standings_list:
            lines = [f"{e['position']}. {e['team']} – P{e['played']} W{e['won']} D{e['drawn']} L{e['lost']} GF{e['goalsFor']} GA{e['goalsAgainst']} GD{e['goalDifference']} Pts{e['points']}" for e in standings_list]
            standings_text = 'Current Premier League table (after latest matchweek):\n' + '\n'.join(lines)
        else:
            standings_text = 'Current Premier League standings could not be loaded; base your prediction on general knowledge of the teams.'

        round_info = f" (Round {fixture.fixture_round})" if fixture.fixture_round else ""
        prompt = f"""Fixture{round_info}: {fixture.fixture_home_team} (home) vs {fixture.fixture_away_team} (away).

{standings_text}

Predict the full-time score. Consider table position, form, and home advantage. Reply with valid JSON only, no other text:
{{"home_team_score": <integer 0-20>, "away_team_score": <integer 0-20>, "rationale": "<one short sentence explaining the prediction>"}}"""

        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[
                {'role': 'system', 'content': 'You are a Premier League expert. Reply only with valid JSON in the exact format requested.'},
                {'role': 'user', 'content': prompt},
            ],
            response_format={'type': 'json_object'},
            max_tokens=150,
        )
        content = (response.choices[0].message.content or '').strip()
        if not content:
            return make_response({'error': 'AI returned no prediction'}, 502)

        parsed = json.loads(content)
        home = parsed.get('home_team_score')
        away = parsed.get('away_team_score')
        rationale = parsed.get('rationale') or ''

        try:
            home = int(home) if home is not None else None
            away = int(away) if away is not None else None
        except (TypeError, ValueError):
            home = away = None
        if home is None or away is None or not (0 <= home <= 20 and 0 <= away <= 20):
            return make_response({'error': 'AI returned invalid score format'}, 502)

        return make_response({
            'home_team_score': home,
            'away_team_score': away,
            'rationale': rationale.strip(),
        }, 200)
    except json.JSONDecodeError as e:
        return make_response({'error': f'Invalid AI response: {str(e)}'}, 502)
    except Exception as e:
        err_str = str(e).lower()
        err_body = getattr(e, 'body', None) or {}
        if getattr(e, 'response', None):
            try:
                err_body = getattr(e.response, 'json', lambda: {})() or err_body
            except Exception:
                pass
        err_inner = err_body.get('error', {}) if isinstance(err_body, dict) else {}
        msg = str(err_inner.get('message', '') or err_inner) if isinstance(err_inner, dict) else str(err_inner)
        code = err_inner.get('code', '') if isinstance(err_inner, dict) else ''
        if code == 'insufficient_quota' or 'quota' in err_str or 'quota' in msg.lower():
            return make_response({
                'error': 'AI suggestion is unavailable: your OpenAI account has no quota. Add a payment method at platform.openai.com/account/billing to enable usage (you only pay for what you use).'
            }, 402)
        if getattr(e, 'status_code', None) == 429 or 'rate' in err_str or 'rate' in msg.lower():
            return make_response({
                'error': 'AI is rate limited. Please try again in a moment.'
            }, 429)
        print(f"Ask AI error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/fixtures/sync-scores', methods=['POST', 'GET'])
def sync_fixture_scores():
    """
    Sync completed fixtures with actual scores.
    - Premier League: use api_url (pulselive API) in body/query or EXTERNAL_FIXTURES_API_URL.
    - Other leagues: pass competition=slug (e.g. ger.1, eng.2); uses football-data.org or ESPN to refresh scores.
    GET: use query params competition= and optionally api_url= (for PL).
    """
    print("DEBUG sync-scores: Function called")
    try:
        if not REQUESTS_AVAILABLE:
            return make_response({
                'error': 'Requests module is not available. Please run the server with pipenv: pipenv run python app.py'
            }, 500)
        if request.method == 'GET':
            competition_slug = (request.args.get('competition') or request.args.get('league_slug') or '').strip()
            api_url = request.args.get('api_url') or os.getenv('EXTERNAL_FIXTURES_API_URL')
        else:
            data = request.get_json() or {}
            competition_slug = (data.get('competition') or data.get('league_slug') or '').strip()
            api_url = data.get('api_url') or os.getenv('EXTERNAL_FIXTURES_API_URL')
        
        # All leagues (including Premier League eng.1) use competition=slug; football-data.org or ESPN.
        if competition_slug:
            comp = next((c for c in SUPPORTED_COMPETITIONS if c.get('slug') == competition_slug), None)
            if comp and comp.get('source') == 'football_data':
                added, updated, seen, err = _sync_fixtures_football_data(
                    comp.get('football_data_code') or 'BL1',
                    competition_slug
                )
                if err:
                    return make_response({'error': err}, 500)
                db.session.commit()
                return make_response({
                    'message': f'Scores synced for {competition_slug} (football-data.org)',
                    'added': added,
                    'updated': updated,
                    'fixtures_seen': seen,
                    'fixtures_updated': updated,
                }, 200)
            if comp and comp.get('source') == 'espn':
                added, updated, seen, err = _sync_fixtures_espn(comp.get('espn_slug') or competition_slug)
                if err:
                    return make_response({'error': err}, 500)
                db.session.commit()
                return make_response({
                    'message': f'Scores synced for {competition_slug} (ESPN)',
                    'added': added,
                    'updated': updated,
                    'fixtures_seen': seen,
                    'fixtures_updated': updated,
                }, 200)
            if comp:
                return make_response({'error': f'Unknown sync source for {competition_slug}'}, 400)
            return make_response({'error': f'Unknown competition: {competition_slug}'}, 400)
        
        if not api_url:
            return make_response({
                'error': 'Provide competition=slug (e.g. eng.1, ger.1, eng.2) in request body or query. Premier League is eng.1.'
            }, 400)
        
        # Legacy: pulselive API when api_url is provided (no competition). Prefer competition=eng.1 + football-data.
        effective_api_url = api_url
        try:
            parsed = urlparse(api_url)
            if (
                parsed.netloc.endswith("premier-league-prod.pulselive.com")
                and parsed.path.endswith("/api/v2/matches")
            ):
                qs = parse_qs(parsed.query)
                qs.pop("_next", None)
                qs["_limit"] = ["400"]
                effective_api_url = urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))
        except Exception as e:
            print(f"WARNING: could not rewrite api_url for _limit override: {e}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Fetch all matches with pagination
        all_items = []
        pages_fetched = 0
        next_token = None
        max_pages = 100
        
        base_effective_api_url = effective_api_url
        while True:
            if pages_fetched == 0:
                page_url = base_effective_api_url
            else:
                parsed_page = urlparse(base_effective_api_url)
                qs_page = parse_qs(parsed_page.query)
                qs_page["_next"] = [next_token]
                page_url = urlunparse(parsed_page._replace(query=urlencode(qs_page, doseq=True)))
            
            resp = requests.get(page_url, headers=headers, timeout=30)
            resp.raise_for_status()
            external_data = resp.json()
            
            if not isinstance(external_data, dict):
                return make_response({'error': 'Unexpected API response type', 'type': str(type(external_data))}, 500)
            
            page_items = external_data.get("data", [])
            all_items.extend(page_items)
            pages_fetched += 1
            
            pagination = external_data.get("pagination") if isinstance(external_data.get("pagination"), dict) else {}
            next_token = pagination.get("_next")
            
            if not next_token:
                break
            if pages_fetched >= max_pages:
                print("WARNING: pagination max_pages reached; stopping early")
                break
        
        fixtures_updated = 0
        fixtures_with_scores = 0
        fixtures_not_found = 0
        matches_with_scores = 0
        
        print(f"DEBUG sync-scores: Fetched {len(all_items)} total matches from API across {pages_fetched} pages")
        
        # Debug: print first match structure
        if all_items and len(all_items) > 0:
            sample = all_items[0]
            print("=" * 80)
            print("DEBUG sync-scores: Sample match structure:")
            print(f"Sample match keys: {list(sample.keys())[:30] if isinstance(sample, dict) else 'not a dict'}")
            if isinstance(sample, dict):
                if 'score' in sample:
                    print(f"Score structure: {sample['score']}")
                else:
                    print("DEBUG: No 'score' key in match data")
                if 'status' in sample:
                    print(f"Status structure: {sample['status']}")
                else:
                    print("DEBUG: No 'status' key in match data")
                # Check for alternative keys
                print(f"isCompleted (top-level): {sample.get('isCompleted')}")
                if isinstance(sample.get('status'), dict):
                    print(f"status.isCompleted: {sample['status'].get('isCompleted')}")
                for key in ['matchStatus', 'state', 'completed', 'finished', 'result', 'isCompleted']:
                    if key in sample:
                        print(f"Found key '{key}': {sample[key]}")
                import json
                print(f"Sample match (first 1200 chars): {json.dumps(sample, indent=2, default=str)[:1200]}")
            print("=" * 80)
        
        print(f"DEBUG sync-scores: Processing {len(all_items)} matches from API")
        
        pl_filter = _fixture_query_competition('eng.1')
        pl_fixtures = Fixture.query.filter(pl_filter).all() if pl_filter is not None else []
        for idx, match_data in enumerate(all_items):
            # Extract match information and scores (scores are nested in homeTeam/awayTeam)
            home_team = None
            away_team = None
            actual_home_score = None
            actual_away_score = None
            is_completed = False
            scores_from_final_result = False

            if 'homeTeam' in match_data:
                home_team_data = match_data['homeTeam']
                if isinstance(home_team_data, dict):
                    home_team = home_team_data.get('name') or home_team_data.get('shortName')
                    # Check for score nested in homeTeam (try multiple keys)
                    for score_key in ('score', 'goals', 'displayScore', 'fullTimeScore'):
                        score_val = home_team_data.get(score_key)
                        if score_val is not None:
                            try:
                                actual_home_score = int(score_val)
                                if idx < 3:
                                    print(f"DEBUG sync-scores: Match {idx} found home score in homeTeam.{score_key}: {actual_home_score}")
                                break
                            except (TypeError, ValueError):
                                pass
                else:
                    home_team = str(home_team_data)
            
            if 'awayTeam' in match_data:
                away_team_data = match_data['awayTeam']
                if isinstance(away_team_data, dict):
                    away_team = away_team_data.get('name') or away_team_data.get('shortName')
                    # Check for score nested in awayTeam (try multiple keys)
                    for score_key in ('score', 'goals', 'displayScore', 'fullTimeScore'):
                        score_val = away_team_data.get(score_key)
                        if score_val is not None:
                            try:
                                actual_away_score = int(score_val)
                                if idx < 3:
                                    print(f"DEBUG sync-scores: Match {idx} found away score in awayTeam.{score_key}: {actual_away_score}")
                                break
                            except (TypeError, ValueError):
                                pass
                else:
                    away_team = str(away_team_data)
            
            if not home_team or not away_team:
                if idx < 3:
                    print(f"DEBUG sync-scores: Skipping match {idx} - missing team names: home={home_team}, away={away_team}")
                continue
            
            # Top-level score fields (some Premier League API responses use these)
            if actual_home_score is None and actual_away_score is None:
                for hkey, akey in [('home_team_score', 'away_team_score'), ('homeTeamScore', 'awayTeamScore'), ('homeScore', 'awayScore')]:
                    h = match_data.get(hkey)
                    a = match_data.get(akey)
                    if h is not None and a is not None:
                        try:
                            actual_home_score = int(h)
                            actual_away_score = int(a)
                            scores_from_final_result = True
                            break
                        except (TypeError, ValueError):
                            pass
            
            # API has isCompleted field (top-level or nested under status) - use as primary indicator
            def _is_completed_true(val):
                if val is True:
                    return True
                if isinstance(val, str) and str(val).lower() in ('true', '1', 'yes'):
                    return True
                if isinstance(val, (int, float)) and val:
                    return True
                return False
            api_is_completed = match_data.get('isCompleted') or match_data.get('is_completed')
            if not _is_completed_true(api_is_completed) and isinstance(match_data.get('status'), dict):
                api_is_completed = match_data['status'].get('isCompleted') or match_data['status'].get('is_completed')
            if _is_completed_true(api_is_completed):
                is_completed = True
                if idx < 3:
                    print(f"DEBUG sync-scores: Match {idx} marked as completed from isCompleted: {api_is_completed}")

            # Debug: Show structure for first few matches
            if idx < 3:
                print(f"DEBUG sync-scores: Match {idx} structure - keys: {list(match_data.keys())[:20]}")
                if 'isCompleted' in match_data:
                    print(f"DEBUG sync-scores: Match {idx} isCompleted: {match_data['isCompleted']}")
                if 'score' in match_data:
                    print(f"DEBUG sync-scores: Match {idx} score structure: {match_data['score']}")
                if 'status' in match_data:
                    print(f"DEBUG sync-scores: Match {idx} status structure: {match_data['status']}")
                # Check alternative fields
                if 'resultType' in match_data:
                    print(f"DEBUG sync-scores: Match {idx} resultType: {match_data['resultType']}")
                if 'period' in match_data:
                    print(f"DEBUG sync-scores: Match {idx} period: {match_data['period']}")
                if 'clock' in match_data:
                    print(f"DEBUG sync-scores: Match {idx} clock: {match_data['clock']}")
            
            # Check for scores in various possible locations
            # First check alternative fields that might contain scores
            if 'period' in match_data:
                period_data = match_data['period']
                if isinstance(period_data, dict):
                    # Check if period has score information
                    if 'homeScore' in period_data or 'awayScore' in period_data:
                        actual_home_score = period_data.get('homeScore') or period_data.get('home')
                        actual_away_score = period_data.get('awayScore') or period_data.get('away')
                        if idx < 3:
                            print(f"DEBUG sync-scores: Match {idx} found scores in period: {actual_home_score}-{actual_away_score}")
            
            # Also check if there's a nested structure with scores (result = final outcome)
            if 'result' in match_data:
                result_data = match_data['result']
                if isinstance(result_data, dict):
                    rh = result_data.get('homeScore') or result_data.get('home')
                    ra = result_data.get('awayScore') or result_data.get('away')
                    if rh is not None and ra is not None:
                        actual_home_score = rh
                        actual_away_score = ra
                        scores_from_final_result = True
                    if idx < 3 and actual_home_score is not None:
                        print(f"DEBUG sync-scores: Match {idx} found scores in result: {actual_home_score}-{actual_away_score}")
            
            # Check for scores in various possible locations (original check)
            if 'score' in match_data:
                score_data = match_data['score']
                if idx < 3:
                    print(f"DEBUG sync-scores: Match {idx} has 'score' key: {score_data}")
                if isinstance(score_data, dict):
                    # Try different score field names
                    if 'fullTime' in score_data:
                        ft = score_data['fullTime']
                        if isinstance(ft, dict):
                            actual_home_score = ft.get('home') or ft.get('homeScore') or ft.get('homeTeam')
                            actual_away_score = ft.get('away') or ft.get('awayScore') or ft.get('awayTeam')
                            if actual_home_score is not None and actual_away_score is not None:
                                scores_from_final_result = True
                            if idx < 3:
                                print(f"DEBUG sync-scores: Match {idx} fullTime scores: {actual_home_score}-{actual_away_score}")
                    elif 'home' in score_data and 'away' in score_data:
                        actual_home_score = score_data.get('home')
                        actual_away_score = score_data.get('away')
                        if idx < 3:
                            print(f"DEBUG sync-scores: Match {idx} direct scores: {actual_home_score}-{actual_away_score}")
                    elif 'homeScore' in score_data and 'awayScore' in score_data:
                        actual_home_score = score_data.get('homeScore')
                        actual_away_score = score_data.get('awayScore')
                        if idx < 3:
                            print(f"DEBUG sync-scores: Match {idx} homeScore/awayScore: {actual_home_score}-{actual_away_score}")
                    # Also check for regularTime or other time periods
                    for period_key in ['regularTime', 'halfTime', 'extraTime', 'penalties']:
                        if period_key in score_data and isinstance(score_data[period_key], dict):
                            period = score_data[period_key]
                            if actual_home_score is None:
                                actual_home_score = period.get('home') or period.get('homeScore')
                            if actual_away_score is None:
                                actual_away_score = period.get('away') or period.get('awayScore')
            elif idx < 3:
                print(f"DEBUG sync-scores: Match {idx} has NO 'score' key")
            
            # Check status to see if match is completed
            # Accept: period = FullTime/FT/Result, or status/resultType indicating finished, or we have full-time scores
            COMPLETED_PERIOD_VALUES = {'FULLTIME', 'FULL_TIME', 'FT', 'RESULT', 'FINISHED', 'COMPLETE', 'C', 'ENDED'}
            if 'period' in match_data:
                period_data = match_data['period']
                if idx < 3:
                    print(f"DEBUG sync-scores: Match {idx} period: {period_data}")
                if isinstance(period_data, dict):
                    period_type = period_data.get('type') or period_data.get('label') or period_data.get('name')
                    if period_type and str(period_type).upper().strip() in COMPLETED_PERIOD_VALUES:
                        is_completed = True
                        if idx < 3:
                            print(f"DEBUG sync-scores: Match {idx} marked as completed based on period: {period_data}")
                elif isinstance(period_data, str):
                    period_str = str(period_data).upper().strip()
                    if period_str in COMPLETED_PERIOD_VALUES:
                        is_completed = True
                        if idx < 3:
                            print(f"DEBUG sync-scores: Match {idx} marked as completed based on period: {period_data}")
            # Also check status / resultType (Premier League API may use these)
            if not is_completed:
                for key in ['status', 'resultType', 'matchStatus', 'state']:
                    val = match_data.get(key)
                    if val is not None:
                        s = str(val).upper().strip()
                        if s in COMPLETED_PERIOD_VALUES or s in {'FINISHED', 'COMPLETE', 'C', 'FT', 'RESULT'}:
                            is_completed = True
                            if idx < 3:
                                print(f"DEBUG sync-scores: Match {idx} marked as completed based on {key}: {val}")
                            break
            # If we have both scores from fullTime/result, treat as completed (API may not set period)
            if not is_completed and scores_from_final_result and actual_home_score is not None and actual_away_score is not None:
                is_completed = True
                if idx < 3:
                    print(f"DEBUG sync-scores: Match {idx} marked as completed (scores from fullTime/result)")
            
            # Count matches with scores
            if actual_home_score is not None and actual_away_score is not None:
                matches_with_scores += 1
                if matches_with_scores <= 3:
                    print(f"DEBUG sync-scores: Match {idx} has scores: {home_team} {actual_home_score}-{actual_away_score} {away_team}, is_completed={is_completed}")
            
            # Find matching fixture in database - Premier League only (eng.1, null, and '' via shared filter)
            fixture = None
            for f in pl_fixtures:
                if (f.fixture_home_team and f.fixture_away_team and
                    f.fixture_home_team.lower().strip() == (home_team or '').lower().strip() and
                    f.fixture_away_team.lower().strip() == (away_team or '').lower().strip()):
                    fixture = f
                    break
            if not fixture:
                for f in pl_fixtures:
                    if _fixture_matches_game(f, home_team, away_team):
                        fixture = f
                        break
            
            if fixture:
                if idx < 5:
                    print(f"DEBUG sync-scores: Match {idx} - Found fixture {fixture.id}: {home_team} vs {away_team}, period={match_data.get('period')}, is_completed={is_completed}, has_scores={actual_home_score is not None and actual_away_score is not None}")
                
                has_both_scores = actual_home_score is not None and actual_away_score is not None
                if has_both_scores:
                    # We have final scores - update fixture (treat as completed; API may not set period/status)
                    fixture.actual_home_score = int(actual_home_score)
                    fixture.actual_away_score = int(actual_away_score)
                    fixture.is_completed = True
                    fixtures_updated += 1
                    fixtures_with_scores += 1
                    if fixtures_updated <= 3:
                        print(f"DEBUG sync-scores: Updated fixture {fixture.id}: {home_team} {actual_home_score}-{actual_away_score} {away_team}, marked as completed")
                elif is_completed and not has_both_scores and fixture.is_completed:
                    # API says completed but we have no scores - clear if we had scores before (e.g. data glitch)
                    if fixture.actual_home_score is not None or fixture.actual_away_score is not None:
                        fixture.is_completed = False
                        fixture.actual_home_score = None
                        fixture.actual_away_score = None
                        fixtures_updated += 1
                elif idx < 5:
                    print(f"DEBUG sync-scores: Match {idx} - No scores yet (is_completed={is_completed}, scores={actual_home_score}-{actual_away_score})")
            else:
                fixtures_not_found += 1
                # Debug: print first few unmatched fixtures
                if fixtures_not_found <= 5:
                    print(f"DEBUG sync-scores: Could not find fixture for: {home_team} vs {away_team}")
                    # Show what fixtures we have in DB for debugging
                    if fixtures_not_found == 1:
                        sample_fixtures = Fixture.query.limit(5).all()
                        print(f"DEBUG: Sample fixtures in DB:")
                        for f in sample_fixtures:
                            print(f"  - {f.fixture_home_team} vs {f.fixture_away_team} (id={f.id}, completed={f.is_completed}, scores={f.actual_home_score}-{f.actual_away_score})")
        
        db.session.commit()
        
        print(f"DEBUG sync-scores SUMMARY: Updated {fixtures_updated} fixtures, {matches_with_scores} matches had scores, {fixtures_not_found} fixtures not found, {pages_fetched} pages fetched")
        
        return make_response({
            'message': 'Fixture scores synced successfully',
            'fixtures_updated': fixtures_updated,
            'fixtures_with_scores': fixtures_with_scores,
            'matches_with_scores': matches_with_scores,
            'fixtures_not_found': fixtures_not_found,
            'pages_fetched': pages_fetched
        }, 200)
        
    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error syncing fixture scores: {str(e)}")
        print(f"Traceback: {error_details}")
        return make_response({'error': str(e), 'type': type(e).__name__, 'details': error_details.split('\n')[-5:]}, 500)

@app.route('/api/v1/predictions/check-results', methods=['POST'])
def check_prediction_results():
    """
    Compare user predictions against actual fixture scores and determine Win/Draw/Loss.
    Updates the game_result field in Game model.
    """
    try:
        user_id = get_current_user_id()
        
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        
        # Get all user's predictions (Games)
        user_games = Game.query.filter_by(user_id=user_id).all()
        
        results_updated = 0
        wins = 0
        draws = 0
        losses = 0
        fixtures_not_found = 0
        fixtures_not_completed = 0
        fixtures_no_scores = 0
        
        print(f"DEBUG check-results: Checking {len(user_games)} predictions for user {user_id}")
        
        all_fixtures = Fixture.query.all()
        for game in user_games:
            # Find matching fixture - exact, then case-insensitive, then normalized (& vs and, etc.)
            fixture = _fixture_for_game(game, None, fixtures_list=all_fixtures)
            if not fixture:
                fixtures_not_found += 1
                if fixtures_not_found <= 3:
                    print(f"DEBUG check-results: Fixture not found for prediction: {game.home_team} vs {game.away_team}")
                continue

            # Keep game team names in sync with fixture (e.g. after sync changed "Man Utd" to "Manchester United")
            if game.home_team != fixture.fixture_home_team or game.away_team != fixture.fixture_away_team:
                game.home_team = fixture.fixture_home_team
                game.away_team = fixture.fixture_away_team
            
            # Treat as completed if we have both scores (even when is_completed is False), so results and leaderboard update
            if fixture.actual_home_score is None or fixture.actual_away_score is None:
                fixtures_no_scores += 1
                if fixtures_no_scores <= 3:
                    print(f"DEBUG check-results: Fixture has no scores: {fixture.fixture_home_team} vs {fixture.fixture_away_team}, is_completed={fixture.is_completed}, scores={fixture.actual_home_score}-{fixture.actual_away_score}")
                continue
            if not fixture.is_completed:
                fixtures_not_completed += 1
                if fixtures_not_completed <= 3:
                    print(f"DEBUG check-results: Fixture not marked completed but has scores: {fixture.fixture_home_team} vs {fixture.fixture_away_team}, processing anyway")
            
            # Get predicted and actual scores
            pred_home = game.home_team_score
            pred_away = game.away_team_score
            actual_home = fixture.actual_home_score
            actual_away = fixture.actual_away_score
            
            # Determine result
            result = None
            
            # Win: both scores match exactly
            if pred_home == actual_home and pred_away == actual_away:
                result = 'Win'
                wins += 1
            else:
                # Determine predicted winner
                if pred_home > pred_away:
                    pred_winner = 'home'
                elif pred_away > pred_home:
                    pred_winner = 'away'
                else:
                    pred_winner = 'draw'
                
                # Determine actual winner
                if actual_home > actual_away:
                    actual_winner = 'home'
                elif actual_away > actual_home:
                    actual_winner = 'away'
                else:
                    actual_winner = 'draw'
                
                # Draw: predicted winner matches actual winner (but scores differ)
                if pred_winner == actual_winner:
                    result = 'Draw'
                    draws += 1
                else:
                    # Loss: wrong winner or wrong scores
                    result = 'Loss'
                    losses += 1
            
            # Update game result if it changed
            if game.game_result != result:
                game.game_result = result
                results_updated += 1
        
        db.session.commit()
        
        return make_response({
            'message': 'Prediction results checked successfully',
            'results_updated': results_updated,
            'wins': wins,
            'draws': draws,
            'losses': losses,
            'total_checked': len(user_games),
            'fixtures_not_found': fixtures_not_found,
            'fixtures_not_completed': fixtures_not_completed,
            'fixtures_no_scores': fixtures_no_scores
        }, 200)
        
    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error checking prediction results: {str(e)}")
        print(f"Traceback: {error_details}")
        return make_response({'error': str(e), 'type': type(e).__name__}, 500)

class Games(Resource):
    def post(self):
        data = request.get_json()
        game = Game(game_week=data['game_week'], home_team=data['home_team'], home_team_score=data['home_team_score'], away_team=data['away_team'], away_team_score=data['away_team_score'])
    
@app.route('/api/v1/authorized')
def authorized():
    """Return current user as plain dict (avoids recursion from User.to_dict() relationships)."""
    user_id = get_current_user_id()
    if not user_id:
        return make_response({"error": "Not authenticated"}, 401)
    user_dict = get_user_dict_by_id(user_id)
    if not user_dict:
        return make_response({"error": "User not found"}, 404)
    return make_response(user_dict, 200)


@app.route('/api/v1/users/me', methods=['PATCH'])
def update_current_user():
    """Update current user email and/or password. Requires current_password for any change."""
    user_id = get_current_user_id()
    if not user_id:
        return make_response({'error': 'User not authenticated'}, 401)
    user = get_active_user_by_id(user_id)
    if not user:
        return make_response({'error': 'User not found'}, 404)
    data = request.get_json() or {}
    current_password = (data.get('current_password') or '').strip()
    if not current_password:
        return make_response({'error': 'Current password is required to update account'}, 400)
    if not _verify_password(user_id, current_password):
        return make_response({'error': 'Current password is incorrect'}, 403)
    updated = False
    new_email = (data.get('email') or '').strip().lower()
    if new_email and new_email != (user.email or '').lower():
        if get_active_user_by_email(new_email):
            return make_response({'error': 'An account with that email already exists'}, 400)
        user.email = new_email
        updated = True
    new_username = (data.get('username') or '').strip() or None
    if new_username != (user.username or None):
        if new_username and get_active_user_by_username(new_username) and get_active_user_by_username(new_username).id != user_id:
            return make_response({'error': 'That name is already in use'}, 400)
        user.username = new_username
        updated = True
    new_password = (data.get('new_password') or '').strip()
    if new_password:
        confirm = (data.get('confirm_password') or '').strip()
        if new_password != confirm:
            return make_response({'error': 'New password and confirmation do not match'}, 400)
        user.password_hash = new_password
        updated = True
    if not updated:
        user_dict = get_user_dict_by_id(user_id)
        return make_response({'user': user_dict, 'message': 'No changes made'}, 200)
    db.session.commit()
    user_dict = get_user_dict_by_id(user_id)
    return make_response({'user': user_dict, 'message': 'Account updated'}, 200)


# Profile picture uploads: stored under server/uploads/avatars, served at /uploads/avatars/<filename>
UPLOAD_AVATAR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'avatars')
AVATAR_MAX_BYTES = 3 * 1024 * 1024  # 3MB
ALLOWED_AVATAR_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}


@app.route('/uploads/avatars/<path:filename>')
def serve_avatar(filename):
    """Serve uploaded avatar images (no auth required for GET)."""
    uploads_parent = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    return send_from_directory(uploads_parent, os.path.join('avatars', filename))


@app.route('/api/v1/users/me/avatar', methods=['POST'])
def upload_avatar():
    """Upload a profile picture. Expects multipart/form-data with field 'avatar' (image file)."""
    user_id = get_current_user_id()
    if not user_id:
        return make_response({'error': 'Not authenticated'}, 401)
    user = get_active_user_by_id(user_id)
    if not user:
        return make_response({'error': 'User not found'}, 404)
    file = request.files.get('avatar')
    if not file or file.filename == '':
        return make_response({'error': 'No file provided. Use form field "avatar".'}, 400)
    ext = (file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else '') or ''
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        return make_response({'error': 'Invalid file type. Use JPEG, PNG, or WebP.'}, 400)
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > AVATAR_MAX_BYTES:
        return make_response({'error': 'File too large. Maximum size is 3MB.'}, 400)
    os.makedirs(UPLOAD_AVATAR_DIR, exist_ok=True)
    safe_name = f"{user_id}_{secrets.token_hex(4)}.{ext}"
    filepath = os.path.join(UPLOAD_AVATAR_DIR, safe_name)
    try:
        file.save(filepath)
    except OSError as e:
        print(f"Avatar save error: {e}")
        return make_response({'error': 'Failed to save file.'}, 500)
    old_url = user.avatar_url
    user.avatar_url = f"/uploads/avatars/{safe_name}"
    db.session.commit()
    if old_url and old_url.startswith('/uploads/avatars/'):
        old_name = old_url.replace('/uploads/avatars/', '', 1)
        old_path = os.path.join(UPLOAD_AVATAR_DIR, old_name)
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass
    user_dict = get_user_dict_by_id(user_id)
    return make_response({'user': user_dict, 'message': 'Profile picture updated.'}, 200)


@app.route('/api/v1/logout', methods=['DELETE'])
def logout():
    session['user_id'] = None
    return make_response('', 204)


@app.route('/api/v1/users/me', methods=['DELETE'])
def soft_delete_current_user():
    """Soft-delete the current user (set deleted_at). They can no longer log in or use the app."""
    user_id = get_current_user_id()
    if not user_id:
        return make_response({'error': 'User not authenticated'}, 401)
    user = get_active_user_by_id(user_id)
    if not user:
        return make_response({'error': 'User not found'}, 404)
    user.deleted_at = datetime.now(timezone.utc)
    db.session.commit()
    session['user_id'] = None
    return make_response({'message': 'Account deleted.'}, 200)


@app.route('/api/v1/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    try:
        email = (data.get('email') or '').strip()
        username = (data.get('username') or '').strip()
        password = data.get('password')
        if password is None or (isinstance(password, str) and not password.strip()):
            return make_response({'error': 'Email and password are required'}, 400)
        # Resolve user by id only (no full User load) to avoid recursion from model access
        user_id = get_active_user_id_by_email(email) if email else get_active_user_id_by_username(username)
        if not user_id and not email and not username:
            return make_response({'error': 'Email and password are required'}, 400)
        pw_clean = (str(password) if password is not None else '').strip()
        if user_id and _verify_password(user_id, pw_clean):
            user_dict = get_user_dict_by_id(user_id)
            if user_dict:
                session['user_id'] = user_id
                token = generate_token(user_id)
                return make_response({
                    'user': user_dict,
                    'token': token
                }, 200)
        if not user_id:
            print("Login 401: no user found for email/username")
        return make_response({'error': 'Invalid email or password'}, 401)
    except RecursionError:
        print("Login error: recursion in auth path")
        return make_response({'error': 'Invalid email or password'}, 401)
    except Exception as e:
        print(f"Login error: {str(e)}")
        return make_response({'error': 'Invalid email or password'}, 401)


@app.route('/api/v1/forgot-password', methods=['POST'])
def forgot_password():
    """Request a password reset link. Sends email if MAIL_* is configured; else returns link in response."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    if not email:
        return make_response({'error': 'Email is required'}, 400)
    frontend_url = (data.get('frontend_url') or '').strip() or app.config.get('RESET_PASSWORD_BASE_URL', '')
    user = get_active_user_by_email(email)
    if user:
        user.reset_token = secrets.token_urlsafe(32)
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.session.commit()
        # Use history API route instead of hash route so the client lands on the reset form.
        reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={user.reset_token}" if frontend_url else None
        to_email = str(user.email)
        # Send email in request; 502 was from Gunicorn worker timeout, not Render proxy. Use gunicorn --timeout 120.
        email_sent = False
        if app.config.get('MAIL_SERVER') and reset_link and not app.config.get('SKIP_PASSWORD_RESET_EMAIL'):
            try:
                email_sent = send_password_reset_email(to_email, reset_link)
                if email_sent:
                    print(f"Password reset email sent to {to_email}")
                else:
                    print(f"Password reset email not sent for {to_email}")
            except Exception as e:
                print(f"send_password_reset_email failed: {e}")
                email_sent = False
        payload = {
            'message': "If an account exists with that email, we've sent a reset link.",
            'email_sent': email_sent,
        }
        return make_response(payload, 200)
    return make_response({
        'message': "If an account exists with that email, we've sent a reset link.",
    }, 200)


@app.route('/api/v1/reset-password', methods=['POST'])
def reset_password():
    """Reset password using a valid token from the forgot-password flow."""
    data = request.get_json() or {}
    token = (data.get('token') or '').strip()
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    if not token:
        return make_response({'error': 'Reset token is required'}, 400)
    pw = (str(password) if password is not None else '').strip()
    confirm_pw = (str(confirm_password) if confirm_password is not None else '').strip()
    if not pw:
        return make_response({'error': 'Password is required'}, 400)
    if pw != confirm_pw:
        return make_response({'error': 'Password and confirmation do not match'}, 400)
    now = datetime.now(timezone.utc)
    user = User.query.filter(
        User.reset_token == token,
        User.reset_token_expires.isnot(None),
        User.reset_token_expires > now,
        User.deleted_at.is_(None),
    ).first()
    if not user:
        return make_response({'error': 'Invalid or expired reset link. Please request a new one.'}, 400)
    user.password_hash = pw
    user.reset_token = None
    user.reset_token_expires = None
    db.session.flush()
    db.session.commit()
    # Verify the new password was stored (re-load from DB in case of session/column issues)
    db.session.refresh(user)
    try:
        if not user.authenticate(pw):
            print("Reset password: stored hash did not verify; possible column truncation or DB issue")
            return make_response({'error': 'Password could not be saved correctly. Please try again or contact support.'}, 500)
    except Exception as e:
        print(f"Reset password verify failed: {e}")
        return make_response({'error': 'Password could not be verified. Please try again.'}, 500)
    return make_response({'message': 'Password reset successfully. You can now log in.'}, 200)


@app.route('/')
def index():
    return '<h1>Project Server</h1>'

@app.route('/api/v1/leagues/open', methods=['GET'])
def get_open_leagues():
    """List leagues that are open to anyone. Optional query param q= for search by league name. Auth required."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        q = (request.args.get('q') or '').strip()
        query = League.query.filter_by(is_open=True)
        if q:
            query = query.filter(League.name.ilike(f'%{q}%'))
        leagues = query.order_by(League.name.asc()).limit(100).all()
        out = []
        for league in leagues:
            out.append({
                'id': league.id,
                'name': league.name,
                'is_open': getattr(league, 'is_open', False),
                'is_member': bool(get_league_membership(user_id, league.id)),
                'member_count': len(league.league_memberships),
            })
        return make_response({'leagues': out}, 200)
    except Exception as e:
        print(f"Error fetching open leagues: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues', methods=['GET'])
def get_user_leagues():
    """Get all leagues the current user is a member of"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        
        user = get_active_user_by_id(user_id)
        if not user:
            return make_response({'error': 'User not found'}, 404)
        
        leagues = []
        for league in user.leagues:
            d = league.to_dict()
            d['is_admin'] = is_league_admin(user_id, league.id)
            leagues.append(d)
        return make_response({'leagues': leagues}, 200)
    except Exception as e:
        print(f"Error fetching user leagues: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)

@app.route('/api/v1/leagues', methods=['POST'])
def create_league():
    """Create a new league. Requires display_name (your username for this league)."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        
        data = request.get_json() or {}
        league_name = (data.get('name') or '').strip()
        display_name = (data.get('display_name') or '').strip()
        is_open = data.get('is_open') in (True, 'true', 1, '1')
        scope = (data.get('leaderboard_scope') or data.get('scope') or 'full_season').strip().lower()
        if scope not in ('full_season', 'weekly'):
            scope = 'full_season'
        competition_slug = (data.get('competition_slug') or data.get('competition') or 'eng.1').strip()
        valid_slugs = [c['slug'] for c in SUPPORTED_COMPETITIONS]
        if competition_slug not in valid_slugs:
            competition_slug = 'eng.1'
        ai_predictions_enabled = data.get('ai_predictions_enabled') in (True, 'true', 1, '1')
        if not league_name:
            return make_response({'error': 'League name is required'}, 400)
        if not display_name:
            return make_response({'error': 'Display name for this league is required'}, 400)
        
        import random
        import string
        while True:
            invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            existing = League.query.filter_by(invite_code=invite_code).first()
            if not existing:
                break
        
        league = League(name=league_name, invite_code=invite_code, is_open=is_open, leaderboard_scope=scope, competition_slug=competition_slug, ai_predictions_enabled=ai_predictions_enabled, created_by=user_id)
        db.session.add(league)
        db.session.flush()
        
        membership = LeagueMembership(user_id=user_id, league_id=league.id, display_name=display_name, role='admin')
        db.session.add(membership)
        db.session.commit()
        
        return make_response({'league': league.to_dict()}, 201)
    except Exception as e:
        db.session.rollback()
        print(f"Error creating league: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)

@app.route('/api/v1/leagues/<int:league_id>/join', methods=['POST'])
def join_league(league_id):
    """Join a league by ID. Requires display_name (your username in this league), unique per league."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        
        data = request.get_json() or {}
        display_name = (data.get('display_name') or '').strip()
        if not display_name:
            return make_response({'error': 'Display name for this league is required'}, 400)
        
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        
        if LeagueMembership.query.filter_by(league_id=league_id, user_id=user_id).first():
            return make_response({'error': 'You are already a member of this league'}, 400)
        if LeagueMembership.query.filter_by(league_id=league_id, display_name=display_name).first():
            return make_response({'error': 'That display name is already taken in this league'}, 400)
        
        db.session.add(LeagueMembership(user_id=user_id, league_id=league_id, display_name=display_name, role='player'))
        db.session.commit()
        league = League.query.get(league_id)
        return make_response({'league': league.to_dict()}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error joining league: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)

@app.route('/api/v1/leagues/join-by-code', methods=['POST'])
def join_league_by_code():
    """Join a league using an invite code. Requires display_name (your username in this league), unique per league."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        
        data = request.get_json() or {}
        invite_code = (data.get('invite_code') or '').strip().upper()
        display_name = (data.get('display_name') or '').strip()
        
        if not invite_code:
            return make_response({'error': 'Invite code is required'}, 400)
        if not display_name:
            return make_response({'error': 'Display name for this league is required'}, 400)
        
        league = League.query.filter_by(invite_code=invite_code).first()
        if not league:
            return make_response({'error': 'Invalid invite code'}, 404)
        
        if LeagueMembership.query.filter_by(league_id=league.id, user_id=user_id).first():
            return make_response({'error': 'You are already a member of this league'}, 400)
        if LeagueMembership.query.filter_by(league_id=league.id, display_name=display_name).first():
            return make_response({'error': 'That display name is already taken in this league'}, 400)
        
        db.session.add(LeagueMembership(user_id=user_id, league_id=league.id, display_name=display_name, role='player'))
        db.session.commit()
        league = League.query.get(league.id)
        return make_response({'league': league.to_dict()}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error joining league by code: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/me', methods=['PATCH'])
def update_my_league_display_name(league_id):
    """Update the current user's display name in this league. Must be unique (case-insensitive) within the league."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        membership = get_league_membership(user_id, league_id)
        if not membership:
            return make_response({'error': 'You are not a member of this league'}, 403)
        data = request.get_json() or {}
        if 'display_name' in data:
            new_name = (data.get('display_name') or '').strip()
            if not new_name:
                return make_response({'error': 'Display name cannot be empty'}, 400)
            for lm in league.league_memberships:
                if lm.user_id != user_id and (lm.display_name or '').strip().lower() == new_name.lower():
                    return make_response({'error': 'That display name is already taken in this league'}, 400)
            membership.display_name = new_name
        if 'notify_missing_predictions' in data:
            membership.notify_missing_predictions = bool(data.get('notify_missing_predictions'))
        db.session.commit()
        return make_response({
            'message': 'Updated',
            'display_name': membership.display_name,
            'notify_missing_predictions': membership.notify_missing_predictions,
            'league': league.to_dict(),
        }, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error updating league display name: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/members/<int:member_user_id>', methods=['PATCH'])
def update_league_member_role(league_id, member_user_id):
    """Update a member's role (admin or player). League admin only. Body: { \"role\": \"admin\" | \"player\" }."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can update member roles'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        membership = get_league_membership(member_user_id, league_id)
        if not membership:
            return make_response({'error': 'Member not in this league'}, 404)
        data = request.get_json() or {}
        role = (data.get('role') or '').strip().lower()
        if role not in ('admin', 'player'):
            return make_response({'error': 'role must be "admin" or "player"'}, 400)
        # If demoting self to player, ensure at least one other admin remains
        if member_user_id == user_id and role == 'player':
            admin_count = sum(1 for lm in league.league_memberships if lm.role == 'admin')
            if admin_count <= 1:
                return make_response({'error': 'Cannot demote the last admin. Promote another member to admin first.'}, 400)
        membership.role = role
        db.session.commit()
        return make_response({'message': 'Role updated', 'role': membership.role}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error updating member role: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/members/<int:member_user_id>', methods=['DELETE'])
def remove_league_member(league_id, member_user_id):
    """Remove a member from the league. Admin only."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can remove members'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        membership = get_league_membership(member_user_id, league_id)
        if not membership:
            return make_response({'error': 'Member not in this league'}, 404)
        db.session.delete(membership)
        db.session.commit()
        return make_response({'message': 'Member removed from league'}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error removing member: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>', methods=['DELETE'])
def delete_league(league_id):
    """Delete the league entirely. Admin only. Removes all league memberships."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can delete the league'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        LeagueMembership.query.filter_by(league_id=league_id).delete()
        db.session.delete(league)
        db.session.commit()
        return make_response({'message': 'League deleted'}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting league: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/games/<int:game_id>', methods=['PATCH'])
def admin_update_prediction(league_id, game_id):
    """Manually update a prediction (home_team_score, away_team_score). Admin of the league only. Game must belong to a league member."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can update predictions'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        game = Game.query.get(game_id)
        if not game:
            return make_response({'error': 'Prediction/game not found'}, 404)
        # Game must belong to a member of this league
        if not get_league_membership(game.user_id, league_id):
            return make_response({'error': 'That prediction is not from a member of this league'}, 403)
        data = request.get_json() or {}
        home_team_score = data.get('home_team_score')
        away_team_score = data.get('away_team_score')
        if home_team_score is not None:
            game.home_team_score = int(home_team_score)
        if away_team_score is not None:
            game.away_team_score = int(away_team_score)
        # Recompute game_result if fixture is completed
        fixture = Fixture.query.filter_by(
            fixture_home_team=game.home_team,
            fixture_away_team=game.away_team
        ).first()
        if not fixture and game.home_team and game.away_team:
            for f in Fixture.query.all():
                if (f.fixture_home_team or '').lower().strip() == (game.home_team or '').lower().strip() and (f.fixture_away_team or '').lower().strip() == (game.away_team or '').lower().strip():
                    fixture = f
                    break
        if fixture and fixture.is_completed and fixture.actual_home_score is not None and fixture.actual_away_score is not None:
            pred_home, pred_away = game.home_team_score, game.away_team_score
            actual_home, actual_away = fixture.actual_home_score, fixture.actual_away_score
            if pred_home == actual_home and pred_away == actual_away:
                game.game_result = 'Win'
            else:
                pred_winner = 'home' if pred_home > pred_away else ('away' if pred_away > pred_home else 'draw')
                actual_winner = 'home' if actual_home > actual_away else ('away' if actual_away > actual_home else 'draw')
                game.game_result = 'Draw' if pred_winner == actual_winner else 'Loss'
        db.session.commit()
        return make_response({'message': 'Prediction updated', 'game': game.to_dict()}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error updating prediction: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/members/<int:member_user_id>/predictions', methods=['GET'])
def get_member_predictions_for_admin(league_id, member_user_id):
    """Get predictions for a league member. Admin only. Same shape as GET /api/v1/predictions."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can view member predictions'}, 403)
        if not get_league_membership(member_user_id, league_id):
            return make_response({'error': 'User is not a member of this league'}, 404)
        league = League.query.get(league_id)
        league_comp = getattr(league, 'competition_slug', None) or 'eng.1'
        comp_filter = _fixture_query_competition(league_comp)
        all_fixtures = Fixture.query.filter(comp_filter).all() if comp_filter is not None else Fixture.query.all()
        user_games = Game.query.filter_by(user_id=member_user_id).order_by(Game.game_week.asc()).all()
        predictions = []
        for game in user_games:
            fixture = _fixture_for_game(game, league_comp, fixtures_list=all_fixtures)
            prediction_data = game.to_dict()
            if fixture:
                prediction_data['fixture'] = {
                    'id': fixture.id,
                    'round': fixture.fixture_round,
                    'date': fixture.fixture_date.isoformat() if fixture.fixture_date else None,
                    'is_completed': fixture.is_completed,
                    'actual_home_score': fixture.actual_home_score,
                    'actual_away_score': fixture.actual_away_score,
                }
            else:
                prediction_data['fixture'] = None
            prediction_data['game_result'] = game.game_result
            predictions.append(prediction_data)
        return make_response({'predictions': predictions}, 200)
    except Exception as e:
        print(f"Error fetching member predictions: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/members/<int:member_user_id>/predictions', methods=['POST'])
def admin_create_member_prediction(league_id, member_user_id):
    """Admin only: create a prediction (or missed pick) for a league member. Body: { home_team, away_team, home_team_score, away_team_score }.
    Use fixture's exact team names. If fixture is completed, game_result is set from scores."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can create predictions for members'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        if not get_league_membership(member_user_id, league_id):
            return make_response({'error': 'User is not a member of this league'}, 404)
        data = request.get_json() or {}
        home_team = (data.get('home_team') or '').strip()
        away_team = (data.get('away_team') or '').strip()
        try:
            home_team_score = int(data.get('home_team_score', 0))
            away_team_score = int(data.get('away_team_score', 0))
        except (TypeError, ValueError):
            return make_response({'error': 'home_team_score and away_team_score must be integers'}, 400)
        if not home_team or not away_team:
            return make_response({'error': 'home_team and away_team are required'}, 400)
        # Find fixture (case-insensitive)
        fixture = Fixture.query.filter_by(
            fixture_home_team=home_team,
            fixture_away_team=away_team
        ).first()
        if not fixture:
            for f in Fixture.query.all():
                if (f.fixture_home_team or '').lower().strip() == home_team.lower() and (f.fixture_away_team or '').lower().strip() == away_team.lower():
                    fixture = f
                    break
        if not fixture:
            return make_response({'error': f'Fixture not found for {home_team} vs {away_team}'}, 404)
        # Use fixture's exact names for the Game
        f_home, f_away = fixture.fixture_home_team, fixture.fixture_away_team
        existing = Game.query.filter_by(user_id=member_user_id, home_team=f_home, away_team=f_away).first()
        if existing:
            return make_response({'error': 'Member already has a prediction for this fixture; use PATCH to update', 'game_id': existing.id}, 400)
        game = Game(
            user_id=member_user_id,
            home_team=f_home,
            away_team=f_away,
            home_team_score=home_team_score,
            away_team_score=away_team_score,
            game_week_name=f"Week {fixture.fixture_round}" if fixture.fixture_round else "Unknown Week",
            game_week=fixture.fixture_date
        )
        if fixture.actual_home_score is not None and fixture.actual_away_score is not None:
            pred_home, pred_away = game.home_team_score, game.away_team_score
            actual_home, actual_away = fixture.actual_home_score, fixture.actual_away_score
            if pred_home == actual_home and pred_away == actual_away:
                game.game_result = 'Win'
            else:
                pred_winner = 'home' if pred_home > pred_away else ('away' if pred_away > pred_home else 'draw')
                actual_winner = 'home' if actual_home > actual_away else ('away' if actual_away > actual_home else 'draw')
                game.game_result = 'Draw' if pred_winner == actual_winner else 'Loss'
        db.session.add(game)
        db.session.flush()
        pred = Prediction.query.filter_by(user_id=member_user_id, game_id=game.id).first()
        if not pred:
            db.session.add(Prediction(user_id=member_user_id, game_id=game.id))
        db.session.commit()
        return make_response({'message': 'Prediction created', 'game': game.to_dict(), 'game_id': game.id}, 201)
    except Exception as e:
        db.session.rollback()
        print(f"Error creating member prediction: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


def _fixture_date_on_or_after_league(fixture, game, league_created_at):
    """True if the fixture/game date is on or after league creation (so it counts for this league's leaderboard)."""
    if league_created_at is None:
        return True
    dt = None
    if fixture and getattr(fixture, 'fixture_date', None) is not None:
        dt = fixture.fixture_date
    elif game and getattr(game, 'game_week', None) is not None:
        dt = game.game_week
    if dt is None:
        return True  # include when date unknown so we don't exclude valid games from scoring
    # Compare as dates when possible so same calendar day counts (avoids timezone/midnight excluding fixtures)
    try:
        dt_date = dt.date() if hasattr(dt, 'date') and callable(getattr(dt, 'date')) else dt
        lc_date = league_created_at.date() if hasattr(league_created_at, 'date') and callable(getattr(league_created_at, 'date')) else league_created_at
        if isinstance(dt_date, date) and isinstance(lc_date, date):
            return dt_date >= lc_date
        if hasattr(dt, 'tzinfo') and hasattr(league_created_at, 'tzinfo'):
            if dt.tzinfo is None and league_created_at.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
            elif dt.tzinfo and league_created_at.tzinfo is None:
                league_created_at = league_created_at.replace(tzinfo=timezone.utc)
        return dt >= league_created_at
    except (TypeError, AttributeError):
        return True


def _fixture_matches_league_competition(fixture, league):
    """True if the fixture belongs to the league's competition (so it counts for this league's leaderboard)."""
    if not fixture:
        return False
    slug = getattr(league, 'competition_slug', None) or 'eng.1'
    comp = getattr(fixture, 'competition_slug', None)
    if slug == 'eng.1':
        return comp in ('eng.1', None, '')  # '' = legacy Pulselive
    return comp == slug


@app.route('/api/v1/leagues/<int:league_id>/leaderboard', methods=['GET'])
def get_league_leaderboard(league_id):
    """Get leaderboard for a league - players ordered by points.
    Only fixtures on or after league.created_at are counted (scoring starts when the league was created)."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        
        league_created_at = getattr(league, 'created_at', None)
        
        # Check if user is a member (and not soft-deleted)
        user = get_active_user_by_id(user_id)
        if not user or user not in league.members:
            return make_response({'error': 'User is not a member of this league'}, 403)
        
        # Helper: compute Win/Draw/Loss from predicted vs actual scores (same logic as check-results).
        # Treat fixture as completed if it has both scores (even when is_completed is False), so leaderboard updates.
        def _result_for_game(game, fixture):
            if not fixture or fixture.actual_home_score is None or fixture.actual_away_score is None:
                return None
            if game.home_team_score is None or game.away_team_score is None:
                return None
            pred_home, pred_away = game.home_team_score, game.away_team_score
            actual_home, actual_away = fixture.actual_home_score, fixture.actual_away_score
            if pred_home == actual_home and pred_away == actual_away:
                return 'Win'
            pred_winner = 'home' if pred_home > pred_away else ('away' if pred_away > pred_home else 'draw')
            actual_winner = 'home' if actual_home > actual_away else ('away' if actual_away > actual_home else 'draw')
            return 'Draw' if pred_winner == actual_winner else 'Loss'

        # Completed fixtures = have both scores (missed pick counts as Loss).
        # Only consider fixtures for this league's competition and on or after league creation.
        league_competition_slug = getattr(league, 'competition_slug', None) or 'eng.1'

        def _member_has_game_for_fixture(member_id, fixture, games_list=None):
            """True if member has a Game (prediction) for this fixture (using league competition for matching)."""
            games = games_list if games_list is not None else Game.query.filter_by(user_id=member_id).all()
            for g in games:
                resolved = _fixture_for_game(g, league_competition_slug, fixtures_list=all_fixtures)
                if resolved and resolved.id == fixture.id:
                    return True
            return False

        comp_filter = _fixture_query_competition(league_competition_slug)
        all_fixtures = (Fixture.query.filter(comp_filter).all() if comp_filter is not None else Fixture.query.all())
        completed_fixtures = Fixture.query.filter(
            Fixture.actual_home_score.isnot(None),
            Fixture.actual_away_score.isnot(None)
        )
        if comp_filter is not None:
            completed_fixtures = completed_fixtures.filter(comp_filter)
        completed_fixtures = completed_fixtures.all()
        completed_fixtures = [f for f in completed_fixtures if _fixture_date_on_or_after_league(f, None, league_created_at)]

        # Preload all games for all league members to avoid N+1 (one query instead of per-member, per-fixture)
        member_ids = [lm.user.id for lm in league.league_memberships if not getattr(lm.user, 'deleted_at', None)]
        all_member_games = Game.query.filter(Game.user_id.in_(member_ids)).all() if member_ids else []
        games_by_user = {}
        for g in all_member_games:
            games_by_user.setdefault(g.user_id, []).append(g)

        debug_data = None
        if request.args.get('debug'):
            debug_data = {
                'league_competition_slug': league_competition_slug,
                'league_created_at': str(league_created_at) if league_created_at else None,
                'all_fixtures_count': len(all_fixtures),
                'completed_fixtures_count': len(completed_fixtures),
                'completed_fixtures_sample': [
                    {'id': f.id, 'home': f.fixture_home_team, 'away': f.fixture_away_team,
                     'actual': (f.actual_home_score, f.actual_away_score), 'comp': getattr(f, 'competition_slug', None), 'round': getattr(f, 'fixture_round', None)}
                    for f in completed_fixtures[:5]
                ],
                'member_ids': member_ids,
                'all_member_games_count': len(all_member_games),
                'games_per_member': {uid: len(games_by_user.get(uid, [])) for uid in member_ids},
                'backfill_sample': [{'user_id': lm.user.id, 'wins': lm.backfill_wins, 'draws': lm.backfill_draws, 'losses': lm.backfill_losses} for lm in league.league_memberships[:5] if not getattr(lm.user, 'deleted_at', None)],
            }

        scope = getattr(league, 'leaderboard_scope', 'full_season')
        if scope == 'weekly':
            # --- Weekly leaderboard: backfill week winners, then return current week standings + weeks_won ---
            all_fixtures_by_round = {}
            q_rounds = Fixture.query.filter(Fixture.fixture_round.isnot(None))
            if comp_filter is not None:
                q_rounds = q_rounds.filter(comp_filter)
            for f in q_rounds.all():
                if _fixture_date_on_or_after_league(f, None, league_created_at):
                    all_fixtures_by_round.setdefault(f.fixture_round, []).append(f)
            # Round is complete if every fixture has both scores, or is marked is_completed (e.g. rescheduled match)
            completed_rounds = []
            for r, flist in all_fixtures_by_round.items():
                if all(
                    (f.actual_home_score is not None and f.actual_away_score is not None)
                    or getattr(f, 'is_completed', False)
                    for f in flist
                ):
                    completed_rounds.append(r)
            # Backfill: award week winner(s) for any completed round we haven't recorded yet
            for round_num in completed_rounds:
                existing = LeagueWeekWinner.query.filter_by(league_id=league_id, fixture_round=round_num).first()
                if existing:
                    continue
                round_fixtures = [f for f in completed_fixtures if f.fixture_round == round_num]
                if not round_fixtures:
                    continue
                # Points per member for this round only
                round_points = {}
                for lm in league.league_memberships:
                    if lm.user.deleted_at:
                        continue
                    wins, draws, losses = 0, 0, 0
                    games = games_by_user.get(lm.user.id, [])
                    for g in games:
                        fixture = _fixture_for_game(g, league_competition_slug, fixtures_list=all_fixtures)
                        if not fixture or fixture.fixture_round != round_num or not _fixture_date_on_or_after_league(fixture, g, league_created_at) or not _fixture_matches_league_competition(fixture, league):
                            continue
                        res = _result_for_game(g, fixture)
                        if res == 'Win':
                            wins += 1
                        elif res == 'Draw':
                            draws += 1
                        elif res == 'Loss':
                            losses += 1
                        elif getattr(g, 'game_result', None) in ('Win', 'Draw', 'Loss'):
                            if g.game_result == 'Win':
                                wins += 1
                            elif g.game_result == 'Draw':
                                draws += 1
                            else:
                                losses += 1
                    rounds_with_pick = set()
                    for g in games:
                        fx = _fixture_for_game(g, league_competition_slug, fixtures_list=all_fixtures)
                        if fx and fx.fixture_round == round_num and _fixture_date_on_or_after_league(fx, g, league_created_at) and _fixture_matches_league_competition(fx, league):
                            rounds_with_pick.add(fx.fixture_round)
                    for f in round_fixtures:
                        if f.fixture_round not in rounds_with_pick:
                            continue
                        if not _member_has_game_for_fixture(lm.user.id, f, games_list=games_by_user.get(lm.user.id, [])):
                            losses += 1
                    pts = (wins * 3) + (draws * 1)
                    round_points[lm.user_id] = (pts, wins, draws, losses)
                if not round_points:
                    continue
                max_pts = max(p[0] for p in round_points.values())
                for uid, (pts, _, _, _) in round_points.items():
                    if pts == max_pts:
                        db.session.add(LeagueWeekWinner(league_id=league_id, fixture_round=round_num, user_id=uid))
            db.session.commit()
            # Current round = lowest round that is not fully completed (the in-progress week); if all complete, use last round
            incomplete_rounds = [r for r in all_fixtures_by_round.keys() if r not in completed_rounds]
            if incomplete_rounds:
                current_round = min(incomplete_rounds)
            else:
                current_round = max(all_fixtures_by_round.keys(), default=None)
            # Optional ?round=N: show leaderboard for that week (e.g. user selected week from dropdown)
            requested_round = request.args.get('round', type=int)
            display_round = requested_round if requested_round is not None else current_round
            if display_round is not None:
                display_round = int(display_round)
            weeks_won_map = {}
            for w in LeagueWeekWinner.query.filter_by(league_id=league_id).all():
                weeks_won_map[w.user_id] = weeks_won_map.get(w.user_id, 0) + 1
            if display_round is None:
                leaderboard = []
                for lm in league.league_memberships:
                    if lm.user.deleted_at:
                        continue
                    leaderboard.append({
                        'user_id': lm.user.id,
                        'display_name': lm.display_name,
                        'wins': 0, 'draws': 0, 'losses': 0, 'points': 0, 'total_games': 0,
                        'weeks_won': weeks_won_map.get(lm.user.id, 0),
                    })
            else:
                def _round_eq(f, r):
                    if f is None or r is None:
                        return False
                    try:
                        return int(f) == int(r)
                    except (TypeError, ValueError):
                        return False
                round_fixtures = [f for f in completed_fixtures if _round_eq(f.fixture_round, display_round)]
                leaderboard = []
                for lm in league.league_memberships:
                    if lm.user.deleted_at:
                        continue
                    wins, draws, losses = 0, 0, 0
                    games = games_by_user.get(lm.user.id, [])
                    for g in games:
                        fixture = _fixture_for_game(g, league_competition_slug, fixtures_list=all_fixtures)
                        if not fixture or not _round_eq(fixture.fixture_round, display_round) or not _fixture_date_on_or_after_league(fixture, g, league_created_at) or not _fixture_matches_league_competition(fixture, league):
                            continue
                        res = _result_for_game(g, fixture)
                        if res == 'Win':
                            wins += 1
                        elif res == 'Draw':
                            draws += 1
                        elif res == 'Loss':
                            losses += 1
                        elif getattr(g, 'game_result', None) in ('Win', 'Draw', 'Loss'):
                            if g.game_result == 'Win':
                                wins += 1
                            elif g.game_result == 'Draw':
                                draws += 1
                            else:
                                losses += 1
                    rounds_with_pick = set()
                    for g in games:
                        fx = _fixture_for_game(g, league_competition_slug, fixtures_list=all_fixtures)
                        if fx and _round_eq(fx.fixture_round, display_round) and _fixture_date_on_or_after_league(fx, g, league_created_at) and _fixture_matches_league_competition(fx, league):
                            rounds_with_pick.add(fx.fixture_round)
                    for f in round_fixtures:
                        if f.fixture_round not in rounds_with_pick:
                            continue
                        if not _member_has_game_for_fixture(lm.user.id, f, games_list=games_by_user.get(lm.user.id, [])):
                            losses += 1
                    points = (wins * 3) + (draws * 1)
                    total_games = wins + draws + losses
                    leaderboard.append({
                        'user_id': lm.user.id,
                        'display_name': lm.display_name,
                        'wins': wins, 'draws': draws, 'losses': losses,
                        'points': points, 'total_games': total_games,
                        'weeks_won': weeks_won_map.get(lm.user.id, 0),
                    })
                leaderboard.sort(key=lambda x: (x['points'], -x['losses'], x['wins'], x['draws']), reverse=True)
            resp = {'leaderboard': leaderboard, 'scope': 'weekly', 'current_round': display_round}
            if debug_data is not None:
                resp['debug'] = debug_data
            return make_response(resp, 200)

        # Full season: backfill + fixture-first scoring. Iterate completed fixtures and match each member's game by team names (same logic as _fixture_matches_game) so leaderboard works after API/team-name changes.
        leaderboard = []
        for lm in league.league_memberships:
            member = lm.user
            if member.deleted_at:
                continue
            wins = lm.backfill_wins or 0
            draws = lm.backfill_draws or 0
            losses = lm.backfill_losses or 0
            games = games_by_user.get(member.id, [])
            # Which rounds does this member have at least one prediction for? (so we can count missed picks as Loss)
            rounds_with_pick = set()
            for f in completed_fixtures:
                if f.fixture_round is not None and _game_for_fixture(f, games) is not None:
                    rounds_with_pick.add(f.fixture_round)
            # Fixture-first: for each completed fixture, find this member's game and score it
            for f in completed_fixtures:
                game = _game_for_fixture(f, games)
                if game is not None:
                    res = _result_for_game(game, f)
                    if res == 'Win':
                        wins += 1
                    elif res == 'Draw':
                        draws += 1
                    elif res == 'Loss':
                        losses += 1
                    elif getattr(game, 'game_result', None) in ('Win', 'Draw', 'Loss'):
                        if game.game_result == 'Win':
                            wins += 1
                        elif game.game_result == 'Draw':
                            draws += 1
                        else:
                            losses += 1
                else:
                    if f.fixture_round is not None and f.fixture_round in rounds_with_pick:
                        losses += 1
            # Fallback: if no completed fixtures in DB (e.g. sync didn't match) but games have game_result from check-results, count those so leaderboard isn't stuck at 0
            if (wins, draws, losses) == (lm.backfill_wins or 0, lm.backfill_draws or 0, lm.backfill_losses or 0) and not completed_fixtures:
                for g in games:
                    gr = getattr(g, 'game_result', None)
                    if gr == 'Win':
                        wins += 1
                    elif gr == 'Draw':
                        draws += 1
                    elif gr == 'Loss':
                        losses += 1
            points = (wins * 3) + (draws * 1) + (losses * 0)
            total_games = wins + draws + losses
            leaderboard.append({
                'user_id': member.id,
                'display_name': lm.display_name,
                'wins': wins,
                'draws': draws,
                'losses': losses,
                'points': points,
                'total_games': total_games,
            })
        
        # Sort by points (descending), then by fewest losses first, then wins, then draws
        leaderboard.sort(key=lambda x: (x['points'], -x['losses'], x['wins'], x['draws']), reverse=True)

        if debug_data and completed_fixtures and member_ids:
            first_member_id = member_ids[0]
            first_fixture = completed_fixtures[0]
            games = games_by_user.get(first_member_id, [])
            matched_game = _game_for_fixture(first_fixture, games)
            debug_data['match_test'] = {
                'first_fixture': {'home': first_fixture.fixture_home_team, 'away': first_fixture.fixture_away_team},
                'first_member_id': first_member_id,
                'games_count': len(games),
                'matched': matched_game is not None,
                'games_sample': [{'home': g.home_team, 'away': g.away_team, 'matches': _fixture_matches_game(first_fixture, g.home_team, g.away_team)} for g in games[:8]],
            }
        
        resp = {'leaderboard': leaderboard, 'scope': 'full_season'}
        if debug_data is not None:
            resp['debug'] = debug_data
        return make_response(resp, 200)
    except Exception as e:
        print(f"Error fetching leaderboard: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/backfill-standings', methods=['GET'])
def get_backfill_standings(league_id):
    """Admin only: return current backfill wins/draws/losses/points for each league member.
    Use this to export a backup before changing backfill, or to recover by re-POSTing the same JSON."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only league admins can view backfill standings'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        standings = []
        for lm in league.league_memberships:
            if getattr(lm.user, 'deleted_at', None):
                continue
            standings.append({
                'display_name': lm.display_name,
                'wins': lm.backfill_wins if lm.backfill_wins is not None else 0,
                'draws': lm.backfill_draws if lm.backfill_draws is not None else 0,
                'losses': lm.backfill_losses if lm.backfill_losses is not None else 0,
                'points': lm.backfill_points if lm.backfill_points is not None else ((lm.backfill_wins or 0) * 3 + (lm.backfill_draws or 0) * 1),
            })
        return make_response({'standings': standings}, 200)
    except Exception as e:
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/leagues/<int:league_id>/backfill-standings', methods=['POST'])
def backfill_league_standings(league_id):
    """Admin only: set wins/draws/losses/points for league members from imported data (e.g. Google Sheet).
    Body: { "standings": [ { "display_name": "Alice", "wins": 5, "draws": 2, "losses": 1, "points": 17 }, ... ] }
    display_name must match an existing league member. Points can be omitted and will be computed as wins*3 + draws*1."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return make_response({'error': 'User not authenticated'}, 401)
        if not is_league_admin(user_id, league_id):
            return make_response({'error': 'Only a league admin can backfill standings'}, 403)
        league = League.query.get(league_id)
        if not league:
            return make_response({'error': 'League not found'}, 404)
        data = request.get_json() or {}
        standings = data.get('standings')
        if not isinstance(standings, list):
            return make_response({'error': 'Body must include "standings": [ { "display_name", "wins", "draws", "losses" } ]'}, 400)
        # Map display_name -> LeagueMembership for this league
        by_display_name = { lm.display_name.strip().lower(): lm for lm in league.league_memberships }
        updated = 0
        for row in standings:
            if not isinstance(row, dict):
                continue
            display_name = (row.get('display_name') or '').strip()
            if not display_name:
                continue
            key = display_name.lower()
            lm = by_display_name.get(key)
            if not lm:
                continue
            try:
                wins = int(row.get('wins', 0)) if row.get('wins') is not None else 0
                draws = int(row.get('draws', 0)) if row.get('draws') is not None else 0
                losses = int(row.get('losses', 0)) if row.get('losses') is not None else 0
                points = int(row['points']) if row.get('points') is not None else (wins * 3) + (draws * 1) + (losses * 0)
            except (TypeError, ValueError):
                continue
            lm.backfill_wins = wins
            lm.backfill_draws = draws
            lm.backfill_losses = losses
            lm.backfill_points = points
            updated += 1
        db.session.commit()
        return make_response({'message': f'Backfilled standings for {updated} member(s)'}, 200)
    except Exception as e:
        db.session.rollback()
        print(f"Error backfilling standings: {str(e)}")
        return make_response({'error': str(e)}, 500)


@app.route('/api/v1/migrate', methods=['POST'])
def run_migrations():
    """
    Run database migrations manually.
    This endpoint allows running migrations without shell access.
    SECURITY: In production, you may want to add authentication or remove this endpoint.
    """
    try:
        from flask_migrate import upgrade
        upgrade()
        return make_response({'message': 'Database migrations completed successfully'}, 200)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Migration error: {str(e)}")
        print(f"Traceback: {error_details}")
        return make_response({'error': str(e), 'details': error_details.split('\n')[-5:]}, 500)


def _dedupe_fixtures():
    """Remove duplicate fixtures (same competition, round, normalized home/away). Keeps one per match.
    Prefer keeping the row with external_id set (football-data/ESPN id); else keep smallest id.
    Returns number of duplicate rows removed.

    Predictions are preserved: Prediction -> game_id -> Game. Games do not store fixture_id; they store
    home_team/away_team. Fixtures are matched to games by team names (with normalization) in _fixture_for_game.
    Dedupe only deletes Fixture rows; Game and Prediction are never touched. The remaining fixture per match
    still matches all existing games by team names."""
    fixtures = Fixture.query.all()
    groups = {}
    for f in fixtures:
        comp = getattr(f, 'competition_slug', None) or ''
        # Legacy Pulselive EPL rows used NULL/'' competition_slug; treat them as eng.1 for dedupe grouping
        # so they collapse with football-data eng.1 rows.
        if comp == '':
            comp = 'eng.1'
        rnd = getattr(f, 'fixture_round', None)
        norm_h = _normalize_team_name_for_match(getattr(f, 'fixture_home_team', None) or '')
        norm_a = _normalize_team_name_for_match(getattr(f, 'fixture_away_team', None) or '')
        key = (comp, rnd, norm_h, norm_a)
        if key not in groups:
            groups[key] = []
        groups[key].append(f)
    deleted = 0
    for key, group in groups.items():
        if len(group) <= 1:
            continue
        group.sort(key=lambda x: (0 if (getattr(x, 'external_id', None) or '').strip() else 1, x.id))
        for dup in group[1:]:
            db.session.delete(dup)
            deleted += 1
    if deleted:
        db.session.commit()
    return deleted


# CLI: dedupe fixtures by (competition_slug, round, normalized home/away); keeps one row per match
@app.cli.command('dedupe-fixtures')
def dedupe_fixtures_cmd():
    """Remove duplicate fixtures (same competition, round, normalized home/away). Keeps one per match. Run from server dir: flask dedupe-fixtures."""
    with app.app_context():
        deleted = _dedupe_fixtures()
        if deleted:
            print(f"Dedupe complete: removed {deleted} duplicate fixture(s).")
        else:
            print("No duplicate fixtures found.")


# SPA fallback: serve React app's index.html for non-API GET requests (fixes refresh 404)
_CLIENT_BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'build')


@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def serve_spa(path):
    """Serve the React app for any GET that isn't API/uploads so client-side routing works on refresh."""
    if path.startswith('api/') or path.startswith('uploads/'):
        return make_response({'error': 'Not found'}, 404)
    if not os.path.isdir(_CLIENT_BUILD):
        return make_response({'error': 'Not found'}, 404)
    # If the path exists as a file (e.g. /static/js/main.xxx.js), serve it
    full_path = os.path.join(_CLIENT_BUILD, path)
    if path and os.path.isfile(full_path):
        return send_from_directory(_CLIENT_BUILD, path)
    return send_from_directory(_CLIENT_BUILD, 'index.html')


if __name__ == '__main__':
    import os
    port = int(os.getenv('PORT', 5555))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    app.run(port=port, host=host, debug=debug)

