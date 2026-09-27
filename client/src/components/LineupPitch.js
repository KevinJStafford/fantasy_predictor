import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    IconButton,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";

const STORAGE_KEY = "fp-lineup-builder-v1";
const MAX_PLAYERS = 30;

const POSITION_NAMES = {
    GK: "Goalkeeper",
    LB: "Left back",
    RB: "Right back",
    LCB: "Left centre-half",
    CB: "Centre-half",
    RCB: "Right centre-half",
    LWB: "Left wing-back",
    RWB: "Right wing-back",
    LM: "Left midfield",
    RM: "Right midfield",
    LCM: "Left centre midfield",
    CM: "Centre midfield",
    RCM: "Right centre midfield",
    CDM: "Defensive midfield",
    LDM: "Left defensive midfield",
    RDM: "Right defensive midfield",
    LAM: "Left attacking midfield",
    CAM: "Attacking midfield",
    RAM: "Right attacking midfield",
    LW: "Left wing",
    RW: "Right wing",
    ST: "Striker",
    LST: "Left striker",
    RST: "Right striker",
};

const FORMATIONS = {
    "4-3-3": [
        { id: "lw", label: "LW", x: 18, y: 18 },
        { id: "st", label: "ST", x: 50, y: 13 },
        { id: "rw", label: "RW", x: 82, y: 18 },
        { id: "lcm", label: "LCM", x: 28, y: 42 },
        { id: "cm", label: "CM", x: 50, y: 46 },
        { id: "rcm", label: "RCM", x: 72, y: 42 },
        { id: "lb", label: "LB", x: 14, y: 68 },
        { id: "lcb", label: "LCB", x: 37, y: 73 },
        { id: "rcb", label: "RCB", x: 63, y: 73 },
        { id: "rb", label: "RB", x: 86, y: 68 },
        { id: "gk", label: "GK", x: 50, y: 89 },
    ],
    "4-4-2": [
        { id: "lst", label: "LST", x: 36, y: 16 },
        { id: "rst", label: "RST", x: 64, y: 16 },
        { id: "lm", label: "LM", x: 14, y: 44 },
        { id: "lcm", label: "LCM", x: 37, y: 48 },
        { id: "rcm", label: "RCM", x: 63, y: 48 },
        { id: "rm", label: "RM", x: 86, y: 44 },
        { id: "lb", label: "LB", x: 14, y: 68 },
        { id: "lcb", label: "LCB", x: 37, y: 73 },
        { id: "rcb", label: "RCB", x: 63, y: 73 },
        { id: "rb", label: "RB", x: 86, y: 68 },
        { id: "gk", label: "GK", x: 50, y: 89 },
    ],
    "4-2-3-1": [
        { id: "st", label: "ST", x: 50, y: 13 },
        { id: "lam", label: "LAM", x: 20, y: 32 },
        { id: "cam", label: "CAM", x: 50, y: 30 },
        { id: "ram", label: "RAM", x: 80, y: 32 },
        { id: "ldm", label: "LDM", x: 36, y: 52 },
        { id: "rdm", label: "RDM", x: 64, y: 52 },
        { id: "lb", label: "LB", x: 14, y: 70 },
        { id: "lcb", label: "LCB", x: 37, y: 74 },
        { id: "rcb", label: "RCB", x: 63, y: 74 },
        { id: "rb", label: "RB", x: 86, y: 70 },
        { id: "gk", label: "GK", x: 50, y: 89 },
    ],
    "3-5-2": [
        { id: "lst", label: "LST", x: 36, y: 15 },
        { id: "rst", label: "RST", x: 64, y: 15 },
        { id: "lwb", label: "LWB", x: 12, y: 42 },
        { id: "lcm", label: "LCM", x: 32, y: 48 },
        { id: "cm", label: "CM", x: 50, y: 44 },
        { id: "rcm", label: "RCM", x: 68, y: 48 },
        { id: "rwb", label: "RWB", x: 88, y: 42 },
        { id: "lcb", label: "LCB", x: 28, y: 72 },
        { id: "cb", label: "CB", x: 50, y: 76 },
        { id: "rcb", label: "RCB", x: 72, y: 72 },
        { id: "gk", label: "GK", x: 50, y: 89 },
    ],
    "3-4-3": [
        { id: "lw", label: "LW", x: 18, y: 16 },
        { id: "st", label: "ST", x: 50, y: 13 },
        { id: "rw", label: "RW", x: 82, y: 16 },
        { id: "lm", label: "LM", x: 16, y: 46 },
        { id: "lcm", label: "LCM", x: 38, y: 50 },
        { id: "rcm", label: "RCM", x: 62, y: 50 },
        { id: "rm", label: "RM", x: 84, y: 46 },
        { id: "lcb", label: "LCB", x: 28, y: 72 },
        { id: "cb", label: "CB", x: 50, y: 76 },
        { id: "rcb", label: "RCB", x: 72, y: 72 },
        { id: "gk", label: "GK", x: 50, y: 89 },
    ],
    "5-3-2": [
        { id: "lst", label: "LST", x: 36, y: 16 },
        { id: "rst", label: "RST", x: 64, y: 16 },
        { id: "lcm", label: "LCM", x: 26, y: 44 },
        { id: "cm", label: "CM", x: 50, y: 48 },
        { id: "rcm", label: "RCM", x: 74, y: 44 },
        { id: "lwb", label: "LWB", x: 12, y: 64 },
        { id: "lcb", label: "LCB", x: 30, y: 73 },
        { id: "cb", label: "CB", x: 50, y: 76 },
        { id: "rcb", label: "RCB", x: 70, y: 73 },
        { id: "rwb", label: "RWB", x: 88, y: 64 },
        { id: "gk", label: "GK", x: 50, y: 89 },
    ],
};

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.players)) return null;
        const formation = FORMATIONS[data.formation] ? data.formation : "4-3-3";
        const players = data.players
            .filter((player) => player && player.id && player.image)
            .slice(0, MAX_PLAYERS);
        const validSlots = new Set(FORMATIONS[formation].map((slot) => slot.id));
        const knownIds = new Set(players.map((player) => player.id));
        const assignments = {};
        if (data.assignments && typeof data.assignments === "object") {
            Object.entries(data.assignments).forEach(([slot, playerId]) => {
                if (validSlots.has(slot) && knownIds.has(playerId)) {
                    assignments[slot] = playerId;
                }
            });
        }
        return { players, assignments, formation };
    } catch (err) {
        return null;
    }
}

