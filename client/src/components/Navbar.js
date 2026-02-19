import * as React from 'react';
import { useEffect } from 'react';
import Avatar from '@mui/material/Avatar';
import { Box, AppBar, Toolbar, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { useHistory } from 'react-router-dom';
import { getToken, removeToken } from '../utils/auth';
import { authenticatedFetch, apiUrl } from '../utils/api';

function Navbar() {
    const history = useHistory();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [user, setUser] = React.useState(null);
    const open = Boolean(anchorEl);
    const logoUrl = (process.env.PUBLIC_URL || '') + '/typeface_logo_new.png';
    const isLoggedIn = !!getToken();

    const fetchUser = React.useCallback(() => {
        if (!getToken()) {
            setUser(null);
            return;
        }
        authenticatedFetch('/api/v1/authorized')
            .then((r) => (r.ok ? r.json() : null))
            .then(setUser)
            .catch(() => setUser(null));
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

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
        <AppBar position="static" sx={{ backgroundColor: 'background.paper', boxShadow: 1 }}>
            <Toolbar
                sx={{
                    justifyContent: 'space-between',
                    px: { xs: 1, sm: 2 },
                    minHeight: { xs: 48, sm: 64 },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        flex: '1 1 0',
                        mr: { xs: 0.5, sm: 1 },
                        maxHeight: { xs: 44, sm: 60 },
                    }}
                >
                    <img
                        className="nav_logo"
                        src={logoUrl}
                        alt="Fantasy Predictor text logo"
                        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                        onError={(e) => {
                            console.error('Navbar image failed to load');
                            e.target.style.display = 'none';
                        }}
                    />
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                    <IconButton
                        onClick={handleAvatarClick}
                        aria-label={isLoggedIn ? 'Account menu' : 'Go to login'}
                        aria-controls={open ? 'account-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        sx={{ p: 0 }}
                    >
                        <Avatar
                            src={user?.avatar_url ? apiUrl(user.avatar_url) : undefined}
                            sx={{
                                width: { xs: 36, sm: 40 },
                                height: { xs: 36, sm: 40 },
                                ...(user?.avatar_url
                                    ? { bgcolor: 'transparent' }
                                    : isLoggedIn
                                    ? {
                                          bgcolor: 'background.paper',
                                          border: '2px solid',
                                          borderColor: 'primary.main',
                                          color: 'primary.main',
                                      }
                                    : { bgcolor: 'primary.main' }),
                            }}
                            variant="rounded"
                        >
                            {!user?.avatar_url && <AccountBoxIcon />}
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