"""Official FIFA World Cup 2026 group draw (resolved teams, no placeholders).

Source: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# First match kickoff: 11 June 2026, 3:00 PM US Eastern (EDT → UTC).
WC_2026_FIRST_KICKOFF_ET = datetime(2026, 6, 11, 15, 0, tzinfo=ZoneInfo('America/New_York'))


def wc_2026_bracket_lock_at_utc():
    """Naive UTC datetime for DB storage and lock comparisons."""
    return WC_2026_FIRST_KICKOFF_ET.astimezone(timezone.utc).replace(tzinfo=None)

WC_2026_GROUPS = {
    'A': ['Mexico', 'South Africa', 'Korea Republic', 'Czechia'],
    'B': ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
    'C': ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
    'D': ['USA', 'Paraguay', 'Australia', 'Türkiye'],
    'E': ['Germany', 'Curaçao', "Côte d'Ivoire", 'Ecuador'],
    'F': ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
    'G': ['Belgium', 'Egypt', 'IR Iran', 'New Zealand'],
    'H': ['Spain', 'Cabo Verde', 'Saudi Arabia', 'Uruguay'],
    'I': ['France', 'Senegal', 'Iraq', 'Norway'],
    'J': ['Argentina', 'Algeria', 'Austria', 'Jordan'],
    'K': ['Portugal', 'Congo DR', 'Uzbekistan', 'Colombia'],
    'L': ['England', 'Croatia', 'Ghana', 'Panama'],
}

# Older seed / ESPN placeholder names -> current FIFA names
WC_2026_TEAM_RENAMES = {
    'Playoff D': 'Bosnia and Herzegovina',
    'Playoff Path D': 'Bosnia and Herzegovina',
    'Playoff C': 'Türkiye',
    'Playoff Path C': 'Türkiye',
    'Turkey': 'Türkiye',
    'UEFA Playoff': 'Sweden',
    'UEFA Playoff Path': 'Sweden',
    'UEFA Play-Off Path': 'Sweden',
    'IC Playoff 2': 'Iraq',
    'Intercontinental Playoff 2': 'Iraq',
    'Czech Republic': 'Czechia',
    'United States': 'USA',
    'Ivory Coast': "Côte d'Ivoire",
    'Iran': 'IR Iran',
    'Cape Verde': 'Cabo Verde',
    'DR Congo': 'Congo DR',
}
