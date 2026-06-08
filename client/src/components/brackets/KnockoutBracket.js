import React, { useMemo } from 'react';
import { Alert, Box, Typography, useTheme } from '@mui/material';
import {
  DEFAULT_BRACKET_LAYOUT,
  LEFT_ROUND_ORDER,
  RIGHT_ROUND_ORDER,
  ROUND_LABELS,
  ROW_SPAN,
  matchesByKeyFromResolved,
} from '../../utils/bracketLayout';

const TEAM_ROW_HEIGHT = 34;
const MATCH_HEIGHT = TEAM_ROW_HEIGHT * 2;
const ROW_HEIGHT = MATCH_HEIGHT + 4;
const MATCH_WIDTH = 132;
const GRID_ROWS = 8;
const BRACKET_HEIGHT = ROW_HEIGHT * GRID_ROWS;
const HEADER_HEIGHT = 20;
const FINAL_SCALE = 1.3;
const FINAL_MATCH_WIDTH = Math.round(248 * FINAL_SCALE);
const FINAL_MATCH_HEIGHT = 44;
const FINAL_LABEL_FONT_SIZE = `${0.75 * FINAL_SCALE}rem`;
const FINAL_TEAM_FONT_SIZE = `${0.875 * FINAL_SCALE}rem`;
const FINAL_LABEL_GAP = Math.round((HEADER_HEIGHT + 4) * FINAL_SCALE);
const CHAMPION_LABEL_SIZE = '1.715rem';
const CHAMPION_TEAM_SIZE = '1.96rem';
const CHAMPION_UNDERLINE_HEIGHT = 4;
const CHAMPION_BANNER_WIDTH = 200;
const COLUMN_GAP = 24;
const CENTER_GAP = 200;
const HALF_WIDTH = 4 * MATCH_WIDTH + 3 * COLUMN_GAP;
const BRACKET_INNER_WIDTH = HALF_WIDTH + CENTER_GAP + HALF_WIDTH;
const SF_SYMMETRIC_GAP = 68;
const FINAL_NUDGE_DOWN = 24;

function firstMatchTop(span) {
  return (span * ROW_HEIGHT - MATCH_HEIGHT) / 2;
}

function matchCenterY(matchIdx, span) {
  const blockTop = matchIdx * span * ROW_HEIGHT;
  const blockHeight = span * ROW_HEIGHT;
  return blockTop + blockHeight / 2;
}

function championUnderlineBottomOffset() {
  const rem = 16;
  const labelHeight = parseFloat(CHAMPION_LABEL_SIZE) * rem * 1.2;
  const teamHeight = parseFloat(CHAMPION_TEAM_SIZE) * rem * 1.25;
  return labelHeight + 1.4 * 8 + teamHeight + 8 + CHAMPION_UNDERLINE_HEIGHT;
}

function finalLayoutMetrics(hasChampion) {
  const sfCenterY = matchCenterY(0, ROW_SPAN.sf);
  const gap = SF_SYMMETRIC_GAP;
  const finalLabelTop = sfCenterY + gap + FINAL_NUDGE_DOWN;
  const finalMatchTop = finalLabelTop + FINAL_LABEL_GAP;
  const championTop = hasChampion
    ? sfCenterY - gap - championUnderlineBottomOffset()
    : null;
  const columnHeight = finalMatchTop + FINAL_MATCH_HEIGHT;

  return {
    sfCenterY,
    finalLabelTop,
    finalMatchTop,
    championTop,
    columnHeight,
  };
}

