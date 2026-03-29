import React, { useEffect, useState, useRef } from "react";
import Navbar from "../../components/Navbar";
import { AlertTriangle, MapPin, Clock, ShieldAlert, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import styles from "../../styles/Alerts/Alerts.module.css";
import { useNavigate } from "react-router-dom";

// --- Categoriile pentru Dropdown ---
const CATEGORIES = [
    { value: "all", label: "All Alerts" },
    { value: "weather", label: "Weather Alert" },
    { value: "lost", label: "Lost Item" },
    { value: "found", label: "Found Item" },
    { value: "lost_pet", label: "Lost Pet" },
    { value: "found_pet", label: "Found Pet" },
    { value: "traffic", label: "Traffic Alert" },
    { value: "safety", label: "Safety Notice" },
    { value: "event", label: "Event" },
    { value: "missing_person", label: "Missing Person" },
    { value: "infrastructure", label: "Road / Utilities" },
    { value: "public_health", label: "Health / Medical" },
    { value: "meetup", label: "Meetup" },
    { value: "volunteer", label: "Volunteer Request" },
    { value: "other", label: "Other" },
];

// --- Sub-Component for Image Navigation ---
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
            <img src={images[currentIndex]} alt="Alert visual" className={styles.carouselImg} />
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

const AlertCard = ({ a, formatDate, navigate }) => {
    if (!a) return <div className={styles.emptyCardSlot}></div>;

    return (
        <div
            className={styles.card}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/alert/${a.id}`)}
        >
            <div className={styles.cardHeader}>
                <span className={styles.categoryBadge}>
                    <AlertTriangle size={14} />
                    {a.category?.toUpperCase() || "FLAG"}
                </span>

                {/* --- VERIFIED BADGE --- */}
                {a.is_verified && (
                    <span className={styles.verifiedBadge} title="Verified Alert">
                        <CheckCircle size={14} fill="#3b82f6" color="white" />
                        <span className={styles.verifiedText}>Verified</span>
                    </span>
                )}

                <span className={styles.user}>@{a.user_name}</span>
            </div>

            <h3 className={styles.alertTitle}>{a.title}</h3>
            <p className={styles.description}>{a.description}</p>

            <AlertCarousel images={a.images} />

            <div className={styles.cardFooter}>
                {a.location && (
                    <span className={styles.metaTag}>
                        <MapPin size={14} /> {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                    </span>
                )}
                <span className={styles.metaTag}>
                    <Clock size={14} /> {formatDate(a.created_at)}
                </span>
            </div>
        </div>
    );
};

export default function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetch("http://localhost:8000/accounts/alerts/", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (data.success) setAlerts(data.alerts || []);
            })
            .finally(() => setLoading(false));
    }, []);

    const socketRef = useRef(null);

    useEffect(() => {
        // Replace with your actual domain/port. 'ws' for dev, 'wss' for prod.
        const socketUrl = `ws://localhost:8000/ws/alerts/`;
        socketRef.current = new WebSocket(socketUrl);

        socketRef.current.onopen = () => {
            console.log("WebSocket Connected to Alerts Feed");
        };

        socketRef.current.onmessage = (event) => {
            const message = JSON.parse(event.data);

            // Check if the type matches what your Consumer sends
            if (message.type === "alert" && message.data) {
                console.log("New Live Alert Received:", message.data);

                // Functional update to prepend the new alert to the top of the list
                setAlerts((prevAlerts) => [message.data, ...prevAlerts]);
            }
        };

        socketRef.current.onclose = (e) => {
            console.log("WebSocket Disconnected. Code:", e.code);
        };

        socketRef.current.onerror = (err) => {
            console.error("WebSocket Error:", err);
        };

        // Clean up on component unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    const formatDate = (iso) => {
        const date = new Date(iso);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    // --- Logica de Filtrare și Carusel ---
    const filteredAlerts = alerts.filter(a => selectedCategory === "all" || a.category === selectedCategory);

    // Primele 2 cele mai recente
    const recentAlerts = filteredAlerts.slice(0, 2);

    // Restul alertelor (pentru caruselul de jos)
    const otherAlerts = filteredAlerts.slice(2);

    const handleCategoryChange = (e) => {
        setSelectedCategory(e.target.value);
        setCarouselIndex(0); // Resetăm caruselul când schimbăm categoria
    };

    const nextCarouselPage = () => {
        if (carouselIndex + 3 < otherAlerts.length) {
            setCarouselIndex(prev => prev + 3);
        }
    };

    const prevCarouselPage = () => {
        if (carouselIndex > 0) {
            setCarouselIndex(prev => Math.max(0, prev - 3));
        }
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
        <div className={styles.body}>

            <div className={styles.bgBloom1}></div>
            <div className={styles.bgBloom2}></div>

            <div className={styles.mainContainer}>
                <div className={styles.header}>
                    <div className={styles.headerSection}>
                        <h1 className={styles.title}>
                            <ShieldAlert className={styles.titleIcon} size={40} />
                            Community Radar
                        </h1>

                        <button className={styles.alertButton} onClick={() => navigate("/add-alerts")}>
                            <span>Post an alert</span>
                            <svg className={styles.arrowIcon} viewBox="0 0 24 24" fill="none">
                                <path d="M17 8L21 12M21 12L17 16M21 12H3"></path>
                            </svg>
                        </button>

                        <div className={styles.liveIndicator}>
                            <span className={styles.pulseDot}></span>
                            Live Updates
                        </div>
                    </div>
                </div>


                {loading ? (
                    <div className={styles.loaderContainer}><div className={styles.loader}></div></div>
                ) : (
                    /* Noul Grid Layout */
                    <div className={styles.parent}>
                        {/* Div 1 & 2: Cele mai recente (Primele 2) */}
                        <div className={styles.div1}>
                            <h2 className={styles.sectionHeading}>Most Recent</h2>
                            <AlertCard a={recentAlerts[0]} formatDate={formatDate} navigate={navigate}/>
                        </div>
                        <div className={styles.div2}>
                            <h2 className={styles.sectionHeading} style={{visibility: 'hidden'}}>Spacer</h2>
                            <AlertCard a={recentAlerts[1]} formatDate={formatDate} navigate={navigate}/>
                        </div>

                        {/* Div 3: Bara de control (Titlu + Dropdown + Butoane Carusel) */}
                        <div className={styles.div3}>
                            <div className={styles.controlsLeft}>
                                <h2>Other Alerts</h2>
                                <div className={styles.carouselControls}>
                                    <button onClick={prevCarouselPage} disabled={carouselIndex === 0}>
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button onClick={nextCarouselPage} disabled={carouselIndex + 3 >= otherAlerts.length}>
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>

                            <select
                                className={styles.categoryDropdown}
                                value={selectedCategory}
                                onChange={handleCategoryChange}
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Div 4, 5, 6: Caruselul pentru restul alertelor (afișăm 3 deodată) */}
                        <div className={styles.div4}>
                            <AlertCard a={otherAlerts[carouselIndex]} formatDate={formatDate} navigate={navigate}/>
                        </div>
                        <div className={styles.div5}>
                            <AlertCard a={otherAlerts[carouselIndex + 1]} formatDate={formatDate} navigate={navigate}/>
                        </div>
                        <div className={styles.div6}>
                            <AlertCard a={otherAlerts[carouselIndex + 2]} formatDate={formatDate} navigate={navigate}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}