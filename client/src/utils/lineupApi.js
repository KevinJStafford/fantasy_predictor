import { apiUrl, authenticatedFetch } from "./api";
import { getAuthHeaders, saveToken } from "./auth";

async function readError(response, fallback) {
    try {
        const body = await response.json();
        if (body && body.error) return body.error;
    } catch (err) {
        // The response was not JSON.
    }
    return fallback;
}

function authHeadersWithoutJson() {
    const headers = getAuthHeaders();
    delete headers["Content-Type"];
    return headers;
}

export function imageSrc(path) {
    if (!path) return "";
    if (path.startsWith("data:") || path.startsWith("http")) return path;
    return apiUrl(path);
}

export function normalizeLineup(data) {
    const assignments = {};
    Object.entries(data?.assignments || {}).forEach(([slot, playerId]) => {
        const id = Number(playerId);
        if (Number.isFinite(id)) assignments[slot] = id;
    });
    return {
        formation: data?.formation || "4-3-3",
        assignments,
        players: (data?.players || []).map((player) => ({
            id: player.id,
            name: player.name || "",
            image: imageSrc(player.image),
        })),
    };
}

async function authRequest(path, body) {
    const response = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Something went wrong."));
    }
    const data = await response.json();
    if (!data.token) {
        throw new Error("No session was returned.");
    }
    saveToken(data.token);
    return data.user;
}

export function loginAccount(email, password) {
    return authRequest("/api/v1/login", { email, password });
}

export function signupAccount(email, password, confirmPassword) {
    return authRequest("/api/v1/starting-eleven/signup", {
        email,
        password,
        confirm_password: confirmPassword,
    });
}

export async function fetchAccount() {
    const response = await authenticatedFetch("/api/v1/authorized");
    if (response.status === 401) return null;
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't check your account."));
    }
    return response.json();
}

export async function fetchLineup() {
    const response = await authenticatedFetch("/api/v1/starting-eleven/lineup");
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't load your lineup."));
    }
    return normalizeLineup(await response.json());
}

export async function saveLineup(formation, assignments) {
    const response = await authenticatedFetch("/api/v1/starting-eleven/lineup", {
        method: "PUT",
        body: JSON.stringify({ formation, assignments }),
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't save your lineup."));
    }
    return normalizeLineup(await response.json());
}

export async function uploadHeadshots(files) {
    const body = new FormData();
    files.forEach((file) => body.append("images", file.blob, file.filename));
    body.append("names", JSON.stringify(files.map((file) => file.name)));
    const response = await fetch(apiUrl("/api/v1/starting-eleven/players"), {
        method: "POST",
        headers: authHeadersWithoutJson(),
        body,
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't upload those headshots."));
    }
    return normalizeLineup(await response.json());
}

export async function renameHeadshot(playerId, name) {
    const response = await authenticatedFetch(`/api/v1/starting-eleven/players/${playerId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't rename that player."));
    }
    return response.json();
}

export async function deleteHeadshot(playerId) {
    const response = await authenticatedFetch(`/api/v1/starting-eleven/players/${playerId}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't remove that player."));
    }
    return normalizeLineup(await response.json());
}

export async function deleteAllHeadshots() {
    const response = await authenticatedFetch("/api/v1/starting-eleven/players", {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Couldn't remove the squad."));
    }
    return normalizeLineup(await response.json());
}
