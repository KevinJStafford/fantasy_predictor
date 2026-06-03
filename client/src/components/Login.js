import { useEffect, useState } from 'react';
import {TextField, Button, Container, Box, Alert} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';
import { useHistory, useLocation, Link } from 'react-router-dom';
import { apiUrl, authenticatedFetch } from '../utils/api';
import { saveToken, getToken, removeToken } from '../utils/auth';
import { writeCurrentUserSnapshot } from '../utils/currentUserSnapshot';

import Navbar from './Navbar'

function getNextRedirect(location) {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) return next;
    return '/leagues';
}

function Login({setUser}) {
    const history = useHistory();
    const location = useLocation();
    const redirectTo = getNextRedirect(location);
    const [pageFlash, setPageFlash] = useState(() => location.state?.flash || null);
    const [submitting, setSubmitting] = useState(false);
    const [loginError, setLoginError] = useState(null);

    useEffect(() => {
        if (location.state?.flash) {
            setPageFlash(location.state.flash);
            history.replace(location.pathname + location.search, {});
        }
    }, [location.state, location.pathname, location.search, history]);

    // If user already has a valid token, log them in and redirect
    useEffect(() => {
        if (!getToken()) return;
        authenticatedFetch('/api/v1/authorized')
            .then((resp) => {
                if (resp.ok) {
                    return resp.json().then((user) => {
                        writeCurrentUserSnapshot(user);
                        setUser(user);
                        window.dispatchEvent(new Event('user-updated'));
                        history.push(redirectTo);
                    });
                }
                removeToken();
            })
            .catch(() => { removeToken(); });
    }, [history, setUser, redirectTo]);
    const loginSchema = yup.object().shape({
        email: yup.string().email('Invalid email').required('Email is required'),
        password: yup.string().required('Password is required'),
    })

    const formik = useFormik({
        initialValues: {
            email: '',
            password: '',
        },
        validationSchema: loginSchema,
        onSubmit: (values) => {
            setSubmitting(true)
            setLoginError(null)
            fetch(apiUrl('/api/v1/login'), {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify({ email: values.email, password: values.password })
            }).then((resp) => {
                if (resp.ok) {
                    return resp.json().then((data) => {
                        const user = data?.user
                        const token = data?.token
                        if (!token) {
                            setLoginError('Login succeeded but no session was returned. Please try again or contact support.')
                            return
                        }
                        saveToken(token)
                        if (user) {
                            writeCurrentUserSnapshot(user)
                            setUser(user)
                            window.dispatchEvent(new Event('user-updated'))
                        }
                        history.push(redirectTo)
                    })
                }
                return resp.json().then((data) => {
                    const msg = data?.error || 'Login failed. Please check your email and password.'
                    console.error('Login error:', msg)
                    setLoginError(msg)
                }).catch(() => {
                    setLoginError('Login failed. Please try again.')
                })
            }).catch((error) => {
                console.error('Login request error:', error)
                setLoginError('Failed to connect to server. Please try again.')
            }).finally(() => setSubmitting(false))
        }
    })

    return(
        <main>
            <Navbar />
            <div>
            {/* {formik.errors} */}
        <hr></hr>
        <Container maxWidth="xs">
            {pageFlash?.text && (
                <Alert severity={pageFlash.type === 'error' ? 'error' : 'info'} sx={{ mb: 2 }}>
                    {pageFlash.text}
                </Alert>
            )}
            {loginError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {loginError}
                </Alert>
            )}
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
                    label="password"
                    type="password"
                    variant="standard"
                    error={!!formik.errors.password}
                    helperText={formik.errors.password}
                    required
                    value={formik.values.password}
                    onChange={formik.handleChange}/>
                </Box>
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: 'inherit' }}>
                        Forgot password?
                    </Link>
                </Box>
                <hr></hr>
                <Button fullWidth variant="contained" color="primary" type="submit" disabled={submitting}>
                    {submitting ? 'Signing in…' : 'Submit'}
                </Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Login;