"""Resolve group predictions into knockout bracket slots."""
from tournament_rules.fifa_world_2026 import (
    BRACKET_LAYOUT,
    KNOCKOUT_ROUNDS,
    R32_MATCHES,
    THIRD_PLACE_SCENARIOS,
)

POINTS_MIN, POINTS_MAX = 0, 9
GF_MIN = 0

RULES_BY_SLUG = {
    'fifa-world-2026': {
        'r32_matches': R32_MATCHES,
        'third_place_scenarios': THIRD_PLACE_SCENARIOS,
        'knockout_rounds': KNOCKOUT_ROUNDS,
        'bracket_layout': BRACKET_LAYOUT,
    },
}


def rank_key(points, goal_diff, goals_scored):
    return (points, goal_diff, goals_scored)


def _parse_int(value, field_name, min_val=None, max_val=None):
    if value is None or value == '':
        return None, f'{field_name} is required'
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None, f'{field_name} must be an integer'
    if min_val is not None and n < min_val:
        return None, f'{field_name} must be at least {min_val}'
    if max_val is not None and n > max_val:
        return None, f'{field_name} must be at most {max_val}'
    return n, None


def _ranking_error(above_label, below_label, above_key, below_key):
    """Explain which tiebreaker failed between two predicted finishers."""
    if above_key[0] < below_key[0]:
        return f'{above_label} must have more points than {below_label}'
    if above_key[0] == below_key[0] and above_key[1] < below_key[1]:
        return (
            f'{above_label} is tied with {below_label} on points — '
            f'must have a better goal difference'
        )
    if (
        above_key[0] == below_key[0]
        and above_key[1] == below_key[1]
        and above_key[2] == below_key[2]
    ):
        return (
            f'{above_label} and {below_label} are tied on points, goal difference, '
            f'and goals scored — adjust stats to break the tie'
        )
    if above_key[0] == below_key[0] and above_key[1] == below_key[1]:
        return (
            f'{above_label} is tied with {below_label} on points and goal difference — '
            f'must have more goals scored'
        )
    return f'{above_label} must rank above {below_label}'


def _normalize_team_payload(payload):
    if not payload or not isinstance(payload, dict):
        return None
    team = (payload.get('team') or '').strip()
    if not team:
        return None
    points, err = _parse_int(payload.get('points'), 'points', POINTS_MIN, POINTS_MAX)
    if err:
        return {'error': err}
    goal_diff, err = _parse_int(payload.get('goal_diff'), 'goal difference')
    if err:
        return {'error': err}
    goals_scored, err = _parse_int(payload.get('goals_scored'), 'goals scored', GF_MIN)
    if err:
        return {'error': err}
    return {
        'team': team,
        'points': points,
        'goal_diff': goal_diff,
        'goals_scored': goals_scored,
    }


def validate_group_prediction(group_key, valid_teams, winner_payload, runner_up_1_payload, runner_up_2_payload):
    """Validate one group table prediction. Returns (data_dict, errors_list)."""
    errors = []
    winner = _normalize_team_payload(winner_payload)
    runner_up_1 = _normalize_team_payload(runner_up_1_payload)
    runner_up_2 = _normalize_team_payload(runner_up_2_payload)

    row_labels = {
        'winner': 'Group Winner',
        'runner_up_1': 'Second',
        'runner_up_2': 'Third',
    }
    for key, parsed in (('winner', winner), ('runner_up_1', runner_up_1), ('runner_up_2', runner_up_2)):
        if parsed is None:
            errors.append(f'{row_labels[key]} is required')
        elif parsed.get('error'):
            errors.append(f"{row_labels[key]}: {parsed['error']}")

    if errors:
        return None, errors

    teams = [winner['team'], runner_up_1['team'], runner_up_2['team']]
    if len(set(teams)) != 3:
        errors.append('Group Winner, Second, and Third must be different teams')

    valid_set = set(valid_teams or [])
    for team in teams:
        if team not in valid_set:
            errors.append(f'{team} is not in Group {group_key}')

    w_key = rank_key(winner['points'], winner['goal_diff'], winner['goals_scored'])
    r1_key = rank_key(runner_up_1['points'], runner_up_1['goal_diff'], runner_up_1['goals_scored'])
    r2_key = rank_key(runner_up_2['points'], runner_up_2['goal_diff'], runner_up_2['goals_scored'])

    if not w_key > r1_key:
        errors.append(_ranking_error('Group Winner', 'Second', w_key, r1_key))
    if not r1_key > r2_key:
        errors.append(_ranking_error('Second', 'Third', r1_key, r2_key))

    if errors:
        return None, errors

    return {
        'group_key': group_key,
        'winner': winner,
        'runner_up_1': runner_up_1,
        'runner_up_2': runner_up_2,
    }, []


