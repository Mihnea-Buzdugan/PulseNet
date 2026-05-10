import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import styles from "../styles/index.module.css";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";

import {
    Map,
    MapClusterLayer,
    MapControls,
    MapPopup,
} from "@/components/ui/map";

import {
    AlertTriangle,
    AlarmClock,
    MapPin,
    ShieldAlert,
    Tags,
    Phone,
    Radio,
    Globe,
    LocateFixed,
} from "lucide-react";

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDuration(triggeredAt, resolvedAt = null) {
    if (!triggeredAt) return "-";

    const start = new Date(triggeredAt);
    const end = resolvedAt ? new Date(resolvedAt) : new Date();

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return "-";
    }

    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
}

function normalizeCenter(center) {
    if (!center) return null;

    if (Array.isArray(center) && center.length >= 2) {
        return [Number(center[0]), Number(center[1])];
    }

    if (typeof center === "object") {
        if ("lng" in center && "lat" in center) {
            return [Number(center.lng), Number(center.lat)];
        }
        if ("x" in center && "y" in center) {
            return [Number(center.x), Number(center.y)];
        }
    }

    return null;
}

function normalizeIncident(incident) {
    const location = normalizeCenter(incident.location);

    return {
        id: incident.id,
        title: incident.title || "Untitled incident",
        description: incident.description || "",
        severityLevel: incident.severity_level || "medium",
        isVerified: !!incident.is_verified,
        confirmCount: incident.confirm_count || 0,
        reportCount: incident.report_count || 0,
        createdAt: incident.created_at || "",
        address: incident.address || "",
        incidentTypeName: incident.incident_type?.name || "Unknown",
        incidentTypeSlug: incident.incident_type?.slug || "",
        location,
    };
}

function normalizeUserInZone(item) {
    const location = normalizeCenter(item.location);

    return {
        id: item.id,
        username: item.username || "",
        firstName: item.first_name || "",
        lastName: item.last_name || "",
        email: item.email || "",
        crisisStatus: String(item.crisis_status || "unknown")
            .trim()
            .toLowerCase(),
        onlineStatus: item.online_status || "offline",
        isVerified: !!item.is_verified,
        distanceFromCrisisMeters: item.distance_from_crisis_meters ?? null,
        location,
    };
}

function normalizeCrisis(item) {
    // The view returns "crisis_id" (not "id") and center as {lat, lng}
    const center = normalizeCenter(item.center);

    return {
        id: item.crisis_id ?? item.id,
        incidentType:
            item.incident_type?.name ||
            item.incident_type_name ||
            item.incident_type ||
            "Unknown incident",
        triggeredAt: item.triggered_at || "",
        resolvedAt: item.resolved_at || null,
        center,
        radius: item.radius ?? 0,
        notes: item.notes || "",
        isActive: !!item.is_active,
        distanceFromCenterMeters: item.distance_from_center_meters ?? null,
        cluster: item.cluster || null,
        usersInZone: item.users_in_zone || [],
    };
}

function getStatusColor(status) {
    switch (String(status || "").trim().toLowerCase()) {
        case "safe":
            return "#22c55e";
        case "need_help":
            return "#ef4444";
        case "injured":
            return "#f97316";
        case "available_to_help":
            return "#a855f7";
        default:
            return "#64748b";
    }
}

function buildUserGeoJSON(users, status) {
    const filtered = users.filter(
        (user) => user.location && user.crisisStatus === status
    );

    return {
        type: "FeatureCollection",
        features: filtered.map((userItem) => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: userItem.location,
            },
            properties: {
                id: userItem.id,
                username: userItem.username,
                firstName: userItem.firstName,
                lastName: userItem.lastName,
                email: userItem.email,
                crisisStatus: userItem.crisisStatus,
                onlineStatus: userItem.onlineStatus,
                isVerified: userItem.isVerified,
                distanceFromCrisisMeters: userItem.distanceFromCrisisMeters,
                crisisId: userItem.crisisId,
                crisisIncidentType: userItem.crisisIncidentType,
                type: "CrisisUser",
            },
        })),
    };
}

