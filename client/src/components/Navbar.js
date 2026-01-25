import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import { Box, AppBar, Toolbar } from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import { yellow } from '@mui/material/colors';

function Navbar() {
    return (
        <AppBar position="static" sx={{ backgroundColor: '#fff', boxShadow: 1 }}>
            <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img 
                        className="nav_logo" 
                        src="https://dl.dropboxusercontent.com/scl/fi/jz578vjpoujkt4o7n0o65/header_navbar_2.png?rlkey=e85yc3b29u3x8nbk8yxkmiw2t&dl=0" 
                        alt='Fantasy Predictor text logo'
                        style={{ maxHeight: '60px', objectFit: 'contain' }}
                        onError={(e) => {
                            console.error('Navbar image failed to load');
                            e.target.style.display = 'none';
                        }}
                    />
                </Box>
                <Box>
                    <Avatar sx={{ bgcolor: yellow[500] }} variant='rounded'>
                        <AccountBoxIcon />
                    </Avatar>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default Navbar;