def apply_group_prediction_row(gp_model, data):
    gp_model.winner_team = data['winner']['team']
    gp_model.winner_points = data['winner']['points']
    gp_model.winner_goal_diff = data['winner']['goal_diff']
    gp_model.winner_goals_scored = data['winner']['goals_scored']
    gp_model.runner_up_1_team = data['runner_up_1']['team']
    gp_model.runner_up_1_points = data['runner_up_1']['points']
    gp_model.runner_up_1_goal_diff = data['runner_up_1']['goal_diff']
    gp_model.runner_up_1_goals_scored = data['runner_up_1']['goals_scored']
    gp_model.runner_up_2_team = data['runner_up_2']['team']
    gp_model.runner_up_2_points = data['runner_up_2']['points']
    gp_model.runner_up_2_goal_diff = data['runner_up_2']['goal_diff']
    gp_model.runner_up_2_goals_scored = data['runner_up_2']['goals_scored']


def group_prediction_is_complete(gp):
    fields = (
        gp.winner_team, gp.winner_points, gp.winner_goal_diff, gp.winner_goals_scored,
        gp.runner_up_1_team, gp.runner_up_1_points, gp.runner_up_1_goal_diff, gp.runner_up_1_goals_scored,
        gp.runner_up_2_team, gp.runner_up_2_points, gp.runner_up_2_goal_diff, gp.runner_up_2_goals_scored,
    )
    return all(f is not None for f in fields)


def build_standings_from_predictions(group_predictions):
    """Return slot_ref -> {team, points, goal_diff, goals_scored, group_key, position}."""
    slots = {}
    for gp in group_predictions:
        if not group_prediction_is_complete(gp):
            continue
        g = gp.group_key
        slots[f'1{g}'] = {
            'slot_ref': f'1{g}',
            'team': gp.winner_team,
            'points': gp.winner_points,
            'goal_diff': gp.winner_goal_diff,
            'goals_scored': gp.winner_goals_scored,
            'group_key': g,
            'position': 1,
            'advances': True,
        }
        slots[f'2{g}'] = {
            'slot_ref': f'2{g}',
            'team': gp.runner_up_1_team,
            'points': gp.runner_up_1_points,
            'goal_diff': gp.runner_up_1_goal_diff,
            'goals_scored': gp.runner_up_1_goals_scored,
            'group_key': g,
            'position': 2,
            'advances': True,
        }
        slots[f'3{g}'] = {
            'slot_ref': f'3{g}',
            'team': gp.runner_up_2_team,
            'points': gp.runner_up_2_points,
            'goal_diff': gp.runner_up_2_goal_diff,
            'goals_scored': gp.runner_up_2_goals_scored,
            'group_key': g,
            'position': 3,
            'advances': False,
        }
    return slots


def rank_third_place_teams(slots, third_place_advance):
    third_teams = [slots[k] for k in sorted(slots) if k.startswith('3')]
    third_teams.sort(
        key=lambda s: (s['points'], s['goal_diff'], s['goals_scored']),
        reverse=True,
    )
    qualifying = third_teams[:third_place_advance]
    qualifying_groups = {t['group_key'] for t in qualifying}
    for t in third_teams:
        t['advances'] = t['group_key'] in qualifying_groups
    return qualifying, third_teams


