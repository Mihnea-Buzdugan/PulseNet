import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/index.module.css";
import { useNavigate } from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Map, MapControls} from "@/components/ui/map"
import "../App.css"
function Index() {
    const [pulses, setPulses] = useState([]);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const fetchPulses = async (pageNum) => {
        if (loading) return;
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/accounts/get_pulses/?page=${pageNum}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            const data = await response.json();
            if (data.success) {
                setPulses(prev => pageNum === 1 ? data.pulses : [...prev, ...data.pulses]);
                setHasNext(data.has_next);
                setPage(pageNum);
            }
        } catch (error) {
            console.error("Eroare:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPulses(1); }, []);

    return (
        <div className={styles.body}>
            <Navbar />
            <div className={styles.mainContainer}>
                <h2 className={styles.feedTitle}>Latest Pulses</h2>

                <div className={styles.pulseGrid}>
                    {pulses.map((pulse, index) => (
                        <div
                            key={`${pulse.id}-${index}`}
                            className={styles.productCard}
                            onClick={() => navigate(`/pulse/${pulse.type}/${pulse.id}`)}
                            style={{ cursor: "pointer" }}
                        >
                            {/* Imaginea Produsului */}
                            <div className={styles.imageContainer}>
                                <div className={styles.typeBadge}>{pulse.type}</div>
                                {pulse.image ? (
                                    <img src={pulse.image} alt={pulse.name} className={styles.productImage} />
                                ) : (
                                    <div className={styles.noImagePlaceholder}>📦</div>
                                )}
                            </div>

                            {/* Detalii Produs */}
                            <div className={styles.contentWrapper}>
                                <h3 className={styles.productTitle}>{pulse.name}</h3>

                                <span className={styles.postDate}>
                                    🕒 {pulse.timestamp}
                                </span>

                                <div className={styles.priceContainer}>
                                    <div>
                                        <span className={styles.priceLabel}>{pulse.price}</span>
                                        <span className={styles.currencyLabel}>{pulse.currency}</span>
                                    </div>
                                    <span className={styles.userName}>@{pulse.user}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {hasNext && (
                    <button
                        onClick={() => fetchPulses(page + 1)}
                        className={styles.loadMoreBtn}
                        disabled={loading}
                    >
                        {loading ? "Se încarcă..." : "Vezi mai multe"}
                    </button>

                )}
            </div>
        </div>
    );
}

export default Index;