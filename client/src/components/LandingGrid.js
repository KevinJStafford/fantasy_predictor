import * as React from 'react';
import {
    Box,
    Button,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    InputBase,
} from '@mui/material';
import { useHistory } from 'react-router-dom';
import { apiUrl } from '../utils/api';

const LIGHT_BLUE = '#D8F0F0';
const DARK_GREEN = '#1a472a';
const PROMO_RED = '#c62828';
const ORANGE_BG = '#ff6c26';

const SAMPLE_FIXTURES = [
    { home: 'Brentford', away: 'Leeds United', day: 'Saturday' },
    { home: 'West Ham United', away: 'Burnley', day: 'Saturday' },
    { home: 'Manchester City', away: 'Brighton and Hove Albion', day: 'Saturday' },
    { home: 'Sunderland', away: 'Bournemouth', day: 'Saturday' },
    { home: 'Crystal Palace', away: 'Newcastle United', day: 'Sunday' },
    { home: 'Nottingham Forest', away: 'Fulham', day: 'Sunday' },
    { home: 'Aston Villa', away: 'Leeds United', day: 'Saturday', time: '10:00 AM' },
    { home: 'Chelsea', away: 'Wolverhampton Wanderers', day: 'Sunday' },
    { home: 'Liverpool', away: 'Arsenal', day: 'Sunday' },
    { home: 'Manchester United', away: 'Everton', day: 'Sunday' },
];

const SAMPLE_LEADERBOARD = [
    { rank: 1, name: 'Gina' },
    { rank: 2, name: 'Jaclyn' },
    { rank: 3, name: 'Henry' },
    { rank: 4, name: 'Kevin' },
];

