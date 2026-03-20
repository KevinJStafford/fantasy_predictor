# Mode Flag Implementation Guide

This document specifies **exact file and code locations** where to introduce and use the league `mode` flag (`classic` vs `h2h_scorers`) so that classic leagues are unaffected.

---

## 1. Leagues.js (Create League + List)

### 1.1 State for game type (Create Dialog)

**Location:** With other create-dialog state (e.g. after `createAiPredictionsEnabled`).

- **Add state:**  
  `const [createMode, setCreateMode] = useState('classic')`

### 1.2 Create League payload

**Location:** `handleCreateLeagueSubmit` (around line 181), inside the `body` of the `authenticatedFetch('/api/v1/leagues', ...)` call.

- **Add to body:**  
  `mode: createMode`  
  (or `game_type: createMode` if the API uses that name.)

- **Reset on success:** In the `.then(data => { if (data.league) { ... } })` block, add:  
  `setCreateMode('classic')`

### 1.3 Create Dialog UI – Game Type selector

**Location:** Create League Dialog content, after “Real-world league to predict” and before “Leaderboard” (before the Leaderboard `Typography` around line 399).

- **Insert:** A new section “Game type” with a `RadioGroup`:
  - **Option 1:** `Classic (points only)` → `mode: 'classic'`
  - **Option 2:** `Head-to-head with scorers` → `mode: 'h2h_scorers'`
- Bind to `createMode` / `setCreateMode`. Only show the “Head-to-head with scorers” option when the chosen competition has gameweeks (optional: can always show and validate on submit).

### 1.4 League cards (list / browse)

**Location:** Card content for each league (e.g. around line 309–312 where member count is shown).

- **Optional:** Display a small label or chip when `league.mode === 'h2h_scorers'` (e.g. “H2H + Scorers”) so users can tell game type at a glance. Do **not** change behaviour of the card click or existing props.

---

## 2. Members.js (League page – leaderboard, results, predictions)

Assume `leagueDetail` is the resolved league object (from `GET /api/v1/leagues`). Ensure the API returns `mode` (default `'classic'` for existing leagues).

### 2.1 Derive mode once

**Location:** Near other derived league values (e.g. after `effectiveCompetition`, around line 63).

- **Add:**  
  `const leagueMode = leagueDetail?.mode ?? 'classic'`  
  Use `leagueMode === 'h2h_scorers'` for all conditional UI and behaviour below.

### 2.2 Leaderboard section – different layout for H2H

**Location:** “League Leaderboard” box (approx. lines 1036–1112): the `Typography` “League Leaderboard”, the description text, and the table that shows Rank, Player, Points, W, D, L, (Weeks won).

- **Branch on mode:**
  - **If `leagueMode === 'classic'`:** Keep current behaviour unchanged. Keep using `data.leaderboard` from `GET /api/v1/leagues/:id/leaderboard` as today (points, wins, draws, losses, weeks_won). Same table columns.
  - **If `leagueMode === 'h2h_scorers'`:**  
    - Use the same endpoint but expect (or a dedicated H2H endpoint that returns) H2H standings: e.g. rank, display_name, wins, draws, losses, **h2h_points** (3/1/0), **total_prediction_points** (tie-breaker).  
    - Change the copy to something like “Head-to-head table”.  
    - Table columns: Rank, Player, **W**, **D**, **L**, **H2H Pts**, **Prediction Pts** (and optionally “Weeks won” if you still track that).  
    - Sort by H2H points first, then by total prediction points.  
- **Important:** Do **not** change the classic branch logic or the classic API contract; only add a parallel path for `h2h_scorers`.

### 2.3 Weekly refetch of leaderboard (weekly scope)

**Location:** `useEffect` that refetches leaderboard when `gameWeek` or `leaderboardScope` changes (lines 652–658).

- **Behaviour:** For classic leagues, leave as is. For `leagueMode === 'h2h_scorers'`, you may still pass `round` to the leaderboard API if the backend supports “standings for this gameweek” in H2H mode. If not, keep the existing `fetchLeaderboard(round)` call but ensure the backend ignores `round` for H2H or returns the same H2H table; avoid changing the classic flow.

### 2.4 “Results – {Week}” section (W/D/L chips and result cards)

**Location:** The “Results – {weekOrDayTitle(gameWeek)}” block (approx. 848–949) and the mobile equivalent if any (search for “Results” or “completedPredictions”).

- **Classic:** Leave as is (per-match W/D/L and chips).
- **H2H mode (optional for v1):** You can add a sentence like “Your head-to-head result this week: Win/Draw/Loss vs {opponent}” by looking up the H2H fixture for the current user and `gameWeek` from a new API (e.g. `GET /api/v1/leagues/:id/h2h-fixtures` or from leaderboard/fixtures payload). Do **not** remove or change the existing per-match result cards for classic.

### 2.5 H2H Fixtures tab/section (new, only for H2H)

**Location:** In the right column, e.g. after “League Leaderboard” and before “League members” (or in a tabbed layout).

