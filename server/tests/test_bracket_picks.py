"""Tests for knockout bracket picks and tree resolution."""
from datetime import datetime

import app as flask_app
from models import BracketEntry, BracketPick, GroupPrediction, TournamentEdition, TournamentGroupTeam, User
from tournament_engine import downstream_match_keys, resolve_bracket
from tournament_rules.wc_2026_groups import wc_2026_bracket_lock_at_utc


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


def _seed_minimal_edition():
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

    from tournament_rules.wc_2026_groups import WC_2026_GROUPS

    groups = WC_2026_GROUPS
    for group_key, teams in groups.items():
        for team_name in teams:
            db.session.add(TournamentGroupTeam(
                edition_id=edition.id, group_key=group_key, team_name=team_name,
            ))

    user = User(email='picks@smoke.test')
    user.password_hash = 'password'
    db.session.add(user)
    db.session.commit()
    return edition, user


def _complete_group_predictions(entry_id, edition_id):
    from config import db

    rows = TournamentGroupTeam.query.filter_by(edition_id=edition_id).order_by(
        TournamentGroupTeam.group_key, TournamentGroupTeam.team_name
    ).all()
    by_group = {}
    for row in rows:
        by_group.setdefault(row.group_key, []).append(row.team_name)

    predictions = []
    for letter, teams in sorted(by_group.items()):
        gp = GroupPrediction(
            bracket_entry_id=entry_id,
            group_key=letter,
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
        db.session.add(gp)
        predictions.append(gp)
    db.session.commit()
    return predictions


def test_downstream_cascade_from_r32():
    downstream = downstream_match_keys('fifa-world-2026', 'r32-M73')
    assert 'r16-M90' in downstream
    assert 'qf-M97' in downstream
    assert 'sf-M101' in downstream
    assert 'final-M104' in downstream


def test_resolve_bracket_fills_later_rounds_from_picks():
    _create_tables()
    try:
        with flask_app.app.app_context():
            edition, user = _seed_minimal_edition()
            entry = BracketEntry(user_id=user.id, edition_id=edition.id, status='draft')
            from config import db
            db.session.add(entry)
            db.session.flush()
            predictions = _complete_group_predictions(entry.id, edition.id)
            draw_keys = list('ABCDEFGHIJKL')

            resolved = resolve_bracket(
                edition.slug, predictions, draw_keys, edition.third_place_advance, picks={},
            )
            assert len(resolved['rounds']) == 5
            r16 = next(r for r in resolved['rounds'] if r['round_key'] == 'r16')
            assert r16['matches'][0]['home']['team'] is None

            r32_match = resolved['rounds'][0]['matches'][0]
            home = r32_match['home']['team']
            picks = {r32_match['match_key']: home}
            resolved2 = resolve_bracket(
                edition.slug, predictions, draw_keys, edition.third_place_advance, picks=picks,
            )
            r16_2 = next(r for r in resolved2['rounds'] if r['round_key'] == 'r16')
            m90 = next(m for m in r16_2['matches'] if m['match_key'] == 'r16-M90')
            assert m90['home']['team'] == home
    finally:
        _drop_tables()
