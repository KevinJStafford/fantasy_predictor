import * as React from 'react';
import { Button, Box } from '@mui/material';
import { useHistory } from 'react-router-dom';

const buttonColor = '#ff6c26';

function LandingGrid() {
    const history = useHistory();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                gap: 2,
                px: 2,
            }}
        >
            <Box sx={{ textAlign: 'center', maxWidth: 600, color: buttonColor }}>
                <h1>Premier League Score Predictor</h1>
                <h3>Correctly guess the scores of every Premier League match to win points and impress your friends!</h3>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                    sx={{
                        bgcolor: buttonColor,
                        color: '#f93d3a',
                        '&:hover': { bgcolor: '#e55a1a', color: '#f93d3a' },
                    }}
                    variant="contained"
                    onClick={() => history.push('/users')}
                >
                    Sign Up
                </Button>
                <Button
                    sx={{
                        color: '#f93d3a',
                        borderColor: buttonColor,
                        '&:hover': { borderColor: '#e55a1a', color: '#f93d3a', bgcolor: 'rgba(255, 108, 38, 0.08)' },
                    }}
                    variant="outlined"
                    onClick={() => history.push('/login')}
                >
                    Login
                </Button>
            </Box>
        </Box>
    );
}

export default LandingGrid;