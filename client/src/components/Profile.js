import * as React from 'react'
import { useEffect, useState, useRef } from 'react'
import Navbar from './Navbar'
import {
    Container,
    Typography,
    Button,
    Box,
    Alert,
    TextField,
    Avatar,
    Paper,
    Divider,
    Switch,
    FormControlLabel,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
} from '@mui/material'
import { useHistory } from 'react-router-dom'
import { authenticatedFetch, apiUrl } from '../utils/api'
import { getToken } from '../utils/auth'
import { getAuthHeaders } from '../utils/auth'

function Profile() {
    const history = useHistory()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [accountError, setAccountError] = useState(null)
    const [accountSuccess, setAccountSuccess] = useState(null)
    const [saving, setSaving] = useState(false)
    const [avatarUploading, setAvatarUploading] = useState(false)
    const [avatarError, setAvatarError] = useState(null)
    const avatarInputRef = useRef(null)
    const [leagues, setLeagues] = useState([])
    const [leaguesLoading, setLeaguesLoading] = useState(false)
    const [leaguesError, setLeaguesError] = useState(null)
    const [savingNotifyLeagueIds, setSavingNotifyLeagueIds] = useState(() => new Set())

    useEffect(() => {
        if (!getToken()) {
            history.push('/login')
            return
        }
        authenticatedFetch('/api/v1/authorized')
            .then((r) => (r.ok ? r.json() : null))
            .then((u) => {
                setUser(u)
                if (u) {
                    setEmail(u.email || '')
                    setUsername(u.username || '')
                }
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false))
    }, [history])

    useEffect(() => {
        if (!user?.id) return
        setLeaguesLoading(true)
        setLeaguesError(null)
        authenticatedFetch('/api/v1/leagues')
            .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) throw new Error(data.error || 'Failed to load leagues')
                setLeagues(data.leagues || [])
            })
            .catch((e) => setLeaguesError(e.message || 'Failed to load leagues'))
            .finally(() => setLeaguesLoading(false))
    }, [user?.id])

    const updateNotifyMissingPredictions = (leagueId, checked) => {
        if (!leagueId) return
        setSavingNotifyLeagueIds((prev) => {
            const next = new Set(prev)
            next.add(leagueId)
            return next
        })
        // Optimistic update
        setLeagues((prev) =>
            (prev || []).map((l) => {
                if (Number(l.id) !== Number(leagueId)) return l
                const members = Array.isArray(l.members) ? l.members : []
                return {
                    ...l,
                    members: members.map((m) =>
                        Number(m.id) === Number(user?.id)
                            ? { ...m, notify_missing_predictions: !!checked }
                            : m
                    ),
                }
            })
        )
        authenticatedFetch(`/api/v1/leagues/${leagueId}/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notify_missing_predictions: checked }),
        })
            .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) throw new Error(data.error || 'Failed to update notification setting')
                if (data.league) {
                    setLeagues((prev) => (prev || []).map((l) => (Number(l.id) === Number(leagueId) ? data.league : l)))
                }
            })
            .catch((e) => {
                setLeaguesError(e.message || 'Failed to update notification setting')
                // Best-effort refresh
                authenticatedFetch('/api/v1/leagues')
                    .then((r) => (r.ok ? r.json() : null))
                    .then((data) => {
                        if (data?.leagues) setLeagues(data.leagues)
                    })
                    .catch(() => {})
            })
            .finally(() => {
                setSavingNotifyLeagueIds((prev) => {
                    const next = new Set(prev)
                    next.delete(leagueId)
                    return next
                })
            })
    }

    const handleSaveAccount = () => {
        if (!user) return
        const trimmedEmail = email.trim().toLowerCase()
        const trimmedUsername = username.trim() || null
        const hasEmailChange = trimmedEmail !== (user.email || '').toLowerCase()
        const hasUsernameChange = (trimmedUsername || '') !== (user.username || '')
        const hasPasswordChange = newPassword.trim() || confirmPassword.trim()
        if (!currentPassword.trim()) {
            setAccountError('Current password is required to save changes.')
            return
        }
        if (hasPasswordChange && newPassword.trim() !== confirmPassword.trim()) {
            setAccountError('New password and confirmation do not match.')
            return
        }
        if (hasPasswordChange && newPassword.trim().length < 6) {
            setAccountError('New password must be at least 6 characters.')
            return
        }
        setAccountError(null)
        setAccountSuccess(null)
        setSaving(true)
        const body = {
            current_password: currentPassword.trim(),
            ...(hasEmailChange ? { email: trimmedEmail } : {}),
            ...(hasUsernameChange ? { username: trimmedUsername } : {}),
            ...(newPassword.trim()
                ? {
                      new_password: newPassword.trim(),
                      confirm_password: confirmPassword.trim(),
                  }
                : {}),
        }
        authenticatedFetch('/api/v1/users/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (ok && data.user) {
                    setUser(data.user)
                    setAccountSuccess(data.message || 'Profile updated.')
                    if (data.user.email) setEmail(data.user.email)
                    if (data.user.username != null) setUsername(data.user.username || '')
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    window.dispatchEvent(new Event('user-updated'))
                } else {
                    setAccountError(data.error || 'Failed to update profile.')
                }
            })
            .catch(() => setAccountError('Failed to update profile. Please try again.'))
            .finally(() => setSaving(false))
    }

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            setAvatarError('Please choose a JPEG, PNG, or WebP image.')
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            setAvatarError('Image must be under 3MB.')
            return
        }
        setAvatarError(null)
        setAvatarUploading(true)
        const formData = new FormData()
        formData.append('avatar', file)
        const headers = { ...getAuthHeaders() }
        delete headers['Content-Type']
        fetch(apiUrl('/api/v1/users/me/avatar'), {
            method: 'POST',
            headers,
            credentials: 'include',
            body: formData,
        })
            .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (ok && data.user) {
                    setUser(data.user)
                    setAccountSuccess('Profile picture updated.')
                    window.dispatchEvent(new Event('user-updated'))
                } else {
                    setAvatarError(data.error || 'Upload failed.')
                }
            })
            .catch(() => setAvatarError('Upload failed. Please try again.'))
            .finally(() => {
                setAvatarUploading(false)
                if (avatarInputRef.current) avatarInputRef.current.value = ''
            })
    }

    if (loading) {
        return (
            <>
                <Navbar />
                <Container maxWidth="sm" sx={{ mt: 4 }}>
                    <Typography>Loading profile…</Typography>
                </Container>
            </>
        )
    }

    if (!user) {
        return null
    }

    return (
        <>
            <Navbar />
            <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Profile
                </Typography>
                <Paper sx={{ p: 3 }}>
                    {/* Profile image */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                        <Avatar
                            key={user?.avatar_url ? `profile-avatar-${user.id}-${user.avatar_url}` : 'profile-avatar-placeholder'}
                            src={user?.avatar_url ? `${apiUrl(user.avatar_url)}${user.updated_at ? `?v=${user.updated_at}` : ''}` : undefined}
                            sx={{ width: 96, height: 96, bgcolor: 'primary.main', mb: 1 }}
                        />
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={handleAvatarChange}
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            disabled={avatarUploading}
                            onClick={() => avatarInputRef.current?.click()}
                        >
                            {avatarUploading ? 'Uploading…' : 'Upload profile picture'}
                        </Button>
                        {avatarError && (
                            <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
                                {avatarError}
                            </Alert>
                        )}
                    </Box>
                    <Divider sx={{ my: 3 }} />

                    {/* Notifications */}
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enable reminders per league when fixtures are within 24 hours and you haven&apos;t submitted predictions.
                    </Typography>
                    {leaguesLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">Loading your leagues…</Typography>
                        </Box>
                    ) : leaguesError ? (
                        <Alert severity="error" sx={{ mb: 2 }}>{leaguesError}</Alert>
                    ) : leagues.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            You&apos;re not in any leagues yet.
                        </Typography>
                    ) : (
                        <List dense disablePadding sx={{ mb: 2 }}>
                            {leagues.map((league) => {
                                const myMembership = (league.members || []).find((m) => Number(m.id) === Number(user?.id))
                                const checked = !!myMembership?.notify_missing_predictions
                                const savingNotify = savingNotifyLeagueIds.has(league.id)
                                return (
                                    <ListItem
                                        key={league.id}
                                        disableGutters
                                        secondaryAction={
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={checked}
                                                        onChange={(e) => updateNotifyMissingPredictions(league.id, e.target.checked)}
                                                        disabled={!myMembership || savingNotify}
                                                    />
                                                }
                                                label=""
                                                sx={{ m: 0 }}
                                            />
                                        }
                                    >
                                        <ListItemText
                                            primary={league.name}
                                            secondary={savingNotify ? 'Saving…' : (checked ? 'Enabled' : 'Disabled')}
                                        />
                                    </ListItem>
                                )
                            })}
                        </List>
                    )}

                    <Divider sx={{ my: 3 }} />

                    {/* Email */}
                    <TextField
                        label="Email"
                        type="email"
                        fullWidth
                        margin="normal"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            setAccountError(null)
                        }}
                        placeholder="your@email.com"
                    />

                    {/* Name */}
                    <TextField
                        label="Name"
                        fullWidth
                        margin="normal"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value)
                            setAccountError(null)
                        }}
                        placeholder="Your display name"
                        helperText="Optional; used where a name is shown."
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Change password
                    </Typography>
                    <TextField
                        label="Current password (required to save any changes)"
                        type="password"
                        fullWidth
                        margin="normal"
                        value={currentPassword}
                        onChange={(e) => {
                            setCurrentPassword(e.target.value)
                            setAccountError(null)
                        }}
                    />
                    <TextField
                        label="New password (optional)"
                        type="password"
                        fullWidth
                        margin="normal"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value)
                            setAccountError(null)
                        }}
                    />
                    <TextField
                        label="Confirm new password"
                        type="password"
                        fullWidth
                        margin="normal"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value)
                            setAccountError(null)
                        }}
                    />

                    {accountError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {accountError}
                        </Alert>
                    )}
                    {accountSuccess && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                            {accountSuccess}
                        </Alert>
                    )}

                    <Box sx={{ mt: 3 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveAccount}
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </>
    )
}

export default Profile
