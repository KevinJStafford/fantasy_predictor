"""Tests for FIFA Annex C third-place Round of 32 placement."""
from types import SimpleNamespace

from tournament_engine import resolve_bracket
from tournament_rules.fifa_world_2026 import THIRD_PLACE_SCENARIOS


def _gp(group_key, w, r1, r2):
    """Build a minimal group prediction namespace."""
    return SimpleNamespace(
        group_key=group_key,
        winner_team=w[0], winner_points=w[1], winner_goal_diff=w[2], winner_goals_scored=w[3],
        runner_up_1_team=r1[0], runner_up_1_points=r1[1], runner_up_1_goal_diff=r1[2], runner_up_1_goals_scored=r1[3],
        runner_up_2_team=r2[0], runner_up_2_points=r2[1], runner_up_2_goal_diff=r2[2], runner_up_2_goals_scored=r2[3],
    )


def _all_twelve_group_predictions():
    """Twelve groups with distinct third-place rankings for scenario A–H."""
    data = {
        'A': (('Mexico', 7, 3, 8), ('South Africa', 4, 0, 4), ('Korea Republic', 3, -1, 3)),
        'B': (('Canada', 7, 2, 7), ('Switzerland', 4, 1, 5), ('Qatar', 3, -2, 2)),
        'C': (('Brazil', 9, 5, 10), ('Morocco', 4, 0, 4), ('Haiti', 3, -3, 2)),
        'D': (('United States', 7, 2, 6), ('Paraguay', 4, 0, 3), ('Australia', 3, -1, 2)),
        'E': (('Germany', 7, 3, 7), ('Ecuador', 4, 0, 4), ('Curaçao', 3, -2, 1)),
        'F': (('Netherlands', 7, 2, 6), ('Tunisia', 4, 0, 3), ('Japan', 3, -1, 3)),
        'G': (('Belgium', 7, 2, 5), ('New Zealand', 4, 0, 3), ('Egypt', 3, -2, 2)),
        'H': (('Spain', 9, 4, 9), ('Uruguay', 4, 1, 4), ('Cape Verde', 3, -2, 2)),
        'I': (('France', 7, 2, 6), ('Norway', 4, 0, 3), ('Senegal', 2, -3, 1)),
        'J': (('Argentina', 7, 2, 5), ('Jordan', 4, 0, 3), ('Algeria', 2, -2, 2)),
        'K': (('Portugal', 7, 3, 6), ('Colombia', 4, 0, 4), ('Uzbekistan', 2, -3, 1)),
        'L': (('England', 7, 2, 6), ('Panama', 4, 0, 3), ('Croatia', 2, -2, 2)),
    }
    return [_gp(g, *data[g]) for g in sorted(data)]


def test_annex_c_has_495_scenarios():
    assert len(THIRD_PLACE_SCENARIOS) == 495


def test_scenario_abcdefgh_row_495_placements():
    """Wikipedia/FIFA row 495: third-place qualifiers A–H."""
    predictions = _all_twelve_group_predictions()
    draw = list('ABCDEFGHIJKL')
    result = resolve_bracket('fifa-world-2026', predictions, draw, 8)

    assert result['scenario_key'] == 'A,B,C,D,E,F,G,H'
    assert result['scenario_resolved'] is True
    assert result['qualifying_third_from'] == ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

    matches = {m['match_key']: m for m in result['rounds'][0]['matches']}
    assert matches['r32-M79']['home']['team'] == 'Mexico'
    # FIFA Annex C row 495 (qualifiers A–H): 1A←3H, 1B←3G, 1D←3B, 1E←3C, 1G←3A, 1I←3F, 1K←3D, 1L←3E
    assert matches['r32-M79']['away']['team'] == 'Cape Verde'
    assert matches['r32-M74']['away']['team'] == 'Haiti'
    assert matches['r32-M85']['away']['team'] == 'Egypt'
    assert matches['r32-M81']['away']['team'] == 'Qatar'
    assert matches['r32-M73']['home']['team'] == 'South Africa'
    assert matches['r32-M73']['away']['team'] == 'Switzerland'
