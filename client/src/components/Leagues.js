import * as React from 'react'
import Navbar from './Navbar'
import {useEffect, useState} from 'react'
import { Container, Typography, Button, Box, Alert, Card, CardContent, Grid } from '@mui/material'
import { useHistory } from 'react-router-dom'
import { authenticatedFetch, apiUrl } from '../utils/api'

function Leagues() {
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
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

    return (
        <>
            <Navbar />
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    My Leagues
                </Typography>
                
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
                            Create a league or ask someone to invite you to join theirs.
                        </Typography>
                        <Button 
                            variant="contained" 
                            onClick={() => {
                                const name = prompt('Enter league name:')
                                if (name) {
                                    authenticatedFetch('/api/v1/leagues', {
                                        method: 'POST',
                                        body: JSON.stringify({ name })
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
                                }
                            }}
                        >
                            Create League
                        </Button>
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
                                    if (name) {
                                        authenticatedFetch('/api/v1/leagues', {
                                            method: 'POST',
                                            body: JSON.stringify({ name })
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
                                    }
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
            </Container>
        </>
    )
}

export default Leagues
