#!/usr/bin/env python3
"""
Wipe all leagues and users (and their dependent data: league memberships, predictions, games).
Fixtures are left intact.

Run from project root with the app's environment (e.g. DATABASE_URL set):
  cd server && python wipe_leagues_and_users.py

Or with pipenv:
  cd server && pipenv run python wipe_leagues_and_users.py

For production (Render), set DATABASE_URL and run the same way in a one-off shell.
"""
import sys
import os

# Run from server directory so app and models can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import LeagueMembership, League, Prediction, Game, User


def _redact_url(url):
    """Hide password in DATABASE_URL for safe printing."""
    if not url or "@" not in url:
        return url
    try:
        from urllib.parse import urlparse, urlunparse
        p = urlparse(url)
        if p.password:
            netloc = p.netloc.replace(f":{p.password}@", ":****@", 1)
            p = p._replace(netloc=netloc)
        return urlunparse(p)
    except Exception:
        return "(url hidden)"

def wipe():
    with app.app_context():
        db_url = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        print(f"Using database: {_redact_url(db_url)}")
        # Delete in order to respect foreign keys
        lm_count = db.session.query(LeagueMembership).delete()
        league_count = db.session.query(League).delete()
        pred_count = db.session.query(Prediction).delete()
        game_count = db.session.query(Game).delete()
        user_count = db.session.query(User).delete()
        db.session.commit()
        print(f"Deleted: {lm_count} league memberships, {league_count} leagues, {pred_count} predictions, {game_count} games, {user_count} users.")
        print("Fixtures were left unchanged.")


if __name__ == "__main__":
    if os.environ.get("WIPE_CONFIRM") != "yes":
        confirm = input("This will DELETE all leagues and users (and their predictions/games). Type 'yes' to confirm: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(1)
    wipe()
