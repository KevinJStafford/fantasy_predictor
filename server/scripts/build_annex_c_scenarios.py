#!/usr/bin/env python3
"""Parse Wikipedia/FIFA Annex C table into annex_c_scenarios.json."""
import json
import os
import re

# Group winner slot -> R32 match away slot key
WINNER_TO_MATCH = {
    '1A': 'M79_away',
    '1B': 'M85_away',
    '1D': 'M81_away',
    '1E': 'M74_away',
    '1G': 'M82_away',
    '1I': 'M77_away',
    '1K': 'M87_away',
    '1L': 'M80_away',
}

WINNER_COLUMNS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L']

ROW_RE = re.compile(
    r'^\|\s*(\d+)\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|\s*(3[A-L])\s*\|'
)


def parse_wikipedia_table(text):
    scenarios = {}
    for line in text.splitlines():
        m = ROW_RE.match(line.strip())
        if not m:
            continue
        groups = sorted(m.group(i) for i in range(2, 10))
        key = ','.join(groups)
        assignments = {}
        for col_idx, winner_slot in enumerate(WINNER_COLUMNS):
            third_ref = m.group(10 + col_idx)
            assignments[WINNER_TO_MATCH[winner_slot]] = third_ref
        scenarios[key] = assignments
    return scenarios


def main():
    wiki_path = os.path.join(
        os.path.dirname(__file__),
        '../../agent-tools/b896e8eb-3f56-4195-b595-94e94a55ee8e.txt',
    )
    # Fallback: read from bundled copy in repo
    bundled = os.path.join(
        os.path.dirname(__file__),
        '../tournament_rules/annex_c_wikipedia_source.txt',
    )
    source_path = wiki_path if os.path.isfile(wiki_path) else bundled
    if not os.path.isfile(source_path):
        raise SystemExit(f'Source table not found: {source_path}')

    with open(source_path, encoding='utf-8') as f:
        scenarios = parse_wikipedia_table(f.read())

    if len(scenarios) != 495:
        raise SystemExit(f'Expected 495 scenarios, got {len(scenarios)}')

    out_path = os.path.join(
        os.path.dirname(__file__),
        '../tournament_rules/annex_c_scenarios.json',
    )
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(scenarios, f, separators=(',', ':'))

    print(f'Wrote {len(scenarios)} scenarios to {out_path}')


if __name__ == '__main__':
    main()
