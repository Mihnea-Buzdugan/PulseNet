import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, MessageSquare, Star, Send } from "lucide-react";
import styles from "../../styles/Pulses_pages/pulseDetails.module.css";
import Navbar from "../../components/Navbar";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import "maplibre-gl/dist/maplibre-gl.css";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Loading from "@/components/Loading";
import Footer from "@/components/Footer";

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
    const defaultCoords = [27.5766, 47.1585];
    if (!location) return defaultCoords;
    if (Array.isArray(location)) return location;
    if (location.coordinates) return location.coordinates;
    return defaultCoords;
}

function getCookie(name) {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie ? document.cookie.split(";") : [];
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + "=")) {
            return decodeURIComponent(cookie.substring(name.length + 1));
        }
    }
    return null;
}

function getMapInstance(candidate) {
    if (!candidate) return null;
    if (typeof candidate.getMap === "function") {
        try { return candidate.getMap(); } catch (e) {}
    }
    if (candidate.mapInstance) return candidate.mapInstance;
    if (candidate.map) return candidate.map;
    return typeof candidate.resize === "function" ? candidate : null;
}

// Convert a backend UTC timestamp (ISO) into a local YYYY-MM-DD string
// so FullCalendar treats it as an all-day event in the user's timezone.
function utcIsoToLocalDateString(isoOrDate) {
    const d = new Date(isoOrDate);
    // Shift by timezone offset to get the equivalent local date
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
}

// Convert ISO timestamp to local human-readable string (for UI timestamps)
const isoToLocalString = (isoString) => {
    if (!isoString) return "N/A";
    const date = new Date(isoString);

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
};

