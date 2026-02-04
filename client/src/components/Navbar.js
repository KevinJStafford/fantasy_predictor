import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import { Box, AppBar, Toolbar, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import LogoutIcon from '@mui/icons-material/Logout';
import { useHistory } from 'react-router-dom';
import { getToken, removeToken } from '../utils/auth';

function Navbar() {
    const history = useHistory();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const logoUrl = (process.env.PUBLIC_URL || '') + '/typeface_logo_new.png';
    const isLoggedIn = !!getToken();

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

    return (
        <AppBar position="static" sx={{ backgroundColor: 'background.paper', boxShadow: 1 }}>
            <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img 
                        className="nav_logo" 
                        src={logoUrl}
                        alt="Fantasy Predictor text logo"
                        style={{ maxHeight: '60px', objectFit: 'contain' }}
                        onError={(e) => {
                            console.error('Navbar image failed to load');
                            e.target.style.display = 'none';
                        }}
                    />
                </Box>
                <Box>
                    <IconButton
                        onClick={handleAvatarClick}
                        aria-label={isLoggedIn ? 'Account menu' : 'Go to login'}
                        aria-controls={open ? 'account-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        sx={{ p: 0 }}
                    >
                        <Avatar sx={{ bgcolor: 'primary.main' }} variant="rounded">
                            <AccountBoxIcon />
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