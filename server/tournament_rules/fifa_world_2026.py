"""FIFA World Cup 2026 knockout routing (Round of 32 templates)."""
import json
from pathlib import Path

# Fixed R32 — matches ESPN / FIFA schedule.
# Eight matches pair fixed 1X/2X slots; eight pair group winners vs third-place (Annex C).
R32_MATCHES = [
    {'match_key': 'r32-M73', 'match_number': 73, 'label': '2A vs 2B', 'home': '2A', 'away': '2B'},
    {
        'match_key': 'r32-M74', 'match_number': 74, 'label': '1E vs 3rd A/B/C/D/F',
        'home': '1E', 'away': {'pool': 'ABCDF', 'slot_key': 'M74_away'},
    },
    {'match_key': 'r32-M75', 'match_number': 75, 'label': '1F vs 2C', 'home': '1F', 'away': '2C'},
    {'match_key': 'r32-M76', 'match_number': 76, 'label': '1C vs 2F', 'home': '1C', 'away': '2F'},
    {
        'match_key': 'r32-M77', 'match_number': 77, 'label': '1I vs 3rd C/D/F/G/H',
        'home': '1I', 'away': {'pool': 'CDFGH', 'slot_key': 'M77_away'},
    },
    {'match_key': 'r32-M78', 'match_number': 78, 'label': '2E vs 2I', 'home': '2E', 'away': '2I'},
    {
        'match_key': 'r32-M79', 'match_number': 79, 'label': '1A vs 3rd C/E/F/H/I',
        'home': '1A', 'away': {'pool': 'CEFHI', 'slot_key': 'M79_away'},
    },
    {
        'match_key': 'r32-M80', 'match_number': 80, 'label': '1L vs 3rd E/H/I/J/K',
        'home': '1L', 'away': {'pool': 'EHIJK', 'slot_key': 'M80_away'},
    },
    {
        'match_key': 'r32-M81', 'match_number': 81, 'label': '1D vs 3rd B/E/F/I/J',
        'home': '1D', 'away': {'pool': 'BEFIJ', 'slot_key': 'M81_away'},
    },
    {
        'match_key': 'r32-M82', 'match_number': 82, 'label': '1G vs 3rd A/E/H/I/J',
        'home': '1G', 'away': {'pool': 'AEHIJ', 'slot_key': 'M82_away'},
    },
    {'match_key': 'r32-M83', 'match_number': 83, 'label': '2K vs 2L', 'home': '2K', 'away': '2L'},
    {'match_key': 'r32-M84', 'match_number': 84, 'label': '1H vs 2J', 'home': '1H', 'away': '2J'},
    {
        'match_key': 'r32-M85', 'match_number': 85, 'label': '1B vs 3rd E/F/G/I/J',
        'home': '1B', 'away': {'pool': 'EFGIJ', 'slot_key': 'M85_away'},
    },
    {'match_key': 'r32-M86', 'match_number': 86, 'label': '1J vs 2H', 'home': '1J', 'away': '2H'},
    {
        'match_key': 'r32-M87', 'match_number': 87, 'label': '1K vs 3rd D/E/I/J/L',
        'home': '1K', 'away': {'pool': 'DEIJL', 'slot_key': 'M87_away'},
    },
    {'match_key': 'r32-M88', 'match_number': 88, 'label': '2D vs 2G', 'home': '2D', 'away': '2G'},
]


def _load_third_place_scenarios():
    path = Path(__file__).parent / 'annex_c_scenarios.json'
    with open(path, encoding='utf-8') as f:
        return json.load(f)


THIRD_PLACE_SCENARIOS = _load_third_place_scenarios()

# Winner refs use prior match numbers: W73 = winner of match 73.
R16_MATCHES = [
    {'match_key': 'r16-M89', 'match_number': 89, 'label': 'W74 vs W77', 'home': 'W74', 'away': 'W77'},
    {'match_key': 'r16-M90', 'match_number': 90, 'label': 'W73 vs W75', 'home': 'W73', 'away': 'W75'},
    {'match_key': 'r16-M91', 'match_number': 91, 'label': 'W76 vs W78', 'home': 'W76', 'away': 'W78'},
    {'match_key': 'r16-M92', 'match_number': 92, 'label': 'W79 vs W80', 'home': 'W79', 'away': 'W80'},
    {'match_key': 'r16-M93', 'match_number': 93, 'label': 'W83 vs W84', 'home': 'W83', 'away': 'W84'},
    {'match_key': 'r16-M94', 'match_number': 94, 'label': 'W81 vs W82', 'home': 'W81', 'away': 'W82'},
    {'match_key': 'r16-M95', 'match_number': 95, 'label': 'W86 vs W88', 'home': 'W86', 'away': 'W88'},
    {'match_key': 'r16-M96', 'match_number': 96, 'label': 'W85 vs W87', 'home': 'W85', 'away': 'W87'},
]

QF_MATCHES = [
    {'match_key': 'qf-M97', 'match_number': 97, 'label': 'W89 vs W90', 'home': 'W89', 'away': 'W90'},
    {'match_key': 'qf-M98', 'match_number': 98, 'label': 'W93 vs W94', 'home': 'W93', 'away': 'W94'},
    {'match_key': 'qf-M99', 'match_number': 99, 'label': 'W91 vs W92', 'home': 'W91', 'away': 'W92'},
    {'match_key': 'qf-M100', 'match_number': 100, 'label': 'W95 vs W96', 'home': 'W95', 'away': 'W96'},
]

SF_MATCHES = [
    {'match_key': 'sf-M101', 'match_number': 101, 'label': 'W97 vs W98', 'home': 'W97', 'away': 'W98'},
    {'match_key': 'sf-M102', 'match_number': 102, 'label': 'W99 vs W100', 'home': 'W99', 'away': 'W100'},
]

FINAL_MATCH = {
    'match_key': 'final-M104', 'match_number': 104, 'label': 'W101 vs W102', 'home': 'W101', 'away': 'W102',
}

KNOCKOUT_ROUNDS = [
    {'round_key': 'r32', 'name': 'Round of 32', 'matches': R32_MATCHES},
    {'round_key': 'r16', 'name': 'Round of 16', 'matches': R16_MATCHES},
    {'round_key': 'qf', 'name': 'Quarter-finals', 'matches': QF_MATCHES},
    {'round_key': 'sf', 'name': 'Semi-finals', 'matches': SF_MATCHES},
    {'round_key': 'final', 'name': 'Final', 'matches': [FINAL_MATCH]},
]

# Visual bracket layout (top-to-bottom row order within each side).
BRACKET_LAYOUT = {
    'left': {
        'r32': ['r32-M74', 'r32-M77', 'r32-M73', 'r32-M75', 'r32-M83', 'r32-M84', 'r32-M81', 'r32-M82'],
        'r16': ['r16-M89', 'r16-M90', 'r16-M93', 'r16-M94'],
        'qf': ['qf-M97', 'qf-M98'],
        'sf': ['sf-M101'],
    },
    'right': {
        'r32': ['r32-M76', 'r32-M78', 'r32-M79', 'r32-M80', 'r32-M86', 'r32-M88', 'r32-M85', 'r32-M87'],
        'r16': ['r16-M91', 'r16-M92', 'r16-M95', 'r16-M96'],
        'qf': ['qf-M99', 'qf-M100'],
        'sf': ['sf-M102'],
    },
    'final': 'final-M104',
}