def scenario_key_from_groups(group_keys):
    return ','.join(sorted(group_keys))


def _slot_display(ref):
    if isinstance(ref, dict):
        pool = ref.get('pool', '')
        return f"3[{ '|'.join(pool) }]"
    return ref


def _resolve_slot_ref(ref, slots, scenario_assignments, slot_key=None):
    if isinstance(ref, dict):
        pool = ref.get('pool', '')
        assign_key = slot_key or ref.get('slot_key')
        assigned = (scenario_assignments or {}).get(assign_key)
        if assigned and assigned in slots:
            team_slot = slots[assigned]
            if not team_slot.get('advances', True):
                return {
                    'slot_ref': _slot_display(ref),
                    'team': None,
                    'resolved': False,
                    'pool': pool,
                    'assigned_slot': assigned,
                    'note': f'{assigned} did not qualify among third-place teams',
                }
            return {
                'slot_ref': assigned,
                'team': team_slot['team'],
                'resolved': True,
                'assigned_slot': assigned,
            }
        return {
            'slot_ref': _slot_display(ref),
            'team': None,
            'resolved': False,
            'pool': pool,
        }

    if ref in slots:
        team_slot = slots[ref]
        return {
            'slot_ref': ref,
            'team': team_slot['team'],
            'resolved': True,
        }
    return {
        'slot_ref': ref,
        'team': None,
        'resolved': False,
        'note': 'Group not in draw',
    }


def _match_key_by_number(rules):
    index = {}
    for round_def in rules.get('knockout_rounds', []):
        for match_def in round_def['matches']:
            index[match_def['match_number']] = match_def['match_key']
    return index


def _winner_team(match_number, picks, match_key_by_number):
    key = match_key_by_number.get(match_number)
    if not key:
        return None
    return picks.get(key)


def _resolve_winner_ref(ref, picks, match_key_by_number):
    num = int(ref[1:])
    team = _winner_team(num, picks, match_key_by_number)
    return {
        'slot_ref': ref,
        'team': team,
        'resolved': team is not None,
    }


def _build_downstream_index(rules):
    """Map match_key -> match_keys that directly consume this match's winner."""
    match_key_by_number = _match_key_by_number(rules)
    all_keys = [
        m['match_key']
        for round_def in rules.get('knockout_rounds', [])
        for m in round_def['matches']
    ]
    downstream = {key: set() for key in all_keys}
    for round_def in rules.get('knockout_rounds', []):
        for match_def in round_def['matches']:
            for side in ('home', 'away'):
                ref = match_def[side]
                if isinstance(ref, str) and ref.startswith('W'):
                    src_num = int(ref[1:])
                    src_key = match_key_by_number.get(src_num)
                    if src_key:
                        downstream[src_key].add(match_def['match_key'])
    return downstream


def downstream_match_keys(edition_slug, match_key):
    """All match keys that must be cleared when a pick upstream changes."""
    rules = RULES_BY_SLUG.get(edition_slug)
    if not rules:
        return []
    index = _build_downstream_index(rules)
    result = set()
    stack = list(index.get(match_key, []))
    while stack:
        key = stack.pop()
        if key in result:
            continue
        result.add(key)
        stack.extend(index.get(key, []))
    return sorted(result)


def validate_bracket_pick(match, picked_team):
    """Return error list if pick is invalid for this resolved match."""
    errors = []
    if not picked_team:
        errors.append('picked_team is required')
        return errors
    home_team = (match.get('home') or {}).get('team')
    away_team = (match.get('away') or {}).get('team')
    if not home_team or not away_team:
        errors.append('Both teams must be set before picking a winner')
        return errors
    if picked_team not in (home_team, away_team):
        errors.append(f'{picked_team} is not playing in this match')
    return errors


def _attach_picks_to_rounds(rounds, picks):
    for round_data in rounds:
        for match in round_data.get('matches', []):
            match['picked_team'] = picks.get(match['match_key'])


