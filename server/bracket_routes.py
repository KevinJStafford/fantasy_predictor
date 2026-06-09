"""Bracket challenge API routes (tournament-centric, solo play)."""
from datetime import datetime, timezone

from flask import make_response, request

from config import db
from models import BracketEntry, BracketPick, GroupPrediction, TournamentEdition, TournamentGroupTeam
from tournament_engine import (
    apply_group_prediction_row,
    count_knockout_matches,
    downstream_match_keys,
    group_prediction_is_complete,
    resolve_bracket,
    validate_bracket_pick,
    validate_group_prediction,
)


def _edition_is_locked(edition):
    if not edition or not edition.bracket_lock_at:
        return False
    lock_at = edition.bracket_lock_at
    if getattr(lock_at, 'tzinfo', None):
        lock_at = lock_at.replace(tzinfo=None)
    return datetime.now(timezone.utc).replace(tzinfo=None) >= lock_at


def _bracket_completion_metrics(entry, edition):
    draw_groups = _draw_group_keys(edition.id)
    groups_required = len(draw_groups) or edition.num_groups
    predictions = list(entry.group_predictions.all())
    groups_complete = sum(1 for g in draw_groups if any(
        gp.group_key == g and group_prediction_is_complete(gp) for gp in predictions
    ))
    knockout_required = count_knockout_matches(edition.slug)
    knockout_complete = entry.bracket_picks.count()
    return groups_complete, groups_required, knockout_complete, knockout_required


def _bracket_entry_is_complete(entry, edition):
    groups_complete, groups_required, knockout_complete, knockout_required = (
        _bracket_completion_metrics(entry, edition)
    )
    if not knockout_required:
        return False
    return (
        groups_complete >= groups_required
        and knockout_complete >= knockout_required
    )


def _sync_entry_submission_status(entry, edition):
    """Mark complete brackets as submitted; revert to draft if picks are cleared."""
    if entry.status == 'locked':
        return False

    complete = _bracket_entry_is_complete(entry, edition)
    changed = False

    if complete and entry.status == 'draft':
        entry.status = 'submitted'
        if not entry.submitted_at:
            entry.submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        changed = True
    elif not complete and entry.status == 'submitted':
        entry.status = 'draft'
        entry.submitted_at = None
        changed = True

    return changed


def _submission_count(edition_id):
    edition = TournamentEdition.query.get(edition_id)
    if not edition:
        return 0
    total = 0
    for entry in BracketEntry.query.filter_by(edition_id=edition_id).all():
        if entry.status in ('submitted', 'locked') or _bracket_entry_is_complete(entry, edition):
            total += 1
    return total


def _edition_by_slug(edition_slug):
    return TournamentEdition.query.filter_by(slug=edition_slug).first()


def _groups_for_edition(edition_id):
    rows = (
        TournamentGroupTeam.query.filter_by(edition_id=edition_id)
        .order_by(TournamentGroupTeam.group_key, TournamentGroupTeam.team_name)
        .all()
    )
    groups = {}
    for row in rows:
        groups.setdefault(row.group_key, []).append(row.team_name)
    return groups


def _draw_group_keys(edition_id):
    """Group letters from the official draw (same keys as GET /tournaments/:slug groups)."""
    return sorted(_groups_for_edition(edition_id).keys())


def _team_stats(team, points, goal_diff, goals_scored):
    if not team:
        return None
    return {
        'team': team,
        'points': points,
        'goal_diff': goal_diff,
        'goals_scored': goals_scored,
    }


def _group_prediction_to_dict(gp):
    return {
        'group_key': gp.group_key,
        'winner': _team_stats(gp.winner_team, gp.winner_points, gp.winner_goal_diff, gp.winner_goals_scored),
        'runner_up_1': _team_stats(
            gp.runner_up_1_team, gp.runner_up_1_points, gp.runner_up_1_goal_diff, gp.runner_up_1_goals_scored
        ),
        'runner_up_2': _team_stats(
            gp.runner_up_2_team, gp.runner_up_2_points, gp.runner_up_2_goal_diff, gp.runner_up_2_goals_scored
        ),
    }


def _entry_is_editable(entry, edition):
    if _edition_is_locked(edition):
        return False
    if entry and entry.status == 'locked':
        return False
    return True


def _get_or_create_entry(user_id, edition):
    entry = BracketEntry.query.filter_by(user_id=user_id, edition_id=edition.id).first()
    if entry:
        return entry
    entry = BracketEntry(user_id=user_id, edition_id=edition.id, status='draft')
    db.session.add(entry)
    db.session.flush()
    return entry


