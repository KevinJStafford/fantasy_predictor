#!/usr/bin/env python3
"""Seed tournament editions for bracket challenges. Run from server/: python scripts/seed_bracket_editions.py"""
import os
import sys
from datetime import datetime

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from sqlalchemy.exc import IntegrityError

from config import app, db  # noqa: E402
from models import (  # noqa: E402
    BracketEntry,
    BracketPick,
    GroupPrediction,
    TournamentEdition,
    TournamentGroupTeam,
)
from tournament_rules.wc_2026_groups import WC_2026_GROUPS, WC_2026_TEAM_RENAMES  # noqa: E402


def _rename_team(value):
    if not value:
        return value
    return WC_2026_TEAM_RENAMES.get(value, value)


def _sync_group_teams(edition_id):
    """Align stored draw with WC_2026_GROUPS; drop replaced placeholders."""
    changed = 0
    for group_key, teams in WC_2026_GROUPS.items():
        desired = set(teams)
        rows = TournamentGroupTeam.query.filter_by(
            edition_id=edition_id, group_key=group_key
        ).all()
        existing_names = {row.team_name for row in rows}

        for row in rows:
            if row.team_name not in desired:
                db.session.delete(row)
                changed += 1

        for team_name in teams:
            if team_name in existing_names:
                continue
            db.session.add(
                TournamentGroupTeam(
                    edition_id=edition_id,
                    group_key=group_key,
                    team_name=team_name,
                )
            )
            changed += 1
    return changed


def _migrate_saved_team_names(edition_id):
    """Update saved group/knockout picks that still use placeholder or old team names."""
    changed = 0
    entry_ids = [
        row.id for row in BracketEntry.query.filter_by(edition_id=edition_id).all()
    ]
    if not entry_ids:
        return 0

    for prediction in GroupPrediction.query.filter(
        GroupPrediction.bracket_entry_id.in_(entry_ids)
    ).all():
        for field in ('winner_team', 'runner_up_1_team', 'runner_up_2_team'):
            old = getattr(prediction, field)
            new = _rename_team(old)
            if new != old:
                setattr(prediction, field, new)
                changed += 1

    for pick in BracketPick.query.filter(
        BracketPick.bracket_entry_id.in_(entry_ids)
    ).all():
        new_team = _rename_team(pick.picked_team)
        if new_team != pick.picked_team:
            pick.picked_team = new_team
            changed += 1

    for entry in BracketEntry.query.filter_by(edition_id=edition_id).all():
        new_champion = _rename_team(entry.champion_pick)
        if new_champion != entry.champion_pick:
            entry.champion_pick = new_champion
            changed += 1

    return changed


def ensure_default_bracket_editions():
    """Idempotent: ensure FIFA World Cup 2026 is present and active with the official draw."""
    edition = TournamentEdition.query.filter_by(slug='fifa-world-2026').first()
    created = False
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
        created = True
        print(f'Created edition: {edition.slug}')
    elif not edition.is_active:
        edition.is_active = True
        print(f'Activated edition: {edition.slug}')

    draw_changes = _sync_group_teams(edition.id)
    pick_changes = _migrate_saved_team_names(edition.id)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        edition = TournamentEdition.query.filter_by(slug='fifa-world-2026').first()
    if created or draw_changes or pick_changes:
        print(
            f'Bracket seed complete for {edition.slug}: '
            f'{draw_changes} draw change(s), {pick_changes} saved pick rename(s).'
        )
    return edition


def seed():
    with app.app_context():
        ensure_default_bracket_editions()


if __name__ == '__main__':
    seed()
