import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import { Box, AppBar, Toolbar, IconButton } from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import { useHistory } from 'react-router-dom';
import { getToken } from '../utils/auth';

function Navbar() {
    const history = useHistory();
    const logoUrl = (process.env.PUBLIC_URL || '') + '/typeface_logo_new.png';
    const isLoggedIn = !!getToken();

    const handleAvatarClick = () => {
        history.push(isLoggedIn ? '/player' : '/login');
    };

    return (
        <AppBar position="static" sx={{ backgroundColor: '#fff', boxShadow: 1 }}>
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
                    <IconButton onClick={handleAvatarClick} aria-label={isLoggedIn ? 'Go to players' : 'Go to login'} sx={{ p: 0 }}>
                        <Avatar sx={{ bgcolor: '#ff6c26' }} variant="rounded">
                            <AccountBoxIcon />
                        </Avatar>
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default Navbar;