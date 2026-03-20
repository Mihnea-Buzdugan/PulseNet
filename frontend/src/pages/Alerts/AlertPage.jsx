import React, {useCallback, useEffect, useRef, useState} from "react";
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
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState("");
    const [commentsPage, setCommentsPage] = useState(1);
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    const [imgIndex, setImgIndex] = useState(0);
    const [toast, setToast] = useState(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportDescription, setReportDescription] = useState("");
    const [commentText, setCommentText] = useState("");
    const carouselRef = useRef(null);

    const [confirmLoading, setConfirmLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    const COMMENTS_PAGE_SIZE = 10;

    const loadComments = useCallback(async (page = 1, append = false) => {
        setCommentsLoading(true);
        setCommentsError("");
        try {
            const res = await fetch(`http://localhost:8000/accounts/urgent-requests/comments/${id}/?page=${page}`, {
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
            const res = await fetch(`http://localhost:8000/accounts/urgent-requests/comments/${id}/`, {
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
            const res = await fetch(`http://localhost:8000/accounts/urgent-requests/comments/${commentId}/`, {
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
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
        <div className={styles.pageWrap}>

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
                            <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>Community Updates</span>

                                <button
                                    onClick={handleToggleComments}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        color: "#007bff",
                                    }}
                                >
                                    {showComments
                                        ? "Hide comments"
                                        : `Show comments${comments.length ? ` (${comments.length})` : ""}`}
                                </button>
                            </h3>

                            <form onSubmit={handlePostComment} className={styles.commentForm}>
                            <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Provide additional details or updates..."
                            disabled={isPosting}
                            />
                                <div className={styles.commentBtns}>
                                    <button
                                        type="submit"
                                        className={styles.postCommentBtn}
                                        disabled={isPosting || !commentText.trim()}
                                    >
                                        {isPosting ? "Posting..." : "Post Update"}
                                    </button>
                                </div>
                            </form>

                            {showComments && (
                                <div className={styles.commentsSection}>
                                    {commentsLoading && <div className={styles.commentsLoading}>Loading updates...</div>}
                                    {commentsError && <div className={styles.commentsError}>{commentsError}</div>}

                                    {!commentsLoading && comments.length === 0 && (
                                        <div className={styles.noComments}>
                                            No updates yet. Be the first to add details.
                                        </div>
                                    )}

                                    <div className={styles.commentList}>
                                        {comments.map((c) => (
                                            <div className={styles.comment} key={c.id}>
                                                <div className={styles.commentAvatar}>
                                                    {c.user?.[0] || c.user_username?.[0] || "U"}
                                                </div>

                                                <div className={styles.commentBody}>
                                                    <div className={styles.commentHeader}>
                                                        <strong>@{c.user || "user"}</strong>
                                                        <span className={styles.commentTime}>
              {c.created_at ? new Date(c.created_at).toLocaleString() : c.date || ""}
            </span>
                                                    </div>

                                                    <div className={styles.commentText}>
                                                        {c.text || c.content}
                                                    </div>

                                                    {c.can_delete && (
                                                        <button
                                                            onClick={() => handleDeleteComment(c.id)}
                                                            className={styles.deleteBtn}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {commentsHasMore && (
                                        <div className={styles.loadMoreWrap}>
                                            <button
                                                onClick={handleLoadMoreComments}
                                                disabled={commentsLoading}
                                                className={styles.loadMoreBtn}
                                            >
                                                {commentsLoading ? "Loading..." : "Load more"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
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
        </div>
    );
}