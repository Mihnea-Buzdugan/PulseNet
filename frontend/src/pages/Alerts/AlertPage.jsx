import { useEffect, useRef, useState } from "react";
// IMPORTANT: You MUST import leaflet CSS for the map to render correctly
import "leaflet/dist/leaflet.css";
import Navbar from "@/components/Navbar";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../../styles/Alerts/AlertPage.module.css";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Circle,
    useMap
} from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import Loading from "../../components/Loading";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});


/* Recenter map on coords change */
function RecenterMap({ lat, lng }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) map.setView([lat, lng], 15, { animate: true });
    }, [lat, lng, map]);
    return null;
}

function getCookie(name) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

export default function AlertPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [alert, setAlert] = useState(null);
    const [loading, setLoading] = useState(true);

    // Comments only (persisted in localStorage per-alert)
    const [comments, setComments] = useState([]);

    const [imgIndex, setImgIndex] = useState(0);
    const [toast, setToast] = useState(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportDescription, setReportDescription] = useState("");
    const [commentText, setCommentText] = useState("");
    const carouselRef = useRef(null);

    const [confirmLoading, setConfirmLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    /* Load alert + comments */
    useEffect(() => {
        if (!id) return;
        setLoading(true);

        fetch(`http://localhost:8000/accounts/alerts/${id}/`,
            {
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
            })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    setAlert(data.alert);
                } else {
                    setToast({ type: "error", text: data.error || "Alert not found." });
                }
            })
            .catch((e) => {
                console.error(e);
                setToast({ type: "error", text: "Network error while loading alert details." });
            })
            .finally(() => setLoading(false));
    }, [id]);

    /* load comments for this alert from localStorage */
    useEffect(() => {
        if (!id) return;
        try {
            const raw = localStorage.getItem(`alert_comments_${id}`);
            if (raw) setComments(JSON.parse(raw));
        } catch (e) {
            console.warn("Could not load comments", e);
        }
    }, [id]);

    const saveComments = (next) => {
        try {
            localStorage.setItem(`alert_comments_${id}`, JSON.stringify(next));
        } catch (e) {
            console.warn("Could not save comments", e);
        }
    };

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    if (loading || !alert) return <Loading />;

    const counts = {
        confirms: alert.confirm_count || 0,
        reports: alert.report_count || 0,
        views: alert.views_count || 0
    };

    const images = alert.images && alert.images.length ? alert.images : ["/default-alert.jpg"];

    // Toggle confirm/unconfirm using the new API endpoints.
    const handleConfirm = async () => {
        if (confirmLoading) return;
        setConfirmLoading(true);

        const currentlyConfirmed = !!alert.is_confirmed;
        const endpoint = `http://localhost:8000/accounts/alerts/${id}/${currentlyConfirmed ? "unconfirm" : "confirm"}/`;

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: null
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data && data.success) {
                const newCount = typeof data.confirm_count === "number"
                    ? data.confirm_count
                    : (currentlyConfirmed ? Math.max(0, alert.confirm_count - 1) : alert.confirm_count + 1);

                setAlert(prev => ({ ...prev, confirm_count: newCount, is_confirmed: !currentlyConfirmed }));
                setToast({ type: "success", text: currentlyConfirmed ? "Confirmation removed." : "Alert confirmed." });
            } else {
                const message = (data && (data.message || data.error)) || "Could not confirm (server error).";
                setToast({ type: "error", text: message });
            }
        } catch (e) {
            console.error("Network error confirming/unconfirming:", e);
            setToast({ type: "error", text: "Network error confirming alert." });
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleReportOpen = () => setReportModalOpen(true);

    // use the server report endpoint
    const submitReport = async () => {
        if (!reportReason) return setToast({ type: "error", text: "Choose a reason first." });

        if (reportLoading) return;
        setReportLoading(true);

        try {
            const res = await fetch(`http://localhost:8000/accounts/alerts/${id}/report/`, {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: JSON.stringify({ reason: reportReason, description: reportDescription || "" })
            });

            const data = await res.json().catch(() => null);

            // Optimistically update count


            if (res.ok && data && data.success) {
                setAlert(prev => ({
                    ...prev,
                    report_count: (prev.report_count  + 1)
                }));
                setReportModalOpen(false);
                setReportDescription("");
                setReportReason("");
                setToast({ type: "success", text: "Alert reported." });
            } else {
                const message = (data && (data.message || data.error)) || "Could not report (server error).";
                setToast({ type: "error", text: message });
            }
        } catch (e) {
            console.error("Network error reporting:", e);
            // still increment locally so the user sees change
            setAlert(prev => ({ ...prev, report_count: (prev.report_count ?? 0) + 1 }));
            setToast({ type: "error", text: "Network error reporting alert." });
        } finally {
            setReportLoading(false);
            setReportModalOpen(false);
            setReportReason("");
        }
    };

    const submitComment = (e) => {
        e.preventDefault();
        if (!commentText.trim()) return setToast({ type: "error", text: "Write something first." });

        const newComment = {
            id: `local-${Date.now()}`,
            user_name: "You (local)",
            text: commentText.trim(),
            created_at: new Date().toISOString()
        };

        const next = [newComment, ...comments];
        setComments(next);
        saveComments(next);
        setCommentText("");
        setToast({ type: "success", text: "Comment saved locally." });
    };

    const openInMaps = () => {
        if (!alert.lat || !alert.lng) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${alert.lat},${alert.lng}`;
        window.open(url, "_blank");
    };

    const nextImage = (e) => {
        e.stopPropagation();
        setImgIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e) => {
        e.stopPropagation();
        setImgIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const goToImage = (i) => {
        setImgIndex(i);
        carouselRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const related = alert.related || [];

    return (
        <div className={styles.pageWrap}>
            <Navbar />

            <div className={styles.container}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <span className={styles.arrow}>←</span> Back to Alerts
                </button>

                <div className={styles.headerCard}>
                    <div className={styles.headerLeft}>
                        <div className={styles.badgeContainer}>
                            <span className={styles.badge}>{alert.category_display || "General"}</span>
                            <span className={styles.time}>
                                {new Intl.DateTimeFormat('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                }).format(new Date(alert.created_at))}
                            </span>
                        </div>
                        <h1 className={styles.title}>{alert.title}</h1>
                        <span className={styles.postedBy}>Reported by <span className={styles.highlightedUser}>@{alert.user}</span></span>

                        <p className={styles.excerpt}>{alert.description}</p>

                        <div className={styles.actionRow}>
                            <button
                                className={`${styles.actionBtn} ${styles.confirmBtn}`}
                                onClick={handleConfirm}
                                disabled={confirmLoading}
                                aria-pressed={!!alert.is_confirmed}
                            >
                                {alert.is_confirmed ? "✅ Confirmed" : "✅ Confirm"} <span className={styles.count}>{counts.confirms}</span>
                            </button>

                            <button
                                className={`${styles.actionBtn} ${styles.reportBtn}`}
                                onClick={handleReportOpen}
                                disabled={reportLoading}
                            >
                                ⚠️ Report <span className={styles.count}>{counts.reports}</span>
                            </button>

                            <button className={`${styles.actionBtn} ${styles.mapBtn}`} onClick={openInMaps}>📍 Open in Maps</button>
                        </div>
                    </div>

                    <div className={styles.headerRight}>
                        <div className={styles.imagePanel} ref={carouselRef}>
                            <div className={styles.carouselViewport}>
                                <img
                                    src={images[imgIndex]}
                                    alt="alert"
                                    className={styles.mainImage}
                                    key={imgIndex}
                                />

                                {images.length > 1 && (
                                    <>
                                        <button className={styles.navBtnPrev} onClick={prevImage}>‹</button>
                                        <button className={styles.navBtnNext} onClick={nextImage}>›</button>
                                        <div className={styles.imageCountBadge}>
                                            {imgIndex + 1} / {images.length}
                                        </div>
                                    </>
                                )}
                            </div>

                            {images.length > 1 && (
                                <div className={styles.thumbnailRow}>
                                    {images.map((src, i) => (
                                        <img
                                            key={i}
                                            src={src}
                                            className={`${styles.thumb} ${i === imgIndex ? styles.thumbActive : ""}`}
                                            onClick={() => setImgIndex(i)}
                                            alt={`thumb-${i}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.statsCard}>
                            <div className={styles.statBox}><strong>{counts.confirms}</strong><div className={styles.statLabel}>Confirms</div></div>
                            <div className={styles.statBox}><strong>{counts.reports}</strong><div className={styles.statLabel}>Reports</div></div>
                            <div className={styles.statBox}><strong>{counts.views}</strong><div className={styles.statLabel}>Views</div></div>
                        </div>
                    </div>
                </div>

                <div className={styles.contentGrid}>
                    <div className={styles.mainColumn}>
                        <div className={styles.mapSection}>
                            <h3>Incident Location</h3>
                            <div className={styles.mapWrap}>
                                {alert.lat && alert.lng ? (
                                    <MapContainer center={[alert.lat, alert.lng]} zoom={15} className={styles.map} style={{ height: "400px", width: "100%", zIndex: 0 }}>
                                        <RecenterMap lat={alert.lat} lng={alert.lng} />
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                        <Marker position={[alert.lat, alert.lng]}>
                                            <Popup>{alert.title} <br /> @{alert.user}</Popup>
                                        </Marker>
                                        <Circle center={[alert.lat, alert.lng]} radius={40} pathOptions={{ color: "#3b82f6", fillOpacity: 0.2 }} />
                                    </MapContainer>
                                ) : (
                                    <div className={styles.noMap}>No location provided for this alert.</div>
                                )}
                            </div>
                        </div>

                        <div className={styles.commentsWrap}>
                            <h3>Community Updates</h3>
                            <form onSubmit={submitComment} className={styles.commentForm}>
                                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Provide additional details or updates..." />
                                <div className={styles.commentBtns}>
                                    <button type="submit" className={styles.postCommentBtn}>Post Update</button>
                                </div>
                            </form>

                            <div className={styles.commentList}>
                                {comments && comments.length ? comments.map(c => (
                                    <div className={styles.comment} key={c.id}>
                                        <div className={styles.commentAvatar}>{c.user_name?.[0] || "U"}</div>
                                        <div className={styles.commentBody}>
                                            <div className={styles.commentHeader}>
                                                <strong>@{c.user_name}</strong>
                                                <span className={styles.commentTime}>{new Date(c.created_at).toLocaleString()}</span>
                                            </div>
                                            <div className={styles.commentText}>{c.text}</div>
                                        </div>
                                    </div>
                                )) : <div className={styles.noComments}>No updates yet. Be the first to add details.</div>}
                            </div>
                        </div>
                    </div>

                    <div className={styles.sideColumn}>
                        <div className={styles.detailPanel}>
                            <h3>Alert Details</h3>
                            <dl className={styles.detailsList}>
                                <div className={styles.detailItem}>
                                    <dt>Category</dt>
                                    <dd>{alert.category_display || "Uncategorized"}</dd>
                                </div>
                                <div
                                    className={styles.detailItem}
                                    onClick={() => {navigate(`/user-profile/${alert.user_id}`);}}
                                    style={{ cursor: "pointer" }}
                                >
                                    <dt>Reporter</dt>
                                    <dd>@{alert.user}</dd>
                                </div>
                                <div className={styles.detailItem}>
                                    <dt>Coordinates</dt>
                                    <dd>{alert.lat ? `${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}` : "N/A"}</dd>
                                </div>
                            </dl>
                        </div>

                        {related.length > 0 && (
                            <div className={styles.relatedPanel}>
                                <h4>Related Alerts</h4>
                                <div className={styles.relatedList}>
                                    {related.map(r => (
                                        <div key={r.id} className={styles.relatedItem} onClick={() => navigate(`/alerts/${r.id}`)}>
                                            <div className={styles.relatedTitle}>{r.title}</div>
                                            <div className={styles.relatedMeta}>{r.category_display} • {new Date(r.created_at).toLocaleDateString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {reportModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setReportModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3>Report Alert</h3>
                        <p>Why are you reporting this alert?</p>
                        <select
                            className={styles.selectInput}
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                        >
                            <option value="">Select reason…</option>
                            <option value="false_info">False information</option>
                            <option value="duplicate">Duplicate</option>
                            <option value="irrelevant">Irrelevant / Spam</option>
                            <option value="safety_concern">Safety concern</option>
                            <option value="other">Other</option>
                        </select>


                            <textarea
                                className={styles.textareaInput}
                                placeholder="Provide a description..."
                                value={reportDescription}
                                onChange={(e) => setReportDescription(e.target.value)}
                            />


                        <div className={styles.modalActions}>
                            <button className={styles.cancelReport} onClick={() => setReportModalOpen(false)}>Cancel</button>
                            <button
                                className={styles.confirmReportBtn}
                                onClick={submitReport}
                                disabled={reportLoading}
                            >
                                {reportLoading ? "Reporting…" : "Submit Report"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`${styles.toast} ${styles[toast.type]}`}>
                    {toast.text}
                </div>
            )}
        </div>
    );
}