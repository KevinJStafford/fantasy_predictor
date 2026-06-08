import React from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from '@mui/material';

function TeamSlot({ slot, side }) {
  const resolved = slot?.resolved !== false && slot?.team;
  return (
    <Box
      sx={{
        flex: 1,
        p: 1.5,
        borderRadius: 1,
        bgcolor: resolved ? 'background.paper' : 'action.hover',
        border: '1px solid',
        borderColor: resolved ? 'divider' : 'warning.light',
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {side} · {slot?.slot_ref || '—'}
      </Typography>
      <Typography variant="body1" fontWeight={resolved ? 600 : 400}>
        {slot?.team || 'TBD'}
      </Typography>
    </Box>
  );
}

function BracketResolvedView({ resolved, loading, error }) {
  if (loading) {
    return <Typography color="text.secondary">Loading knockout preview…</Typography>;
  }

  if (error) {
    return <Alert severity="info">{error}</Alert>;
  }

  if (!resolved) {
    return (
      <Alert severity="info">
        Complete all group predictions to preview your Round of 32 matchups.
      </Alert>
    );
  }

  const r32 = resolved.rounds?.find((r) => r.round_key === 'r32');

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Third-place scenario
        </Typography>
        <Chip
          label={resolved.scenario_key || '—'}
          size="small"
          color={resolved.scenario_resolved ? 'success' : 'warning'}
        />
        {!resolved.scenario_resolved && (
          <Typography variant="body2" color="text.secondary">
            Third-place scenario not found for key {resolved.scenario_key} — complete all 12 groups.
          </Typography>
        )}
      </Box>

      {resolved.third_place_ranking?.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Best third-place teams (your prediction)
            </Typography>
            {resolved.third_place_ranking.map((row, idx) => (
              <Box
                key={row.group_key}
                sx={{ display: 'flex', gap: 2, py: 0.5, opacity: row.advances ? 1 : 0.55 }}
              >
                <Typography variant="body2" sx={{ width: 24 }}>{idx + 1}.</Typography>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {row.team} (Group {row.group_key})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.points} pts · {row.goal_diff >= 0 ? '+' : ''}{row.goal_diff} GD · {row.goals_scored} GF
                </Typography>
                {row.advances ? (
                  <Chip label="Advances" size="small" color="success" />
                ) : (
                  <Chip label="Out" size="small" />
                )}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" gutterBottom>
        Round of 32
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {r32?.matches?.map((match) => (
        <Card key={match.match_key} variant="outlined" sx={{ mb: 1.5 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {match.label || `Match ${match.match_number}`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', flexDirection: { xs: 'column', sm: 'row' } }}>
              <TeamSlot slot={match.home} side="Home" />
              <Typography sx={{ alignSelf: 'center', px: 1, fontWeight: 700 }}>vs</Typography>
              <TeamSlot slot={match.away} side="Away" />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default BracketResolvedView;
