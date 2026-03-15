// src/components/UrgentRequests/UrgentRequests.jsx
import React, { useEffect, useState } from "react";
import styles from "../../styles/Requests/UrgentRequests.module.css";

function isoToLocal(iso) {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function UrgentRequests() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        let mounted = true;
        const fetchList = async () => {
            try {
                setLoading(true);
                const res = await fetch(
                    "http://localhost:8000/accounts/urgent-requests/",
                    { credentials: "include" }
                );
                const data = await res.json();
                if (!mounted) return;
                if (res.ok && data.success) {
                    setItems(data.urgent_requests || []);
                } else {
                    setError(data.error || "Failed to load urgent requests.");
                }
            } catch (err) {
                console.error(err);
                setError("Network error while loading urgent requests.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchList();
        return () => {
            mounted = false;
        };
    }, []);

    if (loading) return <div className={styles.loading}>Loading urgent requests…</div>;
    if (error) return <div className={styles.error}>{error}</div>;
    if (!items.length) return <div className={styles.empty}>No urgent requests found.</div>;

    return (
        <div className={styles.container}>
            {items.map((it) => {
                const isExpanded = expandedId === it.id;
                return (
                    <article
                        key={it.id}
                        className={`${styles.card} ${isExpanded ? styles.expanded : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : it.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") setExpandedId(isExpanded ? null : it.id);
                        }}
                    >
                        <header className={styles.cardHeader}>
                            <div>
                                <h3 className={styles.title}>
                                    {it.title || it.pulse_type || "Urgent request"}
                                </h3>
                                <div className={styles.meta}>
                                    <span className={styles.username}>@{it.user ?? "unknown"}</span>
                                    <span className={styles.sep}>•</span>
                                    <span className={styles.created}>{isoToLocal(it.created_at)}</span>
                                </div>
                            </div>

                            <div className={styles.right}>
                                {it.max_price ? <div className={styles.price}>{it.max_price} €</div> : null}
                                <div className={styles.chev}>{isExpanded ? "▴" : "▾"}</div>
                            </div>
                        </header>

                        <div className={styles.cardBody}>
                            <p className={styles.description}>{it.description || "No description provided."}</p>

                            {isExpanded && (
                                <div className={styles.details}>
                                    <div><strong>Category:</strong> {it.category || "—"}</div>
                                    <div><strong>Type:</strong> {it.pulse_type || "—"}</div>
                                    <div><strong>Radius:</strong> {it.radius_km} km</div>
                                    <div><strong>Created:</strong> {isoToLocal(it.created_at)}</div>
                                    <div><strong>Expires:</strong> {it.expires_at ? isoToLocal(it.expires_at) : "Never"}</div>
                                    <div>
                                        <strong>Location:</strong>{" "}
                                        {it.location
                                            ? `${it.location[1].toFixed(6)}°N, ${it.location[0].toFixed(6)}°E`
                                            : "Not specified"}
                                    </div>

                                    <div className={styles.actions}>
                                        <a
                                            href={`/transaction/new?urgent_request=${it.id}`}
                                            className={styles.actionBtn}
                                        >
                                            Respond / Create Pulse
                                        </a>
                                        <a href={`/user-profile/${it.user_id}`} className={styles.actionLink}>
                                            View requester
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}