function nameFromFile(file) {
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return base || "Player";
}

function fileToHeadshot(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const size = 220;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            const scale = Math.max(size / img.width, size / img.height);
            const sw = size / scale;
            const sh = size / scale;
            const sx = (img.width - sw) / 2;
            const sy = (img.height - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("unreadable"));
        };
        img.src = url;
    });
}

function dropIdFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.closest) return null;
    const node = el.closest("[data-drop]");
    return node ? node.getAttribute("data-drop") : null;
}

function PitchMarkings() {
    const line = "rgba(255,255,255,0.92)";
    return (
        <svg
            viewBox="0 0 680 1050"
            width="100%"
            height="100%"
            aria-hidden="true"
            style={{ display: "block" }}
        >
            <defs>
                <linearGradient id="lineup-pitch-shade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.14)" />
                    <stop offset="42%" stopColor="rgba(0,0,0,0)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
                </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <rect
                    key={i}
                    x="0"
                    y={i * 105}
                    width="680"
                    height="105"
                    fill={i % 2 === 0 ? "#1f7a3a" : "#186b32"}
                />
            ))}
            <rect x="0" y="0" width="680" height="1050" fill="url(#lineup-pitch-shade)" />
            <rect x="20" y="30" width="640" height="990" fill="none" stroke={line} strokeWidth="3" />
            <line x1="20" y1="525" x2="660" y2="525" stroke={line} strokeWidth="3" />
            <circle cx="340" cy="525" r="86" fill="none" stroke={line} strokeWidth="3" />
            <circle cx="340" cy="525" r="5" fill={line} />
            <rect x="150" y="30" width="380" height="156" fill="none" stroke={line} strokeWidth="3" />
            <rect x="254" y="30" width="172" height="52" fill="none" stroke={line} strokeWidth="3" />
            <circle cx="340" cy="134" r="4" fill={line} />
            <path d="M272 186 A86 86 0 0 0 408 186" fill="none" stroke={line} strokeWidth="3" />
            <rect x="150" y="864" width="380" height="156" fill="none" stroke={line} strokeWidth="3" />
            <rect x="254" y="968" width="172" height="52" fill="none" stroke={line} strokeWidth="3" />
            <circle cx="340" cy="916" r="4" fill={line} />
            <path d="M272 864 A86 86 0 0 1 408 864" fill="none" stroke={line} strokeWidth="3" />
            <path d="M20 42 Q20 30 32 30" fill="none" stroke={line} strokeWidth="3" />
            <path d="M648 30 Q660 30 660 42" fill="none" stroke={line} strokeWidth="3" />
            <path d="M20 1008 Q20 1020 32 1020" fill="none" stroke={line} strokeWidth="3" />
            <path d="M648 1020 Q660 1020 660 1008" fill="none" stroke={line} strokeWidth="3" />
            <rect x="292" y="10" width="96" height="20" fill="none" stroke={line} strokeWidth="3" />
            <rect x="292" y="1020" width="96" height="20" fill="none" stroke={line} strokeWidth="3" />
        </svg>
    );
}