const CRISIS_STATUS_OPTIONS = [
    { value: "safe", label: "I'm Safe", color: "#22c55e" },
    { value: "need_help", label: "Need Help", color: "#ef4444" },
    { value: "injured", label: "Injured", color: "#f97316" },
    { value: "available_to_help", label: "Available to Help", color: "#a855f7" },
];

// All accounts-app URLs share this base
const API_BASE = "https://pulsenet-45is.onrender.com/accounts";

export default function CrisisPage({ user }) {
    const navigate = useNavigate();
    const mapRef = useRef(null);

    const [selectedPoint, setSelectedPoint] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [locationDenied, setLocationDenied] = useState(false);

    const [currentCrisisStatus, setCurrentCrisisStatus] = useState(
        user?.crisis_status || null
    );

    // activeCrises is fetched here from check_user_in_crisis
    // The view returns { active_crises: [...] } where each item has "crisis_id" (not "id")
    const [activeCrises, setActiveCrises] = useState([]);

    const [activeTab, setActiveTab] = useState("crisis");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Pulses state
    const [pulses, setPulses] = useState([]);
    const [pulsesLoading, setPulsesLoading] = useState(false);
    const [pulsesError, setPulsesError] = useState(null);
    const [pulsesMeta, setPulsesMeta] = useState(null);

    // GET /accounts/check_user_in_crisis/
    useEffect(() => {
        async function fetchCrisisData() {
            try {
                const res = await fetch(`${API_BASE}/check_user_in_crisis/`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    },
                });
                if (!res.ok) throw new Error("Failed to fetch crisis data");

                const data = await res.json();
                setCurrentCrisisStatus(data.current_user_crisis_status);
                // active_crises items use "crisis_id" key — normalizeCrisis handles both
                setActiveCrises(data.active_crises || []);
            } catch (err) {
                console.error(err);
            }
        }

        fetchCrisisData();
    }, []);

    // GET /accounts/crisis-events/<id>/pulses/  — runs when tab is pulses AND activeCrises has loaded
    useEffect(() => {
        if (activeTab !== "pulses") return;

        // activeCrises loads async — if not ready yet, show loading and wait for re-run
        const primaryCrisisId = activeCrises?.[0]?.crisis_id ?? activeCrises?.[0]?.id;
        if (!primaryCrisisId) {
            setPulsesLoading(true); // show spinner while crisis data arrives
            return;
        }

        async function fetchPulses() {
            try {
                setPulsesLoading(true);
                setPulsesError(null);

                const res = await fetch(
                    `${API_BASE}/crisis-events/${primaryCrisisId}/pulses/`,
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                        },
                    }
                );

                if (!res.ok) throw new Error("Failed to fetch pulses");

                const data = await res.json();
                if (!data.success) throw new Error(data.error || "Unknown error");

                setPulses(data.pulses || []);
                setPulsesMeta({
                    mode: data.mode,
                    userInCrisisZone: data.user_in_crisis_zone,
                    total: data.total,
                    localCount: data.local_count,
                    globalCount: data.global_count,
                });
            } catch (err) {
                console.error(err);
                setPulsesError(err.message || "Failed to load pulses");
            } finally {
                setPulsesLoading(false);
            }
        }

        fetchPulses();
    }, [activeTab, activeCrises]);

    // PATCH /accounts/users/me/crisis-status/
    async function updateCrisisStatus(status) {
        try {
            setIsUpdatingStatus(true);
            setCurrentCrisisStatus(status);

            const response = await fetch(`${API_BASE}/users/me/crisis-status/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                },
                body: JSON.stringify({ crisis_status: status }),
            });

            if (!response.ok) throw new Error("Failed to update crisis status");
        } catch (err) {
            console.error(err);
            setCurrentCrisisStatus(user?.crisis_status || null);
        } finally {
            setIsUpdatingStatus(false);
        }
    }

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationDenied(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
            },
            () => setLocationDenied(true),
            { enableHighAccuracy: false, timeout: 5000 }
        );
    }, []);

    const crises = useMemo(
        () => activeCrises.map(normalizeCrisis).filter(Boolean),
        [activeCrises]
    );

    const primaryCrisis = crises[0] || null;

    const allIncidents = useMemo(() => {
        const incidents = [];

        for (const crisis of crises) {
            const clusterIncidents = crisis.cluster?.incidents || [];
            for (const incident of clusterIncidents) {
                incidents.push({
                    ...normalizeIncident(incident),
                    crisisId: crisis.id,
                    crisisIncidentType: crisis.incidentType,
                    crisisCenter: crisis.center,
                    crisisRadius: crisis.radius,
                });
            }
        }

        return incidents.filter((incident) => incident.location);
    }, [crises]);

    const allUsersInZone = useMemo(() => {
        const users = [];

        for (const crisis of crises) {
            for (const userItem of crisis.usersInZone || []) {
                const normalized = normalizeUserInZone(userItem);
                if (!normalized.location) continue;

                users.push({
                    ...normalized,
                    crisisId: crisis.id,
                    crisisIncidentType: crisis.incidentType,
                    crisisCenter: crisis.center,
                });
            }
        }

        return users;
    }, [crises]);

    const crisisGeoJSON = useMemo(
        () => ({
            type: "FeatureCollection",
            features: crises
                .filter((c) => c.center)
                .map((c) => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: c.center },
                    properties: {
                        id: c.id,
                        title: c.incidentType,
                        description: c.notes,
                        radius: c.radius,
                        triggeredAt: c.triggeredAt,
                        resolvedAt: c.resolvedAt,
                        isActive: c.isActive,
                        type: "Crisis",
                    },
                })),
        }),
        [crises]
    );

    const incidentGeoJSON = useMemo(
        () => ({
            type: "FeatureCollection",
            features: allIncidents.map((incident) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: incident.location },
                properties: {
                    id: incident.id,
                    title: incident.title,
                    description: incident.description,
                    type: "Incident",
                    incidentTypeName: incident.incidentTypeName,
                    incidentTypeSlug: incident.incidentTypeSlug,
                    severityLevel: incident.severityLevel,
                    isVerified: incident.isVerified,
                    confirmCount: incident.confirmCount,
                    reportCount: incident.reportCount,
                    createdAt: incident.createdAt,
                    address: incident.address,
                    crisisId: incident.crisisId,
                    crisisIncidentType: incident.crisisIncidentType,
                },
            })),
        }),
        [allIncidents]
    );

    const safeUsersGeoJSON = useMemo(() => buildUserGeoJSON(allUsersInZone, "safe"), [allUsersInZone]);
    const needHelpUsersGeoJSON = useMemo(() => buildUserGeoJSON(allUsersInZone, "need_help"), [allUsersInZone]);
    const injuredUsersGeoJSON = useMemo(() => buildUserGeoJSON(allUsersInZone, "injured"), [allUsersInZone]);
    const availableUsersGeoJSON = useMemo(() => buildUserGeoJSON(allUsersInZone, "available_to_help"), [allUsersInZone]);

    const unknownUsersGeoJSON = useMemo(
        () => ({
            type: "FeatureCollection",
            features: allUsersInZone
                .filter(
                    (userItem) =>
                        userItem.location &&
                        !["safe", "need_help", "injured", "available_to_help"].includes(
                            userItem.crisisStatus
                        )
                )
                .map((userItem) => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: userItem.location },
                    properties: {
                        id: userItem.id,
                        username: userItem.username,
                        firstName: userItem.firstName,
                        lastName: userItem.lastName,
                        email: userItem.email,
                        crisisStatus: userItem.crisisStatus,
                        onlineStatus: userItem.onlineStatus,
                        isVerified: userItem.isVerified,
                        distanceFromCrisisMeters: userItem.distanceFromCrisisMeters,
                        crisisId: userItem.crisisId,
                        crisisIncidentType: userItem.crisisIncidentType,
                        type: "CrisisUser",
                    },
                })),
        }),
        [allUsersInZone]
    );

    // Build GeoJSON for pulses
    const pulsesGeoJSON = useMemo(
        () => ({
            type: "FeatureCollection",
            features: pulses
                .filter((p) => p.lat != null && p.lng != null)
                .map((p) => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
                    properties: {
                        id: p.id,
                        title: p.title,
                        description: p.description,
                        user: p.user,
                        emergencyCategory: p.emergency_category,
                        emergencyCategoryDisplay: p.emergency_category_display,
                        phoneNumber: p.phone_number,
                        timestamp: p.timestamp,
                        image: p.image,
                        distance: p.distance,
                        scope: p.scope,
                        type: "Pulse",
                    },
                })),
        }),
        [pulses]
    );

    const userLocationGeoJSON = userLocation
        ? {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [userLocation.lng, userLocation.lat],
                    },
                    properties: { name: "You are here", type: "User" },
                },
            ],
        }
        : null;

    const mapCenter = primaryCrisis?.center
        ? [primaryCrisis.center[0], primaryCrisis.center[1]]
        : userLocation
            ? [userLocation.lng, userLocation.lat]
            : [27.6014, 47.1585];

    if (locationDenied) {
        return (
            <div className={styles.bodyContainer}>
                <div className={styles.navbarAdjust}>
                    <Navbar />
                </div>

                <div
                    style={{
                        minHeight: "80vh",
                        display: "grid",
                        placeItems: "center",
                        padding: 24,
                    }}
                >
                    <div style={{ maxWidth: 560, textAlign: "center" }}>
                        <ShieldAlert
                            size={54}
                            style={{ margin: "0 auto 16px", color: "#b91c1c" }}
                        />
                        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
                            Location access required
                        </h1>
                        <p style={{ color: "#64748b", lineHeight: 1.6 }}>
                            Crisis mode is active, and your location helps show how close you are to the incident.
                            Please enable location access and reload the page.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: 18,
                                padding: "10px 18px",
                                borderRadius: 999,
                                border: "none",
                                background: "#991b1b",
                                color: "#fff",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Reload page
                        </button>
                    </div>
                </div>

                <Footer />
            </div>
        );
    }

    if (!primaryCrisis) {
        return <Loading />;
    }

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            {/* Crisis banner */}
            <div
                style={{
                    width: "100%",
                    background: "#991b1b",
                    color: "white",
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    fontWeight: 700,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <AlertTriangle size={22} />
                    <div>ACTIVE CRISIS: {primaryCrisis.incidentType}</div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                    <span>Started {formatDate(primaryCrisis.triggeredAt)}</span>
                    <span>•</span>
                    <span>Ongoing for {formatDuration(primaryCrisis.triggeredAt, primaryCrisis.resolvedAt)}</span>
                    <span>•</span>
                    <span>{allIncidents.length} incidents in cluster</span>
                    <span>•</span>
                    <span>{allUsersInZone.length} users in zone</span>
                </div>
            </div>

            <div className={styles.page}>
                <div className={styles.container}>
                    {/* ── LEFT PANEL ── */}
                    <div className={styles.leftPanel}>
                        {/* Tabs */}
                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tab} ${activeTab === "crisis" ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab("crisis")}
                            >
                                Crisis
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === "pulses" ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab("pulses")}
                            >
                                Pulses
                            </button>
                            <button
                                className={`${styles.tab}`}
                                onClick={() => {navigate("./backup");}}
                            >
                                Backup Page
                            </button>
                        </div>

                        {/* ── CRISIS TAB ── */}
                        {activeTab === "crisis" && (
                            <>
                                {/* My Crisis Status card */}
                                <div
                                    style={{
                                        background: "#fff",
                                        borderRadius: 16,
                                        padding: 20,
                                        marginBottom: 20,
                                        border: "1px solid #e2e8f0",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            marginBottom: 14,
                                        }}
                                    >
                                        <ShieldAlert size={20} />
                                        <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                                            My Crisis Status
                                        </h3>
                                    </div>

                                    <p style={{ color: "#64748b", marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
                                        Let nearby people and responders know your current situation.
                                    </p>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: 12,
                                        }}
                                    >
                                        {CRISIS_STATUS_OPTIONS.map((option) => {
                                            const active = currentCrisisStatus === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    disabled={isUpdatingStatus}
                                                    onClick={() => updateCrisisStatus(option.value)}
                                                    style={{
                                                        padding: "14px 12px",
                                                        borderRadius: 14,
                                                        border: active
                                                            ? `2px solid ${option.color}`
                                                            : "1px solid #cbd5e1",
                                                        background: active ? `${option.color}15` : "#fff",
                                                        color: active ? option.color : "#0f172a",
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        transition: "0.2s",
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {currentCrisisStatus && (
                                        <div style={{ marginTop: 16, fontSize: 14, color: "#475569" }}>
                                            Current status:
                                            <strong style={{ marginLeft: 6 }}>
                                                {CRISIS_STATUS_OPTIONS.find((s) => s.value === currentCrisisStatus)?.label}
                                            </strong>
                                        </div>
                                    )}
                                </div>

                                {/* Crisis cards */}
                                <div className={styles.cardsGrid}>
                                    {crises.map((crisis) => (
                                        <div
                                            key={crisis.id}
                                            className={styles.card}
                                            style={{ border: "1px solid #ef4444" }}
                                            onClick={() => {
                                                if (crisis.center) {
                                                    setSelectedPoint({
                                                        coordinates: crisis.center,
                                                        properties: {
                                                            id: crisis.id,
                                                            title: crisis.incidentType,
                                                            description: crisis.notes,
                                                            radius: crisis.radius,
                                                            triggeredAt: crisis.triggeredAt,
                                                            resolvedAt: crisis.resolvedAt,
                                                            type: "Crisis",
                                                        },
                                                    });
                                                }
                                            }}
                                        >
                                            <div className={styles.cardContent}>
                                                <div className={styles.cardHeader}>
                                                    <div>
                                                        <h3 className={styles.title}>{crisis.incidentType}</h3>
                                                        <p className={styles.user}>
                                                            {crisis.isActive ? "Active crisis" : "Resolved crisis"}
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={styles.rating}
                                                        style={{
                                                            background: crisis.isActive ? "#991b1b" : "#6b7280",
                                                            color: "white",
                                                        }}
                                                    >
                                                        {crisis.isActive ? "LIVE" : "ENDED"}
                                                    </div>
                                                </div>

                                                <p className={styles.description}>
                                                    {crisis.notes || "No additional notes provided."}
                                                </p>

                                                <div className={styles.metaGrid}>
                                                    <div>
                                                        <span className={styles.metaLabel}>Started</span>
                                                        <span className={styles.metaValue}>{formatDate(crisis.triggeredAt)}</span>
                                                    </div>
                                                    <div>
                                                        <span className={styles.metaLabel}>Duration</span>
                                                        <span className={styles.metaValue}>{formatDuration(crisis.triggeredAt, crisis.resolvedAt)}</span>
                                                    </div>
                                                    <div>
                                                        <span className={styles.metaLabel}>Radius</span>
                                                        <span className={styles.metaValue}>{crisis.radius} km</span>
                                                    </div>
                                                    <div>
                                                        <span className={styles.metaLabel}>Distance</span>
                                                        <span className={styles.metaValue}>
                                                            {crisis.distanceFromCenterMeters != null
                                                                ? `${crisis.distanceFromCenterMeters} m`
                                                                : "-"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ── PULSES TAB ── */}
                        {activeTab === "pulses" && (
                            <div>
                                {/* Summary bar */}
                                {pulsesMeta && !pulsesLoading && (
                                    <div
                                        style={{
                                            background: "#fff",
                                            borderRadius: 16,
                                            padding: "14px 18px",
                                            marginBottom: 16,
                                            border: "1px solid #e2e8f0",
                                            display: "flex",
                                            gap: 16,
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                            fontSize: 13,
                                            color: "#475569",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            {pulsesMeta.mode === "global"
                                                ? <Globe size={15} />
                                                : <LocateFixed size={15} />}
                                            <span style={{ fontWeight: 700, textTransform: "capitalize" }}>
                                                {pulsesMeta.mode} mode
                                            </span>
                                        </div>
                                        <span>•</span>
                                        <span><strong>{pulsesMeta.total}</strong> pulses total</span>
                                        <span>•</span>
                                        <span><strong>{pulsesMeta.localCount}</strong> local</span>
                                        <span>•</span>
                                        <span><strong>{pulsesMeta.globalCount}</strong> global</span>
                                    </div>
                                )}

                                {/* Loading state */}
                                {pulsesLoading && (
                                    <div
                                        style={{
                                            padding: 40,
                                            textAlign: "center",
                                            color: "#94a3b8",
                                            fontSize: 14,
                                        }}
                                    >
                                        Loading pulses…
                                    </div>
                                )}

                                {/* Error state */}
                                {pulsesError && !pulsesLoading && (
                                    <div
                                        style={{
                                            padding: 20,
                                            borderRadius: 12,
                                            background: "#fef2f2",
                                            border: "1px solid #fecaca",
                                            color: "#b91c1c",
                                            fontSize: 14,
                                        }}
                                    >
                                        {pulsesError}
                                    </div>
                                )}

                                {/* Empty state */}
                                {!pulsesLoading && !pulsesError && pulses.length === 0 && (
                                    <div
                                        style={{
                                            padding: 40,
                                            textAlign: "center",
                                            color: "#94a3b8",
                                            fontSize: 14,
                                        }}
                                    >
                                        No emergency pulses found in this crisis zone.
                                    </div>
                                )}

                                {/* Pulse cards */}
                                {!pulsesLoading && !pulsesError && (
                                    <div className={styles.cardsGrid}>
                                        {pulses.map((pulse) => (
                                            <div
                                                key={pulse.id}
                                                className={styles.card}
                                                style={{ border: "1px solid #f97316", cursor: "pointer" }}
                                                onClick={() => {
                                                    if (pulse.lat != null && pulse.lng != null) {
                                                        setSelectedPoint({
                                                            coordinates: [pulse.lng, pulse.lat],
                                                            properties: {
                                                                id: pulse.id,
                                                                title: pulse.title,
                                                                description: pulse.description,
                                                                user: pulse.user,
                                                                emergencyCategory: pulse.emergency_category,
                                                                emergencyCategoryDisplay: pulse.emergency_category_display,
                                                                phoneNumber: pulse.phone_number,
                                                                timestamp: pulse.timestamp,
                                                                image: pulse.image,
                                                                distance: pulse.distance,
                                                                scope: pulse.scope,
                                                                type: "Pulse",
                                                            },
                                                        });
                                                    }
                                                }}
                                            >
                                                <div className={styles.cardContent}>
                                                    {/* Header */}
                                                    <div className={styles.cardHeader}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <h3 className={styles.title}>{pulse.title}</h3>
                                                            <p className={styles.user}>@{pulse.user}</p>
                                                        </div>
                                                        <div
                                                            className={styles.rating}
                                                            style={{
                                                                background: pulse.scope === "local" ? "#f97316" : "#6366f1",
                                                                color: "white",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {pulse.scope === "local" ? "LOCAL" : "GLOBAL"}
                                                        </div>
                                                    </div>

                                                    {/* Image thumbnail */}
                                                    {pulse.image && (
                                                        <img
                                                            src={pulse.image}
                                                            alt={pulse.title}
                                                            style={{
                                                                width: "100%",
                                                                height: 120,
                                                                objectFit: "cover",
                                                                borderRadius: 10,
                                                                marginBottom: 10,
                                                            }}
                                                        />
                                                    )}

                                                    <p className={styles.description}>
                                                        {pulse.description || "No description provided."}
                                                    </p>

                                                    {/* Meta */}
                                                    <div className={styles.metaGrid}>
                                                        <div>
                                                            <span className={styles.metaLabel}>Category</span>
                                                            <span className={styles.metaValue}>
                                                                {pulse.emergency_category_display || pulse.emergency_category || "-"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className={styles.metaLabel}>Distance</span>
                                                            <span className={styles.metaValue}>
                                                                {pulse.distance != null ? `${pulse.distance} km` : "-"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className={styles.metaLabel}>Posted</span>
                                                            <span className={styles.metaValue}>
                                                                {formatDate(pulse.timestamp)}
                                                            </span>
                                                        </div>
                                                        {pulse.phone_number && (
                                                            <div>
                                                                <span className={styles.metaLabel}>Phone</span>
                                                                <span className={styles.metaValue}>{pulse.phone_number}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── MAP PANEL ── */}
                    <div className={styles.mapPanel}>
                        <div className={styles.mapBox}>
                            <Map
                                key={`${mapCenter[0]}-${mapCenter[1]}`}
                                ref={mapRef}
                                center={mapCenter}
                                zoom={12}
                                fadeDuration={0}
                            >
                                {/* Crisis tab layers */}
                                {activeTab === "crisis" && (
                                    <>
                                        <MapClusterLayer
                                            data={crisisGeoJSON}
                                            clusterRadius={40}
                                            clusterMaxZoom={14}
                                            clusterColors={["#9ca3af", "#6b7280", "#4b5563"]}
                                            pointColor="#6b7280"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                        <MapClusterLayer
                                            data={incidentGeoJSON}
                                            clusterRadius={50}
                                            clusterMaxZoom={14}
                                            clusterColors={["#9ca3af", "#6b7280", "#4b5563"]}
                                            pointColor="#6b7280"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                        <MapClusterLayer
                                            data={safeUsersGeoJSON}
                                            clusterRadius={45}
                                            clusterMaxZoom={14}
                                            clusterColors={["#22c55e", "#16a34a", "#15803d"]}
                                            pointColor="#22c55e"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                        <MapClusterLayer
                                            data={needHelpUsersGeoJSON}
                                            clusterRadius={45}
                                            clusterMaxZoom={14}
                                            clusterColors={["#ef4444", "#dc2626", "#b91c1c"]}
                                            pointColor="#ef4444"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                        <MapClusterLayer
                                            data={injuredUsersGeoJSON}
                                            clusterRadius={45}
                                            clusterMaxZoom={14}
                                            clusterColors={["#f97316", "#ea580c", "#c2410c"]}
                                            pointColor="#f97316"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                        <MapClusterLayer
                                            data={availableUsersGeoJSON}
                                            clusterRadius={45}
                                            clusterMaxZoom={14}
                                            clusterColors={["#a855f7", "#9333ea", "#7e22ce"]}
                                            pointColor="#a855f7"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                        <MapClusterLayer
                                            data={unknownUsersGeoJSON}
                                            clusterRadius={45}
                                            clusterMaxZoom={14}
                                            clusterColors={["#64748b", "#475569", "#334155"]}
                                            pointColor="#64748b"
                                            onPointClick={(feature, coordinates) =>
                                                setSelectedPoint({ coordinates, properties: feature.properties })
                                            }
                                        />
                                    </>
                                )}

                                {/* Pulses tab layer */}
                                {activeTab === "pulses" && (
                                    <MapClusterLayer
                                        data={pulsesGeoJSON}
                                        clusterRadius={50}
                                        clusterMaxZoom={14}
                                        clusterColors={["#fb923c", "#f97316", "#ea580c"]}
                                        pointColor="#f97316"
                                        onPointClick={(feature, coordinates) =>
                                            setSelectedPoint({ coordinates, properties: feature.properties })
                                        }
                                    />
                                )}

                                {/* User location — always shown */}
                                {userLocationGeoJSON && (
                                    <MapClusterLayer
                                        data={userLocationGeoJSON}
                                        clusterRadius={0}
                                        pointColor="#22c55e"
                                        clusterColors={["#22c55e"]}
                                        onPointClick={(_feature, coordinates) =>
                                            setSelectedPoint({
                                                coordinates,
                                                properties: { name: "Your location", type: "User", description: "" },
                                            })
                                        }
                                    />
                                )}

                                {/* Popup */}
                                {selectedPoint && (
                                    <MapPopup
                                        longitude={selectedPoint.coordinates[0]}
                                        latitude={selectedPoint.coordinates[1]}
                                        onClose={() => setSelectedPoint(null)}
                                        closeOnClick={false}
                                        focusAfterOpen={false}
                                        closeButton
                                    >
                                        <div className="space-y-1 p-1 cursor-pointer">
                                            <p className="font-semibold">
                                                {selectedPoint.properties.title ||
                                                    selectedPoint.properties.name ||
                                                    selectedPoint.properties.username ||
                                                    selectedPoint.properties.email}
                                            </p>

                                            {selectedPoint.properties.type === "Crisis" && (
                                                <>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <AlertTriangle size={16} /> Crisis center
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <MapPin size={16} /> Radius: {selectedPoint.properties.radius} km
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <AlarmClock size={16} /> Started: {formatDate(selectedPoint.properties.triggeredAt)}
                                                    </p>
                                                    {selectedPoint.properties.description && (
                                                        <p className="text-sm text-slate-600">{selectedPoint.properties.description}</p>
                                                    )}
                                                </>
                                            )}

                                            {selectedPoint.properties.type === "Incident" && (
                                                <>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <Tags size={16} /> {selectedPoint.properties.incidentTypeName}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <MapPin size={16} /> {selectedPoint.properties.address || "No address"}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <AlarmClock size={16} /> Created: {formatDate(selectedPoint.properties.createdAt)}
                                                    </p>
                                                    <p className="text-sm">Severity: {selectedPoint.properties.severityLevel}</p>
                                                    <p className="text-sm">Verified: {selectedPoint.properties.isVerified ? "Yes" : "No"}</p>
                                                    {selectedPoint.properties.description && (
                                                        <p className="text-sm text-slate-600">{selectedPoint.properties.description}</p>
                                                    )}
                                                </>
                                            )}

                                            {selectedPoint.properties.type === "CrisisUser" && (
                                                <>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <AlertTriangle size={16} /> Crisis user
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <Tags size={16} /> Status: {selectedPoint.properties.crisisStatus}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <AlarmClock size={16} /> Distance:{" "}
                                                        {selectedPoint.properties.distanceFromCrisisMeters != null
                                                            ? `${selectedPoint.properties.distanceFromCrisisMeters} m`
                                                            : "-"}
                                                    </p>
                                                    <p className="text-sm text-slate-600">
                                                        {selectedPoint.properties.username
                                                            ? `@${selectedPoint.properties.username}`
                                                            : selectedPoint.properties.email}
                                                    </p>
                                                </>
                                            )}

                                            {selectedPoint.properties.type === "Pulse" && (
                                                <div onClick={() => {
                                                        navigate(`/pulse/${selectedPoint.properties.pulseType}/${selectedPoint.properties.id}`);
                                                }}>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <Radio size={16} /> Emergency pulse
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <Tags size={16} />{" "}
                                                        {selectedPoint.properties.emergencyCategoryDisplay ||
                                                            selectedPoint.properties.emergencyCategory ||
                                                            "Unknown category"}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <MapPin size={16} />{" "}
                                                        {selectedPoint.properties.distance != null
                                                            ? `${selectedPoint.properties.distance} km from crisis center`
                                                            : "Distance unknown"}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-sm">
                                                        <AlarmClock size={16} /> {formatDate(selectedPoint.properties.timestamp)}
                                                    </p>
                                                    {selectedPoint.properties.phoneNumber && (
                                                        <p className="flex items-center gap-1 text-sm">
                                                            <Phone size={16} /> {selectedPoint.properties.phoneNumber}
                                                        </p>
                                                    )}
                                                    <p className="text-sm text-slate-600">
                                                        @{selectedPoint.properties.user} •{" "}
                                                        <span
                                                            style={{
                                                                background: selectedPoint.properties.scope === "local" ? "#fff7ed" : "#eef2ff",
                                                                color: selectedPoint.properties.scope === "local" ? "#c2410c" : "#4338ca",
                                                                padding: "1px 6px",
                                                                borderRadius: 4,
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {selectedPoint.properties.scope}
                                                        </span>
                                                    </p>
                                                    {selectedPoint.properties.description && (
                                                        <p className="text-sm text-slate-600">{selectedPoint.properties.description}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </MapPopup>
                                )}

                                <MapControls />
                            </Map>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}