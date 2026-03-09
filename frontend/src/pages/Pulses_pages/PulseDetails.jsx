import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, MessageSquare } from "lucide-react";
import styles from "../../styles/Pulses_pages/pulseDetails.module.css";
import Navbar from "../../components/Navbar";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import "maplibre-gl/dist/maplibre-gl.css";

/* FullCalendar imports */
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

/* --- helper utilities (kept from your original file) --- */
function formatLocation(location) {
    if (!location) return "Not specified";
    if (Array.isArray(location)) {
        return `${location[1].toFixed(4)}°N, ${location[0].toFixed(4)}°E`;
    }
    if (location.coordinates) {
        return `${location.coordinates[1].toFixed(4)}°N, ${location.coordinates[0].toFixed(4)}°E`;
    }
    return String(location);
}

function getLocationCoords(location) {
    // default coords (lon, lat)
    const defaultCoords = [27.5766, 47.1585];

    if (!location) return defaultCoords;
    if (Array.isArray(location)) return location;
    if (location.coordinates) return location.coordinates;
    return defaultCoords;
}

function getCookie(name) {
    let cookieValue = null;

    if (typeof document === "undefined") return null;

    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");

        for (let cookie of cookies) {
            cookie = cookie.trim();

            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
                break;
            }
        }
    }

    return cookieValue;
}

/** Try to extract the underlying maplibre/map instance from various wrapper shapes */
function getMapInstance(candidate) {
    if (!candidate) return null;

    // wrapper exposes getMap()
    if (typeof candidate.getMap === "function") {
        try {
            return candidate.getMap();
        } catch (e) {
            // ignore
        }
    }

    // wrapper might expose a property with the instance
    if (candidate.mapInstance) return candidate.mapInstance;
    if (candidate.map) return candidate.map;
    // maybe the ref is already the actual instance
    return typeof candidate.resize === "function" ? candidate : null;
}

