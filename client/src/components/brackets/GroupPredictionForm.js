import React from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { impliedFourthPlace } from '../../utils/bracketValidation';

const STAT_FIELD_WIDTH = 76;

const ROWS = [
  { key: 'winner', label: 'Group Winner', color: 'success' },
  { key: 'runner_up_1', label: 'Second', color: 'primary' },
  { key: 'runner_up_2', label: 'Third', color: 'default' },
];

const STAT_FIELDS = [
  { field: 'points', label: 'Pts', min: 0, max: 9 },
  { field: 'goal_diff', label: 'GD' },
  { field: 'goals_scored', label: 'Goals', min: 0 },
];

function StatFields({ rowKey, value, onChange, disabled, showLabels }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
      {STAT_FIELDS.map(({ field, label, min, max }) => {
        const inputProps = {};
        if (min !== undefined) inputProps.min = min;
        if (max !== undefined) inputProps.max = max;
        return (
          <Box key={field} sx={{ width: STAT_FIELD_WIDTH }}>
            {showLabels && (
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                display="block"
                textAlign="center"
                sx={{ mb: 0.5 }}
              >
                {label}
              </Typography>
            )}
            <TextField
              size="small"
              type="number"
              placeholder={label}
              inputProps={inputProps}
              value={value?.[field] ?? ''}
              onChange={(e) => onChange(field, e.target.value)}
              disabled={disabled}
              fullWidth
            />
          </Box>
        );
      })}
    </Box>
  );
}

function GroupPredictionForm({ groupKey, teams, value, onChange, errors = [], disabled, highlight }) {
  const fourth = impliedFourthPlace(teams, value);

  const teamsForRow = (rowKey) => {
    const otherPicks = ROWS.filter((r) => r.key !== rowKey).map((r) => value[r.key]?.team).filter(Boolean);
    return (teams || []).filter((t) => !otherPicks.includes(t));
  };

  const updateRow = (rowKey, field, fieldValue) => {
    onChange({
      ...value,
      [rowKey]: {
        ...value[rowKey],
        [field]: fieldValue,
      },
    });
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        ...(highlight ? { borderColor: 'warning.main', borderWidth: 2 } : {}),
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="h3">
            Group {groupKey}
          </Typography>
          {fourth && (
            <Typography variant="body2" color="text.secondary">
              4th (out): {fourth}
            </Typography>
          )}
        </Box>

        {errors.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {errors.map((err) => (
              <Typography key={err} variant="body2" color="error" sx={{ mb: 0.5 }}>
                {err}
              </Typography>
            ))}
          </Box>
        )}

        {/* Desktop: column headers aligned with stat fields */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 2, mb: 1, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            {STAT_FIELDS.map(({ label }) => (
              <Typography
                key={label}
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                sx={{ width: STAT_FIELD_WIDTH, textAlign: 'center' }}
              >
                {label}
              </Typography>
            ))}
          </Box>
        </Box>

        {ROWS.map(({ key, label, color }, idx) => (
          <Box
            key={key}
            sx={{
              mb: idx < ROWS.length - 1 ? 2.5 : 0,
              pb: idx < ROWS.length - 1 ? 2.5 : 0,
              borderBottom: idx < ROWS.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            {/* Mobile: badge + team, then stats row below */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              <Chip label={label} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />
              <FormControl size="small" fullWidth disabled={disabled} sx={{ mt: 1, mb: 1.5 }}>
                <InputLabel>Team</InputLabel>
                <Select
                  label="Team"
                  value={value[key]?.team || ''}
                  onChange={(e) => updateRow(key, 'team', e.target.value)}
                >
                  {teamsForRow(key).map((team) => (
                    <MenuItem key={team} value={team}>
                      {team}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <StatFields
                rowKey={key}
                value={value[key]}
                onChange={(field, v) => updateRow(key, field, v)}
                disabled={disabled}
                showLabels
              />
            </Box>

            {/* Desktop: badge+team left, stats inline right */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Chip label={label} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />
                <FormControl size="small" fullWidth disabled={disabled} sx={{ mt: 1 }}>
                  <InputLabel>Team</InputLabel>
                  <Select
                    label="Team"
                    value={value[key]?.team || ''}
                    onChange={(e) => updateRow(key, 'team', e.target.value)}
                  >
                    {teamsForRow(key).map((team) => (
                      <MenuItem key={team} value={team}>
                        {team}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <StatFields
                rowKey={key}
                value={value[key]}
                onChange={(field, v) => updateRow(key, field, v)}
                disabled={disabled}
                showLabels={false}
              />
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export default GroupPredictionForm;
