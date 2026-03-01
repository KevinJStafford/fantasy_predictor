import * as React from 'react'
import { useEffect, useState } from 'react'
import { useParams, useHistory, Link as RouterLink } from 'react-router-dom'
import Navbar from './Navbar'
import { Container, Typography, Button, Box } from '@mui/material'
import { authenticatedFetch } from '../utils/api'

/**
 * Shown when a user opens a share link (/join/:inviteCode) and is not logged in.
 * Offers sign up or log in; after auth they are redirected to /leagues?join=CODE.
 */
function JoinLeagueLanding() {
    const { inviteCode } = useParams()
    const history = useHistory()
    const [checkingAuth, setCheckingAuth] = useState(true)

    useEffect(() => {
        if (!inviteCode) return
        authenticatedFetch('/api/v1/authorized')
            .then(res => {
                if (res.ok) return res.json()
                return null
            })
            .then(user => {
                if (user) {
                    history.replace(`/leagues?join=${encodeURIComponent(inviteCode.trim().toUpperCase())}`)
                } else {
                    setCheckingAuth(false)
                }
            })
            .catch(() => setCheckingAuth(false))
    }, [inviteCode, history])

    const nextUrl = `/leagues?join=${encodeURIComponent((inviteCode || '').trim().toUpperCase())}`
    const nextParam = encodeURIComponent(nextUrl)

    if (checkingAuth) {
        return (
            <>
                <Navbar />
                <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">Loading…</Typography>
                </Container>
            </>
        )
    }

    return (
        <>
            <Navbar />
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" component="h1" gutterBottom>
                        You're invited to join a league
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        Create an account or log in to join with invite code <strong>{inviteCode?.trim().toUpperCase()}</strong>.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
                        <Button
                            component={RouterLink}
                            to={`/users?next=${nextParam}`}
                            variant="contained"
                            color="primary"
                            size="large"
                        >
                            Create account
                        </Button>
                        <Button
                            component={RouterLink}
                            to={`/login?next=${nextParam}`}
                            variant="outlined"
                            color="primary"
                            size="large"
                        >
                            Log in
                        </Button>
                    </Box>
                </Box>
            </Container>
        </>
    )
}

export default JoinLeagueLanding
