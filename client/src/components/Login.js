import { useEffect } from 'react';
import {TextField, Button, Container, Box} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';
import { useHistory, Link } from 'react-router-dom';
import { apiUrl, authenticatedFetch } from '../utils/api';
import { saveToken, getToken, removeToken } from '../utils/auth';

import Navbar from './Navbar'

function Login({setUser}) {
    const history = useHistory();

    // If user already has a valid token, log them in and redirect to leagues
    useEffect(() => {
        if (!getToken()) return;
        authenticatedFetch('/api/v1/authorized')
            .then((resp) => {
                if (resp.ok) {
                    return resp.json().then((user) => {
                        setUser(user);
                        window.dispatchEvent(new Event('user-updated'));
                        history.push('/leagues');
                    });
                }
                removeToken();
            })
            .catch(() => { removeToken(); });
    }, [history, setUser]);
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
            fetch(apiUrl('/api/v1/login'), {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify({ email: values.email, password: values.password })
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
                        console.error('Login error:', data.error || 'Login failed')
                        alert(data.error || 'Login failed. Please check your email and password.')
                    }).catch(() => {
                        alert('Login failed. Please try again.')
                    })
                }
            }).catch((error) => {
                console.error('Login request error:', error)
                alert('Failed to connect to server. Please try again.')
            })
        }
    })

    return(
        <main>
            <Navbar />
            <div>
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
                <Button fullWidth variant="contained" color="primary" type="submit">Submit</Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Login;