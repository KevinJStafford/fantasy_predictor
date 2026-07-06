import * as React from 'react'
import {
    Box,
    Button,
    Divider,
    Drawer,
    IconButton,
    Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'

export default function AdminPanel({
    open,
    onClose,
    onSyncFixtures,
    onRefreshScores,
    onBackfill,
    onStartNewSeason,
    onDeleteLeague,
    syncing,
    startingNewSeason,
    children,
}) {
    return (
        <Drawer anchor="left" open={open} onClose={onClose}>
            <Box
                sx={{
                    width: { xs: '100vw', sm: 400 },
                    maxWidth: '100vw',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
                role="presentation"
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AdminPanelSettingsIcon color="primary" />
                        <Typography variant="h6">Admin</Typography>
                    </Box>
                    <IconButton aria-label="Close admin panel" onClick={onClose} edge="end">
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    League management tools
                </Typography>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Actions</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onSyncFixtures}
                        disabled={syncing}
                        fullWidth
                    >
                        {syncing ? 'Syncing...' : 'Sync fixtures'}
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={onRefreshScores}
                        disabled={syncing}
                        fullWidth
                    >
                        Refresh scores
                    </Button>
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={onBackfill}
                        disabled={syncing || startingNewSeason}
                        fullWidth
                    >
                        Backfill standings
                    </Button>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={onStartNewSeason}
                        disabled={syncing || startingNewSeason}
                        fullWidth
                    >
                        Start new season
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={onDeleteLeague}
                        disabled={syncing || startingNewSeason}
                        fullWidth
                    >
                        Delete league
                    </Button>
                </Box>

                {children && (
                    <>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                            {children}
                        </Box>
                    </>
                )}
            </Box>
        </Drawer>
    )
}
