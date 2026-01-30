import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import { Box, AppBar, Toolbar } from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import { yellow } from '@mui/material/colors';
import typefaceLogoNew from '../../images/typeface_logo_new.png';

function Navbar() {
    return (
        <AppBar position="static" sx={{ backgroundColor: '#fff', boxShadow: 1 }}>
            <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img 
                        className="nav_logo" 
                        src={typefaceLogoNew}
                        alt="Fantasy Predictor text logo"
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