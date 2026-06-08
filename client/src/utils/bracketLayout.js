/** Visual bracket layout — mirrors server/tournament_rules/fifa_world_2026.py BRACKET_LAYOUT */

export const ROUND_LABELS = {
  r32: 'Last 32',
  r16: 'Last 16',
  qf: 'Quarter-finals',
  sf: 'Semi-final',
  final: 'Final',
};

export const ROW_SPAN = { r32: 1, r16: 2, qf: 4, sf: 8 };

export const DEFAULT_BRACKET_LAYOUT = {
  left: {
    r32: ['r32-M74', 'r32-M77', 'r32-M73', 'r32-M75', 'r32-M83', 'r32-M84', 'r32-M81', 'r32-M82'],
    r16: ['r16-M89', 'r16-M90', 'r16-M93', 'r16-M94'],
    qf: ['qf-M97', 'qf-M98'],
    sf: ['sf-M101'],
  },
  right: {
    r32: ['r32-M76', 'r32-M78', 'r32-M79', 'r32-M80', 'r32-M86', 'r32-M88', 'r32-M85', 'r32-M87'],
    r16: ['r16-M91', 'r16-M92', 'r16-M95', 'r16-M96'],
    qf: ['qf-M99', 'qf-M100'],
    sf: ['sf-M102'],
  },
  final: 'final-M104',
};

export const LEFT_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf'];
export const RIGHT_ROUND_ORDER = ['sf', 'qf', 'r16', 'r32'];

export function matchesByKeyFromResolved(resolved) {
  const map = {};
  (resolved?.rounds || []).forEach((round) => {
    (round.matches || []).forEach((match) => {
      map[match.match_key] = match;
    });
  });
  return map;
}

export function picksMapFromList(picksList) {
  const map = {};
  (picksList || []).forEach((p) => {
    if (p?.match_key) map[p.match_key] = p.picked_team;
  });
  return map;
}