def _entry_summary(entry, edition):
    groups_complete, groups_required, knockout_complete, knockout_required = (
        _bracket_completion_metrics(entry, edition)
    )
    is_complete = (
        bool(knockout_required)
        and groups_complete >= groups_required
        and knockout_complete >= knockout_required
    )
    return {
        'id': entry.id,
        'status': entry.status,
        'group_points': entry.group_points,
        'bracket_points': entry.bracket_points,
        'total_points': entry.total_points,
        'champion_pick': entry.champion_pick,
        'submitted_at': entry.submitted_at.isoformat() if entry.submitted_at else None,
        'groups_complete': groups_complete,
        'groups_required': groups_required,
        'knockout_complete': knockout_complete,
        'knockout_required': knockout_required,
        'incomplete_groups': _incomplete_draw_groups(entry, edition),
        'is_complete': is_complete,
    }


def _incomplete_draw_groups(entry, edition):
    draw_groups = _draw_group_keys(edition.id)
    predictions = {gp.group_key: gp for gp in entry.group_predictions.all()}
    return [
        g for g in draw_groups
        if g not in predictions or not group_prediction_is_complete(predictions[g])
    ]


def _bootstrap_bracket_editions_if_needed(app):
    """Ensure default editions exist and the WC 2026 draw stays in sync (no placeholders)."""
    if app.config.get('TESTING'):
        return
    try:
        from scripts.seed_bracket_editions import ensure_default_bracket_editions
        ensure_default_bracket_editions()
    except Exception as e:
        print(f'Bracket edition bootstrap skipped: {e}')


