import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import { Flex, Spacer, Box, Image } from '@chakra-ui/react'
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import { yellow } from '@mui/material/colors';

function Navbar() {
    try {
        return (
            <Flex>
                <Box p='4' bg='red.400'>
                    <Image 
                        justify="left" 
                        className="nav_logo" 
                        objectFit='cover' 
                        src="https://dl.dropboxusercontent.com/scl/fi/jz578vjpoujkt4o7n0o65/header_navbar_2.png?rlkey=e85yc3b29u3x8nbk8yxkmiw2t&dl=0" 
                        alt='Fantasy Predictor text logo'
                        onError={(e) => {
                            console.error('Navbar image failed to load');
                            e.target.style.display = 'none';
                        }}
                    />
                </Box>
                <Spacer />
                <Box p='4' bg='green.400'>
                    <Avatar sx={{bgcolor: yellow[500] }} variant='rounded'>
                        <AccountBoxIcon />
                    </Avatar>
                </Box>
            </Flex>
        );
    } catch (error) {
        console.error('Navbar render error:', error);
        return (
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>
                <h3>Fantasy Predictor</h3>
            </div>
        );
    }
}

export default Navbar;