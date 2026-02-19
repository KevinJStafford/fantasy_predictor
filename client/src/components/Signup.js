import React, { useState } from 'react';
import { TextField, Button, Container, Box, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {useFormik} from 'formik';
import * as yup from 'yup';
import {useHistory} from 'react-router-dom';
import { apiUrl } from '../utils/api';
import { saveToken } from '../utils/auth';

import Navbar from './Navbar'

function Signup({setUser}) {
    const history = useHistory();
    const [showPassword, setShowPassword] = useState(false);

    const signupSchema = yup.object().shape({
        email: yup.string().email('Invalid email').required('Email is required'),
        password: yup.string()
            .min(5, 'Password is too short!')
            .max(72, 'Password is too long!')
            .required('Password is required'),
        confirm_password: yup.string()
            .oneOf([yup.ref('password'), null], 'Passwords must match')
            .required('Please confirm your password'),
    })

    const formik = useFormik({
        initialValues: {
            email: '',
            password: '',
            confirm_password: '',
        },
        validationSchema: signupSchema,
        onSubmit: (values) => {
            fetch(apiUrl('/api/v1/users'), {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify({
                    email: values.email,
                    password: values.password,
                    confirm_password: values.confirm_password,
                })
            }).then((resp) => {
                if (resp.ok) {
                    resp.json().then(({user, token}) => {
                        if (token) {
                            saveToken(token)
                        }
                        setUser(user)
                        window.dispatchEvent(new Event('user-updated'))
                        history.push('/leagues')
                    })
                } else {
                    resp.json().then((data) => {
                        alert(data.error || 'Signup failed. Please try again.')
                    }).catch(() => alert('Signup failed. Please try again.'))
                }
            })
        }
    })

    return(
        <main>
            <Navbar />
            <div style={{ padding: '20px' }}>
            {/* {formik.errors} */}
        <hr></hr>
        <Container maxWidth="xs">
            <form onSubmit={formik.handleSubmit}>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="email" 
                    label="Email" 
                    type="email"
                    variant="standard"
                    error={!!formik.errors.email}
                    helperText={formik.errors.email}
                    required
                    value={formik.values.email}
                    onChange={formik.handleChange}
                />
                </Box>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="password" 
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    variant="standard"
                    error={!!formik.errors.password}
                    helperText={formik.errors.password}
                    required
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    edge="end"
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
                </Box>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="confirm_password" 
                    label="Confirm password"
                    type={showPassword ? 'text' : 'password'}
                    variant="standard"
                    error={!!formik.errors.confirm_password}
                    helperText={formik.errors.confirm_password}
                    required
                    value={formik.values.confirm_password}
                    onChange={formik.handleChange}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    edge="end"
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
                </Box>
                <hr></hr>
                <Button fullWidth variant="contained" color="primary" type="submit">Submit</Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Signup