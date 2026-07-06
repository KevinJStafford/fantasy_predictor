import * as React from 'react';
import { useEffect } from 'react';
import Avatar from '@mui/material/Avatar';
import { Box, AppBar, Toolbar, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Button } from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { useHistory } from 'react-router-dom';
import { getToken, removeToken } from '../utils/auth';
import { authenticatedFetch, apiUrl } from '../utils/api';
import {
    clearCurrentUserSnapshot,
    fetchCurrentUser,
    getCachedCurrentUser,
} from '../utils/currentUserSnapshot';

function Navbar() {
    const history = useHistory();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [user, setUser] = React.useState(() => getCachedCurrentUser());
    const open = Boolean(anchorEl);
    const logoUrl = (process.env.PUBLIC_URL || '') + '/typeface_logo_new.png';
    const isLoggedIn = !!getToken();

    const fetchUser = React.useCallback(() => {
        if (!getToken()) {
            setUser(null);
            clearCurrentUserSnapshot();
            return;
        }
        fetchCurrentUser(authenticatedFetch).then((u) => {
            if (!u && getToken()) {
                removeToken();
            }
            setUser(u);
        });
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser, isLoggedIn]);

    useEffect(() => {
        const onUserUpdated = () => fetchUser();
        window.addEventListener('user-updated', onUserUpdated);
        return () => window.removeEventListener('user-updated', onUserUpdated);
    }, [fetchUser]);

    const handleAvatarClick = (event) => {
        if (isLoggedIn) {
            setAnchorEl(event.currentTarget);
        } else {
            history.push('/login');
        }
    };

    const handleClose = () => setAnchorEl(null);

    const handleLogout = () => {
        removeToken();
        setAnchorEl(null);
        history.push('/');
    };

    const handleBrackets = () => {
        setAnchorEl(null);
        history.push('/brackets');
    };

    const handleMyLeagues = () => {
        setAnchorEl(null);
        history.push('/leagues');
    };

    const handlePlayer = () => {
        setAnchorEl(null);
        history.push('/player');
    };

    const handleProfile = () => {
        setAnchorEl(null);
        history.push('/profile');
    };

    return (
        <AppBar
            position="sticky"
            elevation={0}
            sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                overflow: 'hidden',
            }}
        >
            <Toolbar
                sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: { xs: 1.5, sm: 3 },
                    minHeight: { xs: 56, sm: 64 },
                    height: { xs: 56, sm: 64 },
                    maxWidth: 1280,
                    width: '100%',
                    mx: 'auto',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        flex: '1 1 0',
                        mr: { xs: 0.5, sm: 1 },
                        height: { xs: 36, sm: 44 },
                        flexShrink: 0,
                        overflow: 'hidden',
                    }}
                >
                    <img
                        className="nav_logo"
                        src={logoUrl}
                        alt="Fantasy Predictor text logo"
                        style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', verticalAlign: 'middle' }}
                        onError={(e) => {
                            console.error('Navbar image failed to load');
                            e.target.style.display = 'none';
                        }}
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 }, flexShrink: 0 }}>
                    {!isLoggedIn && (
                        <>
                            <Button
                                onClick={() => history.push('/login')}
                                sx={{
                                    display: { xs: 'none', sm: 'inline-flex' },
                                    color: 'text.primary',
                                    fontWeight: 600,
                                    fontFamily: 'var(--landing-font)',
                                    textTransform: 'none',
                                    borderRadius: 99,
                                    px: 2,
                                }}
                            >
                                Log in
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => history.push('/users')}
                                sx={{
                                    display: { xs: 'none', sm: 'inline-flex' },
                                    bgcolor: '#ff6c26',
                                    color: '#111',
                                    fontWeight: 700,
                                    fontFamily: 'var(--landing-font)',
                                    textTransform: 'none',
                                    borderRadius: 99,
                                    px: 2.5,
                                    boxShadow: 'none',
                                    '&:hover': { bgcolor: '#e55a1a', boxShadow: 'none' },
                                }}
                            >
                                Sign up
                            </Button>
                        </>
                    )}
                    <IconButton
                        onClick={handleAvatarClick}
                        aria-label={isLoggedIn ? 'Account menu' : 'Go to login'}
                        aria-controls={open ? 'account-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        sx={{ p: 0 }}
                    >
                        <Avatar
                            key={user?.avatar_url ? `avatar-${user.id}-${user.avatar_url}` : 'avatar-placeholder'}
                            src={user?.avatar_url ? `${apiUrl(user.avatar_url)}${user.updated_at ? `?v=${user.updated_at}` : ''}` : undefined}
                            sx={{
                                width: { xs: 36, sm: 40 },
                                height: { xs: 36, sm: 40 },
                                boxSizing: 'border-box',
                                ...(user?.avatar_url
                                    ? { bgcolor: 'transparent' }
                                    : {
                                          bgcolor: 'primary.main',
                                          color: '#fff',
                                          '& .MuiSvgIcon-root': { color: '#fff' },
                                      }),
                            }}
                            variant="rounded"
                        >
                            {!user?.avatar_url && <AccountBoxIcon sx={{ color: 'inherit' }} />}
                        </Avatar>
                    </IconButton>
                    <Menu
                        id="account-menu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        onClick={handleClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <MenuItem onClick={handleProfile}>
                            <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Profile</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleBrackets}>
                            <ListItemText>Brackets</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleMyLeagues}>
                            <ListItemText>My leagues</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handlePlayer}>
                            <ListItemText>League / Predictions</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Log out</ListItemText>
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default Navbar;