function curvedPath(x1, y1, x2, y2) {
  const bend = x1 + (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}`;
}

function buildPairConnectors(sourceKeys, destKeys, sourceSpan, destSpan, gapWidth, direction) {
  const paths = [];
  const ltr = direction === 'ltr';
  const xStart = ltr ? 0 : gapWidth;
  const xEnd = ltr ? gapWidth : 0;

  destKeys.forEach((_, destIdx) => {
    const destY = matchCenterY(destIdx, destSpan);
    [destIdx * 2, destIdx * 2 + 1].forEach((sourceIdx) => {
      if (sourceIdx >= sourceKeys.length) return;
      const sourceY = matchCenterY(sourceIdx, sourceSpan);
      paths.push(curvedPath(xStart, sourceY, xEnd, destY));
    });
  });

  return paths;
}

function ConnectorGap({ paths, width, stroke, height = BRACKET_HEIGHT }) {
  if (!paths.length) return <Box sx={{ width, flexShrink: 0 }} />;

  return (
    <Box
      sx={{
        width,
        height,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden
      >
        {paths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </Box>
  );
}

function RoundLabel({ children, top }) {
  return (
    <Typography
      variant="caption"
      fontWeight={600}
      color="text.secondary"
      sx={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        lineHeight: 1.2,
      }}
    >
      {children}
    </Typography>
  );
}

function TeamRow({ team, isWinner, isLoser, onClick, disabled }) {
  const hasTeam = Boolean(team);
  const clickable = hasTeam && !disabled;

  return (
    <Box
      onClick={clickable ? onClick : undefined}
      sx={{
        px: 1.25,
        height: TEAM_ROW_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        cursor: clickable ? 'pointer' : 'default',
        bgcolor: isWinner ? 'primary.main' : 'background.paper',
        color: isWinner ? 'primary.contrastText' : isLoser ? 'text.disabled' : 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: 'background-color 0.15s',
        '&:last-child': { borderBottom: 'none' },
        '&:hover': clickable && !isWinner ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      <Typography variant="body2" fontWeight={isWinner ? 600 : 400} noWrap title={team || 'TBD'}>
        {team || 'TBD'}
      </Typography>
    </Box>
  );
}

function MatchCell({ match, pickedTeam, onPick, disabled }) {
  if (!match) return null;

  const homeTeam = match.home?.team;
  const awayTeam = match.away?.team;
  const canPick = homeTeam && awayTeam && !disabled;

  const pick = (team) => {
    if (!canPick || !team) return;
    onPick(match.match_key, team);
  };

  return (
    <Box
      sx={{
        width: MATCH_WIDTH,
        height: MATCH_HEIGHT,
        flexShrink: 0,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: pickedTeam ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <TeamRow
        team={homeTeam}
        isWinner={pickedTeam === homeTeam}
        isLoser={pickedTeam && pickedTeam !== homeTeam}
        onClick={() => pick(homeTeam)}
        disabled={!canPick}
      />
      <TeamRow
        team={awayTeam}
        isWinner={pickedTeam === awayTeam}
        isLoser={pickedTeam && pickedTeam !== awayTeam}
        onClick={() => pick(awayTeam)}
        disabled={!canPick}
      />
    </Box>
  );
}

function FinalTeamSide({ team, drawSide, isWinner, isLoser, onClick, disabled }) {
  const hasTeam = Boolean(team);
  const clickable = hasTeam && !disabled;

  return (
    <Box
      onClick={clickable ? onClick : undefined}
      sx={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: drawSide === 'left' ? 'flex-end' : 'flex-start',
        px: 1.5,
        cursor: clickable ? 'pointer' : 'default',
        textAlign: drawSide === 'left' ? 'right' : 'left',
        bgcolor: isWinner ? 'primary.main' : 'background.paper',
        color: isWinner ? 'primary.contrastText' : isLoser ? 'text.disabled' : 'text.primary',
        transition: 'background-color 0.15s',
        '&:hover': clickable && !isWinner ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      <Typography
        sx={{ fontSize: FINAL_TEAM_FONT_SIZE }}
        fontWeight={isWinner ? 600 : 400}
        noWrap
        title={team || 'TBD'}
      >
        {team || 'TBD'}
      </Typography>
    </Box>
  );
}

function FinalMatchCell({ match, pickedTeam, onPick, disabled }) {
  if (!match) return null;

  const homeTeam = match.home?.team;
  const awayTeam = match.away?.team;
  const canPick = homeTeam && awayTeam && !disabled;

  const pick = (team) => {
    if (!canPick || !team) return;
    onPick(match.match_key, team);
  };

  return (
    <Box
      sx={{
        width: FINAL_MATCH_WIDTH,
        height: FINAL_MATCH_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: pickedTeam ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <FinalTeamSide
        team={homeTeam}
        drawSide="left"
        isWinner={pickedTeam === homeTeam}
        isLoser={pickedTeam && pickedTeam !== homeTeam}
        onClick={() => pick(homeTeam)}
        disabled={!canPick}
      />
      <Box
        sx={{
          width: '1px',
          flexShrink: 0,
          bgcolor: 'divider',
          alignSelf: 'stretch',
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 0.75,
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          sx={{ fontSize: `${0.75 * FINAL_SCALE}rem` }}
          color="text.secondary"
          fontWeight={600}
        >
          vs
        </Typography>
      </Box>
      <Box
        sx={{
          width: '1px',
          flexShrink: 0,
          bgcolor: 'divider',
          alignSelf: 'stretch',
        }}
      />
      <FinalTeamSide
        team={awayTeam}
        drawSide="right"
        isWinner={pickedTeam === awayTeam}
        isLoser={pickedTeam && pickedTeam !== awayTeam}
        onClick={() => pick(awayTeam)}
        disabled={!canPick}
      />
    </Box>
  );
}

function BracketColumn({ roundKey, matchKeys, matchesByKey, picks, onPick, disabled }) {
  const span = ROW_SPAN[roundKey];
  const headerTop = firstMatchTop(span) - HEADER_HEIGHT - 4;

  return (
    <Box
      sx={{
        position: 'relative',
        width: MATCH_WIDTH,
        height: BRACKET_HEIGHT,
        flexShrink: 0,
      }}
    >
      <RoundLabel top={headerTop}>{ROUND_LABELS[roundKey]}</RoundLabel>
      <Box
        sx={{
          display: 'grid',
          gridTemplateRows: `repeat(${GRID_ROWS}, ${ROW_HEIGHT}px)`,
          height: '100%',
        }}
      >
        {matchKeys.map((matchKey, matchIdx) => {
          const match = matchesByKey[matchKey];
          const rowStart = matchIdx * span + 1;
          return (
            <Box
              key={matchKey}
              sx={{
                gridRow: `${rowStart} / span ${span}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MatchCell
                match={match}
                pickedTeam={picks[matchKey]}
                onPick={onPick}
                disabled={disabled}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function BracketHalf({
  side,
  roundOrder,
  layout,
  matchesByKey,
  picks,
  onPick,
  disabled,
  connectorStroke,
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      {roundOrder.map((roundKey, colIdx) => {
        const nextRoundKey = roundOrder[colIdx + 1];
        let connectorPaths = [];

        if (nextRoundKey) {
          const sourceRound = side === 'left' ? roundKey : nextRoundKey;
          const destRound = side === 'left' ? nextRoundKey : roundKey;
          const direction = side === 'left' ? 'ltr' : 'rtl';
          connectorPaths = buildPairConnectors(
            layout[sourceRound] || [],
            layout[destRound] || [],
            ROW_SPAN[sourceRound],
            ROW_SPAN[destRound],
            COLUMN_GAP,
            direction
          );
        }

        return (
          <React.Fragment key={roundKey}>
            <BracketColumn
              roundKey={roundKey}
              matchKeys={layout[roundKey] || []}
              matchesByKey={matchesByKey}
              picks={picks}
              onPick={onPick}
              disabled={disabled}
            />
            {nextRoundKey && (
              <ConnectorGap
                paths={connectorPaths}
                width={COLUMN_GAP}
                stroke={connectorStroke}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

function ChampionBanner({ team }) {
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: CHAMPION_LABEL_SIZE,
          fontWeight: 700,
          color: 'text.primary',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          mb: 1.4,
          lineHeight: 1.2,
          textAlign: 'center',
          width: '100%',
        }}
      >
        Champion
      </Typography>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography
          noWrap
          title={team}
          sx={{
            fontSize: CHAMPION_TEAM_SIZE,
            fontWeight: 400,
            color: 'text.primary',
            lineHeight: 1.25,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {team}
        </Typography>
        <Box
          sx={{
            height: CHAMPION_UNDERLINE_HEIGHT,
            width: '100%',
            mt: 1,
            background: (theme) =>
              `linear-gradient(90deg, transparent 0%, ${theme.palette.primary.main} 20%, ${theme.palette.primary.main} 80%, transparent 100%)`,
            borderRadius: 1,
          }}
        />
      </Box>
    </Box>
  );
}

function FinalBlock({ match, pickedTeam, onPick, disabled, finalMatchTop, finalLabelTop, championTop }) {
  return (
    <>
      {pickedTeam && championTop != null && (
        <Box
          sx={{
            position: 'absolute',
            top: championTop,
            left: '50%',
            transform: 'translateX(-50%)',
            width: CHAMPION_BANNER_WIDTH,
            zIndex: 2,
          }}
        >
          <ChampionBanner team={pickedTeam} />
        </Box>
      )}

      <Typography
        fontWeight={700}
        color="text.primary"
        sx={{
          position: 'absolute',
          top: finalLabelTop,
          left: '50%',
          transform: 'translateX(-50%)',
          width: FINAL_MATCH_WIDTH,
          fontSize: FINAL_LABEL_FONT_SIZE,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          zIndex: 2,
        }}
      >
        {ROUND_LABELS.final}
      </Typography>

      <Box
        sx={{
          position: 'absolute',
          top: finalMatchTop,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
        }}
      >
        <FinalMatchCell
          match={match}
          pickedTeam={pickedTeam}
          onPick={onPick}
          disabled={disabled}
        />
      </Box>
    </>
  );
}

function KnockoutBracket({ resolved, picks = {}, onPick, disabled, saving, loading, error }) {
  const theme = useTheme();
  const connectorStroke = theme.palette.divider;
  const layout = resolved?.bracket_layout || DEFAULT_BRACKET_LAYOUT;
  const matchesByKey = useMemo(() => matchesByKeyFromResolved(resolved), [resolved]);

  const picksComplete = useMemo(() => {
    const total = (resolved?.rounds || []).reduce(
      (sum, r) => sum + (r.matches || []).length,
      0
    );
    const picked = Object.keys(picks).filter((k) => picks[k]).length;
    return { picked, total };
  }, [resolved, picks]);

  if (loading) {
    return <Typography color="text.secondary">Loading knockout bracket…</Typography>;
  }

  if (error) {
    return <Alert severity="info">{error}</Alert>;
  }

  if (!resolved) {
    return (
      <Alert severity="info">
        Complete all group predictions to build your knockout bracket.
      </Alert>
    );
  }

  const finalMatch = matchesByKey[layout.final];
  const topPadding = HEADER_HEIGHT + 8;
  const hasChampion = Boolean(picks[layout.final]);
  const {
    finalLabelTop,
    finalMatchTop,
    championTop,
    columnHeight,
  } = finalLayoutMetrics(hasChampion);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Click a team to advance them. Winners flow into the next round automatically.
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          Picks {picksComplete.picked} / {picksComplete.total}
          {saving && (
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}· saving…
            </Typography>
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          width: { xs: '100vw', md: '100%' },
          maxWidth: { xs: '100vw', md: '100%' },
          ml: { xs: 'calc(50% - 50vw)', md: 0 },
          overflowX: 'auto',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          minWidth: 0,
          pb: 1,
        }}
      >
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            verticalAlign: 'top',
            position: 'relative',
            pt: `${topPadding}px`,
            minHeight: columnHeight + topPadding,
            width: BRACKET_INNER_WIDTH,
            minWidth: BRACKET_INNER_WIDTH,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <BracketHalf
              side="left"
              roundOrder={LEFT_ROUND_ORDER}
              layout={layout.left}
              matchesByKey={matchesByKey}
              picks={picks}
              onPick={onPick}
              disabled={disabled || saving}
              connectorStroke={connectorStroke}
            />

            <Box sx={{ width: CENTER_GAP, height: BRACKET_HEIGHT, flexShrink: 0 }} />

            <BracketHalf
              side="right"
              roundOrder={RIGHT_ROUND_ORDER}
              layout={layout.right}
              matchesByKey={matchesByKey}
              picks={picks}
              onPick={onPick}
              disabled={disabled || saving}
              connectorStroke={connectorStroke}
            />
          </Box>

          <FinalBlock
            match={finalMatch}
            pickedTeam={picks[layout.final]}
            onPick={onPick}
            disabled={disabled || saving}
            finalMatchTop={finalMatchTop}
            finalLabelTop={finalLabelTop}
            championTop={championTop}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default KnockoutBracket;
