import * as React from 'react'
import Navbar from './Navbar'
import Predictions from './Predictions'
import {useEffect, useState} from 'react'
import { useLocation, useHistory } from 'react-router-dom'
import { Typography, Button, Box, Alert, Card, CardContent, Grid, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material'
import { apiUrl, authenticatedFetch } from '../utils/api'


function Members() {
    const location = useLocation()
    const history = useHistory()
    const [leagueId, setLeagueId] = useState(null)
    const [leaderboard, setLeaderboard] = useState([])
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [filteredFixtures, setFilteredFixtures] = useState([])
    const [availableRounds, setAvailableRounds] = useState([])
    const [gameWeek, setGameWeek] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState(null)
    const [loadingFixtures, setLoadingFixtures] = useState(false)
    const [predictions, setPredictions] = useState([])
    const [loadingPredictions, setLoadingPredictions] = useState(false)

    // Get league_id from URL query params
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const leagueParam = params.get('league')
        if (leagueParam) {
            setLeagueId(parseInt(leagueParam))
        } else {
            // If no league_id, redirect to leagues page
            history.push('/leagues')
        }
    }, [location.search, history])

    // Fetch leaderboard when league_id is set
    useEffect(() => {
        if (leagueId) {
            fetchLeaderboard()
        }
    }, [leagueId])

    function getAvailableRounds() {
        fetch(apiUrl('/api/v1/fixtures/rounds'))
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch rounds')
            }
            return response.json()
        })
        .then(data => {
            console.log('Available rounds:', data.rounds)
            setAvailableRounds(data.rounds || [])
        })
        .catch(error => {
            console.error('Error fetching rounds:', error)
            setAvailableRounds([])
        })
    }

    function getFixtures(roundNumber = null) {
        setLoadingFixtures(true)
        const url = roundNumber ? apiUrl(`/api/v1/fixtures/${roundNumber}`) : apiUrl('/api/v1/fixtures')
        fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch fixtures')
            }
            return response.json()
        })
        .then(fixturesData => {
            console.log('Fixtures fetched:', fixturesData)
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

    function syncFixtures() {
        setSyncing(true)
        setSyncMessage(null)
        
        fetch(apiUrl('/api/v1/fixtures/sync'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_url: 'https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2025&_limit=100'
            })
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
        .then(data => {
            if (data.error) {
                setSyncMessage({ type: 'error', text: data.error })
            } else {
                const details = [
                    `added=${data.added ?? 0}, updated=${data.updated ?? 0}`,
                    data.window_start_utc && data.window_end_utc ? `window=${data.window_start_utc} → ${data.window_end_utc}` : null,
                    data.fixtures_seen != null ? `seen=${data.fixtures_seen}` : null,
                    data.fixtures_with_parsed_date != null ? `parsed_dates=${data.fixtures_with_parsed_date}` : null,
                    data.fixtures_in_window != null ? `in_window=${data.fixtures_in_window}` : null,
                    data.skipped_no_date != null ? `skipped_no_date=${data.skipped_no_date}` : null,
                    data.skipped_outside_window != null ? `skipped_outside_window=${data.skipped_outside_window}` : null,
                    data.parsed_min_date_utc ? `api_min=${data.parsed_min_date_utc}` : null,
                    data.parsed_max_date_utc ? `api_max=${data.parsed_max_date_utc}` : null,
                ].filter(Boolean).join(' | ')

                setSyncMessage({ 
                    type: 'success', 
                    text: `Sync complete. ${details}` 
                })
                // Refresh available rounds and fixtures after sync
                getAvailableRounds()
                if (gameWeek && gameWeek !== '') {
                    getFixtures(parseInt(gameWeek))
                }
            }
        })
        .catch(error => {
            console.error('Error syncing fixtures:', error)
            setSyncMessage({ type: 'error', text: error.message || 'Failed to sync fixtures. Please check the backend console for details.' })
        })
        .finally(() => {
            setSyncing(false)
            // Clear message after 5 seconds
            setTimeout(() => setSyncMessage(null), 5000)
        })
    }

    function getPredictions() {
        setLoadingPredictions(true)
        authenticatedFetch('/api/v1/predictions')
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

    function fetchLeaderboard() {
        if (!leagueId) return
        setLoadingLeaderboard(true)
        authenticatedFetch(`/api/v1/leagues/${leagueId}/leaderboard`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch leaderboard')
                }
                return response.json()
            })
            .then(data => {
                setLeaderboard(data.leaderboard || [])
            })
            .catch(error => {
                console.error('Error fetching leaderboard:', error)
                setLeaderboard([])
            })
            .finally(() => {
                setLoadingLeaderboard(false)
            })
    }

    // Load available rounds and predictions on mount
    useEffect(() => {
        getAvailableRounds()
        getPredictions()
    }, [])

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
        <div>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button 
                variant="outlined" 
                onClick={() => history.push('/leagues')}
                sx={{ mr: 2 }}
            >
                ← Back to Leagues
            </Button>
            <Typography variant="h5" component="h2"><span>Select Game Week:</span></Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                    variant="contained" 
                    onClick={syncFixtures} 
                    disabled={syncing}
                >
                    {syncing ? 'Syncing...' : 'Sync Fixtures'}
                </Button>
                <Button 
                    variant="outlined" 
                    onClick={() => {
                        setSyncing(true)
                        authenticatedFetch('/api/v1/fixtures/sync-scores', {
                            method: 'POST',
                            body: JSON.stringify({
                                api_url: 'https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2025&_limit=100'
                            })
                        })
                        .then(async response => {
                            const data = await response.json()
                            if (!response.ok) {
                                throw new Error(data.error || 'Failed to sync scores')
                            }
                            // After syncing scores, check results
                                return authenticatedFetch('/api/v1/predictions/check-results', { method: 'POST' })
                                .then(res => res.json())
                                .then((resultData) => {
                                    getPredictions() // Refresh results
                                    if (leagueId) {
                                        fetchLeaderboard() // Refresh leaderboard
                                    }
                                    const details = [
                                        `Updated: ${resultData.results_updated || 0}`,
                                        `W: ${resultData.wins || 0}, D: ${resultData.draws || 0}, L: ${resultData.losses || 0}`,
                                        resultData.fixtures_not_found > 0 ? `Not found: ${resultData.fixtures_not_found}` : null,
                                        resultData.fixtures_not_completed > 0 ? `Not completed: ${resultData.fixtures_not_completed}` : null,
                                        resultData.fixtures_no_scores > 0 ? `No scores: ${resultData.fixtures_no_scores}` : null,
                                    ].filter(Boolean).join(' | ')
                                    setSyncMessage({ 
                                        type: 'success', 
                                        text: `Synced ${data.fixtures_updated || 0} scores. ${details}` 
                                    })
                                })
                        })
                        .catch(error => {
                            setSyncMessage({ type: 'error', text: error.message || 'Failed to sync scores' })
                        })
                        .finally(() => {
                            setSyncing(false)
                            setTimeout(() => setSyncMessage(null), 5000)
                        })
                    }}
                    disabled={syncing}
                >
                    Sync Scores
                </Button>
            </Box>
        </Box>
        
        {syncMessage && (
            <Alert severity={syncMessage.type} sx={{ mb: 2 }}>
                {syncMessage.text}
            </Alert>
        )}
        
        <Box sx={{ mb: 2 }}>
            <Typography variant="h6" component="label" sx={{ mr: 2 }}>
                Select Game Week:
            </Typography>
            <select 
                value={gameWeek} 
                onChange={handleDropdownChange}
                style={{ padding: '8px', fontSize: '16px', minWidth: '150px' }}
            >
                <option value="">-- Select a Week --</option>
                {availableRounds.map(round => (
                    <option key={round} value={round}>Week {round}</option>
                ))}
            </select>
        </Box>

        <Grid container spacing={3}>
            {/* Left side: Predictions and Results (only when game week is selected) */}
            <Grid item xs={12} md={7}>
                {gameWeek ? (
                    <>
                        <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
                            <span>Fixtures for Week {gameWeek}</span>
                        </Typography>
                        
                        {loadingFixtures ? (
                            <Typography variant="body1">Loading fixtures...</Typography>
                        ) : filteredFixtures.length > 0 ? (
                            <Box>
                                {filteredFixtures.map(fixture => {
                                    // Find matching prediction for this fixture
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
                                                if (leagueId) {
                                                    fetchLeaderboard()
                                                }
                                            }}
                                        />
                                    )
                                })}
                            </Box>
                        ) : (
                            <Typography variant="body1" sx={{ mt: 2 }}>
                                No fixtures found for week {gameWeek}. Please sync fixtures first.
                            </Typography>
                        )}

                        {/* Results Section for Selected Week */}
                        <Box sx={{ mt: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h5" component="h2">
                                    Results - Week {gameWeek}
                                </Typography>
                                <Button 
                                    variant="outlined" 
                                    size="small"
                                    onClick={() => {
                                        setLoadingPredictions(true)
                                        // Also trigger result check on backend
                                        fetch(apiUrl('/api/v1/predictions/check-results'), { method: 'POST' })
                                            .then(res => res.json())
                                            .then(data => {
                                                console.log('Check results response:', data)
                                                getPredictions() // Refresh after checking
                                                if (leagueId) {
                                                    fetchLeaderboard() // Refresh leaderboard
                                                }
                                                if (data.fixtures_not_found > 0 || data.fixtures_no_scores > 0) {
                                                    setSyncMessage({
                                                        type: 'warning',
                                                        text: `Results checked. ${data.wins || 0}W/${data.draws || 0}D/${data.losses || 0}L. ${data.fixtures_not_found || 0} not found, ${data.fixtures_no_scores || 0} missing scores. Try "Sync Scores" first.`
                                                    })
                                                    setTimeout(() => setSyncMessage(null), 8000)
                                                }
                                            })
                                            .catch(err => {
                                                console.error('Error checking results:', err)
                                                setSyncMessage({ type: 'error', text: 'Failed to check results' })
                                                setTimeout(() => setSyncMessage(null), 5000)
                                            })
                                            .finally(() => setLoadingPredictions(false))
                                    }}
                                    disabled={loadingPredictions}
                                >
                                    {loadingPredictions ? 'Loading...' : 'Refresh'}
                                </Button>
                            </Box>

                            {loadingPredictions ? (
                                <Typography variant="body2">Loading results...</Typography>
                            ) : (() => {
                                // Filter to only completed fixtures with predictions for the selected game week
                                const selectedRound = parseInt(gameWeek)
                                const completedPredictions = predictions
                                    .filter(p => {
                                        // Must have a fixture
                                        if (!p.fixture) return false
                                        
                                        // Must be completed with scores
                                        if (!p.fixture.is_completed || 
                                            p.fixture.actual_home_score === null || 
                                            p.fixture.actual_away_score === null) {
                                            return false
                                        }
                                        
                                        // Must match the selected game week
                                        const fixtureRound = p.fixture.round
                                        return fixtureRound === selectedRound
                                    })
                                    .sort((a, b) => {
                                        // Sort chronologically by fixture date (oldest first)
                                        const dateA = a.fixture?.date ? new Date(a.fixture.date).getTime() : 0
                                        const dateB = b.fixture?.date ? new Date(b.fixture.date).getTime() : 0
                                        return dateA - dateB
                                    })

                                if (completedPredictions.length === 0) {
                                    return (
                                        <Typography variant="body2" sx={{ mt: 2 }}>
                                            No completed predictions for this week yet.
                                        </Typography>
                                    )
                                }

                                // Calculate stats
                                const wins = completedPredictions.filter(p => p.game_result === 'Win').length
                                const draws = completedPredictions.filter(p => p.game_result === 'Draw').length
                                const losses = completedPredictions.filter(p => p.game_result === 'Loss').length

                                return (
                                    <>
                                        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                            <Chip 
                                                label={`W: ${wins}`} 
                                                color="success" 
                                                size="small"
                                            />
                                            <Chip 
                                                label={`D: ${draws}`} 
                                                color="warning" 
                                                size="small"
                                            />
                                            <Chip 
                                                label={`L: ${losses}`} 
                                                color="error" 
                                                size="small"
                                            />
                                        </Box>

                                        <Box sx={{ maxHeight: '50vh', overflowY: 'auto' }}>
                                            {completedPredictions.map((prediction) => {
                                                const { fixture, home_team, away_team, home_team_score, away_team_score, game_result } = prediction
                                                
                                                // Determine result color
                                                let resultColor = 'default'
                                                if (game_result === 'Win') resultColor = 'success'
                                                else if (game_result === 'Draw') resultColor = 'warning'
                                                else if (game_result === 'Loss') resultColor = 'error'

                                                return (
                                                    <Card key={prediction.id} sx={{ mb: 1.5 }}>
                                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                                <Typography variant="subtitle2">
                                                                    Week {fixture?.round || 'N/A'}
                                                                </Typography>
                                                                <Chip 
                                                                    label={game_result || 'Pending'} 
                                                                    color={resultColor}
                                                                    size="small"
                                                                />
                                                            </Box>

                                                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                                {home_team} vs {away_team}
                                                            </Typography>

                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                <Typography variant="caption">
                                                                    Pred: {home_team_score}-{away_team_score}
                                                                </Typography>
                                                                <Typography variant="caption" color="textSecondary">
                                                                    Actual: {fixture.actual_home_score}-{fixture.actual_away_score}
                                                                </Typography>
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
                    </>
                ) : (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Please select a game week to view and make predictions for fixtures.
                    </Typography>
                )}
            </Grid>

            {/* Right side: Leaderboard (always visible) */}
            <Grid item xs={12} md={5}>
                <Box sx={{ position: 'sticky', top: 20 }}>
                    {/* Leaderboard Table */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                            League Leaderboard
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            All game weeks (1-38)
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
                                                <TableCell>{player.username}</TableCell>
                                                <TableCell align="right"><strong>{player.points}</strong></TableCell>
                                                <TableCell align="right">{player.wins}</TableCell>
                                                <TableCell align="right">{player.draws}</TableCell>
                                                <TableCell align="right">{player.losses}</TableCell>
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
                </Box>
            </Grid>
        </Grid>
        </div>
        </>
      );
}

export default Members;