import * as React from 'react'
import { Button, Box } from '@mui/material'
import { yellow } from '@mui/material/colors';

function LandingGrid() {
    return (
        <>
        <Box>
            <h1>Premier League Score Predictor</h1>
            <h3>Correctly guess the scores of every Premier League match to win points and impress your friends!</h3>
        </Box>
        <Button sx={{bgcolor: yellow[500] }} variant="contained" href="/users">Sign Up</Button>
        <Button sx={{bgcolor: yellow[500] }} variant='outlined' href="/login">Login</Button>
        </>
    )
}

export default LandingGrid;