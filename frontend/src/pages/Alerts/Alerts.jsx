import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { AlertTriangle, MapPin, Clock, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "../../styles/Alerts/Alerts.module.css";

// --- Sub-Component for the Image Navigation ---
const AlertCarousel = ({ images }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextImage = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    if (!images || images.length === 0) return null;

    return (
        <div className={styles.carouselContainer}>
            <img
                src={images[currentIndex]}
                alt="Alert visual"
                className={styles.carouselImg}
            />

            {images.length > 1 && (
                <>
                    <button className={`${styles.navBtn} ${styles.left}`} onClick={prevImage}>
                        <ChevronLeft size={20} />
                    </button>
                    <button className={`${styles.navBtn} ${styles.right}`} onClick={nextImage}>
                        <ChevronRight size={20} />
                    </button>
                    <div className={styles.imageCounter}>
                        {currentIndex + 1} / {images.length}
                    </div>
                </>
            )}
        </div>
    );
};

export default function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/accounts/alerts/", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.success) setAlerts(data.alerts || []);
            })
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (iso) => {
        const date = new Date(iso);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    return (
        <div className={styles.body}>
            <Navbar />
            <div className={styles.bgBloom1}></div>
            <div className={styles.bgBloom2}></div>

            <div className={styles.mainContainer}>
                <div className={styles.headerSection}>
                    <h1 className={styles.title}>
                        <ShieldAlert className={styles.titleIcon} size={40} />
                        Community Radar
                    </h1>
                    <div className={styles.liveIndicator}>
                        <span className={styles.pulseDot}></span>
                        Live Updates
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loaderContainer}><div className={styles.loader}></div></div>
                ) : (
                    <div className={styles.grid}>
                        {alerts.map((a) => (
                            <div key={a.id} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.categoryBadge}>
                                        <AlertTriangle size={14} />
                                        {a.category?.toUpperCase() || "FLAG"}
                                    </span>
                                    <span className={styles.user}>@{a.user_name}</span>
                                </div>

                                <h3 className={styles.alertTitle}>{a.title}</h3>
                                <p className={styles.description}>{a.description}</p>

                                {/* Use the new Carousel component here */}
                                <AlertCarousel images={a.images} />

                                <div className={styles.cardFooter}>
                                    {a.location && (
                                        <span className={styles.metaTag}>
                                            <MapPin size={14} /> {a.location}
                                        </span>
                                    )}
                                    <span className={styles.metaTag}>
                                        <Clock size={14} /> {formatDate(a.created_at)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}