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
    Container,
    Grid,
} from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import GroupsIcon from '@mui/icons-material/Groups';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import { useHistory } from 'react-router-dom';
import { apiUrl } from '../utils/api';

const BRAND = {
    primary: '#ff6c26',
    primaryDark: '#e55a1a',
    accent: '#f93d3a',
    green: '#1a472a',
    mint: '#D8F0F0',
    cream: '#fafafa',
};

const MARQUEE_ITEMS = [
    'Score Predictions',
    'Private Leagues',
    'Live Leaderboards',
    'Premier League Fixtures',
    'Compete with Friends',
    'Real-Time Scoring',
    'Bragging Rights',
    'Season-Long Play',
];

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

const LEADERBOARD_NAMES = [
    'Alex', 'Jordan', 'Sam', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Avery',
    'Jamie', 'Drew', 'Skyler', 'Parker', 'Reese', 'Cameron', 'Blair', 'Finley',
];

const SCORING_RULES = [
    { points: '3 pts', label: 'Perfect score', detail: 'Exact home and away goals' },
    { points: '1 pt', label: 'Correct outcome', detail: 'Right result, wrong scores' },
    { points: '0 pts', label: 'Miss', detail: 'Wrong outcome — try again next match' },
];

const FEATURE_CARDS = [
    {
        icon: SportsSoccerIcon,
        title: 'Predict every match',
        body: 'Fill in scorelines for upcoming Premier League fixtures each gameweek.',
    },
    {
        icon: GroupsIcon,
        title: 'Play with your crew',
        body: 'Join an open league or start a private one with family and friends.',
    },
    {
        icon: EmojiEventsIcon,
        title: 'Climb the table',
        body: 'Track standings across all 38 gameweeks and fight for the top spot.',
    },
];