export default function PulseDetails() {
    const { type, id } = useParams();
    const navigate = useNavigate();

    const [pulse, setPulse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [index, setIndex] = useState(0);
    const [favAnim, setFavAnim] = useState(false);
    const mapRef = useRef(null);

    // rating states
    const [userRating, setUserRating] = useState(0); // will be initialized from backend when available
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);

    // comments/reviews
    const [commentText, setCommentText] = useState("");
    const [calendarEvents, setCalendarEvents] = useState([]);

    // ---------- Comments (lazy) ----------
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState("");
    const [commentsPage, setCommentsPage] = useState(1);
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    // local reviews state (for immediate UI preview)
    const [formattedAddress, setFormattedAddress] = useState("Loading address...");

    const COMMENTS_PAGE_SIZE = 10;

    const loadComments = useCallback(async (page = 1, append = false) => {
        setCommentsLoading(true);
        setCommentsError("");
        try {
            const res = await fetch(`http://localhost:8000/accounts/pulse/comments/${id}/?page=${page}`, {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load comments");
            const newComments = Array.isArray(data.comments) ? data.comments : (data.data || []);
            if (append) setComments(prev => [...prev, ...newComments]);
            else setComments(newComments);

            if (typeof data.next !== "undefined") setCommentsHasMore(!!data.next);
            else if (typeof data.has_more !== "undefined") setCommentsHasMore(!!data.has_more);
            else setCommentsHasMore(newComments.length === COMMENTS_PAGE_SIZE);

            setCommentsPage(page);
        } catch (err) {
            console.error("Comments load error:", err);
            setCommentsError(err.message || "Error loading comments");
        } finally {
            setCommentsLoading(false);
        }
    }, [id]);

    const handleToggleComments = () => {
        const willShow = !showComments;
        setShowComments(willShow);
        if (willShow && comments.length === 0) loadComments(1, false);
    };

    const handleLoadMoreComments = () => {
        if (commentsLoading) return;
        loadComments(commentsPage + 1, true);
    };

    // POST a new comment to backend and prepend it
    const handlePostComment = async (e) => {
        e.preventDefault();
        const text = (e?.target?.elements?.comment?.value ?? commentText).trim();
        if (!text) return;
        const csrftoken = getCookie("csrftoken");
        setIsPosting(true);
        setCommentsError("");
        try {
            const res = await fetch(`http://localhost:8000/accounts/pulse/comments/${id}/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                    "Accept": "application/json",
                },
                body: JSON.stringify({ content: text }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = (data && (data.error || data.message)) || `Failed to post comment (status ${res.status})`;
                throw new Error(msg);
            }

            const created = (data && (data.comment || data)) || null;
            const fallback = {
                id: created?.id ?? `tmp-${Date.now()}`,
                user: created?.user ?? (created?.user_username ?? "You"),
                user_id: created?.user_id ?? null,
                avatar: created?.avatar ?? null,
                content: created?.content ?? text,
                date: created?.date ?? new Date().toISOString(),
                can_delete: created?.can_delete ?? true,
            };

            setComments(prev => [created || fallback, ...prev]);
            setCommentText("");
            setShowComments(true);
        } catch (err) {
            console.error("Post comment error:", err);
            setCommentsError(err.message || "Could not post comment");
        } finally {
            setIsPosting(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        const csrftoken = getCookie("csrftoken");
        try {
            const res = await fetch(`http://localhost:8000/accounts/pulse/comments/${commentId}/`, {
                method: "DELETE",
                credentials: "include",
                headers: { "X-CSRFToken": csrftoken },
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to delete comment");
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (err) {
            console.error("Delete comment error:", err);
            alert(err.message || "Could not delete comment");
        }
    };
    // ---------- end comments ----------

    // ---------- Rating: submit handler (separate, not inline) ----------
    const handleSubmitRating = async () => {
        if (!userRating || userRating < 1 || userRating > 10) {
            alert("Please select a rating between 1 and 10.");
            return;
        }
        const csrftoken = getCookie("csrftoken");
        setIsSubmittingRating(true);
        try {
            const res = await fetch(`http://localhost:8000/accounts/pulse/ratings/${id}/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                    "Accept": "application/json",
                },
                body: JSON.stringify({ rating: userRating }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                const message = (data && (data.error || data.message)) || `Failed to submit rating (status ${res.status})`;
                throw new Error(message);
            }

            // update local pulse info if backend returned rating
            if (data.rating !== undefined) {
                setPulse(prev => prev ? ({ ...prev, my_rating: data.rating }) : prev);
            }
            alert(`Thanks — you rated ${userRating}/10.`);
        } catch (err) {
            console.error("Submit rating error:", err);
            alert(err.message || "Could not submit rating");
        } finally {
            setIsSubmittingRating(false);
        }
    };
    // ---------- end rating ----------

    useEffect(() => {
        let mounted = true;
        const csrfToken = getCookie("csrftoken");

        fetch(`http://localhost:8000/accounts/pulse/${id}/`, {
            method: "GET",
            credentials: "include",
            headers: { "X-CSRFToken": csrfToken },
        })
            .then(res => res.json())
            .then(data => {
                if (!mounted) return;
                if (data.success) {
                    setPulse(data.pulse);
                    setIndex(0);

                    // initialize userRating from backend even if it's 0
                    const backendRating = (data.pulse?.user_rating ?? data.pulse?.my_rating);
                    if (backendRating !== undefined && backendRating !== null) {
                        setUserRating(backendRating);
                    }
                } else {
                    setError(data.error || "Not found");
                }
            })
            .catch(() => setError("Server error"))
            .finally(() => mounted && setLoading(false));

        return () => (mounted = false);
    }, [id]);

    useEffect(() => {
        const getDetailedAddress = async () => {
            if (!pulse?.location) return;

            // Get coords regardless of format (Array or GeoJSON)
            const coords = getLocationCoords(pulse.location);
            const [lng, lat] = coords;

            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
                    {
                        headers: {
                            'Accept-Language': 'en',
                            'User-Agent': 'YourApp/1.0'
                        }
                    }
                );

                if (!res.ok) throw new Error();

                const data = await res.json();
                const addr = data.address;

                // Extract the fields you wanted
                const street = addr.road || "";
                const houseNumber = addr.house_number || "";
                const city = addr.city || addr.town || addr.village || "";

                const fullString = [street, houseNumber, city].filter(Boolean).join(", ");
                setFormattedAddress(fullString || "Location found");
            } catch (err) {
                console.error("Geocoding error:", err);
                // Fallback to coordinates if API fails
                setFormattedAddress(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
            }
        };

        getDetailedAddress();
    }, [pulse?.location]);



    // === TIMEZONE-FIXED: convert backend UTC ranges to local all-day events ===
    useEffect(() => {
        if (!pulse) {
            setCalendarEvents([]);
            return;
        }

        const ranges = pulse.unavailable_ranges ?? pulse.reserved_periods ?? [];

        const events = ranges
            .map((r, i) => {
                const startRaw = r.start ?? r.start_date;
                const endRaw = r.end ?? r.end_date;
                if (!startRaw || !endRaw) return null;

                // Convert backend UTC ISO -> local YYYY-MM-DD
                const startLocalDate = utcIsoToLocalDateString(startRaw);

                // Convert end to local, then add 1 day
                const endDate = new Date(endRaw);
                endDate.setDate(endDate.getDate() + 1); // add 1 day
                const endLocalDate = utcIsoToLocalDateString(endDate.toISOString());

                return {
                    id: `unav-${i}`,
                    start: startLocalDate,
                    end: endLocalDate, // FullCalendar end is exclusive
                    allDay: true,
                    display: "background",
                    backgroundColor: "rgba(255,70,70,0.35)",
                    borderColor: "rgba(255,70,70,0.6)",
                    extendedProps: { source: "backend" },
                };
            })
            .filter(Boolean);

        setCalendarEvents(events);
    }, [pulse]);

    useEffect(() => {
        if (!pulse) return;
        const coords = getLocationCoords(pulse.location);
        let mounted = true;
        const ensureMapReady = async () => {
            await new Promise(r => setTimeout(r, 250));
            let mapInst = getMapInstance(mapRef.current);
            const start = Date.now();
            while (!mapInst && Date.now() - start < 2000 && mounted) {
                await new Promise(r => setTimeout(r, 150));
                mapInst = getMapInstance(mapRef.current);
            }
            if (!mounted) return;
            if (mapInst) {
                try {
                    if (typeof mapInst.resize === "function") mapInst.resize();
                    if (typeof mapInst.setCenter === "function") mapInst.setCenter([coords[0], coords[1]]);
                    if (typeof mapInst.setZoom === "function") mapInst.setZoom(16);
                } catch (err) { window.dispatchEvent(new Event("resize")); }
            }
        };
        ensureMapReady();
        return () => { mounted = false; };
    }, [pulse]);

    const images = useMemo(() => (pulse && pulse.images ? pulse.images : []), [pulse]);
    const next = () => { if (images.length) setIndex(i => (i + 1) % images.length); };
    const prev = () => { if (images.length) setIndex(i => (i - 1 + images.length) % images.length); };

    const handleFavorite = async () => {
        if (!pulse) return;
        setFavAnim(true);
        try {
            const csrfToken = getCookie("csrftoken");
            const response = await fetch(`http://localhost:8000/accounts/add_to_favorites/${pulse.id}/`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
            });
            const data = await response.json().catch(() => null);
            if (response.ok && data?.success) setPulse(prev => ({ ...prev, is_favorite: true }));
        } catch (err) { console.error("Favorite error:", err); }
        setTimeout(() => setFavAnim(false), 350);
    };

    const delete_favorite = async () => {
        if (!pulse) return;
        try {
            const csrfToken = getCookie("csrftoken");
            const response = await fetch(`http://localhost:8000/accounts/delete_from_favorites/${pulse.id}/`, {
                method: "DELETE",
                credentials: "include",
                headers: { "X-CSRFToken": csrfToken },
            });
            const data = await response.json().catch(() => null);
            if (response.ok && data?.success) setPulse(prev => ({ ...prev, is_favorite: false }));
        } catch (err) { console.error("Delete favorite error:", err); }
    };

    if (loading) return <Loading />
    if (error) return <div className={styles.errorBox}><h2>{error}</h2><button onClick={() => navigate(-1)}>Go Back</button></div>;
    if (!pulse) return null;

    const coords = getLocationCoords(pulse.location);
    const isService = type === "servicii";

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />
                {pulse.trustLevel === "Dangerous" || pulse.trustLevel === "Scary" ? (
                    <div className="bg-red-600 text-white px-4 py-2 rounded-md mb-4 flex items-center gap-2 shadow-md">
                        <span>⚠️</span>
                        <span>
            Warning: This user has a low trust score.
            Interact with caution.
        </span>
                    </div>
                ) : null}
                <div className={styles.page}>
                    <div className={styles.container}>
                        {/* LEFT SIDE */}
                        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className={styles.left}>
                            <div className={styles.header}>
                                {pulse.user_avatar ? (
                                    <img src={pulse.user_avatar} alt="avatar" className={styles.avatar} />
                                ) : (
                                    <div className={styles.avatarPlaceholder}>{pulse.user?.[0] ?? '?'}</div>
                                )}
                                <div>
                                    <div className={styles.username}>{pulse.user}</div>
                                    <div className={styles.timestamp}>{isoToLocalString(pulse.timestamp)}</div>
                                </div>
                            </div>

                            <h1 className={styles.title}>{pulse.name}</h1>
                            <p className={styles.description}>{pulse.description}</p>

                            <div className={styles.badges}>
                                <div className={styles.typeBadge}>{isService ? "Serviciu" : "Obiect"}</div>
                                <div className={styles.priceBadge}>{pulse.price} {pulse.currency}</div>
                            </div>

                            {/* IMAGE CAROUSEL */}
                            <div className={styles.carousel}>
                                {images.length > 0 ? (
                                    <>
                                        <img src={images[index]} className={styles.mainImage} alt="" />
                                        <button onClick={prev} className={styles.navLeft}><ArrowLeft size={20} /></button>
                                        <button onClick={next} className={styles.navRight}><ArrowRight size={20} /></button>
                                        <div className={styles.thumbs}>
                                            {images.map((img, i) => (
                                                <img key={i} src={img} onClick={() => setIndex(i)}
                                                     className={`${styles.thumb} ${i === index ? styles.activeThumb : ""}`} alt="" />
                                            ))}
                                        </div>
                                    </>
                                ) : <div className={styles.noImage}>No images</div>}
                            </div>

                            {/* INFO GRID */}
                            <div className={styles.infoGrid}>
                                <div><span>Posted</span><strong>{isoToLocalString(pulse.timestamp)}</strong></div>
                                <div><span>Location</span><strong>{formattedAddress}</strong></div>
                                <div><span>Condition</span><strong>{pulse.condition || "N/A"}</strong></div>
                            </div>

                            {/* --- RATING & COMMENT SECTION (1-10 Scale) --- */}
                            <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                                <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Recenzii și Rating</span>
                                    <button onClick={handleToggleComments} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#007bff' }}>
                                        {showComments ? "Hide comments" : `Show comments${pulse.comments_count ? ` (${pulse.comments_count})` : ""}`}
                                    </button>
                                </h3>

                                {/* 1-10 Star Picker + Submit Rating */}
                                <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                    <p style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600' }}>
                                        Acordă o notă (1-10): {userRating > 0 ? userRating : ''}
                                    </p>

                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '15px' }}>
                                        {[...Array(10)].map((_, i) => {
                                            const ratingValue = i + 1;
                                            return (
                                                <Star
                                                    key={ratingValue}
                                                    size={22}
                                                    style={{ cursor: 'pointer', transition: '0.2s' }}
                                                    fill={ratingValue <= (hoverRating || userRating) ? "#FFC107" : "none"}
                                                    stroke={ratingValue <= (hoverRating || userRating) ? "#FFC107" : "#ccc"}
                                                    onMouseEnter={() => setHoverRating(ratingValue)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    onClick={() => setUserRating(ratingValue)}
                                                />
                                            );
                                        })}
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button
                                            onClick={handleSubmitRating}
                                            disabled={isSubmittingRating || userRating === 0}
                                            style={{
                                                background: isSubmittingRating || userRating === 0 ? '#9bb8ff' : '#007bff',
                                                color: 'white',
                                                border: 'none',
                                                padding: '10px 15px',
                                                borderRadius: '8px',
                                                cursor: isSubmittingRating || userRating === 0 ? 'default' : 'pointer'
                                            }}
                                        >
                                            {isSubmittingRating ? "Submitting..." : "Submit Rating"}
                                        </button>

                                        <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px', flex: 1 }}>
                                            <input
                                                type="text"
                                                name="comment"
                                                placeholder="Adaugă un comentariu..."
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
                                                disabled={isPosting}
                                            />
                                            <button
                                                type="submit"
                                                disabled={isPosting}
                                                style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: isPosting ? 'default' : 'pointer' }}
                                            >
                                                <Send size={18} />
                                            </button>
                                        </form>
                                    </div>
                                </div>

                                {/* ------- Comments (lazy-loaded from backend) ------- */}
                                {showComments && (
                                    <div className={styles.commentsSection}>
                                        {commentsLoading && (
                                            <div className={styles.commentsLoading}>Loading comments...</div>
                                        )}

                                        {commentsError && (
                                            <div className={styles.commentsError}>{commentsError}</div>
                                        )}

                                        {!commentsLoading && comments.length === 0 && (
                                            <div className={styles.commentsEmpty}>No comments yet.</div>
                                        )}

                                        <div className={styles.commentsContainer}>
                                            {comments.map((c) => (
                                                <div
                                                    key={c.id || `${c.user}-${c.pub_date}`}
                                                    className={styles.commentsBox}
                                                >
                                                    <div className={styles.commentsHeader}>
                                                        <strong className={styles.commentsUser}>
                                                            {c.user || (c.user_username ?? c.user_name)}
                                                        </strong>
                                                        <small className={styles.commentsDate}>
                                                            {c.date ?? c.pub_date ?? ""}
                                                        </small>
                                                    </div>

                                                    <p className={styles.commentsContent}>{c.content}</p>

                                                    {c.can_delete && (
                                                        <button
                                                            className={styles.commentsDeleteBtn}
                                                            onClick={() => handleDeleteComment(c.id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {commentsHasMore && (
                                            <div className={styles.commentsLoadMoreWrap}>
                                                <button
                                                    onClick={handleLoadMoreComments}
                                                    disabled={commentsLoading}
                                                    className={styles.commentsLoadMoreBtn}
                                                >
                                                    {commentsLoading ? "Loading..." : "Load more"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* ------- end comments ------- */}
                            </div>
                        </motion.div>

                        {/* RIGHT COLUMN */}
                        <div className={styles.rightColumn}>
                            <motion.aside initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className={styles.sidebar}>
                                <div className={styles.sellerCard}>
                                    <h3>Seller</h3>
                                    <p>{pulse.user}</p>
                                    <div>
                                        <button className={styles.contactBtn} onClick={(e) => { e.stopPropagation(); navigate(`/direct-chat/${pulse.user_id}`, {
                                            state: {
                                                fromPulse: true,
                                            }
                                        }); }}>
                                            <MessageSquare size={16} /> Contact
                                        </button>
                                        <button onClick={() => { pulse.is_favorite ? delete_favorite() : handleFavorite(); }}
                                                className={`${styles.favoriteBtn} ${pulse.is_favorite ? styles.favoriteActive : styles.favoriteInactive} ${favAnim ? styles.favActive : ""}`}>
                                            <Heart size={16} fill={pulse.is_favorite ? "currentColor" : "none"} />
                                            {pulse.is_favorite ? "Favorited" : "Favorite"}
                                        </button>
                                    </div>
                                    {(pulse.has_trust_access || !pulse.trustRequired) ? (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => navigate(`/transaction/${pulse.id}`)}
                                        >
                                            {isService ? "Book Service" : "Lend Item"}
                                        </button>
                                    ) : (
                                        <div className={styles.lockedNotice}>
                                            🔒 You need a verified account with enough trust to access this
                                        </div>
                                    )}
                                </div>
                            </motion.aside>

                            {/* MAP */}
                            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className={styles.mapContainer}>
                                <div className={styles.mapWrapper} style={{ minHeight: 280, height: 320 }}>
                                    <Map key={`${coords[0]}-${coords[1]}-${pulse.id}`} ref={mapRef} center={coords} zoom={16}>
                                        <MapMarker longitude={coords[0]} latitude={coords[1]}>
                                            <MarkerContent />
                                        </MapMarker>
                                    </Map>
                                </div>
                            </motion.div>

                            {/* CALENDAR */}
                            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className={styles.calendarContainer} style={{ marginTop: 18 }}>
                                <h4 style={{ margin: "8px 0" }}>Availability</h4>
                                <FullCalendar
                                    key={calendarEvents.length}
                                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                    initialView="dayGridMonth"
                                    headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth" }}
                                    height="auto"
                                    events={calendarEvents}
                                    display="background"
                                />
                                <div style={{ marginTop: 8, fontSize: 13 }}>
                                    <span style={{ display: "inline-block", width: 12, height: 12, background: "rgba(255,70,70,0.6)", marginRight: 8, verticalAlign: "middle", borderRadius: 3 }} />
                                    <span>Unavailable</span>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
