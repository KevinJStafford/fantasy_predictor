"""Tests for kickoff-gated W/D/L scoring (ESPN 0-0 placeholders before kickoff)."""
from datetime import datetime, timedelta, timezone

import pytest

from app import (
    _apply_api_scores_to_fixture,
    _compute_game_result,
    _fixture_has_started,
    _fixture_scoreable,
    _scores_from_api_map,
)


class _FakeFixture:
    def __init__(self, *, fixture_date=None, actual_home_score=None, actual_away_score=None, is_completed=False, manual_round_override=False):
        self.fixture_date = fixture_date
        self.actual_home_score = actual_home_score
        self.actual_away_score = actual_away_score
        self.is_completed = is_completed
        self.manual_round_override = manual_round_override


class _FakeGame:
    def __init__(self, home_team_score, away_team_score):
        self.home_team_score = home_team_score
        self.away_team_score = away_team_score
        self.game_result = None


def test_fixture_has_not_started_before_kickoff():
    kickoff = datetime.now(timezone.utc) + timedelta(hours=2)
    fixture = _FakeFixture(fixture_date=kickoff, actual_home_score=0, actual_away_score=0)
    assert _fixture_has_started(fixture) is False
    assert _fixture_scoreable(fixture) is False


def test_fixture_has_started_after_kickoff():
    kickoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    fixture = _FakeFixture(fixture_date=kickoff, actual_home_score=0, actual_away_score=0)
    assert _fixture_has_started(fixture) is True
    assert _fixture_scoreable(fixture) is True


def test_completed_fixture_scoreable_even_before_kickoff_clock():
    kickoff = datetime.now(timezone.utc) + timedelta(hours=2)
    fixture = _FakeFixture(
        fixture_date=kickoff,
        actual_home_score=2,
        actual_away_score=1,
        is_completed=True,
    )
    assert _fixture_has_started(fixture) is True
    assert _fixture_scoreable(fixture) is True


def test_compute_game_result_none_before_kickoff_with_placeholder_scores():
    kickoff = datetime.now(timezone.utc) + timedelta(hours=2)
    fixture = _FakeFixture(fixture_date=kickoff, actual_home_score=0, actual_away_score=0)
    game = _FakeGame(1, 0)
    assert _compute_game_result(game, fixture) is None


def test_compute_game_result_after_kickoff():
    kickoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    fixture = _FakeFixture(fixture_date=kickoff, actual_home_score=0, actual_away_score=0)
    assert _compute_game_result(_FakeGame(0, 0), fixture) == 'Win'
    assert _compute_game_result(_FakeGame(1, 0), fixture) == 'Draw'
    assert _compute_game_result(_FakeGame(0, 1), fixture) == 'Loss'


def test_scores_from_api_map_keeps_zero():
    assert _scores_from_api_map({'home': 0, 'away': 2}) == (0, 2)
    assert _scores_from_api_map({'homeTeam': 1, 'awayTeam': 0}) == (1, 0)
    assert _scores_from_api_map({'home': None, 'away': None}) == (None, None)


def test_apply_api_scores_does_not_wipe_stored_result_with_nulls():
    fixture = _FakeFixture(actual_home_score=2, actual_away_score=2, is_completed=True)
    assert _apply_api_scores_to_fixture(fixture, None, None, False) is False
    assert fixture.actual_home_score == 2
    assert fixture.actual_away_score == 2
    assert fixture.is_completed is True


def test_apply_api_scores_updates_when_api_has_a_result():
    fixture = _FakeFixture(actual_home_score=None, actual_away_score=None, is_completed=False)
    assert _apply_api_scores_to_fixture(fixture, 0, 1, True) is True
    assert fixture.actual_home_score == 0
    assert fixture.actual_away_score == 1
    assert fixture.is_completed is True


def test_apply_api_scores_skips_manual_round_override():
    fixture = _FakeFixture(
        actual_home_score=2,
        actual_away_score=2,
        is_completed=True,
        manual_round_override=True,
    )
    assert _apply_api_scores_to_fixture(fixture, None, None, False) is False
    assert _apply_api_scores_to_fixture(fixture, 0, 1, True) is False
    assert fixture.actual_home_score == 2
    assert fixture.actual_away_score == 2
    assert fixture.is_completed is True