function LandingGrid() {
    const history = useHistory();
    const [fixtures, setFixtures] = React.useState(SAMPLE_FIXTURES);

    React.useEffect(() => {
        fetch(apiUrl('/api/v1/fixtures/current-round'))
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.round != null) {
                    return fetch(apiUrl(`/api/v1/fixtures/${data.round}`)).then((r) => (r.ok ? r.json() : []));
                }
                return Promise.resolve([]);
            })
            .then((list) => {
                if (Array.isArray(list) && list.length > 0) {
                    setFixtures(
                        list.map((f) => ({
                            home: f.fixture_home_team || f.home_team || '',
                            away: f.fixture_away_team || f.away_team || '',
                            day: f.fixture_date ? new Date(f.fixture_date).toLocaleDateString('en-US', { weekday: 'long' }) : '',
                            time: f.fixture_date ? new Date(f.fixture_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
                        })).filter((f) => f.home && f.away)
                    );
                }
            })
            .catch(() => {});
    }, []);

    return (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
            {/* Section 1: Hero - green prediction card left, FANTASY PREDICTOR + Sign up/Login right on light blue */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    minHeight: { xs: 'auto', md: '70vh' },
                    backgroundColor: LIGHT_BLUE,
                    alignItems: 'stretch',
                }}
            >
                <Box
                    sx={{
                        flex: { xs: 'none', md: '1 1 55%' },
                        p: { xs: 2, md: 3 },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            backgroundColor: DARK_GREEN,
                            borderRadius: 3,
                            borderTopRightRadius: { md: 0 },
                            borderBottomRightRadius: { md: 0 },
                            overflow: 'hidden',
                            width: '100%',
                            maxWidth: 560,
                        }}
                    >
                        <TableContainer>
                            <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.2)', color: 'white' } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '1rem' }}>Home</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 700, width: 100 }}>Score</TableCell>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '1rem' }}>Away</TableCell>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Day/Time</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {fixtures.slice(0, 8).map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{row.home}</TableCell>
                                            <TableCell align="center">
                                                <InputBase
                                                    sx={{
                                                        width: 36,
                                                        height: 32,
                                                        bgcolor: 'white',
                                                        borderRadius: 1,
                                                        px: 1,
                                                        textAlign: 'center',
                                                        fontSize: '0.875rem',
                                                    }}
                                                    placeholder="–"
                                                    inputProps={{ style: { textAlign: 'center' } }}
                                                />
                                                <Typography component="span" sx={{ mx: 0.5, color: 'white' }}>–</Typography>
                                                <InputBase
                                                    sx={{
                                                        width: 36,
                                                        height: 32,
                                                        bgcolor: 'white',
                                                        borderRadius: 1,
                                                        px: 1,
                                                        textAlign: 'center',
                                                        fontSize: '0.875rem',
                                                    }}
                                                    placeholder="–"
                                                    inputProps={{ style: { textAlign: 'center' } }}
                                                />
                                            </TableCell>
                                            <TableCell>{row.away}</TableCell>
                                            <TableCell sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}>
                                                {row.day}
                                                {row.time ? ` ${row.time}` : ''}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Box>
                <Box
                    sx={{
                        flex: { xs: 'none', md: '1 1 45%' },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: { xs: 4, md: 6 },
                        px: 3,
                    }}
                >
                    <Typography
                        component="h1"
                        sx={{
                            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                            fontWeight: 800,
                            letterSpacing: 2,
                            textAlign: 'center',
                            mb: 3,
                            lineHeight: 1.1,
                        }}
                    >
                        <Box component="span" sx={{ color: '#f93d3a' }}>F</Box>
                        <Box component="span" sx={{ color: 'primary.main' }}>ANTASY PREDICTOR</Box>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Button
                            variant="contained"
                            href="/#/users"
                            onClick={(e) => { e.preventDefault(); history.push('/users'); }}
                            sx={{
                                bgcolor: 'primary.main',
                                color: 'black',
                                fontWeight: 700,
                                letterSpacing: 1.5,
                                px: 3,
                                py: 1.5,
                                borderRadius: 10,
                                '&:hover': { bgcolor: 'primary.dark', color: 'black' },
                            }}
                        >
                            SIGN UP
                        </Button>
                        <Button
                            variant="contained"
                            href="/#/login"
                            onClick={(e) => { e.preventDefault(); history.push('/login'); }}
                            sx={{
                                bgcolor: 'primary.main',
                                color: 'black',
                                fontWeight: 700,
                                letterSpacing: 1.5,
                                px: 3,
                                py: 1.5,
                                borderRadius: 10,
                                '&:hover': { bgcolor: 'primary.dark', color: 'black' },
                            }}
                        >
                            LOGIN
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Section 2: Match list background with two red promo banners */}
            <Box
                sx={{
                    position: 'relative',
                    minHeight: 380,
                    backgroundColor: '#fff',
                    py: 6,
                    px: 2,
                }}
            >
                {/* Background match list (faded) */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        opacity: 0.25,
                        py: 4,
                        px: 3,
                    }}
                >
                    <TableContainer>
                        <Table size="small">
                            <TableBody>
                                {fixtures.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{row.home}</TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ width: 40, height: 28, border: '1px solid #ccc', borderRadius: 1, display: 'inline-block' }} />
                                        </TableCell>
                                        <TableCell>{row.away}</TableCell>
                                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                            {row.day}
                                            {row.time ? ` ${row.time}` : ''}
                                        </TableCell>
                                        <TableCell>
                                            <Button size="small" variant="contained" color="primary" sx={{ borderRadius: 2 }}>
                                                SAVE
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                {/* Two red overlay banners */}
                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        gap: 3,
                        justifyContent: 'center',
                        alignItems: 'stretch',
                        maxWidth: 900,
                        margin: '0 auto',
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            flex: 1,
                            backgroundColor: PROMO_RED,
                            color: 'white',
                            borderRadius: 3,
                            p: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            minHeight: 160,
                        }}
                    >
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Join the action today! Sign up now!
                        </Typography>
                    </Paper>
                    <Paper
                        elevation={0}
                        sx={{
                            flex: 1.2,
                            backgroundColor: PROMO_RED,
                            color: 'white',
                            borderRadius: 3,
                            p: 4,
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 160,
                        }}
                    >
                        <Typography variant="body1" sx={{ textAlign: 'left' }}>
                            Experience the excitement of predicting football scores in real-time! With every match, you have the opportunity to test your ball knowledge. Join a community of fellow fans who share your passion for the game, or{' '}
                            <Box component="span" sx={{ fontWeight: 700 }}>start a league with your friends</Box>
                            {' '}and compete for bragging rights.
                        </Typography>
                    </Paper>
                </Box>
            </Box>

            {/* Section 3: How to play + Scoring (orange) left, League Leaderboard (white card) right */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    minHeight: { xs: 'auto', md: '55vh' },
                    backgroundColor: ORANGE_BG,
                }}
            >
                <Box
                    sx={{
                        flex: { xs: 'none', md: '1 1 50%' },
                        py: 6,
                        px: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 5,
                    }}
                >
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', letterSpacing: 1, mb: 2 }}>
                            HOW TO PLAY
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '1.05rem', lineHeight: 1.7 }}>
                            <Box component="span" sx={{ fontWeight: 700 }}>Joining the game</Box> is easy; create your account and join an open league to start predicting scores!
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '1.05rem', lineHeight: 1.7, mt: 1 }}>
                            <Box component="span" sx={{ fontWeight: 700 }}>Start your own league</Box> to compete against family and friends.
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', letterSpacing: 1, mb: 2 }}>
                            SCORING SYSTEM
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '1.05rem', mb: 1.5 }}>
                            Our scoring system rewards accurate predictions.
                        </Typography>
                        <Typography component="div" sx={{ color: 'white', fontSize: '1rem', lineHeight: 2 }}>
                            • <Box component="span" sx={{ fontWeight: 700 }}>Win 3 points</Box> – Perfect score prediction<br />
                            • <Box component="span" sx={{ fontWeight: 700 }}>Draw 1 point</Box> – Correct outcome; wrong scores<br />
                            • <Box component="span" sx={{ fontWeight: 700 }}>Lose 0 points</Box> – Try harder!
                        </Typography>
                    </Box>
                </Box>
                <Box
                    sx={{
                        flex: { xs: 'none', md: '1 1 50%' },
                        py: 6,
                        px: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: { xs: 'center', md: 'flex-start' },
                    }}
                >
                    <Paper
                        elevation={4}
                        sx={{
                            backgroundColor: 'white',
                            borderRadius: 3,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            overflow: 'hidden',
                            width: '100%',
                            maxWidth: 400,
                        }}
                    >
                        <Box sx={{ p: 2.5, pb: 0 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                                League Leaderboard
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                All game weeks (1-38)
                            </Typography>
                        </Box>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Player</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {SAMPLE_LEADERBOARD.map((row) => (
                                        <TableRow key={row.rank} sx={{ '&:not(:last-child) td': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                                            <TableCell sx={{ fontWeight: 700 }}>#{row.rank}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
}

export default LandingGrid;
