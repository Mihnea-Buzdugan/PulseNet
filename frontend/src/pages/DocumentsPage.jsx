import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/DocumentsPage.module.css";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const DocumentsPage = () => {
    const navigate = useNavigate();
    const [docs, setDocs] = useState([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);

            const params = new URLSearchParams();
            if (search.trim()) params.append("search", search.trim());
            if (status) params.append("status", status);

            const url = `https://pulsenet-45is.onrender.com/accounts/documents/?${params.toString()}`;

            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                        "Content-Type": "application/json",
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                const data = await response.json();
                setDocs(Array.isArray(data.documents) ? data.documents : []);
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Link Failure", err);
                    setDocs([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        const timeoutId = setTimeout(fetchData, 300);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [search, status]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === "Escape") setSelectedDoc(null);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const stats = useMemo(() => {
        const total = docs.length;
        const lost = docs.filter((doc) => doc.status === "LOST").length;
        const found = docs.filter((doc) => doc.status === "FOUND").length;

        return { total, lost, found };
    }, [docs]);

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
        <div className={styles.page}>

            <div className={styles.container}>
                <section className={styles.hero}>
                    <div className={styles.heroText}>
                        <span className={styles.kicker}>Secure document archive</span>
                        <h1 className={styles.title}>Documents</h1>
                        <p className={styles.subtitle}>
                            Search, filter, and review your documents in a clean premium workspace.
                        </p>
                    </div>

                    <div className={styles.stats}>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Total</span>
                            <strong className={styles.statValue}>{stats.total}</strong>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Lost</span>
                            <strong className={`${styles.statValue} ${styles.statDanger}`}>{stats.lost}</strong>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Found</span>
                            <strong className={`${styles.statValue} ${styles.statSuccess}`}>{stats.found}</strong>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={styles.uploadButton}
                        onClick={() => navigate("/document-upload")}
                    >
                        Upload Document
                    </button>
                </section>

                <section className={styles.controlsPanel}>
                    <div className={styles.searchWrap}>
                        <input
                            type="text"
                            className={styles.input}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by document type or data..."
                            aria-label="Search documents"
                        />
                    </div>

                    <div className={styles.selectWrap}>
                        <select
                            className={styles.select}
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            aria-label="Filter by status"
                        >
                            <option value="">All statuses</option>
                            <option value="LOST">Lost</option>
                            <option value="FOUND">Found</option>
                        </select>
                    </div>
                </section>

                {loading ? (
                    <div className={styles.grid}>
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className={styles.skeletonCard}>
                                <div className={styles.skeletonImage} />
                                <div className={styles.skeletonBody}>
                                    <div className={styles.skeletonLine} />
                                    <div className={styles.skeletonLineShort} />
                                    <div className={styles.skeletonLineTiny} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : docs.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>✦</div>
                        <h2 className={styles.emptyTitle}>No documents found</h2>
                        <p className={styles.emptyText}>
                            Try a different search term or switch the status filter.
                        </p>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {docs.map((doc) => {
                            const isLost = doc.status === "LOST";
                            const isFound = doc.status === "FOUND";

                            return (
                                <article
                                    key={doc.id}
                                    className={styles.card}
                                    onClick={() => setSelectedDoc(doc)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            setSelectedDoc(doc);
                                        }
                                    }}
                                >
                                    <div className={styles.cardMedia}>
                                        {doc.redacted_image ? (
                                            <img
                                                src={doc.redacted_image}
                                                alt={doc.doc_type || "Document"}
                                                className={styles.image}
                                            />
                                        ) : (
                                            <div className={styles.imageFallback}>
                                                <span>No preview</span>
                                            </div>
                                        )}

                                        <div className={styles.cardOverlay} />

                                        <div className={styles.mediaTop}>
                                            <span className={styles.type}>
                                                {doc.doc_type || "Document"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.cardBody}>
                                        <h3 className={styles.cardTitle}>
                                            {doc.doc_type || "Document"}
                                        </h3>

                                        <div className={styles.cardFooter}>
                                            <span className={styles.footerLabel}>Status</span>
                                            <span
                                                className={`${styles.footerValue} ${
                                                    isLost
                                                        ? styles.footerDanger
                                                        : isFound
                                                            ? styles.footerSuccess
                                                            : styles.footerNeutral
                                                }`}
                                            >
                                                {doc.status || "UNKNOWN"}
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedDoc && (
                <div
                    className={styles.modalBackdrop}
                    onClick={() => setSelectedDoc(null)}
                >
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={styles.modalClose}
                            onClick={() => setSelectedDoc(null)}
                            aria-label="Close preview"
                        >
                            ×
                        </button>

                        <div className={styles.modalImageWrap}>
                            {selectedDoc.redacted_image ? (
                                <img
                                    src={selectedDoc.redacted_image}
                                    alt={selectedDoc.doc_type || "Document"}
                                    className={styles.modalImage}
                                />
                            ) : (
                                <div className={styles.modalFallback}>No preview available</div>
                            )}
                        </div>

                        <div className={styles.modalContent}>
                            <h2 className={styles.modalTitle}>
                                {selectedDoc.doc_type || "Document"}
                            </h2>
                            <div className={styles.modalMeta}>
                                <span
                                    className={`${styles.footerValue} ${
                                        selectedDoc.status === "LOST"
                                            ? styles.footerDanger
                                            : selectedDoc.status === "FOUND"
                                                ? styles.footerSuccess
                                                : styles.footerNeutral
                                    }`}
                                >
                                    {selectedDoc.status || "UNKNOWN"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
            <Footer />
        </div>
    );
};

export default DocumentsPage;