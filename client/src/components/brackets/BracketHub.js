import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useHistory } from 'react-router-dom';
import Navbar from '../Navbar';
import { apiUrl, authenticatedFetch } from '../../utils/api';
import { getToken } from '../../utils/auth';

function formatLockDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function BracketHub() {
  const history = useHistory();
  const [editions, setEditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) {
      setIsLoggedIn(false);
      return;
    }
    authenticatedFetch('/api/v1/authorized')
      .then((res) => setIsLoggedIn(res.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    fetch(apiUrl('/api/v1/tournaments/active'))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load tournaments'))))
      .then((data) => setEditions(data.editions || []))
      .catch((err) => setError(err.message || 'Failed to load tournaments'))
      .finally(() => setLoading(false));
  }, []);

  const openBracket = (slug) => {
    if (!isLoggedIn) {
      history.push(`/login?next=${encodeURIComponent(`/brackets/${slug}`)}`);
      return;
    }
    history.push(`/brackets/${slug}`);
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          Tournament Brackets
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Predict group finishers and fill out the knockout bracket — solo or with friends in a league.
        </Typography>

        {!isLoggedIn && !loading && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            action={
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                  color="inherit"
                  size="small"
                  component={RouterLink}
                  to={`/login?next=${encodeURIComponent('/brackets')}`}
                >
                  Log in
                </Button>
                <Button
                  color="inherit"
                  size="small"
                  component={RouterLink}
                  to="/users"
                >
                  Sign up
                </Button>
              </Box>
            }
          >
            Sign in to save your bracket. You can browse tournaments below without an account.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && <Typography color="text.secondary">Loading tournaments…</Typography>}

        {!loading && !error && editions.length === 0 && (
          <Alert severity="info">No active bracket tournaments right now. Check back soon.</Alert>
        )}

        {editions.map((edition) => (
          <Card key={edition.slug} variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" component="h2">
                  {edition.name}
                </Typography>
                {edition.is_locked && <Chip label="Locked" size="small" color="error" />}
                {!edition.is_locked && <Chip label="Open" size="small" color="success" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {edition.num_groups} groups · top {edition.third_place_advance} third-place teams advance
              </Typography>
              {edition.bracket_lock_at && (
                <Typography variant="body2" color="text.secondary">
                  Brackets lock {formatLockDate(edition.bracket_lock_at)}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {edition.submission_count} bracket{edition.submission_count === 1 ? '' : 's'} submitted
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="contained" onClick={() => openBracket(edition.slug)}>
                {isLoggedIn ? 'Fill out bracket' : 'Log in to play'}
              </Button>
            </CardActions>
          </Card>
        ))}
      </Container>
    </>
  );
}

export default BracketHub;
