"""Unit tests for tournament_engine validation."""
from tournament_engine import validate_group_prediction


def test_validate_group_ordering():
    teams = ['Mexico', 'South Africa', 'Korea Republic', 'Czech Republic']
    data, errors = validate_group_prediction(
        'A',
        teams,
        {'team': 'Korea Republic', 'points': 9, 'goal_diff': 4, 'goals_scored': 10},
        {'team': 'Mexico', 'points': 4, 'goal_diff': 3, 'goals_scored': 11},
        {'team': 'South Africa', 'points': 4, 'goal_diff': 1, 'goals_scored': 5},
    )
    assert errors == []
    assert data['winner']['team'] == 'Korea Republic'


def test_validate_ranking_uses_cascading_tiebreakers():
    teams = ['Mexico', 'South Africa', 'Korea Republic', 'Czech Republic']
    # Winner beats second on points only; second beats third on GD when points tied
    data, errors = validate_group_prediction(
        'A',
        teams,
        {'team': 'Korea Republic', 'points': 9, 'goal_diff': 0, 'goals_scored': 5},
        {'team': 'Mexico', 'points': 4, 'goal_diff': 0, 'goals_scored': 20},
        {'team': 'South Africa', 'points': 4, 'goal_diff': -2, 'goals_scored': 30},
    )
    assert errors == []
    assert data['winner']['team'] == 'Korea Republic'


def test_validate_ranking_error_on_points():
    teams = ['Mexico', 'South Africa', 'Korea Republic', 'Czech Republic']
    _, errors = validate_group_prediction(
        'A',
        teams,
        {'team': 'Korea Republic', 'points': 3, 'goal_diff': 10, 'goals_scored': 10},
        {'team': 'Mexico', 'points': 4, 'goal_diff': 3, 'goals_scored': 11},
        {'team': 'South Africa', 'points': 2, 'goal_diff': 1, 'goals_scored': 5},
    )
    assert any('more points' in e for e in errors)


def test_validate_allows_any_goal_difference():
    teams = ['Mexico', 'South Africa', 'Korea Republic', 'Czech Republic']
    _, errors = validate_group_prediction(
        'A',
        teams,
        {'team': 'Korea Republic', 'points': 9, 'goal_diff': 25, 'goals_scored': 10},
        {'team': 'Mexico', 'points': 4, 'goal_diff': 3, 'goals_scored': 11},
        {'team': 'South Africa', 'points': 4, 'goal_diff': 1, 'goals_scored': 5},
    )
    assert errors == []


def test_validate_rejects_unknown_team():
    teams = ['Mexico', 'South Africa', 'Korea Republic', 'Czech Republic']
    _, errors = validate_group_prediction(
        'A',
        teams,
        {'team': 'Brazil', 'points': 9, 'goal_diff': 4, 'goals_scored': 10},
        {'team': 'Mexico', 'points': 4, 'goal_diff': 3, 'goals_scored': 11},
        {'team': 'South Africa', 'points': 4, 'goal_diff': 1, 'goals_scored': 5},
    )
    assert any('Brazil' in e for e in errors)
