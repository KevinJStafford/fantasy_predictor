#!/usr/bin/env python3
"""Seed tournament editions for bracket challenges. Run from server/: python scripts/seed_bracket_editions.py"""
import os
import sys
from datetime import datetime

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from config import app, db  # noqa: E402
from models import TournamentEdition, TournamentGroupTeam  # noqa: E402


# Groups A–D from current draw; E–L placeholders for full 12-group bracket resolution.
WC_2026_GROUPS = {
    'A': ['Mexico', 'South Africa', 'Korea Republic', 'Czech Republic'],
    'B': ['Canada', 'Switzerland', 'Qatar', 'Playoff D'],
    'C': ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
    'D': ['United States', 'Paraguay', 'Australia', 'Playoff C'],
    'E': ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
    'F': ['Netherlands', 'Japan', 'UEFA Playoff', 'Tunisia'],
    'G': ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
    'H': ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
    'I': ['France', 'Senegal', 'Norway', 'IC Playoff 2'],
    'J': ['Argentina', 'Algeria', 'Austria', 'Jordan'],
    'K': ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
    'L': ['England', 'Croatia', 'Ghana', 'Panama'],
}


def seed():
    with app.app_context():
        edition = TournamentEdition.query.filter_by(slug='fifa-world-2026').first()
        if not edition:
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
            print(f'Created edition: {edition.slug}')
        else:
            edition.is_active = True
            print(f'Edition already exists: {edition.slug}')

        existing = {
            (row.group_key, row.team_name)
            for row in TournamentGroupTeam.query.filter_by(edition_id=edition.id).all()
        }
        added = 0
        for group_key, teams in WC_2026_GROUPS.items():
            for team_name in teams:
                key = (group_key, team_name)
                if key in existing:
                    continue
                db.session.add(
                    TournamentGroupTeam(
                        edition_id=edition.id,
                        group_key=group_key,
                        team_name=team_name,
                    )
                )
                added += 1

        db.session.commit()
        print(f'Seed complete. Added {added} group team(s) for {edition.slug}.')


if __name__ == '__main__':
    seed()