def _build_later_knockout_rounds(rules, picks):
    """R16 through Final from saved winner picks."""
    match_key_by_number = _match_key_by_number(rules)
    rounds = []
    for round_def in rules.get('knockout_rounds', [])[1:]:
        matches = []
        for match_def in round_def['matches']:
            home = _resolve_winner_ref(match_def['home'], picks, match_key_by_number)
            away = _resolve_winner_ref(match_def['away'], picks, match_key_by_number)
            matches.append({
                'match_key': match_def['match_key'],
                'match_number': match_def['match_number'],
                'label': match_def.get('label'),
                'home': home,
                'away': away,
            })
        rounds.append({
            'round_key': round_def['round_key'],
            'name': round_def['name'],
            'matches': matches,
        })
    return rounds


def resolve_bracket(edition_slug, group_predictions, draw_group_keys, third_place_advance, picks=None):
    """
    Build resolved group standings and full knockout tree from group predictions.
    Optional picks map (match_key -> team) fills later rounds from user choices.
    Returns dict or raises ValueError with message.
    """
    picks = picks or {}
    rules = RULES_BY_SLUG.get(edition_slug)
    if not rules:
        raise ValueError(f'No knockout rules loaded for {edition_slug}')

    draw_groups = sorted(draw_group_keys or [])
    predictions_by_group = {gp.group_key: gp for gp in group_predictions}
    incomplete = [
        g for g in draw_groups
        if g not in predictions_by_group or not group_prediction_is_complete(predictions_by_group[g])
    ]
    if incomplete:
        raise ValueError(f'Incomplete group predictions: {", ".join(incomplete)}')

    if len(draw_groups) < 12:
        raise ValueError(
            'All 12 groups must be predicted to resolve Round of 32 third-place placements'
        )

    slots = build_standings_from_predictions(group_predictions)
    qualifying_third, all_third = rank_third_place_teams(slots, third_place_advance)
    scenario_key = scenario_key_from_groups(t['group_key'] for t in qualifying_third)
    scenario_assignments = rules['third_place_scenarios'].get(scenario_key)
    scenario_resolved = scenario_assignments is not None

    r32_round = {
        'round_key': 'r32',
        'name': 'Round of 32',
        'matches': [],
    }
    for match_def in rules['r32_matches']:
        home = _resolve_slot_ref(match_def['home'], slots, scenario_assignments)
        away = _resolve_slot_ref(
            match_def['away'],
            slots,
            scenario_assignments,
            slot_key=match_def['away'].get('slot_key') if isinstance(match_def['away'], dict) else None,
        )
        r32_round['matches'].append({
            'match_key': match_def['match_key'],
            'match_number': match_def['match_number'],
            'label': match_def.get('label'),
            'home': home,
            'away': away,
        })

    group_tables = []
    for gp in sorted(group_predictions, key=lambda x: x.group_key):
        if not group_prediction_is_complete(gp):
            continue
        group_tables.append({
            'group_key': gp.group_key,
            'winner': slots[f'1{gp.group_key}'],
            'runner_up_1': slots[f'2{gp.group_key}'],
            'runner_up_2': slots[f'3{gp.group_key}'],
        })

    later_rounds = _build_later_knockout_rounds(rules, picks)
    all_rounds = [r32_round] + later_rounds
    _attach_picks_to_rounds(all_rounds, picks)

    return {
        'scenario_key': scenario_key,
        'scenario_resolved': scenario_resolved,
        'qualifying_third_from': sorted(t['group_key'] for t in qualifying_third),
        'third_place_ranking': [
            {
                'group_key': t['group_key'],
                'team': t['team'],
                'points': t['points'],
                'goal_diff': t['goal_diff'],
                'goals_scored': t['goals_scored'],
                'advances': t['advances'],
            }
            for t in all_third
        ],
        'group_tables': group_tables,
        'rounds': all_rounds,
        'bracket_layout': rules.get('bracket_layout'),
    }


def count_knockout_matches(edition_slug):
    rules = RULES_BY_SLUG.get(edition_slug)
    if not rules:
        return None
    return sum(len(r['matches']) for r in rules.get('knockout_rounds', []))
