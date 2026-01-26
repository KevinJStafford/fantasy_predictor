import * as React from 'react'
import { Button, Box } from '@mui/material'
import { yellow } from '@mui/material/colors';
import { useHistory } from 'react-router-dom';

function LandingGrid() {
    const history = useHistory();
    
    return (
        <>
        <Box>
            <h1>Premier League Score Predictor</h1>
            <h3>Correctly guess the scores of every Premier League match to win points and impress your friends!</h3>
        </Box>
        <Button 
            sx={{bgcolor: yellow[500] }} 
            variant="contained" 
            onClick={() => history.push('/users')}
        >
            Sign Up
        </Button>
        <Button 
            sx={{bgcolor: yellow[500] }} 
            variant='outlined' 
            onClick={() => history.push('/login')}
        >
            Login
        </Button>
        </>
    )
}

export default LandingGrid;