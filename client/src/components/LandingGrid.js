import * as React from 'react'
import { Button, Box } from '@mui/material'

function LandingGrid() {
    return (
        <>
        <Box>
            <h1>Premier League Score Predictor</h1>
            <h3>Correctly guess the scores of every Premier League match to win points and impress your friends!</h3>
        </Box>
        <Button variant="contained" href="/users">Sign Up</Button>
        <Button variant='outlined' href="/login">Login</Button>
        </>
    )
}

export default LandingGrid;