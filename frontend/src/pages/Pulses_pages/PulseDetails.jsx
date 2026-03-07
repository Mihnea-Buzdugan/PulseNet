import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, MessageSquare } from "lucide-react";
import styles from "../../styles/Pulses_pages/pulseDetails.module.css";
import Navbar from "../../components/Navbar";


function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}



export default function PulseDetails() {
    const { type, id } = useParams();
    const navigate = useNavigate();

    const [pulse, setPulse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [index, setIndex] = useState(0);
    const [favAnim, setFavAnim] = useState(false);
    useEffect(() => {
        let mounted = true;
        const csrfToken = getCookie('csrftoken');
        fetch(`http://localhost:8000/accounts/pulse/${id}/`, {
            method: "GET",
            credentials: "include",
            headers: {
                'X-CSRFToken': csrfToken,
            }
        })
            .then(res => res.json())
            .then(data => {
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

    const images = useMemo(() => (pulse && pulse.images ? pulse.images : []), [pulse]);

    const next = () => setIndex(i => (i + 1) % images.length);
    const prev = () => setIndex(i => (i - 1 + images.length) % images.length);

    const handleFavorite = async () => {
        setFavAnim(true);


        try {
            const csrfToken = getCookie('csrftoken');
            const response = await fetch(`http://localhost:8000/accounts/add_to_favorites/${pulse.id}/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    'X-CSRFToken': csrfToken,
                }
            });

            const data = await response.json();
            if (response.ok && data.success) {
                // ✅ Update state -> set is_favorite to true
                setPulse(prev => ({
                    ...prev,
                    is_favorite: true
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
                setPulse(prev => ({
                    ...prev,
                    is_favorite: false
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

    const isService = type === "servicii";

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />
        <div className={styles.page}>

            <div className={styles.container}>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.left}
                >

                    <div className={styles.header}>

                        {pulse.user_avatar ? (
                            <img src={pulse.user_avatar} alt="avatar" className={styles.avatar} />
                        ) : (
                            <div className={styles.avatarPlaceholder}>{pulse.user[0]}</div>
                        )}

                        <div>
                            <div className={styles.username}>{pulse.user}</div>
                            <div className={styles.timestamp}>{pulse.timestamp}</div>
                        </div>

                    </div>

                    <h1 className={styles.title}>{pulse.name}</h1>

                    <p className={styles.description}>{pulse.description}</p>

                    <div className={styles.badges}>

                        <div className={styles.typeBadge}>
                            {isService ? "Serviciu" : "Obiect"}
                        </div>

                        <div className={styles.priceBadge}>
                            {pulse.price} {pulse.currency}
                        </div>

                    </div>


                    <div className={styles.carousel}>

                        {images.length > 0 ? (
                            <>
                                <img
                                    src={images[index]}
                                    className={styles.mainImage}
                                />

                                <button onClick={prev} className={styles.navLeft}>
                                    <ArrowLeft size={20} />
                                </button>

                                <button onClick={next} className={styles.navRight}>
                                    <ArrowRight size={20} />
                                </button>

                                <div className={styles.thumbs}>
                                    {images.map((img, i) => (
                                        <img
                                            key={i}
                                            src={img}
                                            onClick={() => setIndex(i)}
                                            className={`${styles.thumb} ${i === index ? styles.activeThumb : ""}`}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className={styles.noImage}>No images</div>
                        )}

                    </div>

                    <div className={styles.infoGrid}>
                        <div>
                            <span>Posted</span>
                            <strong>{pulse.timestamp}</strong>
                        </div>

                        <div>
                            <span>Location</span>
                            <strong>{pulse.location || "Not specified"}</strong>
                        </div>

                        <div>
                            <span>Condition</span>
                            <strong>{pulse.condition || "N/A"}</strong>
                        </div>
                    </div>

                </motion.div>


                <motion.aside
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={styles.sidebar}
                >

                    <div className={styles.sellerCard}>

                        <h3>Seller</h3>
                        <p>{pulse.user}</p>

                        <button className={styles.contactBtn} onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/direct-chat/${pulse.user_id}`);
                        }}>
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

                    <button className={styles.actionBtn}>
                        {isService ? "Book Service" : "Buy Item"}
                    </button>

                </motion.aside>

            </div>

        </div>
            </div>
        </div>
    );
}