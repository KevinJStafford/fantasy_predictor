import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useHistory, useParams } from 'react-router-dom';
import Navbar from '../Navbar';
import { apiUrl, authenticatedFetch } from '../../utils/api';
import { getToken, removeToken } from '../../utils/auth';
import {
  EMPTY_GROUP,
  groupFromApi,
  groupToApiPayload,
  isGroupComplete,
  validateGroup,
} from '../../utils/bracketValidation';
import { picksMapFromList } from '../../utils/bracketLayout';
import GroupPredictionForm from './GroupPredictionForm';
import KnockoutBracket from './KnockoutBracket';

function formatLockDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function BracketBuilder() {
  const { editionSlug } = useParams();
  const history = useHistory();
  const [tab, setTab] = useState(0);
  const [edition, setEdition] = useState(null);
  const [entry, setEntry] = useState(null);
  const [groups, setGroups] = useState({});
  const [groupErrors, setGroupErrors] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [resolved, setResolved] = useState(null);
  const [resolvedLoading, setResolvedLoading] = useState(false);
  const [resolvedError, setResolvedError] = useState(null);
  const [incompleteGroups, setIncompleteGroups] = useState([]);
  const [bracketPicks, setBracketPicks] = useState({});
  const [pickSaving, setPickSaving] = useState(false);

  const groupKeys = useMemo(
    () => Object.keys(edition?.groups || {}).sort(),
    [edition]
  );

  const groupsRequired = entry?.groups_required ?? groupKeys.length ?? 12;

  const localGroupsComplete = useMemo(
    () => groupKeys.filter((k) => isGroupComplete(groups[k] || EMPTY_GROUP)).length,
    [groupKeys, groups]
  );

  const savedGroupsComplete = entry?.groups_complete ?? 0;

  const progress = groupsRequired ? (savedGroupsComplete / groupsRequired) * 100 : 0;

  const allGroupsComplete = groupsRequired > 0 && savedGroupsComplete >= groupsRequired;

  const hasUnsavedCompleteGroups = localGroupsComplete > savedGroupsComplete;

  const groupsNeedingAttention = useMemo(() => {
    const need = new Set(incompleteGroups);
    groupKeys.forEach((key) => {
      if (!isGroupComplete(groups[key] || EMPTY_GROUP)) {
        need.add(key);
      }
    });
    return [...need].sort();
  }, [incompleteGroups, groupKeys, groups]);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    const editionPromise = fetch(apiUrl(`/api/v1/tournaments/${editionSlug}`)).then((res) => {
      if (!res.ok) throw new Error('Tournament not found');
      return res.json();
    });

    const mePromise = authenticatedFetch(`/api/v1/tournaments/${editionSlug}/bracket/me`).then((res) => {
      if (res.status === 401) return { auth: false };
      if (!res.ok) throw new Error('Failed to load your bracket');
      return res.json();
    });

    Promise.all([editionPromise, mePromise])
      .then(([editionData, meData]) => {
        if (meData.auth === false) {
          history.replace(`/login?next=${encodeURIComponent(`/brackets/${editionSlug}`)}`);
          return;
        }

        const ed = editionData.edition;
        setEdition(ed);

        const drawGroups = ed.groups || {};
        const initial = {};
        groupKeysFromDraw(drawGroups).forEach((key) => {
          initial[key] = { ...EMPTY_GROUP };
        });

        (meData.group_predictions || []).forEach((gp) => {
          initial[gp.group_key] = groupFromApi(gp);
        });
        setGroups(initial);
        setEntry(meData.entry);
        setIncompleteGroups(
          meData.incomplete_groups ?? meData.entry?.incomplete_groups ?? []
        );
        setBracketPicks(picksMapFromList(meData.bracket_picks));
        setIsLocked(meData.is_locked || ed.is_locked);
      })
      .catch((err) => setError(err.message || 'Failed to load bracket'))
      .finally(() => setLoading(false));
  }, [editionSlug, history]);

  function groupKeysFromDraw(drawGroups) {
    return Object.keys(drawGroups || {}).sort();
  }

  useEffect(() => {
    if (!getToken()) {
      history.replace(`/login?next=${encodeURIComponent(`/brackets/${editionSlug}`)}`);
      return;
    }
    loadData();
  }, [editionSlug, history, loadData]);

  const loadResolved = useCallback(() => {
    if (!allGroupsComplete) {
      setResolved(null);
      setResolvedError('Complete all 12 group predictions to preview Round of 32 matchups.');
      return;
    }

    setResolvedLoading(true);
    setResolvedError(null);
    authenticatedFetch(`/api/v1/tournaments/${editionSlug}/bracket/resolved`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          const incomplete = data.incomplete_groups?.join(', ');
          throw new Error(
            data.error + (incomplete ? `: ${incomplete}` : '')
          );
        }
        setResolved(data);
        const picksFromResolved = {};
        (data.rounds || []).forEach((round) => {
          (round.matches || []).forEach((match) => {
            if (match.picked_team) picksFromResolved[match.match_key] = match.picked_team;
          });
        });
        setBracketPicks((prev) => ({ ...prev, ...picksFromResolved }));
      })
      .catch((err) => {
        setResolved(null);
        setResolvedError(err.message);
      })
      .finally(() => setResolvedLoading(false));
  }, [allGroupsComplete, editionSlug]);

  const handleKnockoutPick = useCallback(
    (matchKey, team) => {
      if (isLocked || pickSaving) return;

      setPickSaving(true);
      authenticatedFetch(`/api/v1/tournaments/${editionSlug}/bracket/picks`, {
        method: 'PUT',
        body: JSON.stringify({ picks: [{ match_key: matchKey, picked_team: team }] }),
      })
        .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
        .then(({ ok, status, data }) => {
          if (status === 401) {
            removeToken();
            history.push(`/login?next=${encodeURIComponent(`/brackets/${editionSlug}`)}`);
            return;
          }
          if (!ok) throw new Error(data.error || 'Failed to save pick');
          if (data.resolved) setResolved(data.resolved);
          setBracketPicks(picksMapFromList(data.bracket_picks));
          if (data.entry) setEntry(data.entry);
        })
        .catch((err) => {
          setSnackbar({ severity: 'error', message: err.message || 'Failed to save pick' });
          loadResolved();
        })
        .finally(() => setPickSaving(false));
    },
    [editionSlug, history, isLocked, loadResolved, pickSaving]
  );

  useEffect(() => {
    if (tab === 1 && allGroupsComplete) {
      loadResolved();
    }
  }, [tab, allGroupsComplete, loadResolved]);

  const updateGroup = (groupKey, nextGroup) => {
    setGroups((prev) => ({ ...prev, [groupKey]: nextGroup }));
    setGroupErrors((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
  };

  const handleSave = () => {
    const draw = edition?.groups || {};
    const toSave = [];
    const errors = {};

    const skipped = [];

    groupKeys.forEach((key) => {
      const group = groups[key];
      if (!isGroupComplete(group)) {
        skipped.push(key);
        return;
      }
      const errs = validateGroup(key, draw[key], group);
      if (errs.length) {
        errors[key] = errs;
      } else {
        toSave.push(groupToApiPayload(key, group));
      }
    });

    if (Object.keys(errors).length) {
      setGroupErrors(errors);
      setSnackbar({ severity: 'error', message: 'Fix validation errors before saving.' });
      return;
    }

    if (!toSave.length) {
      setSnackbar({ severity: 'info', message: 'Fill in at least one complete group to save.' });
      return;
    }

    setSaving(true);
    authenticatedFetch(`/api/v1/tournaments/${editionSlug}/bracket/groups`, {
      method: 'PUT',
      body: JSON.stringify({ groups: toSave }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (status === 401) {
          removeToken();
          history.push(`/login?next=${encodeURIComponent(`/brackets/${editionSlug}`)}`);
          return;
        }
        if (!ok) {
          if (data.groups) {
            setGroupErrors(data.groups);
          }
          throw new Error(data.error || 'Save failed');
        }
        setEntry(data.entry);
        setIncompleteGroups(
          data.incomplete_groups || data.entry?.incomplete_groups || []
        );
        const merged = { ...groups };
        (data.group_predictions || []).forEach((gp) => {
          merged[gp.group_key] = groupFromApi(gp);
        });
        setGroups(merged);
        let message = `Saved ${toSave.length} group${toSave.length === 1 ? '' : 's'}.`;
        if (skipped.length > 0) {
          message += ` Still need Group ${skipped.join(', ')} (missing fields).`;
        } else if (data.entry?.incomplete_groups?.length) {
          message += ` Still incomplete: Group ${data.entry.incomplete_groups.join(', ')}.`;
        }
        setSnackbar({ severity: skipped.length ? 'warning' : 'success', message });
      })
      .catch((err) => setSnackbar({ severity: 'error', message: err.message || 'Save failed' }))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Container maxWidth={tab === 1 ? 'xl' : 'md'} sx={{ py: 4 }}>
          <Typography color="text.secondary">Loading bracket…</Typography>
        </Container>
      </>
    );
  }

  if (error || !edition) {
    return (
      <>
        <Navbar />
        <Container maxWidth={tab === 1 ? 'xl' : 'md'} sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Tournament not found'}</Alert>
          <Button sx={{ mt: 2 }} onClick={() => history.push('/brackets')}>
            Back to brackets
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container
        maxWidth={tab === 1 ? 'xl' : 'md'}
        sx={{
          py: 4,
          ...(tab === 1 && {
            overflow: 'visible',
            maxWidth: '100% !important',
            px: { xs: 1, sm: 2, md: 3 },
          }),
        }}
      >
        <Button size="small" onClick={() => history.push('/brackets')} sx={{ mb: 2 }}>
          ← All brackets
        </Button>

        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          {edition.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {isLocked
            ? 'Bracket is locked — no more edits.'
            : edition.bracket_lock_at
            ? `Brackets lock ${formatLockDate(edition.bracket_lock_at)}`
            : 'Fill in group tables, then preview your knockout path.'}
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">
              Groups saved {savedGroupsComplete} / {groupsRequired}
              {hasUnsavedCompleteGroups && (
                <Typography component="span" variant="body2" color="warning.main">
                  {' '}
                  ({localGroupsComplete} filled locally — click Save group predictions)
                </Typography>
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {entry?.status === 'draft' ? 'Draft' : entry?.status || 'Not started'}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 1 }} />
          {hasUnsavedCompleteGroups && localGroupsComplete >= groupsRequired && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              All {groupsRequired} groups are filled in. Click <strong>Save group predictions</strong> below
              to unlock the knockout preview.
            </Alert>
          )}
          {groupsNeedingAttention.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Still need attention: Group {groupsNeedingAttention.join(', ')}
              {groupsNeedingAttention.some((key) => isGroupComplete(groups[key] || EMPTY_GROUP)) &&
                ' (filled in but not saved yet)'}
            </Alert>
          )}
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Group stage" />
          <Tab label="Knockout bracket" disabled={!allGroupsComplete} />
        </Tabs>

        {tab === 0 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              For each group, pick the top three finishers with points, goal difference, and goals scored.
              Rankings use points first; if tied, goal difference; if still tied, goals scored.
            </Typography>

            {groupKeys.map((key) => (
              <GroupPredictionForm
                key={key}
                groupKey={key}
                teams={edition.groups[key]}
                value={groups[key] || EMPTY_GROUP}
                onChange={(next) => updateGroup(key, next)}
                errors={groupErrors[key] || []}
                disabled={isLocked}
                highlight={groupsNeedingAttention.includes(key) || (groupErrors[key]?.length > 0)}
              />
            ))}

            {!isLocked && (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save group predictions'}
                </Button>
                {allGroupsComplete && (
                  <Button variant="outlined" onClick={() => setTab(1)}>
                    Fill out knockout bracket
                  </Button>
                )}
              </Box>
            )}
          </>
        )}

        {tab === 1 && (
          <KnockoutBracket
            resolved={resolved}
            picks={bracketPicks}
            onPick={handleKnockoutPick}
            disabled={isLocked}
            saving={pickSaving}
            loading={resolvedLoading}
            error={resolvedError}
          />
        )}
      </Container>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        ) : null}
      </Snackbar>
    </>
  );
}

export default BracketBuilder;
