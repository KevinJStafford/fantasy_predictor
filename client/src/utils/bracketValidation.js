const POINTS_MIN = 0;
const POINTS_MAX = 9;
const GF_MIN = 0;

export const EMPTY_TEAM_ROW = { team: '', points: '', goal_diff: '', goals_scored: '' };

export const EMPTY_GROUP = {
  winner: { ...EMPTY_TEAM_ROW },
  runner_up_1: { ...EMPTY_TEAM_ROW },
  runner_up_2: { ...EMPTY_TEAM_ROW },
};

function parseIntField(value, label, { min, max } = {}) {
  if (value === '' || value === null || value === undefined) {
    return { error: `${label} is required` };
  }
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return { error: `${label} must be a whole number` };
  }
  if (min !== undefined && n < min) {
    return { error: `${label} must be at least ${min}` };
  }
  if (max !== undefined && n > max) {
    return { error: `${label} must be at most ${max}` };
  }
  return { value: n };
}

function rankKey(points, goalDiff, goalsScored) {
  return [points, goalDiff, goalsScored];
}

function compareRank(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function rankingError(aboveLabel, belowLabel, aboveKey, belowKey) {
  if (aboveKey[0] < belowKey[0]) {
    return `${aboveLabel} must have more points than ${belowLabel}`;
  }
  if (aboveKey[0] === belowKey[0] && aboveKey[1] < belowKey[1]) {
    return `${aboveLabel} is tied with ${belowLabel} on points — must have a better goal difference`;
  }
  if (aboveKey[0] === belowKey[0] && aboveKey[1] === belowKey[1] && aboveKey[2] === belowKey[2]) {
    return `${aboveLabel} and ${belowLabel} are tied on points, goal difference, and goals scored — adjust stats to break the tie`;
  }
  if (aboveKey[0] === belowKey[0] && aboveKey[1] === belowKey[1]) {
    return `${aboveLabel} is tied with ${belowLabel} on points and goal difference — must have more goals scored`;
  }
  return `${aboveLabel} must rank above ${belowLabel}`;
}

export function groupFromApi(apiGroup) {
  if (!apiGroup) return { ...EMPTY_GROUP };
  const mapRow = (row) => ({
    team: row?.team || '',
    points: row?.points ?? '',
    goal_diff: row?.goal_diff ?? '',
    goals_scored: row?.goals_scored ?? '',
  });
  return {
    winner: mapRow(apiGroup.winner),
    runner_up_1: mapRow(apiGroup.runner_up_1),
    runner_up_2: mapRow(apiGroup.runner_up_2),
  };
}

export function groupToApiPayload(groupKey, group) {
  const toNum = (v) => Number(v);
  return {
    group_key: groupKey,
    winner: {
      team: group.winner.team,
      points: toNum(group.winner.points),
      goal_diff: toNum(group.winner.goal_diff),
      goals_scored: toNum(group.winner.goals_scored),
    },
    runner_up_1: {
      team: group.runner_up_1.team,
      points: toNum(group.runner_up_1.points),
      goal_diff: toNum(group.runner_up_1.goal_diff),
      goals_scored: toNum(group.runner_up_1.goals_scored),
    },
    runner_up_2: {
      team: group.runner_up_2.team,
      points: toNum(group.runner_up_2.points),
      goal_diff: toNum(group.runner_up_2.goal_diff),
      goals_scored: toNum(group.runner_up_2.goals_scored),
    },
  };
}

export function validateGroup(groupKey, validTeams, group) {
  const errors = [];
  const rows = [
    ['winner', group.winner, 'Group Winner'],
    ['runner_up_1', group.runner_up_1, 'Second'],
    ['runner_up_2', group.runner_up_2, 'Third'],
  ];

  const parsed = {};
  for (const [key, row, label] of rows) {
    if (!row.team) {
      errors.push(`${label} team is required`);
      continue;
    }
    const points = parseIntField(row.points, `${label} points`, { min: POINTS_MIN, max: POINTS_MAX });
    const gd = parseIntField(row.goal_diff, `${label} goal difference`);
    const gf = parseIntField(row.goals_scored, `${label} goals scored`, { min: GF_MIN });
    if (points.error) errors.push(points.error);
    if (gd.error) errors.push(gd.error);
    if (gf.error) errors.push(gf.error);
    if (!points.error && !gd.error && !gf.error) {
      parsed[key] = { team: row.team, points: points.value, goal_diff: gd.value, goals_scored: gf.value };
    }
  }

  if (errors.length) return errors;

  const teams = [parsed.winner.team, parsed.runner_up_1.team, parsed.runner_up_2.team];
  if (new Set(teams).size !== 3) {
    errors.push('Group Winner, Second, and Third must be different teams');
  }

  const validSet = new Set(validTeams || []);
  teams.forEach((t) => {
    if (!validSet.has(t)) errors.push(`${t} is not in Group ${groupKey}`);
  });

  const w = rankKey(parsed.winner.points, parsed.winner.goal_diff, parsed.winner.goals_scored);
  const r1 = rankKey(parsed.runner_up_1.points, parsed.runner_up_1.goal_diff, parsed.runner_up_1.goals_scored);
  const r2 = rankKey(parsed.runner_up_2.points, parsed.runner_up_2.goal_diff, parsed.runner_up_2.goals_scored);

  if (compareRank(w, r1) <= 0) {
    errors.push(rankingError('Group Winner', 'Second', w, r1));
  }
  if (compareRank(r1, r2) <= 0) {
    errors.push(rankingError('Second', 'Third', r1, r2));
  }

  return errors;
}

export function isGroupComplete(group) {
  if (!group) return false;
  return ['winner', 'runner_up_1', 'runner_up_2'].every((k) => {
    const row = group[k];
    return row?.team && row.points !== '' && row.goal_diff !== '' && row.goals_scored !== '';
  });
}

export function impliedFourthPlace(teams, group) {
  if (!group) return null;
  const picked = new Set(
    [group.winner?.team, group.runner_up_1?.team, group.runner_up_2?.team].filter(Boolean)
  );
  return (teams || []).find((t) => !picked.has(t)) || null;
}
