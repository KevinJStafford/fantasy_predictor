import * as React from 'react'
import { Card, CardContent, Typography, TextField, Button, Box, Grid, Alert } from "@mui/material"
import {useFormik} from 'formik';
import { useState, useEffect } from 'react';
import * as yup from 'yup';

// Helper function to parse UTC dates
const parseUtcDate = (value) => {
    if (!value) return null

    // If server returns ISO with timezone (best case)
    if (typeof value === 'string' && (value.includes('Z') || /[+-]\d\d:\d\d$/.test(value))) {
        const d = new Date(value)
        return Number.isNaN(d.getTime()) ? null : d
    }

    // If server returns "YYYY-MM-DD HH:MM:SS" (no timezone), treat it as UTC
    if (typeof value === 'string' && value.includes(' ') && !value.includes('T')) {
        const utcIso = value.replace(' ', 'T') + 'Z'
        const d = new Date(utcIso)
        return Number.isNaN(d.getTime()) ? null : d
    }

    // Fallback: let the browser try
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

function Predictions({fixture, existingPrediction, onPredictionSaved}) {
    const {fixture_round, fixture_date, fixture_home_team, fixture_away_team, id} = fixture
    const [message, setMessage] = useState(null)
    const [saving, setSaving] = useState(false)
    
    // Check if the game has started (lock predictions after kickoff time)
    const isGameStarted = () => {
        if (!fixture_date) return false
        const gameDate = parseUtcDate(fixture_date)
        if (!gameDate) return false
        return new Date() >= gameDate
    }
    
    const gameStarted = isGameStarted()

    const predictionSchema = yup.object().shape({
        home_team_score: yup.number()
            .integer('Score must be a whole number')
            .min(0, 'Score cannot be negative')
            .required('Home team score is required'),
        away_team_score: yup.number()
            .integer('Score must be a whole number')
            .min(0, 'Score cannot be negative')
            .required('Away team score is required')
    })

    const formik = useFormik({
        initialValues: {
            home_team_score: existingPrediction?.home_team_score ?? '',
            away_team_score: existingPrediction?.away_team_score ?? '',
        },
        enableReinitialize: true,
        validationSchema: predictionSchema,
        onSubmit: (values) => {
            setSaving(true)
            setMessage(null)
            
            fetch('/api/v1/predictions', {
                method: 'POST',
                headers: {
                    "Content-Type": 'application/json'
                },
                body: JSON.stringify({
                    fixture_id: id,
                    home_team_score: parseInt(values.home_team_score),
                    away_team_score: parseInt(values.away_team_score)
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Failed to save prediction')
                    })
                }
                return response.json()
            })
            .then(data => {
                setMessage({ type: 'success', text: 'Prediction saved successfully!' })
                setTimeout(() => setMessage(null), 3000)
                // Refresh results if callback provided
                if (onPredictionSaved) {
                    onPredictionSaved()
                }
            })
            .catch(error => {
                console.error('Error saving prediction:', error)
                setMessage({ type: 'error', text: error.message || 'Failed to save prediction. Please try again.' })
            })
            .finally(() => {
                setSaving(false)
            })
        }
    })

    // Update form values when existingPrediction changes
    useEffect(() => {
        if (existingPrediction) {
            formik.setFieldValue('home_team_score', existingPrediction.home_team_score ?? '')
            formik.setFieldValue('away_team_score', existingPrediction.away_team_score ?? '')
        } else {
            // Clear form if no existing prediction
            formik.setFieldValue('home_team_score', '')
            formik.setFieldValue('away_team_score', '')
        }
    }, [existingPrediction?.id, existingPrediction?.home_team_score, existingPrediction?.away_team_score])

    const formatKickoffLocal = (value) => {
        const date = parseUtcDate(value)
        if (!date) return 'Date TBD'

        // Uses the browser's locale + timezone (no geolocation permission required)
        return new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(date)
    }

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    Week {fixture_round || 'TBD'}
                </Typography>
                
                {message && (
                    <Alert severity={message.type} sx={{ mb: 2 }}>
                        {message.text}
                    </Alert>
                )}
                
                {gameStarted && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        This game has started. Predictions are locked and cannot be changed.
                    </Alert>
                )}

                <form onSubmit={formik.handleSubmit}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {fixture_home_team}
                            </Typography>
                            <TextField
                                fullWidth
                                id="home_team_score"
                                name="home_team_score"
                                label="Home Score"
                                type="number"
                                variant="outlined"
                                value={formik.values.home_team_score}
                                onChange={formik.handleChange}
                                error={formik.touched.home_team_score && Boolean(formik.errors.home_team_score)}
                                helperText={formik.touched.home_team_score && formik.errors.home_team_score}
                                inputProps={{ min: 0, max: 20 }}
                                disabled={gameStarted}
                            />
                        </Grid>
                        
                        <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                vs
                            </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {fixture_away_team}
                            </Typography>
                            <TextField
                                fullWidth
                                id="away_team_score"
                                name="away_team_score"
                                label="Away Score"
                                type="number"
                                variant="outlined"
                                value={formik.values.away_team_score}
                                onChange={formik.handleChange}
                                error={formik.touched.away_team_score && Boolean(formik.errors.away_team_score)}
                                helperText={formik.touched.away_team_score && formik.errors.away_team_score}
                                inputProps={{ min: 0, max: 20 }}
                                disabled={gameStarted}
                            />
                        </Grid>
                        
                        <Grid item xs={12} md={3}>
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                disabled={saving || gameStarted}
                                sx={{ mt: { xs: 0, md: 4 } }}
                            >
                                {saving ? 'Saving...' : gameStarted ? 'Game Started' : 'Save Prediction'}
                            </Button>
                        </Grid>
                    </Grid>
                    
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                        {formatKickoffLocal(fixture_date)}
                    </Typography>
                </form>
            </CardContent>
        </Card>
    )
}

export default Predictions;