import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {ArrowLeft, ArrowRight, LockKeyhole, MessageSquare, Send} from "lucide-react";
import styles from "../../styles/Pulses_pages/pulseDetails.module.css";
import Navbar from "../../components/Navbar";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import "maplibre-gl/dist/maplibre-gl.css";
import Loading from "@/components/Loading";
import Footer from "@/components/Footer";


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

function utcIsoToLocalDateString(isoOrDate) {
    const d = new Date(isoOrDate);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
}

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

export default function RequestDetails() {
    const {  id } = useParams();
    const navigate = useNavigate();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [index, setIndex] = useState(0);
    const mapRef = useRef(null);


    const [commentText, setCommentText] = useState("");


    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState("");
    const [commentsPage, setCommentsPage] = useState(1);
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const [isPosting, setIsPosting] = useState(false);



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
        let mounted = true;
        const csrfToken = getCookie("csrftoken");

        fetch(`http://localhost:8000/accounts/urgent-request/${id}/`, {
            method: "GET",
            credentials: "include",
            headers: { "X-CSRFToken": csrfToken },
        })
            .then(res => res.json())
            .then(data => {
                if (!mounted) return;
                if (data.success) {
                    setRequest(data.request);
                    setIndex(0);
                } else {
                    setError(data.error || "Not found");
                }
            })
            .catch(() => setError("Server error"))
            .finally(() => mounted && setLoading(false));

        return () => (mounted = false);
    }, [id]);

    useEffect(() => {
        if (!request) return;
        let mounted = true;

        const ensureMapReady = async () => {
            await new Promise(r => setTimeout(r, 250));
            let mapInst = getMapInstance(mapRef.current);
            if (mapInst && mounted) {
                try {
                    mapInst.resize();
                    mapInst.setCenter([coords[0], coords[1]]);
                    mapInst.setZoom(16);
                } catch (err) { window.dispatchEvent(new Event("resize")); }
            }
        };
        ensureMapReady();
        return () => { mounted = false; };
    }, [request]);

    const coords = useMemo(() => getLocationCoords(request?.location), [request]);
    const images = useMemo(() => (request && request.images ? request.images : []), [request]);
    const next = () => { if (images.length) setIndex(i => (i + 1) % images.length); };
    const prev = () => { if (images.length) setIndex(i => (i - 1 + images.length) % images.length); };

    if (loading) return <Loading />
    if (error) return <div className={styles.errorBox}><h2>{error}</h2><button onClick={() => navigate(-1)}>Go Back</button></div>;
    if (!request) return null;

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />

                {request.trustLevel === "Dangerous" || request.trustLevel === "Scary" ? (
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

                        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className={styles.left}>
                            <div className={styles.header}>
                                {request.user_avatar ? (
                                    <img src={request.user_avatar} alt="avatar" className={styles.avatar} />
                                ) : (
                                    <div className={styles.avatarPlaceholder}>{request.user?.[0] ?? '?'}</div>
                                )}
                                <div>
                                    <div className={styles.username}>{request.user}</div>
                                    <div className={styles.timestamp}>{isoToLocalString(request.timestamp)}</div>
                                </div>
                            </div>

                            <h1 className={styles.title}>{request.title}</h1>
                            <p className={styles.description}>{request.description}</p>

                            <div className={styles.badges}>
                                <div className={styles.priceBadge}>
                                    Max Price: {request.max_price} {request.currency}
                                </div>
                            </div>


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
                                ) : <div className={styles.noImage}>No preview</div>}
                            </div>


                            <div className={styles.infoGrid}>
                                <div><span>Posted</span><strong>{isoToLocalString(request.timestamp)}</strong></div>
                                <div><span>Location</span><strong>{request.address}</strong></div>
                                <div><span>Available until</span><strong>{isoToLocalString(request.expires_at)}</strong></div>
                            </div>


                            <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                                <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Recenzii</span>
                                    <button onClick={handleToggleComments} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#3B82A6' }}>
                                        {showComments ? "Hide comments" : `Show comments${request.comments_count ? ` (${request.comments_count})` : ""}`}
                                    </button>
                                </h3>


                                <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>

                                    <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px', flex: 1 }}>
                                        <input
                                            type="text"
                                            name="comment"
                                            placeholder="Submit a comment..."
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            className={styles.commentInput}
                                            disabled={isPosting}
                                        />
                                        <button
                                            type="submit"
                                            disabled={isPosting}
                                            className={styles.sendButton}
                                        >
                                            <Send size={18} />
                                        </button>
                                    </form>
                                </div>


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

                            </div>
                        </motion.div>

                        <div className={styles.rightColumn}>
                            <motion.aside initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className={styles.sidebar}>
                                <div className={styles.sellerCard}>
                                    <h3>Seller</h3>
                                    <p>{request.user}</p>
                                    <div>
                                        <button className={styles.contactBtn} onClick={(e) => { e.stopPropagation(); navigate(`/direct-chat/${request.user_id}`, {
                                            state: {
                                                fromPulse: true,
                                            }
                                        }); }}>
                                            <MessageSquare size={16} /> Contact
                                        </button>
                                    </div>
                                    {(request.has_trust_access || !request.trustRequired) ? (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => navigate(`/offer/${request.id}`)}
                                        >
                                            Propose offer
                                        </button>
                                    ) : (
                                        <div className={styles.lockedNotice}>
                                            <LockKeyhole color='#D5B60A' size={25} strokeWidth={2.5}/>You need a verified account with enough trust to access this
                                        </div>
                                    )}
                                </div>
                            </motion.aside>


                            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className={styles.mapContainer}>
                                <div className={styles.mapWrapper} style={{ minHeight: 280, height: 320 }}>
                                    <Map key={`${coords[0]}-${coords[1]}-${request.id}`} ref={mapRef} center={coords} zoom={16}>
                                        <MapMarker longitude={coords[0]} latitude={coords[1]}>
                                            <MarkerContent />
                                        </MapMarker>
                                    </Map>
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
