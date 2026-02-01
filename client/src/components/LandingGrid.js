import * as React from 'react';
import { Button, Box } from '@mui/material';
import { useHistory } from 'react-router-dom';

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
            <Box sx={{ textAlign: 'center', maxWidth: 600, color: 'primary.main' }}>
                <h1>Premier League Score Predictor</h1>
                <h3>Correctly guess the scores of every Premier League match to win points and impress your friends!</h3>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                    sx={{
                        bgcolor: 'primary.main',
                        color: 'secondary.main',
                        '&:hover': { bgcolor: 'primary.dark', color: 'secondary.main' },
                    }}
                    variant="contained"
                    onClick={() => history.push('/users')}
                >
                    Sign Up
                </Button>
                <Button
                    sx={{
                        color: 'secondary.main',
                        borderColor: 'primary.main',
                        '&:hover': { borderColor: 'primary.dark', color: 'secondary.main', bgcolor: 'primary.light' },
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