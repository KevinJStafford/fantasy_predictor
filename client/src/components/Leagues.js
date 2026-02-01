import * as React from 'react'
import Navbar from './Navbar'
import {useEffect, useState} from 'react'
import { Container, Typography, Button, Box, Alert, Card, CardContent, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material'
import { useHistory } from 'react-router-dom'
import { authenticatedFetch, apiUrl } from '../utils/api'

function Leagues() {
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [joinDialogOpen, setJoinDialogOpen] = useState(false)
    const [inviteCode, setInviteCode] = useState('')
    const [joinDisplayName, setJoinDisplayName] = useState('')
    const [joinError, setJoinError] = useState(null)
    const history = useHistory()

    useEffect(() => {
        fetchLeagues()
    }, [])

    function fetchLeagues() {
        setLoading(true)
        setError(null)
        authenticatedFetch('/api/v1/leagues')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch leagues')
                }
                return response.json()
            })
            .then(data => {
                setLeagues(data.leagues || [])
            })
            .catch(error => {
                console.error('Error fetching leagues:', error)
                setError('Failed to load leagues. Please try again.')
            })
            .finally(() => {
                setLoading(false)
            })
    }

    function handleLeagueClick(leagueId) {
        history.push(`/player?league=${leagueId}`)
    }

    function handleJoinLeague() {
        setJoinDialogOpen(true)
        setInviteCode('')
        setJoinDisplayName('')
        setJoinError(null)
    }

    function handleJoinSubmit() {
        if (!inviteCode.trim()) {
            setJoinError('Please enter an invite code')
            return
        }
        if (!joinDisplayName.trim()) {
            setJoinError('Please enter a display name for this league')
            return
        }

        authenticatedFetch('/api/v1/leagues/join-by-code', {
            method: 'POST',
            body: JSON.stringify({
                invite_code: inviteCode.trim(),
                display_name: joinDisplayName.trim(),
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.league) {
                setJoinDialogOpen(false)
                setInviteCode('')
                setJoinDisplayName('')
                setJoinError(null)
                fetchLeagues()
            } else {
                setJoinError(data.error || 'Failed to join league')
            }
        })
        .catch(err => {
            console.error('Error joining league:', err)
            setJoinError('Failed to join league. Please try again.')
        })
    }

    return (
        <>
            <Navbar />
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" component="h1">
                        My Leagues
                    </Typography>
                    <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={handleJoinLeague}
                    >
                        Join League
                    </Button>
                </Box>
                
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Typography variant="body1">Loading leagues...</Typography>
                ) : leagues.length === 0 ? (
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="h6" gutterBottom>
                            You're not in any leagues yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Create a league or join one with an invite code.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button 
                                variant="contained" 
                                color="primary"
                                onClick={() => {
                                    const name = prompt('Enter league name:')
                                    if (!name?.trim()) return
                                    const displayName = prompt('Your display name for this league (unique in this league):')
                                    if (!displayName?.trim()) return
                                    authenticatedFetch('/api/v1/leagues', {
                                        method: 'POST',
                                        body: JSON.stringify({ name: name.trim(), display_name: displayName.trim() })
                                    })
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.league) {
                                            fetchLeagues()
                                        } else {
                                            alert(data.error || 'Failed to create league')
                                        }
                                    })
                                    .catch(err => {
                                        console.error('Error creating league:', err)
                                        alert('Failed to create league')
                                    })
                                }}
                            >
                                Create League
                            </Button>
                            <Button 
                                variant="outlined" 
                                color="primary"
                                onClick={handleJoinLeague}
                            >
                                Join League
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        {leagues.map(league => (
                            <Grid item xs={12} sm={6} md={4} key={league.id}>
                                <Card 
                                    sx={{ 
                                        cursor: 'pointer',
                                        '&:hover': {
                                            boxShadow: 6
                                        }
                                    }}
                                    onClick={() => handleLeagueClick(league.id)}
                                >
                                    <CardContent>
                                        <Typography variant="h6" component="h2">
                                            {league.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {league.members?.length || 0} members
                                        </Typography>
                                        {league.invite_code && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                Code: {league.invite_code}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                        <Grid item xs={12} sm={6} md={4}>
                            <Card 
                                sx={{ 
                                    cursor: 'pointer',
                                    border: '2px dashed',
                                    borderColor: 'divider',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: 'action.hover'
                                    }
                                }}
                                onClick={() => {
                                    const name = prompt('Enter league name:')
                                    if (!name?.trim()) return
                                    const displayName = prompt('Your display name for this league (unique in this league):')
                                    if (!displayName?.trim()) return
                                    authenticatedFetch('/api/v1/leagues', {
                                        method: 'POST',
                                        body: JSON.stringify({ name: name.trim(), display_name: displayName.trim() })
                                    })
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.league) {
                                            fetchLeagues()
                                        } else {
                                            alert(data.error || 'Failed to create league')
                                        }
                                    })
                                    .catch(err => {
                                        console.error('Error creating league:', err)
                                        alert('Failed to create league')
                                    })
                                }}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="h6" color="text.secondary">
                                        + Create New League
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )}

                {/* Join League Dialog */}
                <Dialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)}>
                    <DialogTitle>Join League with Invite Code</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Invite Code"
                            type="text"
                            fullWidth
                            variant="standard"
                            value={inviteCode}
                            onChange={(e) => {
                                setInviteCode(e.target.value.toUpperCase())
                                setJoinError(null)
                            }}
                            inputProps={{ 
                                style: { textTransform: 'uppercase' },
                                maxLength: 6
                            }}
                            sx={{ mt: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="Your display name for this league"
                            placeholder="Must be unique in this league"
                            type="text"
                            fullWidth
                            variant="standard"
                            value={joinDisplayName}
                            onChange={(e) => {
                                setJoinDisplayName(e.target.value)
                                setJoinError(null)
                            }}
                            sx={{ mt: 2 }}
                        />
                        {joinError && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {joinError}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setJoinDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleJoinSubmit} variant="contained" color="primary">Join</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </>
    )
}

export default Leagues