function LineupPitch() {
    const saved = useRef(undefined);
    if (saved.current === undefined) saved.current = loadState();
    const [players, setPlayers] = useState(saved.current?.players || []);
    const [assignments, setAssignments] = useState(saved.current?.assignments || {});
    const [formation, setFormation] = useState(saved.current?.formation || "4-3-3");
    const [selectedId, setSelectedId] = useState(null);
    const [drag, setDrag] = useState(null);
    const [notice, setNotice] = useState("");
    const [uploading, setUploading] = useState(false);
    const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
    const fileInputRef = useRef(null);
    const ghostRef = useRef(null);
    const pointRef = useRef({ x: 0, y: 0 });
    const suppressClick = useRef(false);
    const removeAllTimer = useRef(null);

    const slots = FORMATIONS[formation];

    useEffect(() => {
        const previousTitle = document.title;
        document.title = "Starting Eleven";
        return () => {
            document.title = previousTitle;
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ players, assignments, formation })
            );
            setNotice((current) =>
                current.startsWith("Couldn't save") ? "" : current
            );
        } catch (err) {
            setNotice("Couldn't save this lineup in the browser. Try fewer or smaller photos.");
        }
    }, [players, assignments, formation]);

    useEffect(() => {
        return () => {
            if (removeAllTimer.current) clearTimeout(removeAllTimer.current);
        };
    }, []);

    useLayoutEffect(() => {
        if (!drag || !ghostRef.current) return;
        const { x, y } = pointRef.current;
        ghostRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -62%)`;
    }, [drag]);

    useEffect(() => {
        if (!drag) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [drag]);

    const slotOf = (playerId, map = assignments) =>
        Object.keys(map).find((slot) => map[slot] === playerId) || null;

    const commitDrop = (playerId, fromSlot, dropId) => {
        if (!dropId || !playerId) return;
        if (dropId === "bench") {
            if (!fromSlot) return;
            setAssignments((prev) => {
                const next = { ...prev };
                delete next[fromSlot];
                return next;
            });
            return;
        }
        if (!dropId.startsWith("slot:")) return;
        const slotId = dropId.slice(5);
        if (slotId === fromSlot) return;
        if (!slots.some((slot) => slot.id === slotId)) return;
        setAssignments((prev) => {
            const next = { ...prev };
            const occupant = next[slotId];
            Object.keys(next).forEach((key) => {
                if (next[key] === playerId) delete next[key];
            });
            next[slotId] = playerId;
            if (occupant && occupant !== playerId && fromSlot) {
                next[fromSlot] = occupant;
            }
            return next;
        });
    };

    const beginPointer = (event, playerId, fromSlot) => {
        if (event.button != null && event.button !== 0) return;
        const startX = event.clientX;
        const startY = event.clientY;
        let dragging = false;

        const onMove = (ev) => {
            if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) {
                return;
            }
            if (!dragging) {
                dragging = true;
                pointRef.current = { x: ev.clientX, y: ev.clientY };
                setDrag({ playerId, fromSlot, over: null });
            }
            pointRef.current = { x: ev.clientX, y: ev.clientY };
            if (ghostRef.current) {
                ghostRef.current.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY}px, 0) translate(-50%, -62%)`;
            }
            const over = dropIdFromPoint(ev.clientX, ev.clientY);
            setDrag((current) => {
                if (!current || current.over === over) return current;
                return { ...current, over };
            });
        };

        const onUp = (ev) => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            if (dragging) {
                suppressClick.current = true;
                commitDrop(playerId, fromSlot, dropIdFromPoint(ev.clientX, ev.clientY));
                setDrag(null);
                setSelectedId(null);
            }
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };

    const handlePlayerClick = (playerId) => {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
        if (selectedId && selectedId !== playerId) {
            const targetSlot = slotOf(playerId);
            if (targetSlot) {
                commitDrop(selectedId, slotOf(selectedId), `slot:${targetSlot}`);
                setSelectedId(null);
                return;
            }
        }
        setSelectedId((current) => (current === playerId ? null : playerId));
    };

    const handleSlotClick = (slotId) => {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
        if (!selectedId) {
            const occupant = assignments[slotId];
            if (occupant) setSelectedId(occupant);
            return;
        }
        commitDrop(selectedId, slotOf(selectedId), `slot:${slotId}`);
        setSelectedId(null);
    };

    const addFiles = async (fileList) => {
        const images = Array.from(fileList || []).filter((file) =>
            file.type.startsWith("image/")
        );
        if (!images.length) {
            setNotice("Choose image files for the headshots.");
            return;
        }
        const room = MAX_PLAYERS - players.length;
        if (room <= 0) {
            setNotice(`You can keep up to ${MAX_PLAYERS} headshots.`);
            return;
        }
        const batch = images.slice(0, room);
        setUploading(true);
        setNotice("");
        const created = [];
        let failed = 0;
        for (let i = 0; i < batch.length; i += 1) {
            try {
                const image = await fileToHeadshot(batch[i]);
                created.push({
                    id: `p_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
                    name: nameFromFile(batch[i]),
                    image,
                });
            } catch (err) {
                failed += 1;
            }
        }
        if (created.length) {
            setPlayers((prev) => [...prev, ...created].slice(0, MAX_PLAYERS));
        }
        if (failed) {
            setNotice(
                failed === 1
                    ? "One image couldn't be read."
                    : `${failed} images couldn't be read.`
            );
        } else if (images.length > room) {
            setNotice(`Only ${room} more headshot${room === 1 ? "" : "s"} fit.`);
        }
        setUploading(false);
    };

    const renamePlayer = (playerId, name) => {
        setPlayers((prev) =>
            prev.map((player) =>
                player.id === playerId ? { ...player, name } : player
            )
        );
    };

    const removePlayer = (playerId) => {
        setPlayers((prev) => prev.filter((player) => player.id !== playerId));
        setAssignments((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((key) => {
                if (next[key] === playerId) delete next[key];
            });
            return next;
        });
        setSelectedId((current) => (current === playerId ? null : current));
    };

    const clearPitch = () => {
        setAssignments({});
        setSelectedId(null);
    };

    const removeAll = () => {
        if (!confirmRemoveAll) {
            setConfirmRemoveAll(true);
            removeAllTimer.current = setTimeout(() => setConfirmRemoveAll(false), 3000);
            return;
        }
        if (removeAllTimer.current) clearTimeout(removeAllTimer.current);
        setConfirmRemoveAll(false);
        setPlayers([]);
        setAssignments({});
        setSelectedId(null);
        setNotice("");
    };

    const changeFormation = (nextFormation) => {
        setFormation(nextFormation);
        const valid = new Set(FORMATIONS[nextFormation].map((slot) => slot.id));
        setAssignments((prev) => {
            const next = {};
            Object.entries(prev).forEach(([slot, playerId]) => {
                if (valid.has(slot)) next[slot] = playerId;
            });
            return next;
        });
        setSelectedId(null);
    };

    const playersById = Object.fromEntries(players.map((player) => [player.id, player]));
    const placedCount = Object.keys(assignments).length;
    const selectedPlayer = playersById[selectedId];
    const draggedPlayer = drag ? playersById[drag.playerId] : null;

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f4f7f5" }}>
            <Box
                component="header"
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    bgcolor: "rgba(255,255,255,0.9)",
                    backdropFilter: "blur(12px)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                }}
            >
                <Box
                    sx={{
                        maxWidth: 1120,
                        mx: "auto",
                        px: { xs: 2, sm: 3 },
                        height: 64,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                    }}
                >
                    <Typography
                        component="div"
                        sx={{
                            fontFamily: "var(--landing-font)",
                            fontWeight: 800,
                            letterSpacing: "-0.03em",
                            fontSize: "1.15rem",
                            color: "#14281c",
                        }}
                    >
                        Starting Eleven
                    </Typography>
                    <Button
                        component="a"
                        href="https://playfantasypredictor.com"
                        sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            color: "#14281c",
                            borderRadius: 99,
                            flexShrink: 0,
                        }}
                    >
                        Fantasy Predictor
                    </Button>
                </Box>
            </Box>
            <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 4 } }}>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Box>
                        <Typography
                            component="h1"
                            sx={{
                                fontFamily: "var(--landing-font)",
                                fontWeight: 800,
                                fontSize: { xs: "1.7rem", sm: "2rem" },
                                letterSpacing: "-0.03em",
                                color: "#14281c",
                                lineHeight: 1.1,
                            }}
                        >
                            Build your XI
                        </Typography>
                        <Typography sx={{ mt: 0.75, color: "text.secondary", maxWidth: 460 }}>
                            Upload headshots, then drag them onto the pitch. Drop a player on
                            someone else to swap, or drag them back to the squad.
                        </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                        <TextField
                            select
                            size="small"
                            label="Formation"
                            value={formation}
                            onChange={(event) => changeFormation(event.target.value)}
                            sx={{ minWidth: 140, bgcolor: "#fff" }}
                        >
                            {Object.keys(FORMATIONS).map((name) => (
                                <MenuItem key={name} value={name}>
                                    {name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Button
                            variant="outlined"
                            onClick={clearPitch}
                            disabled={!placedCount}
                            sx={{
                                textTransform: "none",
                                borderRadius: 99,
                                fontWeight: 700,
                                color: "#1a472a",
                                borderColor: "rgba(26,71,42,0.3)",
                            }}
                        >
                            Clear pitch
                        </Button>
                    </Box>
                </Box>

                {notice && (
                    <Typography sx={{ mb: 2, color: "#9a3412", fontWeight: 600, fontSize: "0.9rem" }}>
                        {notice}
                    </Typography>
                )}

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
                        gap: { xs: 2.5, md: 3 },
                        alignItems: "start",
                    }}
                >
                    <Box
                        data-drop="bench"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                            event.preventDefault();
                            if (event.dataTransfer?.files?.length) {
                                addFiles(event.dataTransfer.files);
                            }
                        }}
                        sx={{
                            order: { xs: 2, md: 1 },
                            bgcolor: "#fff",
                            borderRadius: "20px",
                            border: "1px solid rgba(0,0,0,0.06)",
                            boxShadow: "0 10px 30px rgba(20,40,28,0.06)",
                            p: 2,
                            outline:
                                drag?.over === "bench"
                                    ? "2px solid #ff6c26"
                                    : "2px solid transparent",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                            <Box>
                                <Typography sx={{ fontWeight: 800, color: "#14281c" }}>Squad</Typography>
                                <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                                    {`${placedCount} on the pitch · ${players.length} headshot${players.length === 1 ? "" : "s"}`}
                                </Typography>
                            </Box>
                            {players.length > 0 && (
                                <Button
                                    size="small"
                                    color="inherit"
                                    onClick={removeAll}
                                    sx={{ textTransform: "none", fontWeight: 700, color: confirmRemoveAll ? "#f93d3a" : "text.secondary" }}
                                >
                                    {confirmRemoveAll ? "Confirm remove" : "Remove all"}
                                </Button>
                            )}
                        </Box>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(event) => {
                                addFiles(event.target.files);
                                event.target.value = "";
                            }}
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            disabled={uploading || players.length >= MAX_PLAYERS}
                            onClick={() => fileInputRef.current?.click()}
                            sx={{
                                mb: 2,
                                bgcolor: "#ff6c26",
                                color: "#111",
                                fontWeight: 800,
                                textTransform: "none",
                                borderRadius: 99,
                                boxShadow: "none",
                                "&:hover": { bgcolor: "#e55a1a", boxShadow: "none" },
                            }}
                        >
                            {uploading ? "Adding photos…" : "Upload headshots"}
                        </Button>

                        {selectedPlayer && (
                            <Typography sx={{ mb: 1.5, fontSize: "0.85rem", fontWeight: 700, color: "#1a472a" }}>
                                {selectedPlayer.name || "Player"} selected — tap a position to place them.
                            </Typography>
                        )}

                        {players.length === 0 && (
                            <Box
                                sx={{
                                    border: "1.5px dashed rgba(26,71,42,0.25)",
                                    borderRadius: "16px",
                                    px: 2,
                                    py: 3,
                                    textAlign: "center",
                                    color: "text.secondary",
                                }}
                            >
                                <Typography sx={{ fontWeight: 700, color: "#14281c", mb: 0.5 }}>
                                    No headshots yet
                                </Typography>
                                <Typography sx={{ fontSize: "0.85rem" }}>
                                    Add a few photos, then drag each one to goalkeeper, right back, left back, centre-half, and the rest of the XI.
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {players.map((player) => {
                                const slotId = slotOf(player.id);
                                const slot = slots.find((item) => item.id === slotId);
                                const isSelected = selectedId === player.id;
                                const isDragging = drag?.playerId === player.id;
                                return (
                                    <Box
                                        key={player.id}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            p: 0.75,
                                            borderRadius: "14px",
                                            bgcolor: isSelected ? "rgba(255,108,38,0.1)" : "#f7f8f7",
                                            opacity: isDragging ? 0.45 : 1,
                                            outline: isSelected ? "2px solid #ff6c26" : "2px solid transparent",
                                        }}
                                    >
                                        <Box
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Drag ${player.name || "player"}`}
                                            onPointerDown={(event) => beginPointer(event, player.id, slotId)}
                                            onClick={() => handlePlayerClick(player.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    handlePlayerClick(player.id);
                                                }
                                            }}
                                            sx={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: "50%",
                                                overflow: "hidden",
                                                flexShrink: 0,
                                                cursor: "grab",
                                                touchAction: "none",
                                                border: "2px solid #fff",
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                                                bgcolor: "#d9e5dc",
                                            }}
                                        >
                                            <img
                                                src={player.image}
                                                alt=""
                                                draggable={false}
                                                style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                                            />
                                        </Box>
                                        <TextField
                                            value={player.name}
                                            onChange={(event) => renamePlayer(player.id, event.target.value)}
                                            onPointerDown={(event) => event.stopPropagation()}
                                            placeholder="Name"
                                            size="small"
                                            variant="standard"
                                            fullWidth
                                            inputProps={{ "aria-label": "Player name" }}
                                        />
                                        <Typography
                                            sx={{
                                                flexShrink: 0,
                                                minWidth: 36,
                                                textAlign: "center",
                                                fontSize: "0.72rem",
                                                fontWeight: 800,
                                                letterSpacing: "0.04em",
                                                color: slot ? "#1a472a" : "text.disabled",
                                            }}
                                        >
                                            {slot ? slot.label : "SUB"}
                                        </Typography>
                                        <IconButton
                                            aria-label={`Remove ${player.name || "player"}`}
                                            size="small"
                                            onClick={() => removePlayer(player.id)}
                                            onPointerDown={(event) => event.stopPropagation()}
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>

                    <Box sx={{ order: { xs: 1, md: 2 } }}>
                        <Box
                            sx={{
                                position: "relative",
                                width: "100%",
                                maxWidth: 460,
                                mx: "auto",
                                aspectRatio: "680 / 1050",
                                borderRadius: "18px",
                                overflow: "hidden",
                                boxShadow: "0 24px 50px rgba(20, 60, 32, 0.28)",
                                userSelect: "none",
                            }}
                        >
                            <PitchMarkings />
                            {slots.map((slot) => {
                                const player = playersById[assignments[slot.id]];
                                const highlighted = drag?.over === `slot:${slot.id}`;
                                const positionName = POSITION_NAMES[slot.label] || slot.label;
                                return (
                                    <Box
                                        key={slot.id}
                                        data-drop={`slot:${slot.id}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={
                                            player
                                                ? `${player.name || "Player"}, ${positionName}`
                                                : `Empty ${positionName}`
                                        }
                                        onClick={() => handleSlotClick(slot.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                handleSlotClick(slot.id);
                                            }
                                        }}
                                        sx={{
                                            position: "absolute",
                                            left: `${slot.x}%`,
                                            top: `${slot.y}%`,
                                            transform: highlighted
                                                ? "translate(-50%, -50%) scale(1.06)"
                                                : "translate(-50%, -50%)",
                                            width: { xs: 68, sm: 76 },
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            zIndex: player ? 2 : 1,
                                            transition: "transform 120ms ease",
                                        }}
                                    >
                                        {player ? (
                                            <Box sx={{ position: "relative" }}>
                                                <Box
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`Drag ${player.name || "player"}`}
                                                    onPointerDown={(event) => beginPointer(event, player.id, slot.id)}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handlePlayerClick(player.id);
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter" || event.key === " ") {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            handlePlayerClick(player.id);
                                                        }
                                                    }}
                                                    sx={{
                                                        width: { xs: 48, sm: 56 },
                                                        height: { xs: 48, sm: 56 },
                                                        borderRadius: "50%",
                                                        overflow: "hidden",
                                                        border: selectedId === player.id
                                                            ? "3px solid #ff6c26"
                                                            : "3px solid #fff",
                                                        boxShadow: highlighted
                                                            ? "0 0 0 4px rgba(255,108,38,0.85), 0 8px 16px rgba(0,0,0,0.28)"
                                                            : "0 6px 14px rgba(0,0,0,0.28)",
                                                        cursor: "grab",
                                                        touchAction: "none",
                                                        opacity: drag?.playerId === player.id ? 0.35 : 1,
                                                        bgcolor: "#d9e5dc",
                                                    }}
                                                >
                                                    <img
                                                        src={player.image}
                                                        alt=""
                                                        draggable={false}
                                                        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                                                    />
                                                </Box>
                                                <IconButton
                                                    aria-label={`Take ${player.name || "player"} off the pitch`}
                                                    size="small"
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        commitDrop(player.id, slot.id, "bench");
                                                    }}
                                                    sx={{
                                                        position: "absolute",
                                                        top: -6,
                                                        right: -8,
                                                        width: 20,
                                                        height: 20,
                                                        bgcolor: "rgba(0,0,0,0.72)",
                                                        color: "#fff",
                                                        "&:hover": { bgcolor: "rgba(0,0,0,0.88)" },
                                                    }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 13 }} />
                                                </IconButton>
                                            </Box>
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: { xs: 48, sm: 56 },
                                                    height: { xs: 48, sm: 56 },
                                                    borderRadius: "50%",
                                                    border: highlighted
                                                        ? "2px solid #ffb080"
                                                        : "2px dashed rgba(255,255,255,0.85)",
                                                    bgcolor: highlighted
                                                        ? "rgba(255,108,38,0.35)"
                                                        : "rgba(0,0,0,0.18)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "#fff",
                                                    fontWeight: 800,
                                                    fontSize: "0.72rem",
                                                    letterSpacing: "0.04em",
                                                    boxShadow: highlighted
                                                        ? "0 0 0 4px rgba(255,108,38,0.45)"
                                                        : "none",
                                                }}
                                            >
                                                {slot.label}
                                            </Box>
                                        )}
                                        {player && (
                                            <Typography
                                                sx={{
                                                    mt: 0.4,
                                                    maxWidth: "100%",
                                                    px: 0.6,
                                                    py: 0.15,
                                                    borderRadius: 99,
                                                    bgcolor: "rgba(0,0,0,0.45)",
                                                    color: "#fff",
                                                    fontSize: "0.65rem",
                                                    fontWeight: 700,
                                                    lineHeight: 1.3,
                                                    textAlign: "center",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {player.name || positionName}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            </Box>

            {draggedPlayer && (
                <Box
                    ref={ghostRef}
                    sx={{
                        position: "fixed",
                        left: 0,
                        top: 0,
                        zIndex: 2000,
                        pointerEvents: "none",
                        width: 68,
                        height: 68,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "3px solid #fff",
                        boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                    }}
                >
                    <img
                        src={draggedPlayer.image}
                        alt=""
                        draggable={false}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                </Box>
            )}
        </Box>
    );
}

export default LineupPitch;
