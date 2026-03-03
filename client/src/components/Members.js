import * as React from 'react'
import Navbar from './Navbar'
import Predictions from './Predictions'
import {useEffect, useState} from 'react'
import { useLocation, useHistory } from 'react-router-dom'
import {
    Typography, Button, Box, Alert, Card, CardContent, Grid, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Select, MenuItem, FormControl, InputLabel
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { apiUrl, authenticatedFetch } from '../utils/api'


function Members() {
    const location = useLocation()
    const history = useHistory()
    const [leagueId, setLeagueId] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
    const [leaderboardScope, setLeaderboardScope] = useState('full_season')
    const [leaderboardCurrentRound, setLeaderboardCurrentRound] = useState(null)
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [filteredFixtures, setFilteredFixtures] = useState([])
    const [availableRounds, setAvailableRounds] = useState([])
    const [gameWeek, setGameWeek] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState(null)
    const [loadingFixtures, setLoadingFixtures] = useState(false)
    const [predictions, setPredictions] = useState([])
    const [loadingPredictions, setLoadingPredictions] = useState(false)
    // Admin: current user and league with members/roles
    const [currentUser, setCurrentUser] = useState(null)
    const [leagueDetail, setLeagueDetail] = useState(null)
    const [deleteLeagueDialog, setDeleteLeagueDialog] = useState(false)
    const [removingMemberId, setRemovingMemberId] = useState(null)
    const [updatingRoleId, setUpdatingRoleId] = useState(null)
    const [adminMemberPredictions, setAdminMemberPredictions] = useState([])
    const [adminSelectedMemberId, setAdminSelectedMemberId] = useState('')
    const [loadingMemberPredictions, setLoadingMemberPredictions] = useState(false)
    const [editPredictionDialog, setEditPredictionDialog] = useState(null) // { gameId, home_team, away_team, home_team_score, away_team_score }
    const [addPredictionDialog, setAddPredictionDialog] = useState(null) // { home_team, away_team, home_team_score, away_team_score } for missed pick
    const [adminPredictionRound, setAdminPredictionRound] = useState('')
    const [adminFixturesForRound, setAdminFixturesForRound] = useState([])
    const [loadingAdminFixtures, setLoadingAdminFixtures] = useState(false)
    const [backfillDialogOpen, setBackfillDialogOpen] = useState(false)
    const [backfillJson, setBackfillJson] = useState('')
    const [backfillMessage, setBackfillMessage] = useState(null)
    const [plStandings, setPlStandings] = useState(null)
    const [loadingStandings, setLoadingStandings] = useState(false)
    const [standingsError, setStandingsError] = useState(null)
    const [competitions, setCompetitions] = useState([])
    const [selectedCompetition, setSelectedCompetition] = useState('eng.1')
    const [displayNameDialogOpen, setDisplayNameDialogOpen] = useState(false)
    const [displayNameDraft, setDisplayNameDraft] = useState('')
    const [displayNameError, setDisplayNameError] = useState(null)
    const [displayNameSaving, setDisplayNameSaving] = useState(false)

    // Prefer backend is_admin flag; fallback to member role or league creator
    const isAdmin = leagueDetail?.is_admin === true ||
        leagueDetail?.members?.some(m => Number(m.id) === Number(currentUser?.id) && m.role === 'admin') ||
        (leagueDetail?.created_by != null && currentUser?.id != null && Number(leagueDetail.created_by) === Number(currentUser.id)) ||
        false
    const leagueMembers = leagueDetail?.members ?? []
    // When viewing a league, use its competition for API calls so we don't hit eng.1 before state updates
    const effectiveCompetition = leagueDetail?.competition_slug ?? selectedCompetition
    const isWorldCup = effectiveCompetition === 'fifa.world'
    const weekOrDayLabel = isWorldCup ? 'Day' : 'Game Week'
    const weekOrDayTitle = (num) => isWorldCup ? `Day ${num}` : `Week ${num}`

    // Get league_id from URL query params
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const leagueParam = params.get('league')
        if (leagueParam && !Number.isNaN(parseInt(leagueParam, 10))) {
            setLeagueId(parseInt(leagueParam, 10))
        } else {
            setLeagueId(null)
        }
    }, [location.search, history])

    // Fetch current user
    useEffect(() => {
        authenticatedFetch('/api/v1/authorized')
            .then(res => res.ok ? res.json() : null)
            .then(user => setCurrentUser(user))
            .catch(() => setCurrentUser(null))
    }, [])

    // Fetch leagues (to get league detail with members/roles) and leaderboard when league_id is set
    useEffect(() => {
        if (!leagueId) return
        authenticatedFetch('/api/v1/leagues')
            .then(res => res.ok ? res.json() : { leagues: [] })
            .then(data => {
                const league = (data.leagues || []).find(l => l.id === leagueId)
                setLeagueDetail(league || null)
                if (league?.competition_slug) {
                    setSelectedCompetition(league.competition_slug)
                } else if (league) {
                    setSelectedCompetition('eng.1')
                }
            })
            .catch(() => setLeagueDetail(null))
        fetchLeaderboard()
    }, [leagueId])

    // Fetch supported competitions (leagues) for predictions
    useEffect(() => {
        fetch(apiUrl('/api/v1/competitions'))
            .then(res => res.ok ? res.json() : { competitions: [] })
            .then(data => setCompetitions(data.competitions || []))
            .catch(() => setCompetitions([]))
    }, [])

    // Fetch league standings for current competition (all except World Cup)
    const [standingsTitle, setStandingsTitle] = useState('')
    useEffect(() => {
        if (effectiveCompetition === 'fifa.world' || !effectiveCompetition) {
            setPlStandings(null)
            setStandingsError(null)
            setStandingsTitle('')
            return
        }
        setLoadingStandings(true)
        setStandingsError(null)
        setStandingsTitle('')
        const url = apiUrl('/api/v1/standings') + '?competition=' + encodeURIComponent(effectiveCompetition)
        fetch(url)
            .then(res => res.ok ? res.json() : res.json().then(err => { throw new Error(err.error || 'Failed to load standings') }))
            .then(data => {
                setPlStandings(data.standings || [])
                setStandingsTitle(data.competition_name || '')
            })
            .catch(err => {
                setStandingsError(err.message || 'Could not load league table')
                setPlStandings([])
            })
            .finally(() => setLoadingStandings(false))
    }, [effectiveCompetition])

    // On league page load: refresh results (check-results) for everyone; admins also refresh scores from the right source
    useEffect(() => {
        if (!leagueId) return
        // Everyone: run check-results so W/D/L are up to date from current fixture data
        authenticatedFetch('/api/v1/predictions/check-results', { method: 'POST' })
            .then(() => {
                getPredictions()
                fetchLeaderboard()
            })
            .catch(() => {})

        if (!isAdmin) return
        // Admin: refresh scores. All leagues (including Premier League eng.1) use competition=slug; backend uses football-data.org or ESPN.
        const syncBody = { competition: effectiveCompetition || 'eng.1' }
        setSyncing(true)
        const syncPromise = authenticatedFetch(apiUrl('/api/v1/fixtures/sync-scores'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncBody)
        })
        syncPromise
            .then(res => res.ok ? res.json() : res.json().then(err => { throw new Error(err.error || 'Sync failed') }))
            .then(data => {
                if (data && data.error) throw new Error(data.error)
                return authenticatedFetch('/api/v1/predictions/check-results', { method: 'POST' })
            })
            .then(() => {
                getPredictions()
                fetchLeaderboard()
                if (leagueId) getAvailableRounds()
                if (leagueId) loadCurrentRoundAndFixtures()
            })
            .catch(() => {})
            .finally(() => setSyncing(false))
    }, [leagueId, isAdmin, effectiveCompetition])

    function getAvailableRounds() {
        const q = effectiveCompetition ? `?competition=${encodeURIComponent(effectiveCompetition)}` : ''
        fetch(apiUrl('/api/v1/fixtures/rounds') + q)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch rounds')
            }
            return response.json()
        })
        .then(data => {
            const rounds = data.rounds || []
            setAvailableRounds(rounds)
            return rounds
        })
        .catch(error => {
            console.error('Error fetching rounds:', error)
            setAvailableRounds([])
            return []
        })
    }

    /** Load the default game week: the lowest week that has not fully completed yet (week 1
     *  before GW1, then week 2 after GW1, etc.). */
    function loadCurrentRoundAndFixtures() {
        const compQ = effectiveCompetition ? `&competition=${encodeURIComponent(effectiveCompetition)}` : ''
        fetch(apiUrl('/api/v1/fixtures/current-round') + '?t=' + Date.now() + compQ, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : { round: null })
        .then(data => {
            const round = data.round != null ? String(data.round) : ''
            setGameWeek(round)
            if (round) {
                getFixtures(parseInt(round, 10))
            } else {
                setFilteredFixtures([])
            }
        })
        .catch(() => {
            setGameWeek('')
            setFilteredFixtures([])
        })
    }

    function getFixtures(roundNumber = null) {
        setLoadingFixtures(true)
        const base = roundNumber ? apiUrl(`/api/v1/fixtures/${roundNumber}`) : apiUrl('/api/v1/fixtures')
        const url = base + (effectiveCompetition ? `?competition=${encodeURIComponent(effectiveCompetition)}` : '')
        fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch fixtures')
            }
            return response.json()
        })
        .then(fixturesData => {
            const fixturesList = Array.isArray(fixturesData) ? fixturesData : []
            const sorted = [...fixturesList].sort((a, b) => {
                const ad = a?.fixture_date ? new Date(a.fixture_date).getTime() : Number.POSITIVE_INFINITY
                const bd = b?.fixture_date ? new Date(b.fixture_date).getTime() : Number.POSITIVE_INFINITY
                return ad - bd
            })
            setFilteredFixtures(sorted)
        })
        .catch(error => {
            console.error('Error fetching fixtures:', error)
            setFilteredFixtures([])
        })
        .finally(() => {
            setLoadingFixtures(false)
        })
    }

    function refreshScores() {
        if (!leagueId && !effectiveCompetition) return
        const params = new URLSearchParams({ competition: effectiveCompetition || 'eng.1' })
        const url = apiUrl('/api/v1/fixtures/sync-scores') + '?' + params.toString()
        setSyncing(true)
        setSyncMessage(null)
        authenticatedFetch(url, { method: 'GET' })
            .then(res => {
                if (res.status === 404) {
                    const e = new Error('Refresh scores not available')
                    e.status = 404
                    throw e
                }
                return res.ok ? res.json() : res.json().then(err => { throw new Error(err.error || 'Sync failed') })
            })
            .then(data => {
                if (data && data.error) throw new Error(data.error)
                const updated = data.fixtures_updated ?? data.updated ?? 0
                const notFound = data.fixtures_not_found ?? 0
                setSyncMessage({
                    type: 'success',
                    text: `Scores refreshed: ${updated} fixture(s) updated.${notFound ? ` ${notFound} API match(es) had no matching fixture.` : ''}`
                })
                return authenticatedFetch('/api/v1/predictions/check-results', { method: 'POST' })
            })
            .then(() => {
                getPredictions()
                fetchLeaderboard()
                if (leagueId) getAvailableRounds()
                if (leagueId) loadCurrentRoundAndFixtures()
            })
            .catch(err => {
                const msg = err.status === 404
                    ? 'Refresh scores is not available on this server. Deploy the latest backend (with /api/v1/fixtures/sync-scores) to enable it.'
                    : (err.message || 'Failed to refresh scores.')
                setSyncMessage({ type: 'error', text: msg })
            })
            .finally(() => {
                setSyncing(false)
                setTimeout(() => setSyncMessage(null), 6000)
            })
    }

    function syncFixtures() {
        setSyncing(true)
        setSyncMessage(null)
        const comp = competitions.find(c => c.slug === effectiveCompetition)
        const isFootballData = comp && comp.source === 'football_data'
        const isEspn = comp && comp.source === 'espn'
        let body
        if (isFootballData) {
            body = { source: 'football_data', league_slug: comp.slug, competition: comp.slug }
        } else if (isEspn) {
            body = { source: 'espn', league_slug: comp.espn_slug || comp.slug }
        } else if (effectiveCompetition === 'eng.1' || (comp && comp.slug === 'eng.1')) {
            body = { source: 'football_data', league_slug: 'eng.1', competition: 'eng.1' }
        } else {
            body = { source: 'football_data', league_slug: effectiveCompetition || 'eng.1', competition: effectiveCompetition || 'eng.1' }
        }
        fetch(apiUrl('/api/v1/fixtures/sync'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        .then(async response => {
            const contentType = response.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text()
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`)
            }
            
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`)
            }
            return data
        })
        .then(async data => {
            if (data.error) {
                setSyncMessage({ type: 'error', text: data.error })
                return
            }
            const details = [
                data.added != null ? `added=${data.added}` : null,
                data.updated != null ? `updated=${data.updated}` : null,
                data.total_written != null ? `total=${data.total_written}` : null,
                data.window_start_utc && data.window_end_utc ? `window=${data.window_start_utc} → ${data.window_end_utc}` : null,
                data.fixtures_seen != null ? `seen=${data.fixtures_seen}` : null,
                data.fixtures_with_parsed_date != null ? `parsed_dates=${data.fixtures_with_parsed_date}` : null,
                data.fixtures_in_window != null ? `in_window=${data.fixtures_in_window}` : null,
                data.skipped_no_date != null ? `skipped_no_date=${data.skipped_no_date}` : null,
                data.skipped_outside_window != null ? `skipped_outside_window=${data.skipped_outside_window}` : null,
                data.parsed_min_date_utc ? `api_min=${data.parsed_min_date_utc}` : null,
                data.parsed_max_date_utc ? `api_max=${data.parsed_max_date_utc}` : null,
            ].filter(Boolean).join(' | ')

            let text = `Sync complete. ${details}`
            // After syncing fixture list, pull in latest scores for this league (all use competition=slug)
            try {
                const scoreParams = new URLSearchParams({ competition: effectiveCompetition || 'eng.1' })
                const scoreRes = await authenticatedFetch(apiUrl('/api/v1/fixtures/sync-scores') + '?' + scoreParams.toString(), { method: 'GET' })
                const scoreData = await (scoreRes.ok ? scoreRes.json() : scoreRes.json().then(() => ({})))
                const scoreUpdated = scoreData.fixtures_updated ?? scoreData.updated ?? 0
                if (scoreUpdated > 0) text += ` Scores updated: ${scoreUpdated} fixture(s).`
                await authenticatedFetch('/api/v1/predictions/check-results', { method: 'POST' }).catch(() => {})
                getPredictions()
                fetchLeaderboard()
            } catch (_) { /* non-fatal */ }
            setSyncMessage({ type: 'success', text })
            getAvailableRounds()
            loadCurrentRoundAndFixtures()
        })
        .catch(error => {
            console.error('Error syncing fixtures:', error)
            setSyncMessage({ type: 'error', text: error.message || 'Failed to sync fixtures. Please check the backend console for details.' })
        })
        .finally(() => {
            setSyncing(false)
            setTimeout(() => setSyncMessage(null), 5000)
        })
    }

    function getPredictions() {
        setLoadingPredictions(true)
        const url = leagueId ? `/api/v1/predictions?league_id=${leagueId}` : '/api/v1/predictions'
        authenticatedFetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch predictions')
            }
            return response.json()
        })
        .then(data => {
            console.log('Predictions fetched:', data)
            console.log('Debug info:', data.debug)
            const preds = data.predictions || []
            console.log('Total predictions:', preds.length)
            const completed = preds.filter(p => p.fixture && p.fixture.is_completed && p.fixture.actual_home_score !== null && p.fixture.actual_away_score !== null)
            console.log('Completed predictions:', completed.length)
            setPredictions(preds)
        })
        .catch(error => {
            console.error('Error fetching predictions:', error)
            setPredictions([])
        })
        .finally(() => {
            setLoadingPredictions(false)
        })
    }

    function fetchLeaderboard(round = null) {
        if (!leagueId) return
        setLoadingLeaderboard(true)
        const roundQ = round != null ? `&round=${round}` : ''
        authenticatedFetch(`/api/v1/leagues/${leagueId}/leaderboard?t=${Date.now()}${roundQ}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch leaderboard')
                }
                return response.json()
            })
            .then(data => {
                setLeaderboard(data.leaderboard || [])
                setLeaderboardScope(data.scope || 'full_season')
                setLeaderboardCurrentRound(data.current_round ?? null)
            })
            .catch(error => {
                console.error('Error fetching leaderboard:', error)
                setLeaderboard([])
                setLeaderboardScope('full_season')
                setLeaderboardCurrentRound(null)
            })
            .finally(() => {
                setLoadingLeaderboard(false)
            })
    }

    function refreshLeagueDetail() {
        if (!leagueId) return
        authenticatedFetch('/api/v1/leagues')
            .then(res => res.ok ? res.json() : { leagues: [] })
            .then(data => {
                const league = (data.leagues || []).find(l => l.id === leagueId)
                setLeagueDetail(league || null)
            })
            .catch(() => setLeagueDetail(null))
        fetchLeaderboard()
    }

    const myMembership = leagueMembers.find(m => Number(m.id) === Number(currentUser?.id))

    function handleOpenDisplayNameDialog() {
        setDisplayNameDraft(myMembership?.display_name ?? '')
        setDisplayNameError(null)
        setDisplayNameDialogOpen(true)
    }

    function handleSaveDisplayName() {
        const name = (displayNameDraft || '').trim()
        if (!name) {
            setDisplayNameError('Display name cannot be empty')
            return
        }
        if (!leagueId) return
        setDisplayNameError(null)
        setDisplayNameSaving(true)
        authenticatedFetch(`/api/v1/leagues/${leagueId}/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: name }),
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (ok) {
                    setDisplayNameDialogOpen(false)
                    refreshLeagueDetail()
                } else {
                    setDisplayNameError(data.error || 'Failed to update display name')
                }
            })
            .catch(() => setDisplayNameError('Failed to update display name. Please try again.'))
            .finally(() => setDisplayNameSaving(false))
    }

    function handleDeleteLeague() {
        if (!leagueId) return
        authenticatedFetch(`/api/v1/leagues/${leagueId}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    setDeleteLeagueDialog(false)
                    history.push('/leagues')
                } else {
                    return res.json().then(data => { throw new Error(data.error || 'Failed to delete league') })
                }
            })
            .catch(err => {
                setSyncMessage({ type: 'error', text: err.message || 'Failed to delete league' })
                setTimeout(() => setSyncMessage(null), 5000)
            })
    }

    function handleRemoveMember(memberUserId) {
        if (!leagueId) return
        setRemovingMemberId(memberUserId)
        authenticatedFetch(`/api/v1/leagues/${leagueId}/members/${memberUserId}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    refreshLeagueDetail()
                } else {
                    return res.json().then(data => { throw new Error(data.error || 'Failed to remove member') })
                }
            })
            .catch(err => {
                setSyncMessage({ type: 'error', text: err.message || 'Failed to remove member' })
                setTimeout(() => setSyncMessage(null), 5000)
            })
            .finally(() => setRemovingMemberId(null))
    }

    function handleUpdateMemberRole(memberUserId, newRole) {
        if (!leagueId || !newRole) return
        setUpdatingRoleId(memberUserId)
        authenticatedFetch(`/api/v1/leagues/${leagueId}/members/${memberUserId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        })
            .then(res => {
                if (res.ok) {
                    refreshLeagueDetail()
                } else {
                    return res.json().then(data => { throw new Error(data.error || 'Failed to update role') })
                }
            })
            .catch(err => {
                setSyncMessage({ type: 'error', text: err.message || 'Failed to update role' })
                setTimeout(() => setSyncMessage(null), 5000)
            })
            .finally(() => setUpdatingRoleId(null))
    }

    function handleFetchMemberPredictions(memberUserId) {
        if (!leagueId || !memberUserId) return
        setLoadingMemberPredictions(true)
        setAdminMemberPredictions([])
        authenticatedFetch(`/api/v1/leagues/${leagueId}/members/${memberUserId}/predictions`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load predictions')
                return res.json()
            })
            .then(data => {
                setAdminMemberPredictions(data.predictions || [])
            })
            .catch(() => setAdminMemberPredictions([]))
            .finally(() => setLoadingMemberPredictions(false))
    }

    function handleAdminUpdatePrediction(gameId, home_team_score, away_team_score) {
        if (!leagueId || gameId == null) return
        authenticatedFetch(`/api/v1/leagues/${leagueId}/games/${gameId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ home_team_score: Number(home_team_score), away_team_score: Number(away_team_score) })
        })
            .then(res => {
                if (!res.ok) return res.json().then(data => { throw new Error(data.error || 'Failed to update') })
                setEditPredictionDialog(null)
                handleFetchMemberPredictions(adminSelectedMemberId)
                fetchLeaderboard()
            })
            .catch(err => {
                setSyncMessage({ type: 'error', text: err.message || 'Failed to update prediction' })
                setTimeout(() => setSyncMessage(null), 5000)
            })
    }

    function handleAdminCreatePrediction(memberUserId, home_team, away_team, home_team_score, away_team_score) {
        if (!leagueId || !memberUserId) return
        authenticatedFetch(`/api/v1/leagues/${leagueId}/members/${memberUserId}/predictions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ home_team, away_team, home_team_score: Number(home_team_score), away_team_score: Number(away_team_score) })
        })
            .then(res => {
                if (!res.ok) return res.json().then(data => { throw new Error(data.error || 'Failed to add prediction') })
                setAddPredictionDialog(null)
                handleFetchMemberPredictions(adminSelectedMemberId)
                if (adminPredictionRound) getAdminFixturesForRound(Number(adminPredictionRound))
                fetchLeaderboard()
            })
            .catch(err => {
                setSyncMessage({ type: 'error', text: err.message || 'Failed to add prediction' })
                setTimeout(() => setSyncMessage(null), 5000)
            })
    }

    function getAdminFixturesForRound(roundNum) {
        if (roundNum == null || roundNum === '') {
            setAdminFixturesForRound([])
            return
        }
        setLoadingAdminFixtures(true)
        const url = apiUrl(`/api/v1/fixtures/${roundNum}`) + (effectiveCompetition ? `?competition=${encodeURIComponent(effectiveCompetition)}` : '')
        fetch(url)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setAdminFixturesForRound([...list].sort((a, b) => {
                    const ad = a?.fixture_date ? new Date(a.fixture_date).getTime() : 0
                    const bd = b?.fixture_date ? new Date(b.fixture_date).getTime() : 0
                    return ad - bd
                }))
            })
            .catch(() => setAdminFixturesForRound([]))
            .finally(() => setLoadingAdminFixtures(false))
    }

    // Load available rounds and predictions on mount (skip predictions if league in URL - league effect will fetch with league_id to avoid race)
    useEffect(() => {
        getAvailableRounds()
        const hasLeagueInUrl = /\bleague=\d+/.test(location.search)
        if (!hasLeagueInUrl) getPredictions()
    }, [])

    // When not viewing a league, load current round once on mount (league view uses effect below)
    useEffect(() => {
        if (!leagueId) loadCurrentRoundAndFixtures()
    }, [])

    // When league is selected, refresh default game week and predictions (with league_id so fixture resolution uses correct competition)
    useEffect(() => {
        if (leagueId && leagueDetail?.id === leagueId) {
            loadCurrentRoundAndFixtures()
            getAvailableRounds()
            getPredictions()
        }
    }, [leagueId, leagueDetail])

    // When competition (league) changes, refresh rounds and current week/fixtures
    useEffect(() => {
        getAvailableRounds()
        loadCurrentRoundAndFixtures()
    }, [selectedCompetition])

    // When user selects a different week from dropdown (weekly leagues), refetch leaderboard for that week
    useEffect(() => {
        if (leagueId && leaderboardScope === 'weekly' && gameWeek) {
            const roundNum = parseInt(gameWeek, 10)
            if (!Number.isNaN(roundNum)) fetchLeaderboard(roundNum)
        }
    }, [gameWeek, leaderboardScope, leagueId])

    const handleDropdownChange = (e) => {
        const selectedValue = e.target.value;
        setGameWeek(selectedValue);
        if (selectedValue === '' || selectedValue === 'all') {
            setFilteredFixtures([])
        } else {
            // Fetch fixtures for the selected round
            getFixtures(parseInt(selectedValue))
        }
    }

    console.log("reuslts", filteredFixtures)

    return (
        <>
        <Navbar />
        <Box component="div" sx={{ px: 2, pr: { xs: 2, sm: 3, md: 4 }, pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button 
                    variant="outlined" 
                    color="primary"
                    onClick={() => history.push('/leagues')}
                >
                    ← Back to Leagues
                </Button>
                {isAdmin && (
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => setDeleteLeagueDialog(true)}
                    >
                        Delete league
                    </Button>
                )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {isAdmin && (
                    <>
                        <Button 
                            variant="contained" 
                            color="primary"
                            onClick={syncFixtures} 
                            disabled={syncing}
                        >
                            {syncing ? 'Syncing...' : 'Sync Fixtures'}
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={refreshScores}
                            disabled={syncing}
                        >
                            Refresh scores
                        </Button>
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => setBackfillDialogOpen(true)}
                            disabled={syncing}
                        >
                            Backfill standings
                        </Button>
                    </>
                )}
            </Box>
        </Box>
        
        {syncMessage && (
            <Alert severity={syncMessage.type} sx={{ mb: 2 }}>
                {syncMessage.text}
            </Alert>
        )}
        
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" component="label">League:</Typography>
                {leagueDetail?.competition_slug ? (
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {competitions.find(c => c.slug === leagueDetail.competition_slug)?.name || leagueDetail.competition_slug}
                    </Typography>
                ) : (
                    <select
                        value={selectedCompetition}
                        onChange={(e) => setSelectedCompetition(e.target.value)}
                        style={{ padding: '8px', fontSize: '16px', minWidth: '180px' }}
                    >
                        {competitions.length ? competitions.map(c => (
                            <option key={c.slug} value={c.slug}>{c.name}</option>
                        )) : (
                            <option value="eng.1">English Premier League</option>
                        )}
                    </select>
                )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" component="label">{weekOrDayLabel}:</Typography>
                <select
                    value={gameWeek}
                    onChange={handleDropdownChange}
                    style={{ padding: '8px', fontSize: '16px', minWidth: '150px' }}
                >
                    <option value="">-- Select {isWorldCup ? 'Day' : 'Week'} --</option>
                    {availableRounds.map(round => (
                        <option key={round} value={round}>{weekOrDayTitle(round)}</option>
                    ))}
                </select>
            </Box>
        </Box>

        {!leagueId && (
            <Alert severity="warning" sx={{ mb: 2 }}>
                Missing league selection. Please go back to Leagues and pick a league.
                <Box sx={{ mt: 1 }}>
                    <Button variant="outlined" color="primary" size="small" onClick={() => history.push('/leagues')}>
                        Go to Leagues
                    </Button>
                </Box>
            </Alert>
        )}

        <Grid container spacing={3}>
            {/* Left side: Predictions and Results - pl: 2 on md so table left edge aligns with PL table in right column */}
            <Grid item xs={12} md={7} sx={{ pl: { md: 2 } }}>
                {gameWeek ? (
                    <>
                        <Typography variant="h5" component="h2" sx={{ mb: 2, textAlign: 'center', fontWeight: 600 }}>
                            {weekOrDayTitle(gameWeek)}
                        </Typography>

                        {loadingFixtures ? (
                            <Typography variant="body1">Loading fixtures...</Typography>
                        ) : filteredFixtures.length > 0 ? (
                            <TableContainer component={Paper} sx={{ mb: 2 }}>
                                <Table size="small" aria-label="predictions">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'primary.light' }}>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '1rem' }}>Home</TableCell>
                                            <TableCell align="center" sx={{ width: 90, fontWeight: 700, fontSize: '1rem' }}>Score</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '1rem' }}>Away</TableCell>
                                            <TableCell align="center" sx={{ width: 90, fontWeight: 700, fontSize: '1rem' }}>Score</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '1rem' }}>Day/Time</TableCell>
                                            <TableCell align="center" sx={{ width: 80, fontWeight: 700, fontSize: '1rem' }}>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredFixtures.map(fixture => {
                                            const matchingPrediction = predictions.find(p =>
                                                p.fixture && p.fixture.id === fixture.id
                                            ) || predictions.find(p =>
                                                p.home_team && p.away_team &&
                                                p.home_team.toLowerCase().trim() === fixture.fixture_home_team?.toLowerCase().trim() &&
                                                p.away_team.toLowerCase().trim() === fixture.fixture_away_team?.toLowerCase().trim()
                                            )
                                            return (
                                                <Predictions
                                                    key={fixture.id}
                                                    fixture={fixture}
                                                    existingPrediction={matchingPrediction}
                                                    onPredictionSaved={() => {
                                                        getPredictions()
                                                        if (leagueId) fetchLeaderboard()
                                                    }}
                                                    asTableRow
                                                    allowAskAi={leagueDetail?.ai_predictions_enabled === true}
                                                    leagueId={leagueId}
                                                />
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body1" sx={{ mt: 2 }}>
                                No fixtures found for {isWorldCup ? 'day' : 'week'} {gameWeek}. Please sync fixtures first.
                            </Typography>
                        )}

                        {/* Results table - below predictions on desktop */}
                        {gameWeek && (
                            <Box sx={{ mt: 3, display: { xs: 'none', md: 'block' } }}>
                                <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                                    Results - {weekOrDayTitle(gameWeek)}
                                </Typography>
                                {loadingPredictions ? (
                                    <Typography variant="body2">Loading results...</Typography>
                                ) : (() => {
                                    const selectedRound = parseInt(gameWeek, 10)
                                    const roundMatch = (p) => {
                                        const r = p.fixture.round ?? p.fixture.fixture_round
                                        if (r == null) return false
                                        return Number(r) === selectedRound
                                    }
                                    const competitionMatch = (p) => {
                                        if (!effectiveCompetition) return true
                                        if (!leagueDetail?.competition_slug) return true
                                        const slug = p.fixture.competition_slug
                                        if (effectiveCompetition === 'eng.1') return slug === 'eng.1' || slug == null
                                        return slug === effectiveCompetition
                                    }
                                    const hasBothScores = (p) =>
                                        p.fixture.actual_home_score != null && p.fixture.actual_away_score != null
                                    const completedPredictions = predictions
                                        .filter(p => {
                                            if (!p.fixture) return false
                                            if (!hasBothScores(p)) return false
                                            return roundMatch(p) && competitionMatch(p)
                                        })
                                        .sort((a, b) => {
                                            const dateA = a.fixture?.date ? new Date(a.fixture.date).getTime() : 0
                                            const dateB = b.fixture?.date ? new Date(b.fixture.date).getTime() : 0
                                            return dateA - dateB
                                        })
                                    if (completedPredictions.length === 0) {
                                        return (
                                            <Typography variant="body2" sx={{ mt: 2 }}>
                                                No completed predictions for this {isWorldCup ? 'day' : 'week'} yet.
                                            </Typography>
                                        )
                                    }
                                    const getDisplayResult = (p) => {
                                        if (p.game_result) return p.game_result
                                        const f = p.fixture
                                        if (f?.actual_home_score == null || f?.actual_away_score == null || p.home_team_score == null || p.away_team_score == null) return null
                                        const predSame = Number(p.home_team_score) === Number(f.actual_home_score) && Number(p.away_team_score) === Number(f.actual_away_score)
                                        if (predSame) return 'Win'
                                        const ph = Number(p.home_team_score), pa = Number(p.away_team_score), ah = Number(f.actual_home_score), aa = Number(f.actual_away_score)
                                        const predW = ph > pa ? 'home' : (pa > ph ? 'away' : 'draw')
                                        const actW = ah > aa ? 'home' : (aa > ah ? 'away' : 'draw')
                                        return predW === actW ? 'Draw' : 'Loss'
                                    }
                                    const wins = completedPredictions.filter(p => getDisplayResult(p) === 'Win').length
                                    const draws = completedPredictions.filter(p => getDisplayResult(p) === 'Draw').length
                                    const losses = completedPredictions.filter(p => getDisplayResult(p) === 'Loss').length
                                    return (
                                        <>
                                            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                <Chip label={`W: ${wins}`} color="success" size="small" />
                                                <Chip label={`D: ${draws}`} color="warning" size="small" />
                                                <Chip label={`L: ${losses}`} color="error" size="small" />
                                            </Box>
                                            <Box>
                                                {completedPredictions.map((prediction) => {
                                                    const { fixture, home_team, away_team, home_team_score, away_team_score } = prediction
                                                    const displayResult = getDisplayResult(prediction)
                                                    let resultColor = 'default'
                                                    if (displayResult === 'Win') resultColor = 'success'
                                                    else if (displayResult === 'Draw') resultColor = 'warning'
                                                    else if (displayResult === 'Loss') resultColor = 'error'
                                                    return (
                                                        <Card key={prediction.id} sx={{ mb: 1.5 }}>
                                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                                    <Typography variant="subtitle2">{fixture?.round != null ? weekOrDayTitle(fixture.round) : 'N/A'}</Typography>
                                                                    <Chip label={displayResult || 'Pending'} color={resultColor} size="small" />
                                                                </Box>
                                                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                                    {home_team} vs {away_team}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                    <Typography variant="caption">Pred: {home_team_score}-{away_team_score}</Typography>
                                                                    <Typography variant="caption" color="textSecondary">Actual: {fixture.actual_home_score}-{fixture.actual_away_score}</Typography>
                                                                </Box>
                                                            </CardContent>
                                                        </Card>
                                                    )
                                                })}
                                            </Box>
                                        </>
                                    )
                                })()}
                            </Box>
                        )}
                    </>
                ) : (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Please select a {isWorldCup ? 'day' : 'game week'} to view and make predictions for fixtures.
                    </Typography>
                )}
            </Grid>

            {/* Right side: League table (all leagues except World Cup) + Leaderboard */}
            <Grid item xs={12} md={5} sx={{ pl: { md: 2 }, pr: { xs: 2, md: 4 } }}>
                {effectiveCompetition && effectiveCompetition !== 'fifa.world' && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ px: 0, '&:last-child': { pb: 2 }, pt: 2, pb: 0 }}>
                        <Typography variant="h6" component="h3" sx={{ mb: 1.5, fontWeight: 600, px: 2 }}>
                            {standingsTitle || 'League table'}
                        </Typography>
                        {loadingStandings ? (
                            <Typography variant="body2" color="text.secondary">Loading…</Typography>
                        ) : standingsError ? (
                            <Typography variant="body2" color="error" sx={{ px: 2 }}>{standingsError}</Typography>
                        ) : plStandings && plStandings.length > 0 ? (
                            <TableContainer sx={{ maxHeight: 340, overflow: 'auto', px: 0 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                            <TableCell sx={{ fontWeight: 700, width: 32 }}>#</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 36 }}>P</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 36 }}>W</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 36 }}>D</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 36 }}>L</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 36 }}>GF</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 36 }}>GA</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 40 }}>GD</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700, width: 40 }}>Pts</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {plStandings.map((row) => (
                                            <TableRow key={row.position}>
                                                <TableCell sx={{ fontWeight: 500 }}>{row.position}</TableCell>
                                                <TableCell>{row.team}</TableCell>
                                                <TableCell align="center">{row.played}</TableCell>
                                                <TableCell align="center">{row.won}</TableCell>
                                                <TableCell align="center">{row.drawn}</TableCell>
                                                <TableCell align="center">{row.lost}</TableCell>
                                                <TableCell align="center">{row.goalsFor}</TableCell>
                                                <TableCell align="center">{row.goalsAgainst}</TableCell>
                                                <TableCell align="center">{row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference}</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 600 }}>{row.points}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>No standings data.</Typography>
                        )}
                    </CardContent>
                </Card>
                )}
                <Box sx={{ position: 'sticky', top: 20 }}>
                    {/* Your display name in this league */}
                    {leagueId && myMembership && (
                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2" color="text.secondary">
                                Your display name in this league:
                            </Typography>
                            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                                {myMembership.display_name}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={handleOpenDisplayNameDialog}
                            >
                                Update name
                            </Button>
                        </Box>
                    )}
                    {/* Leaderboard Table */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                            League Leaderboard
                            {leaderboardScope === 'weekly' && leaderboardCurrentRound != null && (
                                <Typography component="span" variant="body1" color="text.secondary" sx={{ ml: 1, fontWeight: 'normal' }}>
                                    ({weekOrDayTitle(leaderboardCurrentRound)})
                                </Typography>
                            )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {leaderboardScope === 'weekly'
                                ? (isWorldCup ? 'Points this day. "Days won" = number of days you placed first (including ties).' : 'Points this week. "Weeks won" = number of weeks you placed first (including ties).')
                                : (isWorldCup ? 'All days' : 'All game weeks (1-38)')}
                        </Typography>
                        {loadingLeaderboard ? (
                            <Typography variant="body2">Loading leaderboard...</Typography>
                        ) : leaderboard.length > 0 ? (
                            <TableContainer component={Paper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Rank</strong></TableCell>
                                            <TableCell><strong>Player</strong></TableCell>
                                            <TableCell align="right"><strong>Points</strong></TableCell>
                                            <TableCell align="right"><strong>W</strong></TableCell>
                                            <TableCell align="right"><strong>D</strong></TableCell>
                                            <TableCell align="right"><strong>L</strong></TableCell>
                                            {leaderboardScope === 'weekly' && (
                                                <TableCell align="right"><strong>{isWorldCup ? 'Days won' : 'Weeks won'}</strong></TableCell>
                                            )}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {leaderboard.map((player, index) => (
                                            <TableRow 
                                                key={player.user_id}
                                                sx={{ 
                                                    '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                                                    backgroundColor: index === 0 ? 'success.light' : 'inherit'
                                                }}
                                            >
                                                <TableCell><strong>#{index + 1}</strong></TableCell>
                                                <TableCell>{player.display_name}</TableCell>
                                                <TableCell align="right"><strong>{player.points}</strong></TableCell>
                                                <TableCell align="right">{player.wins}</TableCell>
                                                <TableCell align="right">{player.draws}</TableCell>
                                                <TableCell align="right">{player.losses}</TableCell>
                                                {leaderboardScope === 'weekly' && (
                                                    <TableCell align="right">{player.weeks_won ?? 0}</TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No leaderboard data available yet.
                            </Typography>
                        )}
                    </Box>

                    {/* League members (admin: remove) */}
                    {isAdmin && leagueMembers.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>League members</Typography>
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Name</strong></TableCell>
                                            <TableCell><strong>Role</strong></TableCell>
                                            <TableCell align="right"><strong>Actions</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {leagueMembers.map((m) => (
                                            <TableRow key={m.id}>
                                                <TableCell>{m.display_name}</TableCell>
                                                <TableCell>
                                                    <FormControl size="small" sx={{ minWidth: 100 }} disabled={updatingRoleId === m.id}>
                                                        <Select
                                                            value={m.role === 'admin' ? 'admin' : 'player'}
                                                            onChange={(e) => handleUpdateMemberRole(m.id, e.target.value)}
                                                            sx={{ height: 28, fontSize: '0.875rem' }}
                                                        >
                                                            <MenuItem value="player">Player</MenuItem>
                                                            <MenuItem value="admin">Admin</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {Number(m.id) !== Number(currentUser?.id) && (
                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            variant="outlined"
                                                            disabled={removingMemberId === m.id}
                                                            onClick={() => window.confirm(`Remove ${m.display_name} from the league?`) && handleRemoveMember(m.id)}
                                                        >
                                                            {removingMemberId === m.id ? 'Removing...' : 'Remove'}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}

                    {/* Admin: Edit member prediction + add missed pick */}
                    {isAdmin && leagueMembers.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>Admin: Edit member prediction</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel>Select member</InputLabel>
                                    <Select
                                        value={adminSelectedMemberId}
                                        label="Select member"
                                        onChange={(e) => {
                                            const id = e.target.value
                                            setAdminSelectedMemberId(id)
                                            if (id) handleFetchMemberPredictions(Number(id))
                                            else setAdminMemberPredictions([])
                                        }}
                                    >
                                        <MenuItem value="">—</MenuItem>
                                        {leagueMembers.map((m) => (
                                            <MenuItem key={m.id} value={String(m.id)}>{m.display_name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <InputLabel>Game week</InputLabel>
                                    <Select
                                        value={adminPredictionRound || ''}
                                        label="Game week"
                                        onChange={(e) => {
                                            const r = e.target.value
                                            setAdminPredictionRound(r)
                                            if (r) getAdminFixturesForRound(Number(r))
                                            else setAdminFixturesForRound([])
                                        }}
                                    >
                                        <MenuItem value="">—</MenuItem>
                                        {availableRounds.map((r) => (
                                            <MenuItem key={r} value={String(r)}>{weekOrDayTitle(r)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                            {loadingMemberPredictions ? (
                                <Typography variant="body2">Loading predictions...</Typography>
                            ) : adminSelectedMemberId && adminPredictionRound && adminFixturesForRound.length > 0 ? (
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320, overflow: 'auto' }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Match</TableCell>
                                                <TableCell align="center">Pred</TableCell>
                                                <TableCell align="right">Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {adminFixturesForRound.map((fix) => {
                                                const home = fix.fixture_home_team || fix.home_team || ''
                                                const away = fix.fixture_away_team || fix.away_team || ''
                                                const pred = adminMemberPredictions.find(
                                                    p => (p.home_team || '').toLowerCase() === home.toLowerCase() && (p.away_team || '').toLowerCase() === away.toLowerCase()
                                                )
                                                return (
                                                    <TableRow key={fix.id || `${home}-${away}`}>
                                                        <TableCell>{home} vs {away}</TableCell>
                                                        <TableCell align="center">
                                                            {pred ? `${pred.home_team_score ?? '–'}–${pred.away_team_score ?? '–'}` : <Typography variant="body2" color="text.secondary">No pick (Loss)</Typography>}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {pred ? (
                                                                <IconButton
                                                                    size="small"
                                                                    aria-label="Edit prediction"
                                                                    onClick={() => setEditPredictionDialog({
                                                                        gameId: pred.id,
                                                                        home_team: pred.home_team,
                                                                        away_team: pred.away_team,
                                                                        home_team_score: pred.home_team_score ?? 0,
                                                                        away_team_score: pred.away_team_score ?? 0
                                                                    })}
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            ) : (
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    onClick={() => setAddPredictionDialog({
                                                                        home_team: home,
                                                                        away_team: away,
                                                                        home_team_score: 0,
                                                                        away_team_score: 0
                                                                    })}
                                                                >
                                                                    Add prediction
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : adminSelectedMemberId && adminPredictionRound && !loadingAdminFixtures && adminFixturesForRound.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">No fixtures for this week.</Typography>
                            ) : adminSelectedMemberId && !adminPredictionRound ? (
                                <Typography variant="body2" color="text.secondary">Select a {isWorldCup ? 'day' : 'game week'} to view or add predictions.</Typography>
                            ) : adminSelectedMemberId ? (
                                <Typography variant="body2" color="text.secondary">Select a member and {isWorldCup ? 'day' : 'game week'} to edit or add missed picks.</Typography>
                            ) : null}
                        </Box>
                    )}

                    {/* Results Section - mobile only (on desktop shown below predictions in left column) */}
                    {gameWeek && (
                        <Box sx={{ mt: 3, display: { xs: 'block', md: 'none' } }}>
                            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                                Results - {weekOrDayTitle(gameWeek)}
                            </Typography>

                            {loadingPredictions ? (
                                <Typography variant="body2">Loading results...</Typography>
                            ) : (() => {
                                const selectedRound = parseInt(gameWeek, 10)
                                const roundMatch = (p) => {
                                    const r = p.fixture.round ?? p.fixture.fixture_round
                                    if (r == null) return false
                                    return Number(r) === selectedRound
                                }
                                const competitionMatch = (p) => {
                                    if (!effectiveCompetition) return true
                                    if (!leagueDetail?.competition_slug) return true
                                    const slug = p.fixture.competition_slug
                                    if (effectiveCompetition === 'eng.1') return slug === 'eng.1' || slug == null
                                    return slug === effectiveCompetition
                                }
                                const hasBothScores = (p) =>
                                    p.fixture.actual_home_score != null && p.fixture.actual_away_score != null
                                const completedPredictions = predictions
                                    .filter(p => {
                                        if (!p.fixture) return false
                                        if (!hasBothScores(p)) return false
                                        return roundMatch(p) && competitionMatch(p)
                                    })
                                    .sort((a, b) => {
                                        const dateA = a.fixture?.date ? new Date(a.fixture.date).getTime() : 0
                                        const dateB = b.fixture?.date ? new Date(b.fixture.date).getTime() : 0
                                        return dateA - dateB
                                    })

                                if (completedPredictions.length === 0) {
                                    return (
                                        <Typography variant="body2" sx={{ mt: 2 }}>
                                            No completed predictions for this {isWorldCup ? 'day' : 'week'} yet.
                                        </Typography>
                                    )
                                }

                                const getDisplayResult = (p) => {
                                    if (p.game_result) return p.game_result
                                    const f = p.fixture
                                    if (f?.actual_home_score == null || f?.actual_away_score == null || p.home_team_score == null || p.away_team_score == null) return null
                                    const predSame = Number(p.home_team_score) === Number(f.actual_home_score) && Number(p.away_team_score) === Number(f.actual_away_score)
                                    if (predSame) return 'Win'
                                    const ph = Number(p.home_team_score), pa = Number(p.away_team_score), ah = Number(f.actual_home_score), aa = Number(f.actual_away_score)
                                    const predW = ph > pa ? 'home' : (pa > ph ? 'away' : 'draw')
                                    const actW = ah > aa ? 'home' : (aa > ah ? 'away' : 'draw')
                                    return predW === actW ? 'Draw' : 'Loss'
                                }
                                const wins = completedPredictions.filter(p => getDisplayResult(p) === 'Win').length
                                const draws = completedPredictions.filter(p => getDisplayResult(p) === 'Draw').length
                                const losses = completedPredictions.filter(p => getDisplayResult(p) === 'Loss').length

                                return (
                                    <>
                                        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                            <Chip label={`W: ${wins}`} color="success" size="small" />
                                            <Chip label={`D: ${draws}`} color="warning" size="small" />
                                            <Chip label={`L: ${losses}`} color="error" size="small" />
                                        </Box>
                                        <Box>
                                            {completedPredictions.map((prediction) => {
                                                const { fixture, home_team, away_team, home_team_score, away_team_score } = prediction
                                                const displayResult = getDisplayResult(prediction)
                                                let resultColor = 'default'
                                                if (displayResult === 'Win') resultColor = 'success'
                                                else if (displayResult === 'Draw') resultColor = 'warning'
                                                else if (displayResult === 'Loss') resultColor = 'error'
                                                return (
                                                    <Card key={prediction.id} sx={{ mb: 1.5 }}>
                                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                                <Typography variant="subtitle2">{fixture?.round != null ? weekOrDayTitle(fixture.round) : 'N/A'}</Typography>
                                                                <Chip label={displayResult || 'Pending'} color={resultColor} size="small" />
                                                            </Box>
                                                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                                {home_team} vs {away_team}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                <Typography variant="caption">Pred: {home_team_score}-{away_team_score}</Typography>
                                                                <Typography variant="caption" color="textSecondary">Actual: {fixture.actual_home_score}-{fixture.actual_away_score}</Typography>
                                                            </Box>
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                        </Box>
                                    </>
                                )
                            })()}
                        </Box>
                    )}
                </Box>
            </Grid>
        </Grid>

        {/* Delete league confirmation */}
        <Dialog open={deleteLeagueDialog} onClose={() => setDeleteLeagueDialog(false)}>
            <DialogTitle>Delete league?</DialogTitle>
            <DialogContent>
                <Typography>This will remove the league and all members. This cannot be undone.</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setDeleteLeagueDialog(false)}>Cancel</Button>
                <Button color="error" variant="contained" onClick={handleDeleteLeague}>Delete league</Button>
            </DialogActions>
        </Dialog>

        {/* Update your display name in this league */}
        <Dialog open={displayNameDialogOpen} onClose={() => !displayNameSaving && setDisplayNameDialogOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Update display name</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    This name is shown on the leaderboard and to other members. It must be unique in this league.
                </Typography>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Display name"
                    fullWidth
                    variant="standard"
                    value={displayNameDraft}
                    onChange={(e) => { setDisplayNameDraft(e.target.value); setDisplayNameError(null); }}
                    placeholder="Your name in this league"
                />
                {displayNameError && <Alert severity="error" sx={{ mt: 2 }}>{displayNameError}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setDisplayNameDialogOpen(false)} disabled={displayNameSaving}>Cancel</Button>
                <Button onClick={handleSaveDisplayName} variant="contained" color="primary" disabled={displayNameSaving}>
                    {displayNameSaving ? 'Saving…' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>

        {/* Edit prediction (admin) */}
        <Dialog open={!!editPredictionDialog} onClose={() => setEditPredictionDialog(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Edit prediction</DialogTitle>
            {editPredictionDialog && (
                <>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 2 }}>{editPredictionDialog.home_team} vs {editPredictionDialog.away_team}</Typography>
                        <TextField
                            label="Home score"
                            type="number"
                            inputProps={{ min: 0 }}
                            value={editPredictionDialog.home_team_score}
                            onChange={(e) => setEditPredictionDialog(prev => ({ ...prev, home_team_score: e.target.value }))}
                            fullWidth
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Away score"
                            type="number"
                            inputProps={{ min: 0 }}
                            value={editPredictionDialog.away_team_score}
                            onChange={(e) => setEditPredictionDialog(prev => ({ ...prev, away_team_score: e.target.value }))}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditPredictionDialog(null)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleAdminUpdatePrediction(
                                editPredictionDialog.gameId,
                                editPredictionDialog.home_team_score,
                                editPredictionDialog.away_team_score
                            )}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </>
            )}
        </Dialog>

        {/* Add prediction for missed pick (admin) */}
        <Dialog open={!!addPredictionDialog} onClose={() => setAddPredictionDialog(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Add prediction (missed pick)</DialogTitle>
            {addPredictionDialog && (
                <>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 2 }}>{addPredictionDialog.home_team} vs {addPredictionDialog.away_team}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>Enter the score to record for this member. It will be scored as Win/Draw/Loss if the fixture has results.</Typography>
                        <TextField
                            label="Home score"
                            type="number"
                            inputProps={{ min: 0 }}
                            value={addPredictionDialog.home_team_score}
                            onChange={(e) => setAddPredictionDialog(prev => ({ ...prev, home_team_score: e.target.value }))}
                            fullWidth
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Away score"
                            type="number"
                            inputProps={{ min: 0 }}
                            value={addPredictionDialog.away_team_score}
                            onChange={(e) => setAddPredictionDialog(prev => ({ ...prev, away_team_score: e.target.value }))}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAddPredictionDialog(null)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleAdminCreatePrediction(
                                Number(adminSelectedMemberId),
                                addPredictionDialog.home_team,
                                addPredictionDialog.away_team,
                                addPredictionDialog.home_team_score,
                                addPredictionDialog.away_team_score
                            )}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </>
            )}
        </Dialog>

        {/* Backfill standings (admin) */}
        <Dialog open={backfillDialogOpen} onClose={() => { setBackfillDialogOpen(false); setBackfillMessage(null); setBackfillJson(''); }} maxWidth="sm" fullWidth>
            <DialogTitle>Backfill league standings</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Paste JSON with a &quot;standings&quot; array. Each item: display_name (must match a league member), wins, draws, losses, points (optional).
                </Typography>
                <TextField
                    multiline
                    minRows={6}
                    fullWidth
                    placeholder={'{"standings": [{"display_name": "Alice", "wins": 5, "draws": 2, "losses": 1, "points": 17}]}'}
                    value={backfillJson}
                    onChange={(e) => setBackfillJson(e.target.value)}
                    sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                {backfillMessage && (
                    <Alert severity={backfillMessage.type} sx={{ mt: 2 }}>{backfillMessage.text}</Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { setBackfillDialogOpen(false); setBackfillMessage(null); setBackfillJson(''); }}>Cancel</Button>
                <Button
                    variant="contained"
                    color="primary"
                    disabled={!leagueId || !backfillJson.trim()}
                    onClick={() => {
                        let standings
                        try {
                            const data = JSON.parse(backfillJson.trim())
                            standings = data.standings
                            if (!Array.isArray(standings)) throw new Error('JSON must include "standings" array')
                        } catch (e) {
                            setBackfillMessage({ type: 'error', text: e.message || 'Invalid JSON' })
                            return
                        }
                        authenticatedFetch(`/api/v1/leagues/${leagueId}/backfill-standings`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ standings })
                        })
                            .then(res => res.json().then(data => ({ ok: res.ok, data })))
                            .then(({ ok, data }) => {
                                if (!ok) throw new Error(data.error || 'Request failed')
                                setBackfillMessage({ type: 'success', text: data.message || 'Standings updated.' })
                                fetchLeaderboard()
                            })
                            .catch((err) => setBackfillMessage({ type: 'error', text: err.message || 'Request failed' }))
                    }}
                >
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
        </Box>
        </>
      );
}

export default Members;