def register_bracket_routes(app, get_current_user_id=None):
    """Register tournament/bracket endpoints on the Flask app."""

    @app.route('/api/v1/tournaments/active', methods=['GET'])
    def get_active_tournaments():
        """List tournament editions open for bracket play."""
        try:
            _bootstrap_bracket_editions_if_needed(app)
            editions = (
                TournamentEdition.query.filter_by(is_active=True)
                .order_by(TournamentEdition.year.desc(), TournamentEdition.name)
                .all()
            )
            payload = [
                e.to_public_dict(submission_count=_submission_count(e.id))
                for e in editions
            ]
            return make_response({'editions': payload}, 200)
        except Exception as e:
            print(f"Error listing active tournaments: {e}")
            return make_response({'error': str(e)}, 500)

    @app.route('/api/v1/tournaments/<edition_slug>', methods=['GET'])
    def get_tournament_edition(edition_slug):
        """Tournament edition metadata and official group draw."""
        try:
            _bootstrap_bracket_editions_if_needed(app)
            edition = _edition_by_slug(edition_slug)
            if not edition:
                return make_response({'error': 'Tournament not found'}, 404)

            data = edition.to_public_dict(submission_count=_submission_count(edition.id))
            data['groups'] = _groups_for_edition(edition.id)
            return make_response({'edition': data}, 200)
        except Exception as e:
            print(f"Error fetching tournament {edition_slug}: {e}")
            return make_response({'error': str(e)}, 500)

    if get_current_user_id is not None:

        @app.route('/api/v1/tournaments/<edition_slug>/bracket/me', methods=['GET'])
        def get_my_bracket_entry(edition_slug):
            """Current user's bracket entry for this tournament (draft or submitted)."""
            try:
                user_id = get_current_user_id()
                if not user_id:
                    return make_response({'error': 'User not authenticated'}, 401)

                edition = _edition_by_slug(edition_slug)
                if not edition:
                    return make_response({'error': 'Tournament not found'}, 404)

                entry = BracketEntry.query.filter_by(user_id=user_id, edition_id=edition.id).first()
                is_locked = _edition_is_locked(edition)

                if not entry:
                    draw_groups = _draw_group_keys(edition.id)
                    return make_response({
                        'entry': None,
                        'status': 'not_started',
                        'group_predictions': [],
                        'bracket_picks': [],
                        'is_locked': is_locked,
                        'edition': edition.to_public_dict(
                            submission_count=_submission_count(edition.id),
                        ),
                        'groups_required': len(draw_groups) or edition.num_groups,
                    }, 200)

                if _sync_entry_submission_status(entry, edition):
                    db.session.commit()

                summary = _entry_summary(entry, edition)
                return make_response({
                    'entry': summary,
                    'incomplete_groups': summary['incomplete_groups'],
                    'group_predictions': [
                        _group_prediction_to_dict(gp)
                        for gp in entry.group_predictions.order_by(GroupPrediction.group_key)
                    ],
                    'bracket_picks': [
                        {'match_key': p.match_key, 'picked_team': p.picked_team}
                        for p in entry.bracket_picks.order_by(BracketPick.match_key)
                    ],
                    'is_locked': is_locked or entry.status == 'locked',
                    'edition': edition.to_public_dict(
                        submission_count=_submission_count(edition.id),
                    ),
                }, 200)
            except Exception as e:
                print(f"Error fetching bracket entry for {edition_slug}: {e}")
                return make_response({'error': str(e)}, 500)

        @app.route('/api/v1/tournaments/<edition_slug>/bracket/groups', methods=['PUT'])
        def save_group_predictions(edition_slug):
            """Save or update group table predictions (partial saves allowed)."""
            try:
                user_id = get_current_user_id()
                if not user_id:
                    return make_response({'error': 'User not authenticated'}, 401)

                edition = _edition_by_slug(edition_slug)
                if not edition:
                    return make_response({'error': 'Tournament not found'}, 404)

                if _edition_is_locked(edition):
                    return make_response({'error': 'Bracket is locked'}, 403)

                body = request.get_json() or {}
                groups_payload = body.get('groups')
                if not isinstance(groups_payload, list) or not groups_payload:
                    return make_response({'error': 'groups array is required'}, 400)

                draw = _groups_for_edition(edition.id)
                entry = _get_or_create_entry(user_id, edition)
                if not _entry_is_editable(entry, edition):
                    return make_response({'error': 'Bracket can no longer be edited'}, 403)

                validation_errors = {}
                validated = []

                for item in groups_payload:
                    group_key = (item.get('group_key') or '').strip().upper()
                    if not group_key:
                        validation_errors['_'] = validation_errors.get('_', []) + ['group_key is required']
                        continue
                    if group_key not in draw:
                        validation_errors[group_key] = [f'Group {group_key} is not in this tournament draw']
                        continue

                    data, errs = validate_group_prediction(
                        group_key,
                        draw[group_key],
                        item.get('winner'),
                        item.get('runner_up_1'),
                        item.get('runner_up_2'),
                    )
                    if errs:
                        validation_errors[group_key] = errs
                    else:
                        validated.append(data)

                if validation_errors:
                    return make_response({'error': 'Validation failed', 'groups': validation_errors}, 422)

                for data in validated:
                    gp = GroupPrediction.query.filter_by(
                        bracket_entry_id=entry.id,
                        group_key=data['group_key'],
                    ).first()
                    if not gp:
                        gp = GroupPrediction(bracket_entry_id=entry.id, group_key=data['group_key'])
                        db.session.add(gp)
                    apply_group_prediction_row(gp, data)

                _sync_entry_submission_status(entry, edition)
                db.session.commit()

                summary = _entry_summary(entry, edition)
                return make_response({
                    'entry': summary,
                    'incomplete_groups': summary['incomplete_groups'],
                    'group_predictions': [
                        _group_prediction_to_dict(gp)
                        for gp in entry.group_predictions.order_by(GroupPrediction.group_key)
                    ],
                }, 200)
            except Exception as e:
                db.session.rollback()
                print(f"Error saving group predictions for {edition_slug}: {e}")
                return make_response({'error': str(e)}, 500)

        @app.route('/api/v1/tournaments/<edition_slug>/bracket/picks', methods=['PUT'])
        def save_bracket_picks(edition_slug):
            """Save knockout winner pick(s); clears downstream picks when an upstream pick changes."""
            try:
                user_id = get_current_user_id()
                if not user_id:
                    return make_response({'error': 'User not authenticated'}, 401)

                edition = _edition_by_slug(edition_slug)
                if not edition:
                    return make_response({'error': 'Tournament not found'}, 404)

                if _edition_is_locked(edition):
                    return make_response({'error': 'Bracket is locked'}, 403)

                body = request.get_json() or {}
                picks_payload = body.get('picks')
                if not isinstance(picks_payload, list) or not picks_payload:
                    return make_response({'error': 'picks array is required'}, 400)

                entry = _get_or_create_entry(user_id, edition)
                if not _entry_is_editable(entry, edition):
                    return make_response({'error': 'Bracket can no longer be edited'}, 403)

                missing = _incomplete_draw_groups(entry, edition)
                if missing:
                    return make_response({
                        'error': 'Group predictions incomplete',
                        'incomplete_groups': missing,
                    }, 400)

                draw_group_keys = _draw_group_keys(edition.id)
                existing_picks = {p.match_key: p.picked_team for p in entry.bracket_picks.all()}

                try:
                    resolved = resolve_bracket(
                        edition.slug,
                        list(entry.group_predictions.all()),
                        draw_group_keys,
                        edition.third_place_advance,
                        picks=existing_picks,
                    )
                except ValueError as exc:
                    return make_response({'error': str(exc)}, 400)

                match_by_key = {}
                for round_data in resolved.get('rounds', []):
                    for match in round_data.get('matches', []):
                        match_by_key[match['match_key']] = match

                validation_errors = {}
                for item in picks_payload:
                    match_key = (item.get('match_key') or '').strip()
                    picked_team = (item.get('picked_team') or '').strip()
                    if not match_key:
                        validation_errors['_'] = validation_errors.get('_', []) + ['match_key is required']
                        continue

                    match = match_by_key.get(match_key)
                    if not match:
                        validation_errors[match_key] = [f'Unknown match {match_key}']
                        continue

                    errs = validate_bracket_pick(match, picked_team)
                    if errs:
                        validation_errors[match_key] = errs
                        continue

                    existing = BracketPick.query.filter_by(
                        bracket_entry_id=entry.id,
                        match_key=match_key,
                    ).first()

                    if existing and existing.picked_team != picked_team:
                        for downstream_key in downstream_match_keys(edition.slug, match_key):
                            BracketPick.query.filter_by(
                                bracket_entry_id=entry.id,
                                match_key=downstream_key,
                            ).delete(synchronize_session=False)

                    if existing:
                        existing.picked_team = picked_team
                    else:
                        db.session.add(BracketPick(
                            bracket_entry_id=entry.id,
                            match_key=match_key,
                            picked_team=picked_team,
                        ))

                if validation_errors:
                    return make_response({'error': 'Validation failed', 'picks': validation_errors}, 422)

                db.session.flush()
                all_picks = {p.match_key: p.picked_team for p in entry.bracket_picks.all()}
                entry.champion_pick = all_picks.get('final-M104')
                _sync_entry_submission_status(entry, edition)
                db.session.commit()

                try:
                    resolved = resolve_bracket(
                        edition.slug,
                        list(entry.group_predictions.all()),
                        draw_group_keys,
                        edition.third_place_advance,
                        picks=all_picks,
                    )
                except ValueError as exc:
                    return make_response({'error': str(exc)}, 400)

                summary = _entry_summary(entry, edition)
                return make_response({
                    'entry': summary,
                    'resolved': resolved,
                    'bracket_picks': [
                        {'match_key': p.match_key, 'picked_team': p.picked_team}
                        for p in entry.bracket_picks.order_by(BracketPick.match_key)
                    ],
                }, 200)
            except Exception as e:
                db.session.rollback()
                print(f"Error saving bracket picks for {edition_slug}: {e}")
                return make_response({'error': str(e)}, 500)

        @app.route('/api/v1/tournaments/<edition_slug>/bracket/resolved', methods=['GET'])
        def get_resolved_bracket(edition_slug):
            """Resolved knockout tree from the user's group predictions."""
            try:
                user_id = get_current_user_id()
                if not user_id:
                    return make_response({'error': 'User not authenticated'}, 401)

                edition = _edition_by_slug(edition_slug)
                if not edition:
                    return make_response({'error': 'Tournament not found'}, 404)

                entry = BracketEntry.query.filter_by(user_id=user_id, edition_id=edition.id).first()
                if not entry:
                    return make_response({'error': 'No bracket entry found'}, 404)

                missing = _incomplete_draw_groups(entry, edition)
                if missing:
                    return make_response({
                        'error': 'Group predictions incomplete',
                        'incomplete_groups': missing,
                    }, 400)

                draw_group_keys = _draw_group_keys(edition.id)
                picks = {p.match_key: p.picked_team for p in entry.bracket_picks.all()}
                try:
                    resolved = resolve_bracket(
                        edition.slug,
                        list(entry.group_predictions.all()),
                        draw_group_keys,
                        edition.third_place_advance,
                        picks=picks,
                    )
                except ValueError as exc:
                    return make_response({'error': str(exc)}, 400)

                return make_response(resolved, 200)
            except Exception as e:
                print(f"Error resolving bracket for {edition_slug}: {e}")
                return make_response({'error': str(e)}, 500)
