"""Tests for kickoff-gated W/D/L scoring (ESPN 0-0 placeholders before kickoff)."""
from datetime import datetime, timedelta, timezone

import pytest

from app import _compute_game_result, _fixture_has_started, _fixture_scoreable


class _FakeFixture:
    def __init__(self, *, fixture_date=None, actual_home_score=None, actual_away_score=None, is_completed=False):
        self.fixture_date = fixture_date
        self.actual_home_score = actual_home_score
        self.actual_away_score = actual_away_score
        self.is_completed = is_completed


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