function getRandomLeaderboardNames(count = 4) {
    const shuffled = [...LEADERBOARD_NAMES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((name, i) => ({ rank: i + 1, name }));
}

function SectionLabel({ children, color }) {
    return (
        <Typography
            sx={{
                fontFamily: 'var(--landing-font)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: color || BRAND.primary,
                mb: 1.5,
            }}
        >
            {children}
        </Typography>
    );
}

function FixturePreviewCard({ fixtures }) {
    return (
        <Paper
            elevation={0}
            sx={{
                backgroundColor: BRAND.green,
                borderRadius: '20px',
                overflow: 'hidden',
                width: '100%',
                boxShadow: '0 24px 64px rgba(26, 71, 42, 0.28), 0 8px 24px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
        >
            <Box
                sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                }}
            >
                <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>
                    This Gameweek
                </Typography>
                <Box
                    sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 99,
                        bgcolor: 'rgba(255, 108, 38, 0.2)',
                        color: BRAND.primary,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}
                >
                    Live fixtures
                </Box>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
                <Table
                    size="small"
                    sx={{
                        tableLayout: 'fixed',
                        minWidth: 280,
                        '& td, & th': {
                            borderColor: 'rgba(255,255,255,0.12)',
                            color: 'white',
                            verticalAlign: 'middle',
                        },
                    }}
                >
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.15)' }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', width: '30%' }}>Home</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.8rem', width: '18%' }}>Score</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', width: '30%' }}>Away</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', width: '22%' }}>Kickoff</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {fixtures.slice(0, 6).map((row, i) => (
                            <TableRow key={i} sx={{ '&:nth-of-type(even)': { bgcolor: 'rgba(0,0,0,0.06)' } }}>
                                <TableCell sx={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.home}</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>– –</TableCell>
                                <TableCell sx={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.away}</TableCell>
                                <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.68rem' }}>
                                    {row.day}
                                    {row.time ? ` ${row.time}` : ''}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function MarqueeStrip() {
    const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

    return (
        <Box
            sx={{
                py: 2.5,
                borderTop: '1px solid rgba(0,0,0,0.06)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                bgcolor: '#fff',
                overflow: 'hidden',
            }}
        >
            <Box className="landing-marquee-track" sx={{ gap: 2, px: 2 }}>
                {items.map((item, i) => (
                    <Box
                        key={`${item}-${i}`}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexShrink: 0,
                            px: 2.5,
                            py: 1,
                            borderRadius: 99,
                            bgcolor: BRAND.cream,
                            border: '1px solid rgba(0,0,0,0.05)',
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: i % 2 === 0 ? BRAND.primary : BRAND.accent,
                            }}
                        />
                        <Typography
                            sx={{
                                fontFamily: 'var(--landing-font)',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                color: 'text.primary',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {item}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

function LandingGrid() {
    const history = useHistory();
    const [fixtures, setFixtures] = React.useState(SAMPLE_FIXTURES);
    const leaderboardNames = React.useMemo(() => getRandomLeaderboardNames(4), []);

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

    const goToSignup = (e) => {
        e.preventDefault();
        history.push('/users');
    };

    const goToLogin = (e) => {
        e.preventDefault();
        history.push('/login');
    };

    return (
        <Box sx={{ width: '100%', overflow: 'hidden', fontFamily: 'var(--landing-font)' }}>
            {/* Hero */}
            <Box
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: `linear-gradient(180deg, #ffffff 0%, ${BRAND.mint}55 45%, #ffffff 100%)`,
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: -120,
                        right: -80,
                        width: 420,
                        height: 420,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${BRAND.primary}22 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: -100,
                        left: -60,
                        width: 360,
                        height: 360,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${BRAND.accent}18 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }}
                />

                <Container maxWidth="lg" sx={{ position: 'relative', py: { xs: 6, md: 10 } }}>
                    <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <SectionLabel>Premier League fantasy</SectionLabel>
                            <Typography
                                component="h1"
                                sx={{
                                    fontFamily: 'var(--landing-font)',
                                    fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4.25rem' },
                                    fontWeight: 800,
                                    letterSpacing: '-0.03em',
                                    lineHeight: 1.02,
                                    mb: 2.5,
                                }}
                            >
                                <Box component="span" sx={{ color: BRAND.accent }}>F</Box>
                                <Box component="span" sx={{ color: BRAND.primary }}>ANTASY</Box>
                                <br />
                                <Box component="span" sx={{ color: 'text.primary' }}>PREDICTOR</Box>
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: { xs: '1.05rem', md: '1.2rem' },
                                    lineHeight: 1.7,
                                    color: 'text.secondary',
                                    maxWidth: 520,
                                    mb: 4,
                                }}
                            >
                                Predict football scores, compete in leagues, and prove you know the game better than your mates.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                                <Button
                                    variant="contained"
                                    href="/users"
                                    onClick={goToSignup}
                                    sx={{
                                        bgcolor: BRAND.primary,
                                        color: '#111',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        px: 3.5,
                                        py: 1.4,
                                        borderRadius: 99,
                                        boxShadow: '0 8px 24px rgba(255, 108, 38, 0.35)',
                                        '&:hover': { bgcolor: BRAND.primaryDark, boxShadow: '0 10px 28px rgba(255, 108, 38, 0.4)' },
                                    }}
                                >
                                    Sign up free
                                </Button>
                                <Button
                                    variant="outlined"
                                    href="/login"
                                    onClick={goToLogin}
                                    sx={{
                                        color: 'text.primary',
                                        borderColor: 'rgba(0,0,0,0.12)',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        px: 3.5,
                                        py: 1.4,
                                        borderRadius: 99,
                                        bgcolor: '#fff',
                                        '&:hover': { borderColor: BRAND.primary, bgcolor: '#fff' },
                                    }}
                                >
                                    Log in
                                </Button>
                            </Box>
                            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                Free to join. Create a league in minutes.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FixturePreviewCard fixtures={fixtures} />
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            <MarqueeStrip />

            {/* Value prop */}
            <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#fff' }}>
                <Container maxWidth="lg">
                    <Box sx={{ textAlign: 'center', maxWidth: 720, mx: 'auto', mb: { xs: 5, md: 7 } }}>
                        <SectionLabel>Why play</SectionLabel>
                        <Typography
                            component="h2"
                            sx={{
                                fontFamily: 'var(--landing-font)',
                                fontSize: { xs: '2rem', md: '2.75rem' },
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.15,
                                mb: 2,
                            }}
                        >
                            Join the action today
                        </Typography>
                        <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.75, color: 'text.secondary' }}>
                            Experience the excitement of predicting football scores in real time. With every match, you have the chance to test your ball knowledge — join a community of fellow fans or{' '}
                            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>start a league with your friends</Box>
                            {' '}and compete for bragging rights.
                        </Typography>
                    </Box>

                    <Grid container spacing={3}>
                        {FEATURE_CARDS.map(({ icon: Icon, title, body }) => (
                            <Grid item xs={12} md={4} key={title}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 3.5,
                                        height: '100%',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(0,0,0,0.06)',
                                        bgcolor: BRAND.cream,
                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: '#fff',
                                            color: BRAND.primary,
                                            mb: 2.5,
                                            boxShadow: '0 4px 12px rgba(255, 108, 38, 0.15)',
                                        }}
                                    >
                                        <Icon />
                                    </Box>
                                    <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', mb: 1 }}>{title}</Typography>
                                    <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{body}</Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* How to play + scoring */}
            <Box
                sx={{
                    py: { xs: 8, md: 10 },
                    background: `linear-gradient(135deg, ${BRAND.green} 0%, #143d24 100%)`,
                }}
            >
                <Container maxWidth="lg">
                    <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <SectionLabel color={BRAND.mint}>How to play</SectionLabel>
                            <Typography
                                component="h2"
                                sx={{
                                    fontFamily: 'var(--landing-font)',
                                    fontSize: { xs: '2rem', md: '2.5rem' },
                                    fontWeight: 800,
                                    color: '#fff',
                                    letterSpacing: '-0.02em',
                                    mb: 3,
                                }}
                            >
                                Get in the game in two steps
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 3,
                                        borderRadius: '16px',
                                        bgcolor: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <Typography sx={{ color: BRAND.primary, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.1em', mb: 1 }}>
                                        STEP 01
                                    </Typography>
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>
                                        Create your account
                                    </Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
                                        Sign up and join an open league to start predicting scores right away.
                                    </Typography>
                                </Paper>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 3,
                                        borderRadius: '16px',
                                        bgcolor: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <Typography sx={{ color: BRAND.primary, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.1em', mb: 1 }}>
                                        STEP 02
                                    </Typography>
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>
                                        Start your own league
                                    </Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
                                        Invite family and friends to compete across the full season.
                                    </Typography>
                                </Paper>
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <ScoreboardIcon sx={{ color: BRAND.primary }} />
                                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem' }}>
                                    Scoring system
                                </Typography>
                            </Box>
                            <Typography sx={{ color: 'rgba(255,255,255,0.75)', mb: 3, lineHeight: 1.7 }}>
                                Our scoring rewards accurate predictions — nail the scoreline for maximum points.
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {SCORING_RULES.map((rule) => (
                                    <Box
                                        key={rule.label}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            p: 2,
                                            borderRadius: '14px',
                                            bgcolor: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                minWidth: 64,
                                                textAlign: 'center',
                                                fontWeight: 800,
                                                color: BRAND.primary,
                                                fontSize: '1rem',
                                            }}
                                        >
                                            {rule.points}
                                        </Box>
                                        <Box>
                                            <Typography sx={{ color: '#fff', fontWeight: 700 }}>{rule.label}</Typography>
                                            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{rule.detail}</Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Leaderboard preview */}
            <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: BRAND.cream }}>
                <Container maxWidth="lg">
                    <Grid container spacing={5} alignItems="center">
                        <Grid item xs={12} md={5}>
                            <SectionLabel>Competition</SectionLabel>
                            <Typography
                                component="h2"
                                sx={{
                                    fontFamily: 'var(--landing-font)',
                                    fontSize: { xs: '2rem', md: '2.5rem' },
                                    fontWeight: 800,
                                    letterSpacing: '-0.02em',
                                    mb: 2,
                                }}
                            >
                                Climb the league table
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.75, mb: 3 }}>
                                Every gameweek updates your standing. Track progress from week 1 through week 38 and see who really knows their football.
                            </Typography>
                            <Button
                                variant="contained"
                                href="/users"
                                onClick={goToSignup}
                                sx={{
                                    bgcolor: BRAND.accent,
                                    color: '#fff',
                                    fontWeight: 700,
                                    px: 3,
                                    py: 1.3,
                                    borderRadius: 99,
                                    '&:hover': { bgcolor: '#d63431' },
                                }}
                            >
                                Start competing
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={7}>
                            <Paper
                                elevation={0}
                                sx={{
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 3,
                                        py: 2.5,
                                        background: `linear-gradient(90deg, ${BRAND.primary} 0%, ${BRAND.accent} 100%)`,
                                    }}
                                >
                                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>
                                        League Leaderboard
                                    </Typography>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                                        All gameweeks (1–38)
                                    </Typography>
                                </Box>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: '#fff' }}>
                                                <TableCell sx={{ fontWeight: 700, width: 80 }}>Rank</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Player</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>Pts</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {leaderboardNames.map((row, i) => (
                                                <TableRow
                                                    key={row.rank}
                                                    sx={{
                                                        bgcolor: i === 0 ? `${BRAND.mint}88` : '#fff',
                                                        '& td': { borderColor: 'rgba(0,0,0,0.06)' },
                                                    }}
                                                >
                                                    <TableCell sx={{ fontWeight: 800, color: i === 0 ? BRAND.green : 'text.primary' }}>
                                                        #{row.rank}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: i === 0 ? 700 : 400 }}>{row.name}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: BRAND.primary }}>
                                                        {120 - i * 17}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Final CTA */}
            <Box
                sx={{
                    py: { xs: 8, md: 10 },
                    background: `linear-gradient(135deg, ${BRAND.primary} 0%, #ff8f4d 50%, ${BRAND.accent} 100%)`,
                    textAlign: 'center',
                }}
            >
                <Container maxWidth="md">
                    <Typography
                        component="h2"
                        sx={{
                            fontFamily: 'var(--landing-font)',
                            fontSize: { xs: '2.25rem', md: '3rem' },
                            fontWeight: 800,
                            color: '#111',
                            letterSpacing: '-0.02em',
                            mb: 2,
                        }}
                    >
                        Ready to predict?
                    </Typography>
                    <Typography sx={{ fontSize: '1.1rem', color: 'rgba(0,0,0,0.72)', mb: 4, lineHeight: 1.7 }}>
                        Own your league. Prove your football IQ. Sign up and make your picks before kickoff.
                    </Typography>
                    <Button
                        variant="contained"
                        href="/users"
                        onClick={goToSignup}
                        sx={{
                            bgcolor: '#111',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '1rem',
                            px: 4,
                            py: 1.5,
                            borderRadius: 99,
                            '&:hover': { bgcolor: '#222' },
                        }}
                    >
                        Get started for free
                    </Button>
                </Container>
            </Box>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    py: 4,
                    px: 2,
                    bgcolor: BRAND.green,
                    textAlign: 'center',
                }}
            >
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, mb: 0.5 }}>
                    Fantasy Predictor
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>
                    Predict scores. Win your league.
                </Typography>
            </Box>
        </Box>
    );
}

export default LandingGrid;
