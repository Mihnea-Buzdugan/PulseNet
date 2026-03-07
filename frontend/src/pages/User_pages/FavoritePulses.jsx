import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../styles/User_pages/favoritePulses.module.css";
import Navbar from "../../components/Navbar";
import Loading from "../../components/Loading";

function getCookie(name) {
    let cookieValue = null;
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

export default function FavoritePulses() {
    const [pulses, setPulses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const navigate = useNavigate();

    const fetchFavorites = async (pageNumber = 1) => {
        try {
            setLoading(true);
            const csrfToken = getCookie("csrftoken");

            const response = await fetch(
                `http://localhost:8000/accounts/favorites/?page=${pageNumber}`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "X-CSRFToken": csrfToken,
                    },
                }
            );

            const data = await response.json();

            if (response.ok && data.success) {
                if (pageNumber === 1) {
                    setPulses(data.pulses);
                } else {
                    setPulses((prev) => [...prev, ...data.pulses]);
                }

                setHasNext(data.has_next);
                setPage(pageNumber);
            }
        } catch (err) {
            console.error("Error loading favorites", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites(1);
    }, []);

    const loadMore = () => {
        if (hasNext) {
            fetchFavorites(page + 1);
        }
    };

    if (loading && pulses.length === 0) {
        return <Loading />;
    }

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />
        <div className={styles.page}>
            <div className={styles.container}>
                <h1 className={styles.title}>❤️ Your Favorite Pulses</h1>

                {pulses.length === 0 && !loading && (
                    <p className={styles.empty}>No favorites yet.</p>
                )}

                <div className={styles.grid}>
                    {pulses.map((pulse) => (
                        <div
                            key={pulse.id}
                            className={styles.card}
                            onClick={() =>
                                navigate(`/pulse/${pulse.type}/${pulse.id}`)
                            }
                        >
                            {pulse.image && (
                                <img
                                    src={pulse.image}
                                    alt="pulse"
                                    className={styles.image}
                                />
                            )}

                            <h3 className={styles.name}>{pulse.name}</h3>

                            <p className={styles.price}>
                                {pulse.price} {pulse.currency}
                            </p>

                            <small className={styles.timestamp}>
                                {pulse.timestamp}
                            </small>
                        </div>
                    ))}
                </div>

                {hasNext && (
                    <div className={styles.loadMoreWrapper}>
                        <button
                            onClick={loadMore}
                            className={styles.loadMoreBtn}
                        >
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </div>
            </div>
        </div>
    );
}
