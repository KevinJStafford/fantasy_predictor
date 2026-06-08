"""World Cup 2026 bracket lock schedule."""
from datetime import datetime, timezone

from tournament_rules.wc_2026_groups import WC_2026_FIRST_KICKOFF_ET, wc_2026_bracket_lock_at_utc


def test_bracket_lock_is_first_kickoff_3pm_et():
    assert WC_2026_FIRST_KICKOFF_ET.hour == 15
    assert WC_2026_FIRST_KICKOFF_ET.tzname() in ('EDT', 'EST')
    assert wc_2026_bracket_lock_at_utc() == datetime(2026, 6, 11, 19, 0, 0)
    assert wc_2026_bracket_lock_at_utc() == WC_2026_FIRST_KICKOFF_ET.astimezone(
        timezone.utc
    ).replace(tzinfo=None)