- **Render only when** `leagueMode === 'h2h_scorers'`.
- **Content:** List or table of head-to-head fixtures (e.g. by gameweek: “You vs Alice”, “Bob vs Charlie”, …). Data from something like `GET /api/v1/leagues/:id/h2h-fixtures` (or embedded in league detail). No impact on classic leagues.

### 2.6 Backfill standings (admin)

**Location:** Backfill standings dialog and submit handler (around 1525–1585).

- **Optional:** For `leagueMode === 'h2h_scorers'`, you can hide or disable backfill (since H2H standings are computed from fixtures), or keep it and let the backend reject or no-op for H2H. Prefer not changing the classic backfill flow.

---

## 3. Predictions.js (Score + optional scorer prediction)

### 3.1 Props

**Location:** Component signature (line 32).

- **Add optional prop:** e.g. `leagueMode` or `enableScorerPredictions` (boolean).  
  Example: `enableScorerPredictions = false` so that by default (and for classic) no scorer UI is shown.

### 3.2 Call site in Members.js

**Location:** Where `<Predictions ... />` is rendered (around line 822).

- **Pass:** `enableScorerPredictions={leagueMode === 'h2h_scorers'}` (and keep passing `leagueId`, `allowAskAi`, etc.).

### 3.3 Predictions.js – scorer UI and payload

**Location:** Inside the form (both table row and card layout).

- **When `enableScorerPredictions === false`:** Render exactly as today (only home/away score inputs). Submit payload unchanged: only `fixture_id`, `home_team_score`, `away_team_score`.
- **When `enableScorerPredictions === true`:**  
  - Add optional UI for “predicted scorers” (e.g. home scorers, away scorers).  
  - Extend submit payload to include e.g. `predicted_scorers_home`, `predicted_scorers_away` when present.  
  - Backend should ignore these fields for classic leagues and for any league where `mode !== 'h2h_scorers'`.

Do **not** change validation or submit behaviour for the classic case (scores only).

### 3.4 Form initial values and schema (Predictions.js)

**Location:** `initialValues` and `predictionSchema` in Predictions.js.

- Keep existing `home_team_score` / `away_team_score` required.  
- If you add scorer fields, make them optional (and only used when `enableScorerPredictions` is true).

---

## 4. Results.js

**Current state:** The file is empty; the `/results` route in App.js shows a placeholder (“Results (coming soon)”).

- **No change required** for the mode flag. When you later implement a dedicated Results page, have it accept or load league context and branch on `league.mode` the same way as Members.js (classic vs H2H result views).

---

## 5. Backend (wherever your API lives)

Apply the same principle: **never change behaviour for existing leagues; branch on `mode`.**

- **League model/table:** Add `mode` (e.g. `'classic' | 'h2h_scorers'`), default `'classic'`. Backfill existing rows to `'classic'`.
- **POST /api/v1/leagues (create):** Accept `mode`; store it; for `h2h_scorers` optionally create H2H schedule and return it.
- **GET /api/v1/leagues (list/detail):** Include `mode` in each league object (default `'classic'`).
- **GET /api/v1/leagues/:id/leaderboard:**  
  - If `league.mode === 'classic'`: keep current response (points, wins, draws, losses, weeks_won, etc.).  
  - If `league.mode === 'h2h_scorers'`: return H2H standings (wins, draws, losses, h2h_points, total_prediction_points), computed from weekly H2H fixtures and prediction points.
- **Predictions:** Accept optional scorer fields; ignore them unless the league is `h2h_scorers`. Scoring logic: use classic scoring for classic leagues; use classic + scorer/clean-sheet bonuses for H2H.
- **New endpoints for H2H (only used when mode is h2h_scorers):** e.g. `GET /api/v1/leagues/:id/h2h-fixtures`, and possibly `GET /api/v1/leagues/:id/h2h-results?round=12`.

---

## 6. Summary checklist

| File / Area            | Action |
|------------------------|--------|
| **Leagues.js**         | Add `createMode` state; add `mode` to create payload; add Game Type radios in Create Dialog; optionally show mode on league cards. |
| **Members.js**         | Derive `leagueMode` from `leagueDetail`; branch Leaderboard layout and columns on `leagueMode`; optionally add H2H result line and H2H Fixtures section for `h2h_scorers` only; leave classic flow untouched. |
| **Predictions.js**     | Add prop `enableScorerPredictions`; when false, no UI or payload change; when true, add scorer UI and extend payload; keep classic validation and submit behaviour. |
| **Members.js (Predictions usage)** | Pass `enableScorerPredictions={leagueMode === 'h2h_scorers'}`. |
| **Results.js**         | No change for mode flag; when implemented, branch on league mode. |
| **Backend**            | Add `mode` to league; create/read/include in APIs; leaderboard and scoring branch on `mode`; add H2H-only endpoints. |

Using this layout keeps classic leagues on their current code paths and confines all new behaviour to `mode === 'h2h_scorers'`.
