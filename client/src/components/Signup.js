import React from 'react';
import {TextField, Button, Container, Box} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';
import {useHistory} from 'react-router-dom';
import { apiUrl } from '../utils/api';

import Navbar from './Navbar'
import ErrorBoundary from './ErrorBoundary'

function Signup({setUser}) {
    console.log('=== SIGNUP COMPONENT RENDERING ===');
    console.log('setUser prop:', typeof setUser);
    const history = useHistory();

    const signupSchema = yup.object().shape({
        username: yup.string()
        .min(5, 'Username is too short!')
        .max(18, 'Username is too long!')
        .required('Username is Required!'),
        email: yup.string().email('Invalid email'),
        password: yup.string()
        .min(5, 'Password is too short!')
        .max(18, 'Password is too long!')
        .required('Password is Required!')
    })

    const formik = useFormik({
        initialValues: {
            username: '',
            email: '',
            password: '',
        },
        validationSchema: signupSchema,
        onSubmit: (values) => {
            fetch(apiUrl('/api/v1/users'), {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify(values)
            }).then((resp) => {
                if (resp.ok) {
                    resp.json().then(({user}) => {
                    setUser(user)
                    history.push('/player')
                    })
                } else {
                    console.log('errors? handle error')
                }
            })
        }
    })

    console.log('Signup component returning JSX, apiUrl base:', apiUrl(''));
    return(
        <main style={{ minHeight: '100vh', backgroundColor: '#ffffff', position: 'relative', zIndex: 1 }}>
            <ErrorBoundary>
                <Navbar />
            </ErrorBoundary>
            {/* TEST: This should be visible if component renders */}
            <div style={{ 
                padding: '40px', 
                backgroundColor: 'red', 
                color: 'white', 
                fontSize: '32px', 
                fontWeight: 'bold',
                textAlign: 'center',
                margin: '20px',
                border: '5px solid black'
            }}>
                TEST: SIGNUP PAGE IS RENDERING
            </div>
            <div style={{ padding: '20px', backgroundColor: '#f5f5f5', margin: '20px' }}>
                <h1 style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>Sign Up</h1>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            {/* {formik.errors} */}
        <hr></hr>
        <Container maxWidth="xs">
            <form onSubmit={formik.handleSubmit}>
                <Box>
                <TextField
                    sx={{ width: 1}}
                    id="username" 
                    label="Username" 
                    variant="standard"
                    error={!!formik.errors.username}
                    helperText={formik.errors.username}
                    required
                    value={formik.values.username}
                    onChange={formik.handleChange}
                />
                </Box>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="email" 
                    label="email" 
                    variant="standard"
                    error={!!formik.errors.email}
                    helperText={formik.errors.email}
                    value={formik.values.email}
                   onChange={formik.handleChange}
                  />
                </Box>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="password" 
                    label="password"
                    type="password"
                    variant="standard"
                    error={!!formik.errors.password}
                    helperText={formik.errors.password}
                    required
                    value={formik.values.password}
                    onChange={formik.handleChange} 
                  />
                </Box>
                <hr></hr>
                <Button fullWidth='True'variant="outlined" type="submit">Submit</Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Signup