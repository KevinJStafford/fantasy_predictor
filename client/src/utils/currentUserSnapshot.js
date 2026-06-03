/**
 * Cached snapshot of the current user (sessionStorage).
 * Keeps navbar avatar visible across route changes while /authorized refetches.
 */

const STORAGE_KEY = 'fp_current_user_v1'

let fetchRequestId = 0

function readRaw() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || !parsed.user?.id) return null
        return parsed
    } catch {
        return null
    }
}

export function getCachedCurrentUser() {
    return readRaw()?.user ?? null
}

export function writeCurrentUserSnapshot(user) {
    if (!user?.id) return
    try {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ user, updatedAt: Date.now() })
        )
    } catch {
        /* ignore quota / private mode */
    }
}

export function clearCurrentUserSnapshot() {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        /* ignore */
    }
}

/**
 * Fetch /api/v1/authorized, update snapshot on success, return user or null.
 * Ignores stale responses when multiple calls overlap.
 */
export function fetchCurrentUser(authenticatedFetch) {
    const requestId = ++fetchRequestId
    return authenticatedFetch('/api/v1/authorized')
        .then((res) => {
            if (requestId !== fetchRequestId) return { stale: true }
            if (res.status === 401) {
                clearCurrentUserSnapshot()
                return { user: null, unauthorized: true }
            }
            if (!res.ok) return { user: getCachedCurrentUser() }
            return res.json().then((user) => ({ user }))
        })
        .then((result) => {
            if (result?.stale) return getCachedCurrentUser()
            const user = result?.user
            if (user?.id) {
                writeCurrentUserSnapshot(user)
                return user
            }
            if (result?.unauthorized) return null
            return getCachedCurrentUser()
        })
        .catch(() => {
            if (requestId !== fetchRequestId) return getCachedCurrentUser()
            return getCachedCurrentUser()
        })
}
