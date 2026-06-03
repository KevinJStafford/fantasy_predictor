/**
 * Cached snapshot of the user's leagues (sessionStorage).
 * Speeds up league list / league page loads and supplies competition_slug
 * before the /api/v1/leagues round-trip (avoids defaulting to eng.1).
 */

const STORAGE_KEY = 'fp_user_leagues_v1'

function readRaw() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.leagues)) return null
        return parsed
    } catch {
        return null
    }
}

export function getCachedLeagues() {
    return readRaw()?.leagues ?? []
}

export function getLeagueFromSnapshot(leagueId) {
    const id = Number(leagueId)
    if (!id) return null
    return getCachedLeagues().find((l) => Number(l.id) === id) || null
}

export function writeLeaguesSnapshot(leagues) {
    try {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ leagues: leagues || [], updatedAt: Date.now() })
        )
    } catch {
        /* ignore quota / private mode */
    }
}

export function upsertLeagueInSnapshot(league) {
    if (!league?.id) return
    const leagues = [...getCachedLeagues()]
    const idx = leagues.findIndex((l) => Number(l.id) === Number(league.id))
    if (idx >= 0) leagues[idx] = { ...leagues[idx], ...league }
    else leagues.push(league)
    writeLeaguesSnapshot(leagues)
}

export function removeLeagueFromSnapshot(leagueId) {
    const id = Number(leagueId)
    if (!id) return
    writeLeaguesSnapshot(getCachedLeagues().filter((l) => Number(l.id) !== id))
}

export function clearLeaguesSnapshot() {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        /* ignore */
    }
}

/** Competition slug for API calls while viewing a league (cache-aware). */
export function competitionSlugForLeagueView(leagueId, leagueDetail, selectedCompetition) {
    if (!leagueId) return selectedCompetition || 'eng.1'
    const id = Number(leagueId)
    if (Number(leagueDetail?.id) === id && leagueDetail.competition_slug) {
        return leagueDetail.competition_slug
    }
    const cached = getLeagueFromSnapshot(id)
    if (cached?.competition_slug) return cached.competition_slug
    if (leagueDetail?.competition_slug) return leagueDetail.competition_slug
    return selectedCompetition || 'eng.1'
}

export function applyLeagueCompetitionToState(league, setSelectedCompetition) {
    if (!league || !setSelectedCompetition) return
    if (league.competition_slug) {
        setSelectedCompetition(league.competition_slug)
    }
}

/**
 * Fetch /api/v1/leagues, update snapshot, return leagues array.
 */
export function refreshUserLeagues(authenticatedFetch) {
    return authenticatedFetch('/api/v1/leagues')
        .then((res) => (res.ok ? res.json() : { leagues: [] }))
        .then((data) => {
            const leagues = data.leagues || []
            writeLeaguesSnapshot(leagues)
            return leagues
        })
}

/**
 * Fetch a single league by id; updates snapshot entry. Throws with .status 403|404 when not allowed.
 */
export function fetchLeagueById(authenticatedFetch, leagueId) {
    const id = Number(leagueId)
    if (!id) return Promise.resolve(null)
    return authenticatedFetch(`/api/v1/leagues/${id}`)
        .then((res) =>
            res.json().then((data) => ({
                ok: res.ok,
                status: res.status,
                data,
            }))
        )
        .then(({ ok, status, data }) => {
            if (status === 404 || status === 403) {
                const err = new Error(data.error || 'League not found')
                err.status = status
                throw err
            }
            if (!ok) {
                throw new Error(data.error || 'Failed to load league')
            }
            const league = data.league || null
            if (league) upsertLeagueInSnapshot(league)
            return league
        })
}
