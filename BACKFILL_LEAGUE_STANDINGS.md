# Backfilling league standings from a Google Sheet

You can import wins/draws/losses/points for league members (e.g. from a spreadsheet) so the leaderboard shows that data instead of (or before) prediction-based results.

## Requirements

- You must be a **league admin**.
- Each row in your sheet must match an **existing league member** by **display name** (the name they use in that league). Names are matched case-insensitively.

## Sheet format

Your sheet should have columns like:

| display_name | wins | draws | losses | points |
|--------------|------|-------|--------|--------|
| Alice        | 5    | 2     | 1      | 17     |
| Bob          | 4    | 3     | 1      | 15     |

- **display_name** – Must match the member’s display name in the league.
- **wins**, **draws**, **losses** – Integers. Optional; omit or use 0 if you only have points.
- **points** – Optional. If omitted, it’s computed as `wins*3 + draws*1 + losses*0`.

## API

**POST** `/api/v1/leagues/<league_id>/backfill-standings`

- **Auth:** Bearer token (admin of the league).
- **Body:**

```json
{
  "standings": [
    { "display_name": "Alice", "wins": 5, "draws": 2, "losses": 1, "points": 17 },
    { "display_name": "Bob", "wins": 4, "draws": 3, "losses": 1 }
  ]
}
```

- **Response:** `{ "message": "Backfilled standings for N member(s)" }`
- Rows whose `display_name` don’t match any league member are skipped (no error).

## From Google Sheets

1. Put your data in a sheet with columns: `display_name`, `wins`, `draws`, `losses`, `points` (or a subset).
2. Export or convert to JSON:
   - **Option A:** Use a formula or script in Apps Script to build the `standings` array and call your API (with a service account or script that sends the Bearer token).
   - **Option B:** Export as CSV, then convert CSV → JSON (e.g. with a small script or an online converter) and paste into a REST client (Postman, Insomnia, or a small frontend “Import” button that reads the file and calls the API).
3. Call **POST** `https://your-api.onrender.com/api/v1/leagues/<league_id>/backfill-standings` with:
   - Header: `Authorization: Bearer <your_token>`
   - Header: `Content-Type: application/json`
   - Body: `{ "standings": [ ... ] }`

## After backfill

- The **leaderboard** for that league will show the backfilled wins/draws/losses/points for any member who has backfill data.
- To switch back to prediction-based standings, an admin would need to clear backfill (e.g. set those members’ backfill fields to null via a future “Clear backfill” endpoint or DB update).

## Clearing backfill

There is no “clear backfill” endpoint yet. To reset a member to prediction-based standings, you’d set their `backfill_wins`, `backfill_draws`, `backfill_losses`, `backfill_points` back to `null` in the database, or we can add a **DELETE** or **PATCH** endpoint for that if you want.
