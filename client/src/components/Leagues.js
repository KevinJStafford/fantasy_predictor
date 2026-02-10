import * as React from 'react'
import Navbar from './Navbar'
import {useEffect, useState, useCallback} from 'react'
import { Container, Typography, Button, Box, Alert, Card, CardContent, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Radio, RadioGroup, Link } from '@mui/material'
import { useHistory } from 'react-router-dom'
import { authenticatedFetch, apiUrl } from '../utils/api'

function Leagues() {
    const [leagues, setLeagues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [currentUser, setCurrentUser] = useState(null)
    const [joinDialogOpen, setJoinDialogOpen] = useState(false)
    const [inviteCode, setInviteCode] = useState('')
    const [joinDisplayName, setJoinDisplayName] = useState('')
    const [joinError, setJoinError] = useState(null)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [createName, setCreateName] = useState('')
    const [createDisplayName, setCreateDisplayName] = useState('')
    const [createIsOpen, setCreateIsOpen] = useState(false)
    const [createError, setCreateError] = useState(null)
    const [openLeaguesSearch, setOpenLeaguesSearch] = useState('')
    const [openLeagues, setOpenLeagues] = useState([])
    const [loadingOpenLeagues, setLoadingOpenLeagues] = useState(false)
    const [joinOpenLeagueId, setJoinOpenLeagueId] = useState(null)
    const [joinOpenDisplayName, setJoinOpenDisplayName] = useState('')
    const [joinOpenError, setJoinOpenError] = useState(null)
    const [accountDialogOpen, setAccountDialogOpen] = useState(false)
    const [accountEmail, setAccountEmail] = useState('')
    const [accountCurrentPassword, setAccountCurrentPassword] = useState('')
    const [accountNewPassword, setAccountNewPassword] = useState('')
    const [accountConfirmPassword, setAccountConfirmPassword] = useState('')
    const [accountError, setAccountError] = useState(null)
    const [accountSuccess, setAccountSuccess] = useState(null)
    const [accountSaving, setAccountSaving] = useState(false)
    const history = useHistory()

    useEffect(() => {
        fetchLeagues()
    }, [])

    function fetchCurrentUser() {
        authenticatedFetch('/api/v1/authorized')
            .then(res => (res.ok ? res.json() : null))
            .then(user => setCurrentUser(user))
            .catch(() => setCurrentUser(null))
    }

    useEffect(() => {
        fetchCurrentUser()
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
                // Refetch current user after successful leagues load so "Signed in as" always has email
                fetchCurrentUser()
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

    const fetchOpenLeagues = useCallback((search) => {
        setLoadingOpenLeagues(true)
        const q = (search ?? '').trim()
        const url = q ? `/api/v1/leagues/open?q=${encodeURIComponent(q)}` : '/api/v1/leagues/open'
        authenticatedFetch(url)
            .then(res => res.ok ? res.json() : { leagues: [] })
            .then(data => setOpenLeagues(data.leagues || []))
            .catch(() => setOpenLeagues([]))
            .finally(() => setLoadingOpenLeagues(false))
    }, [])

    useEffect(() => {
        if (!currentUser) return
        const t = setTimeout(() => fetchOpenLeagues(openLeaguesSearch), 300)
        return () => clearTimeout(t)
    }, [currentUser, openLeaguesSearch, fetchOpenLeagues])

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
            headers: { 'Content-Type': 'application/json' },
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
                fetchOpenLeagues()
            } else {
                setJoinError(data.error || 'Failed to join league')
            }
        })
        .catch(err => {
            console.error('Error joining league:', err)
            setJoinError('Failed to join league. Please try again.')
        })
    }

    function handleCreateLeagueSubmit() {
        if (!createName.trim()) {
            setCreateError('League name is required')
            return
        }
        if (!createDisplayName.trim()) {
            setCreateError('Your display name for this league is required')
            return
        }
        setCreateError(null)
        authenticatedFetch('/api/v1/leagues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: createName.trim(),
                display_name: createDisplayName.trim(),
                is_open: createIsOpen,
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.league) {
                    setCreateDialogOpen(false)
                    setCreateName('')
                    setCreateDisplayName('')
                    setCreateIsOpen(false)
                    fetchLeagues()
                    fetchOpenLeagues()
                } else {
                    setCreateError(data.error || 'Failed to create league')
                }
            })
            .catch(err => {
                console.error('Error creating league:', err)
                setCreateError('Failed to create league. Please try again.')
            })
    }

    function handleJoinOpenLeagueSubmit() {
        if (!joinOpenLeagueId || !joinOpenDisplayName.trim()) {
            setJoinOpenError('Display name is required')
            return
        }
        setJoinOpenError(null)
        authenticatedFetch(`/api/v1/leagues/${joinOpenLeagueId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: joinOpenDisplayName.trim() })
        })
            .then(res => res.json())
            .then(data => {
                if (data.league) {
                    setJoinOpenLeagueId(null)
                    setJoinOpenDisplayName('')
                    fetchLeagues()
                    fetchOpenLeagues()
                } else {
                    setJoinOpenError(data.error || 'Failed to join league')
                }
            })
            .catch(() => setJoinOpenError('Failed to join league. Please try again.'))
    }

    function handleOpenAccountDialog() {
        setAccountDialogOpen(true)
        setAccountEmail(currentUser?.email || '')
        setAccountCurrentPassword('')
        setAccountNewPassword('')
        setAccountConfirmPassword('')
        setAccountError(null)
        setAccountSuccess(null)
        // If we don't have email yet, refetch so the form shows it
        if (!currentUser?.email) {
            authenticatedFetch('/api/v1/authorized')
                .then(res => (res.ok ? res.json() : null))
                .then(user => {
                    if (user) {
                        setCurrentUser(user)
                        if (user.email) setAccountEmail(user.email)
                    }
                })
                .catch(() => {})
        }
    }

    function handleAccountSubmit() {
        const newEmail = accountEmail.trim().toLowerCase()
        const hasEmailChange = newEmail && newEmail !== (currentUser?.email || '').toLowerCase()
        const hasPasswordChange = accountNewPassword.trim() || accountConfirmPassword.trim()
        if (!accountCurrentPassword.trim()) {
            setAccountError('Current password is required to update your account')
            return
        }
        if (hasPasswordChange && accountNewPassword.trim() !== accountConfirmPassword.trim()) {
            setAccountError('New password and confirmation do not match')
            return
        }
        if (hasPasswordChange && accountNewPassword.trim().length < 6) {
            setAccountError('New password must be at least 6 characters')
            return
        }
        setAccountError(null)
        setAccountSuccess(null)
        setAccountSaving(true)
        const body = {
            current_password: accountCurrentPassword.trim(),
            ...(hasEmailChange ? { email: newEmail } : {}),
            ...(accountNewPassword.trim() ? { new_password: accountNewPassword.trim(), confirm_password: accountConfirmPassword.trim() } : {}),
        }
        authenticatedFetch('/api/v1/users/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (ok && data.user) {
                    setCurrentUser(data.user)
                    setAccountSuccess(data.message || 'Account updated.')
                    if (data.user.email) setAccountEmail(data.user.email)
                    setAccountCurrentPassword('')
                    setAccountNewPassword('')
                    setAccountConfirmPassword('')
                    setTimeout(() => {
                        setAccountDialogOpen(false)
                        setAccountSuccess(null)
                    }, 1500)
                } else {
                    setAccountError(data.error || 'Failed to update account')
                }
            })
            .catch(() => setAccountError('Failed to update account. Please try again.'))
            .finally(() => setAccountSaving(false))
    }

    return (
        <>
            <Navbar />
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                        <Typography variant="h4" component="h1">
                            My Leagues
                        </Typography>
                        {(currentUser?.email || leagues.length > 0) && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Signed in as{' '}
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={handleOpenAccountDialog}
                                    sx={{ cursor: 'pointer', fontWeight: 500 }}
                                >
                                    {currentUser?.email || 'your account'}
                                </Link>
                                {' '}(update email or password)
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button variant="contained" color="primary" onClick={() => { setCreateError(null); setCreateDialogOpen(true); }}>
                            Create League
                        </Button>
                        <Button variant="outlined" color="primary" onClick={handleJoinLeague}>
                            Join with Code
                        </Button>
                    </Box>
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
                            Create a league, browse open leagues, or join one with an invite code.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button variant="contained" color="primary" onClick={() => setCreateDialogOpen(true)}>
                                Create League
                            </Button>
                            <Button variant="outlined" color="primary" onClick={handleJoinLeague}>
                                Join with Code
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
                                onClick={() => setCreateDialogOpen(true)}
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

                {/* Browse open leagues */}
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                        Browse open leagues
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Search and join leagues that are open to everyone. New signups are automatically added to open leagues.
                    </Typography>
                    <TextField
                        size="small"
                        placeholder="Search open leagues by name..."
                        value={openLeaguesSearch}
                        onChange={(e) => setOpenLeaguesSearch(e.target.value)}
                        sx={{ mb: 2, maxWidth: 360 }}
                        fullWidth
                    />
                    {loadingOpenLeagues ? (
                        <Typography variant="body2" color="text.secondary">Loading...</Typography>
                    ) : openLeagues.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            {openLeaguesSearch.trim() ? 'No open leagues match your search.' : 'No open leagues yet. Create one and set it to "Open to anyone".'}
                        </Typography>
                    ) : (
                        <Grid container spacing={2}>
                            {openLeagues.map(league => (
                                <Grid item xs={12} sm={6} md={4} key={league.id}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" component="h2">{league.name}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {league.member_count ?? league.members?.length ?? 0} members
                                            </Typography>
                                            {league.is_member ? (
                                                <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => handleLeagueClick(league.id)}>
                                                    Open
                                                </Button>
                                            ) : (
                                                <Button size="small" variant="contained" color="primary" sx={{ mt: 1 }} onClick={() => { setJoinOpenLeagueId(league.id); setJoinOpenDisplayName(''); setJoinOpenError(null); }}>
                                                    Join
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Box>

                {/* Create League Dialog */}
                <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Create League</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="League name"
                            fullWidth
                            variant="standard"
                            value={createName}
                            onChange={(e) => { setCreateName(e.target.value); setCreateError(null); }}
                            sx={{ mt: 1 }}
                        />
                        <TextField
                            margin="dense"
                            label="Your display name for this league"
                            placeholder="Unique in this league"
                            fullWidth
                            variant="standard"
                            value={createDisplayName}
                            onChange={(e) => { setCreateDisplayName(e.target.value); setCreateError(null); }}
                            sx={{ mt: 2 }}
                        />
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Who can join?</Typography>
                        <RadioGroup row value={createIsOpen ? 'open' : 'invite'} onChange={(e) => setCreateIsOpen(e.target.value === 'open')}>
                            <FormControlLabel value="open" control={<Radio />} label="Open to anyone (listed in Browse open leagues)" />
                            <FormControlLabel value="invite" control={<Radio />} label="Invite only (share code to join)" />
                        </RadioGroup>
                        {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateLeagueSubmit} variant="contained" color="primary">Create</Button>
                    </DialogActions>
                </Dialog>

                {/* Join open league (display name) Dialog */}
                <Dialog open={!!joinOpenLeagueId} onClose={() => { setJoinOpenLeagueId(null); setJoinOpenError(null); }} maxWidth="xs" fullWidth>
                    <DialogTitle>Join league</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Your display name for this league"
                            placeholder="Must be unique in this league"
                            fullWidth
                            variant="standard"
                            value={joinOpenDisplayName}
                            onChange={(e) => { setJoinOpenDisplayName(e.target.value); setJoinOpenError(null); }}
                            sx={{ mt: 2 }}
                        />
                        {joinOpenError && <Alert severity="error" sx={{ mt: 2 }}>{joinOpenError}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setJoinOpenLeagueId(null)}>Cancel</Button>
                        <Button onClick={handleJoinOpenLeagueSubmit} variant="contained" color="primary">Join</Button>
                    </DialogActions>
                </Dialog>

                {/* Account (email / password) Dialog */}
                <Dialog open={accountDialogOpen} onClose={() => !accountSaving && setAccountDialogOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Account</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Logged in as: <strong>{currentUser?.email}</strong>
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Email address"
                            type="email"
                            fullWidth
                            variant="standard"
                            value={accountEmail}
                            onChange={(e) => { setAccountEmail(e.target.value); setAccountError(null); }}
                            placeholder="your@email.com"
                            sx={{ mt: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="Current password (required to save changes)"
                            type="password"
                            fullWidth
                            variant="standard"
                            value={accountCurrentPassword}
                            onChange={(e) => { setAccountCurrentPassword(e.target.value); setAccountError(null); }}
                            sx={{ mt: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="New password (optional)"
                            type="password"
                            fullWidth
                            variant="standard"
                            value={accountNewPassword}
                            onChange={(e) => { setAccountNewPassword(e.target.value); setAccountError(null); }}
                            sx={{ mt: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="Confirm new password"
                            type="password"
                            fullWidth
                            variant="standard"
                            value={accountConfirmPassword}
                            onChange={(e) => { setAccountConfirmPassword(e.target.value); setAccountError(null); }}
                            sx={{ mt: 1 }}
                        />
                        {accountError && <Alert severity="error" sx={{ mt: 2 }}>{accountError}</Alert>}
                        {accountSuccess && <Alert severity="success" sx={{ mt: 2 }}>{accountSuccess}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAccountDialogOpen(false)} disabled={accountSaving}>Cancel</Button>
                        <Button onClick={handleAccountSubmit} variant="contained" color="primary" disabled={accountSaving}>
                            {accountSaving ? 'Saving…' : 'Save changes'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Join League Dialog (invite code) */}
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
