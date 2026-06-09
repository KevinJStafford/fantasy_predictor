"""Tests for bracket submission status when groups and knockout picks are complete."""
from datetime import datetime

import app as flask_app
from models import BracketEntry, BracketPick, GroupPrediction, TournamentEdition, TournamentGroupTeam, User
from tournament_rules.wc_2026_groups import WC_2026_GROUPS, wc_2026_bracket_lock_at_utc


def _create_tables():
    from config import db

    for table in (
        TournamentEdition.__table__,
        TournamentGroupTeam.__table__,
        BracketEntry.__table__,
        GroupPrediction.__table__,
        BracketPick.__table__,
        User.__table__,
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
        User.__table__,
    ):
        table.drop(db.engine, checkfirst=True)


def _seed_complete_entry():
    from config import db

    edition = TournamentEdition(
        competition_slug='fifa.world',
        year=2026,
        slug='fifa-world-2026',
        name='FIFA World Cup 2026',
        num_groups=12,
        third_place_advance=8,
        bracket_lock_at=wc_2026_bracket_lock_at_utc(),
        is_active=True,
    )
    db.session.add(edition)
    db.session.flush()

    for group_key, teams in WC_2026_GROUPS.items():
        for team_name in teams:
            db.session.add(
                TournamentGroupTeam(
                    edition_id=edition.id,
                    group_key=group_key,
                    team_name=team_name,
                )
            )

    user = User(email='complete@smoke.test')
    user.password_hash = 'password'
    db.session.add(user)
    db.session.flush()

    entry = BracketEntry(user_id=user.id, edition_id=edition.id, status='draft')
    db.session.add(entry)
    db.session.flush()

    for group_key, teams in WC_2026_GROUPS.items():
        db.session.add(
            GroupPrediction(
                bracket_entry_id=entry.id,
                group_key=group_key,
                winner_team=teams[0],
                winner_points=9,
                winner_goal_diff=3,
                winner_goals_scored=5,
                runner_up_1_team=teams[1],
                runner_up_1_points=6,
                runner_up_1_goal_diff=1,
                runner_up_1_goals_scored=3,
                runner_up_2_team=teams[2],
                runner_up_2_points=3,
                runner_up_2_goal_diff=0,
                runner_up_2_goals_scored=2,
            )
        )

    for idx in range(31):
        db.session.add(
            BracketPick(
                bracket_entry_id=entry.id,
                match_key=f'pick-{idx}',
                picked_team='Mexico',
            )
        )

    db.session.commit()
    return edition, user, entry


def test_complete_bracket_marks_submitted_on_load(client):
    _create_tables()
    try:
        with client.application.app_context():
            edition, user, entry = _seed_complete_entry()
            token = flask_app.generate_token(user.id)
            if isinstance(token, bytes):
                token = token.decode('utf-8')
            headers = {'Authorization': f'Bearer {token}'}

        resp = client.get('/api/v1/tournaments/fifa-world-2026/bracket/me', headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['entry']['status'] == 'submitted'
        assert data['entry']['is_complete'] is True
        assert data['entry']['submitted_at'] is not None

        hub = client.get('/api/v1/tournaments/active')
        assert hub.status_code == 200
        editions = hub.get_json()['editions']
        wc = next(e for e in editions if e['slug'] == 'fifa-world-2026')
        assert wc['submission_count'] >= 1
    finally:
        _drop_tables()
