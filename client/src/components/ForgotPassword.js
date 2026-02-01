import React, { useState } from 'react';
import { TextField, Button, Container, Box, Typography, Link } from '@mui/material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { Link as RouterLink } from 'react-router-dom';
import { apiUrl } from '../utils/api';
import Navbar from './Navbar';

const validationSchema = yup.object({
    email: yup.string().email('Invalid email').required('Email is required'),
});

function ForgotPassword() {
    const [submitted, setSubmitted] = useState(false);
    const [resetLink, setResetLink] = useState(null);
    const [error, setError] = useState(null);

    const formik = useFormik({
        initialValues: { email: '' },
        validationSchema,
        onSubmit: (values) => {
            setError(null);
            const frontendUrl = window.location.origin + (window.location.pathname || '');
            fetch(apiUrl('/api/v1/forgot-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: values.email.trim(),
                    frontend_url: frontendUrl,
                }),
            })
                .then((res) => res.json())
                .then((data) => {
                    setSubmitted(true);
                    if (data.reset_link) setResetLink(data.reset_link);
                    if (data.error) setError(data.error);
                })
                .catch(() => setError('Something went wrong. Please try again.'));
        },
    });

    return (
        <main>
            <Navbar />
            <div style={{ padding: '20px' }}>
                <Container maxWidth="xs">
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Forgot password
                    </Typography>
                    {!submitted ? (
                        <form onSubmit={formik.handleSubmit}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Enter your email and we’ll send you a link to reset your password.
                            </Typography>
                            <Box>
                                <TextField
                                    fullWidth
                                    id="email"
                                    name="email"
                                    label="Email"
                                    type="email"
                                    variant="standard"
                                    value={formik.values.email}
                                    onChange={formik.handleChange}
                                    error={!!formik.errors.email}
                                    helperText={formik.errors.email}
                                    required
                                />
                            </Box>
                            {error && (
                                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                                    {error}
                                </Typography>
                            )}
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                color="primary"
                                sx={{ mt: 2 }}
                            >
                                Send reset link
                            </Button>
                        </form>
                    ) : (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                If an account exists with that email, we’ve sent a reset link.
                            </Typography>
                            {resetLink && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Open this link to set a new password:
                                    </Typography>
                                    <Link href={resetLink} target="_self" rel="noopener">
                                        Reset password
                                    </Link>
                                </Box>
                            )}
                            <RouterLink to="/login" style={{ fontSize: '0.875rem' }}>
                                Back to login
                            </RouterLink>
                        </Box>
                    )}
                </Container>
            </div>
        </main>
    );
}

export default ForgotPassword;
