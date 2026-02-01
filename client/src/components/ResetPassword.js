import React, { useState } from 'react';
import { TextField, Button, Container, Box, Typography } from '@mui/material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useHistory, useLocation } from 'react-router-dom';
import { apiUrl } from '../utils/api';
import Navbar from './Navbar';

const validationSchema = yup.object({
    password: yup
        .string()
        .min(5, 'Password is too short')
        .max(72, 'Password is too long')
        .required('Password is required'),
    confirm_password: yup
        .string()
        .oneOf([yup.ref('password'), null], 'Passwords must match')
        .required('Please confirm your password'),
});

function ResetPassword() {
    const history = useHistory();
    const location = useLocation();
    const [success, setSuccess] = useState(false);
    const token = new URLSearchParams(location.search).get('token');

    const formik = useFormik({
        initialValues: { password: '', confirm_password: '' },
        validationSchema,
        onSubmit: (values) => {
            fetch(apiUrl('/api/v1/reset-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: values.password,
                    confirm_password: values.confirm_password,
                }),
            })
                .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    if (ok) {
                        setSuccess(true);
                        setTimeout(() => history.push('/login'), 2000);
                    } else {
                        formik.setFieldError('password', data.error || 'Reset failed');
                    }
                })
                .catch(() => formik.setFieldError('password', 'Something went wrong. Please try again.'));
        },
    });

    if (!token) {
        return (
            <main>
                <Navbar />
                <Container maxWidth="xs" sx={{ pt: 4 }}>
                    <Typography color="error">
                        Missing reset link. Please use the link from your email or request a new one.
                    </Typography>
                    <Button component="a" href="#/forgot-password" sx={{ mt: 2 }}>
                        Request new link
                    </Button>
                </Container>
            </main>
        );
    }

    return (
        <main>
            <Navbar />
            <div style={{ padding: '20px' }}>
                <Container maxWidth="xs">
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Set new password
                    </Typography>
                    {success ? (
                        <Typography color="text.secondary">
                            Password reset successfully. Redirecting to login…
                        </Typography>
                    ) : (
                        <form onSubmit={formik.handleSubmit}>
                            <Box>
                                <TextField
                                    fullWidth
                                    id="password"
                                    name="password"
                                    label="New password"
                                    type="password"
                                    variant="standard"
                                    value={formik.values.password}
                                    onChange={formik.handleChange}
                                    error={!!formik.errors.password}
                                    helperText={formik.errors.password}
                                    required
                                />
                            </Box>
                            <Box sx={{ mt: 2 }}>
                                <TextField
                                    fullWidth
                                    id="confirm_password"
                                    name="confirm_password"
                                    label="Confirm new password"
                                    type="password"
                                    variant="standard"
                                    value={formik.values.confirm_password}
                                    onChange={formik.handleChange}
                                    error={!!formik.errors.confirm_password}
                                    helperText={formik.errors.confirm_password}
                                    required
                                />
                            </Box>
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                color="primary"
                                sx={{ mt: 3 }}
                            >
                                Reset password
                            </Button>
                        </form>
                    )}
                </Container>
            </div>
        </main>
    );
}

export default ResetPassword;
