import * as React from 'react'
import Navbar from './Navbar'
import Predictions from './Predictions'
import {useEffect, useState} from 'react'
import { Container, Typography, Button, Box, Alert } from '@mui/material'


function Members() {
    const [fixtures, setFixtures] = useState([])
    const [filteredFixtures, setFilteredFixtures] = useState([])
    const [availableRounds, setAvailableRounds] = useState([])
    const [gameWeek, setGameWeek] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState(null)
    const [loadingFixtures, setLoadingFixtures] = useState(false)

    function getAvailableRounds() {
        fetch('/api/v1/fixtures/rounds')
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
        const url = roundNumber ? `/api/v1/fixtures/${roundNumber}` : '/api/v1/fixtures'
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
            setFixtures(fixturesList)
            setFilteredFixtures(sorted)
        })
        .catch(error => {
            console.error('Error fetching fixtures:', error)
            setFixtures([])
            setFilteredFixtures([])
        })
        .finally(() => {
            setLoadingFixtures(false)
        })
    }

    function syncFixtures() {
        setSyncing(true)
        setSyncMessage(null)
        
        fetch('/api/v1/fixtures/sync', {
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

    // Load available rounds on mount
    useEffect(() => {
        getAvailableRounds()
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
            <Typography variant="h5" component="h2"><span>Select Game Week:</span></Typography>
            <Button 
                variant="contained" 
                onClick={syncFixtures} 
                disabled={syncing}
                sx={{ ml: 2 }}
            >
                {syncing ? 'Syncing...' : 'Sync Fixtures'}
            </Button>
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

        {gameWeek && (
            <>
                <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
                    <span>Fixtures for Week {gameWeek}</span>
                </Typography>
                
                {loadingFixtures ? (
                    <Typography variant="body1">Loading fixtures...</Typography>
                ) : filteredFixtures.length > 0 ? (
                    <Container maxWidth='md'>
                        {filteredFixtures.map(fixture => (
                            <Predictions key={fixture.id} fixture={fixture} />
                        ))}
                    </Container>
                ) : (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        No fixtures found for week {gameWeek}. Please sync fixtures first.
                    </Typography>
                )}
            </>
        )}
        
        {!gameWeek && (
            <Typography variant="body1" sx={{ mt: 2 }}>
                Please select a game week to view and make predictions for fixtures.
            </Typography>
        )}
        </div>
        </>
      );
}

export default Members;