/* --- main component --- */
export default function PulseDetails() {
    const { type, id } = useParams();
    const navigate = useNavigate();

    const [pulse, setPulse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [index, setIndex] = useState(0);
    const [favAnim, setFavAnim] = useState(false);
    const mapRef = useRef(null);

    /* events for FullCalendar (read-only unavailable/background events) */
    const [calendarEvents, setCalendarEvents] = useState([]);

    useEffect(() => {
        let mounted = true;
        const csrfToken = getCookie("csrftoken");

        fetch(`http://localhost:8000/accounts/pulse/${id}/`, {
            method: "GET",
            credentials: "include",
            headers: {
                "X-CSRFToken": csrfToken,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (!mounted) return;

                if (data.success) {
                    setPulse(data.pulse);
                    setIndex(0);
                } else {
                    setError(data.error || "Not found");
                }
            })
            .catch(() => setError("Server error"))
            .finally(() => mounted && setLoading(false));

        return () => (mounted = false);
    }, [id]);

    // build calendar events when pulse (or its unavailable ranges) changes
    useEffect(() => {
        if (!pulse) {
            setCalendarEvents([]);
            return;
        }

        const ranges = pulse.unavailable_ranges ?? pulse.reserved_periods ?? [];

        const events = ranges.map((r, i) => {

            const startRaw = r.start ?? r.start_date;
            const endRaw = r.end ?? r.end_date;

            const start = new Date(startRaw);
            const end = new Date(endRaw);

            return {
                id: `unav-${i}`,

                // IMPORTANT FIX
                start,
                end,

                allDay: true,  // 👈 fixes month view

                display: "background",

                backgroundColor: "rgba(255,70,70,0.35)",
                borderColor: "rgba(255,70,70,0.6)",
            };
        });

        setCalendarEvents(events);

    }, [pulse]);

    // When pulse/coords change, try to resize & recenter the actual map instance.
    useEffect(() => {
        if (!pulse) return;

        const coords = getLocationCoords(pulse.location);

        let mounted = true;

        const ensureMapReady = async () => {
            // Small initial delay to allow DOM/CSS layout
            await new Promise((r) => setTimeout(r, 250));

            let mapInst = getMapInstance(mapRef.current);

            // Poll for the instance (some wrappers initialize it slightly later)
            const start = Date.now();
            const timeout = 2000; // ms
            while (!mapInst && Date.now() - start < timeout && mounted) {
                await new Promise((r) => setTimeout(r, 150));
                mapInst = getMapInstance(mapRef.current);
            }

            if (!mounted) return;

            if (mapInst) {
                try {
                    // Resize and recenter/redraw the map
                    if (typeof mapInst.resize === "function") mapInst.resize();
                    if (typeof mapInst.setCenter === "function")
                        mapInst.setCenter([coords[0], coords[1]]);
                    else if (typeof mapInst.flyTo === "function")
                        mapInst.flyTo({ center: [coords[0], coords[1]] });

                    if (typeof mapInst.setZoom === "function") mapInst.setZoom(16);
                } catch (err) {
                    // final fallback
                    window.dispatchEvent(new Event("resize"));
                }
            } else {
                // If we couldn't detect an instance, force a resize event
                window.dispatchEvent(new Event("resize"));
            }
        };

        ensureMapReady();

        return () => {
            mounted = false;
        };
    }, [pulse]);

    // Another generic resize pass for when the page first mounts (helps in some layouts)
    useEffect(() => {
        const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 500);
        return () => clearTimeout(t);
    }, []);

    const images = useMemo(() => (pulse && pulse.images ? pulse.images : []), [pulse]);

    // guard navigation when images array is empty
    const next = () => {
        if (!images.length) return;
        setIndex((i) => (i + 1) % images.length);
    };
    const prev = () => {
        if (!images.length) return;
        setIndex((i) => (i - 1 + images.length) % images.length);
    };

    const handleFavorite = async () => {
        setFavAnim(true);

        try {
            const csrfToken = getCookie("csrftoken");

            const response = await fetch(
                `http://localhost:8000/accounts/add_to_favorites/${pulse.id}/`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfToken,
                    },
                }
            );

            const data = await response.json();

            if (response.ok && data.success) {
                setPulse((prev) => ({
                    ...prev,
                    is_favorite: true,
                }));
            }
        } catch (err) {
            console.error("Favorite error:", err);
        }

        setTimeout(() => {
            setFavAnim(false);
        }, 350);
    };

    const delete_favorite = async () => {
        try {
            const csrfToken = getCookie("csrftoken");

            const response = await fetch(
                `http://localhost:8000/accounts/delete_from_favorites/${pulse.id}/`,
                {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "X-CSRFToken": csrfToken,
                    },
                }
            );

            const data = await response.json();

            if (response.ok && data.success) {
                setPulse((prev) => ({
                    ...prev,
                    is_favorite: false,
                }));
            }
        } catch (err) {
            console.error("Delete favorite error:", err);
        }
    };

    if (loading) {
        return <div className={styles.loading}>Loading pulse...</div>;
    }

    if (error) {
        return (
            <div className={styles.errorBox}>
                <h2>{error}</h2>
                <button onClick={() => navigate(-1)}>Go Back</button>
            </div>
        );
    }

    if (!pulse) return null;

    const coords = getLocationCoords(pulse.location);
    const isService = type === "servicii";

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />

                <div className={styles.page}>
                    <div className={styles.container}>

                        {/* LEFT SIDE */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={styles.left}
                        >
                            <div className={styles.header}>
                                {pulse.user_avatar ? (
                                    <img
                                        src={pulse.user_avatar}
                                        alt="avatar"
                                        className={styles.avatar}
                                    />
                                ) : (
                                    <div className={styles.avatarPlaceholder}>
                                        {pulse.user[0]}
                                    </div>
                                )}

                                <div>
                                    <div className={styles.username}>
                                        {pulse.user}
                                    </div>

                                    <div className={styles.timestamp}>
                                        {pulse.timestamp}
                                    </div>
                                </div>
                            </div>

                            <h1 className={styles.title}>{pulse.name}</h1>

                            <p className={styles.description}>
                                {pulse.description}
                            </p>

                            <div className={styles.badges}>
                                <div className={styles.typeBadge}>
                                    {isService ? "Serviciu" : "Obiect"}
                                </div>

                                <div className={styles.priceBadge}>
                                    {pulse.price} {pulse.currency}
                                </div>
                            </div>

                            {/* IMAGE CAROUSEL */}
                            <div className={styles.carousel}>
                                {images.length > 0 ? (
                                    <>
                                        <img
                                            src={images[index]}
                                            className={styles.mainImage}
                                            alt=""
                                        />

                                        <button
                                            onClick={prev}
                                            className={styles.navLeft}
                                        >
                                            <ArrowLeft size={20} />
                                        </button>

                                        <button
                                            onClick={next}
                                            className={styles.navRight}
                                        >
                                            <ArrowRight size={20} />
                                        </button>

                                        <div className={styles.thumbs}>
                                            {images.map((img, i) => (
                                                <img
                                                    key={i}
                                                    src={img}
                                                    onClick={() => setIndex(i)}
                                                    className={`${styles.thumb} ${i === index ? styles.activeThumb : ""}`}
                                                    alt=""
                                                />
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.noImage}>
                                        No images
                                    </div>
                                )}
                            </div>

                            {/* INFO GRID */}
                            <div className={styles.infoGrid}>
                                <div>
                                    <span>Posted</span>
                                    <strong>{pulse.timestamp}</strong>
                                </div>

                                <div>
                                    <span>Location</span>
                                    <strong>
                                        {formatLocation(pulse.location)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Condition</span>
                                    <strong>{pulse.condition || "N/A"}</strong>
                                </div>
                            </div>
                        </motion.div>

                        {/* RIGHT COLUMN - Contains both sidebar, map and calendar */}
                        <div className={styles.rightColumn}>
                            <motion.aside
                                initial={{ opacity: 0, x: 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={styles.sidebar}
                            >
                                <div className={styles.sellerCard}>
                                    <h3>Seller</h3>

                                    <p>{pulse.user}</p>

                                    <div>
                                        <button
                                            className={styles.contactBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/direct-chat/${pulse.user_id}`);
                                            }}
                                        >
                                            <MessageSquare size={16} /> Contact
                                        </button>

                                        <button
                                            onClick={() => {
                                                pulse.is_favorite ? delete_favorite() : handleFavorite();
                                            }}
                                            className={`
                                                ${styles.favoriteBtn}
                                                ${pulse.is_favorite ? styles.favoriteActive : styles.favoriteInactive}
                                                ${favAnim ? styles.favActive : ""}
                                            `}
                                        >
                                            <Heart
                                                size={16}
                                                fill={pulse.is_favorite ? "currentColor" : "none"}
                                            />

                                            {pulse.is_favorite ? "Favorited" : "Favorite"}
                                        </button>
                                    </div>

                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => { navigate(`/transaction/${pulse.id}`); }}
                                    >
                                        {isService ? "Book Service" : "Lend Item"}
                                    </button>
                                </div>
                            </motion.aside>

                            {/* MAP - Now separate from sidebar, below it */}
                            <motion.div
                                initial={{ opacity: 0, x: 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className={styles.mapContainer}
                            >
                                {/* Inline fallback height helps if your CSS isn't giving the map a height */}
                                <div
                                    className={styles.mapWrapper}
                                    style={{ minHeight: 280, height: 320 }}
                                >
                                    {/* key forces the Map to remount when coords/pulse.id changes */}
                                    <Map
                                        key={`${coords[0]}-${coords[1]}-${pulse.id}`}
                                        ref={mapRef}
                                        center={coords}
                                        zoom={16}
                                    >
                                        <MapMarker longitude={coords[0]} latitude={coords[1]}>
                                            <MarkerContent>
                                            </MarkerContent>
                                        </MapMarker>
                                    </Map>
                                </div>
                            </motion.div>

                            {/* CALENDAR - read-only view of unavailable periods */}
                            <motion.div
                                initial={{ opacity: 0, x: 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className={styles.calendarContainer}
                                style={{ marginTop: 18 }}
                            >
                                <h4 style={{ margin: "8px 0" }}>Availability / Unavailable periods</h4>

                                <FullCalendar
                                    key={calendarEvents.length}  // 👈 forces refresh when events change
                                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                    initialView="dayGridMonth"
                                    headerToolbar={{
                                        left: "prev,next today",
                                        center: "title",
                                        right: "dayGridMonth,timeGridWeek,timeGridDay",
                                    }}
                                    height="auto"
                                    events={calendarEvents}
                                    selectable={false}
                                    editable={false}
                                    eventClick={(info) => info.jsEvent.preventDefault()}
                                    selectMirror={false}
                                    dayMaxEventRows={true}

                                    // 👇 important for correct month behaviour
                                    eventDisplay="background"
                                />

                                {/* small legend */}
                                <div style={{ marginTop: 8, fontSize: 13 }}>
                                    <span style={{
                                        display: "inline-block",
                                        width: 12,
                                        height: 12,
                                        background: "rgba(255,70,70,0.6)",
                                        marginRight: 8,
                                        verticalAlign: "middle",
                                        borderRadius: 3,
                                        border: "1px solid rgba(255,70,70,0.9)"
                                    }} />
                                    <span>Unavailable</span>
                                </div>
                            </motion.div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}