import React, { useEffect, useState, useRef } from "react";
import Navbar from "../../components/Navbar";
import {
    AlertTriangle,
    MapPin,
    Clock,
    ShieldAlert,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import styles from "../../styles/Alerts/Alerts.module.css";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";

const IncidentCarousel = ({ images = [] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const hasImages = images.length > 0;

    const nextImage = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    if (!hasImages) {
        return <div className={styles.noImagePlaceholder}>No Preview</div>;
    }

    return (
        <div className={styles.carouselContainer}>
            <img
                src={images[currentIndex]}
                alt="Incident visual"
                className={styles.carouselImg}
            />
            {images.length > 1 && (
                <>
                    <button
                        type="button"
                        className={`${styles.navBtn} ${styles.left}`}
                        onClick={prevImage}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        type="button"
                        className={`${styles.navBtn} ${styles.right}`}
                        onClick={nextImage}
                    >
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

const IncidentCard = ({ incident, formatDate, navigate }) => {
    if (!incident) return <div className={styles.emptyCardSlot} />;

    return (
        <div
            className={styles.card}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/special-incident/${incident.id}`)}
        >
            <div className={styles.cardHeader}>
                <span className={styles.categoryBadge}>
                    <AlertTriangle size={14} />
                    {incident.incident_type?.label?.toUpperCase() || "INCIDENT"}
                </span>
                <span className={styles.user}>@{incident.user?.username}</span>
            </div>

            <h3 className={styles.alertTitle}>{incident.title}</h3>
            <p className={styles.description}>{incident.description}</p>

            <IncidentCarousel images={incident.images || []} />

            <div className={styles.cardFooter}>
                {incident.location?.lat && (
                    <span className={styles.metaTag}>
                        <MapPin size={14} />
                        {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                    </span>
                )}
                <span className={styles.metaTag}>
                    <Clock size={14} /> {formatDate(incident.created_at)}
                </span>
            </div>
        </div>
    );
};

export default function SpecialIncidents() {
    const [incidents, setIncidents] = useState([]);
    const [incidentTypes, setIncidentTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState("all");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetch("https://pulsenet-45is.onrender.com/accounts/get-incident-types/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                const sorted = [...data].sort((a, b) => {
                    if (a.value === "other") return 1;
                    if (b.value === "other") return -1;
                    return 0;
                });
                setIncidentTypes([{ value: "all", label: "All Incidents" }, ...sorted]);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        fetch("https://pulsenet-45is.onrender.com/accounts/special-incidents/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
        })
            .then((res) => res.json())
            .then((data) => setIncidents(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (iso) =>
        new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(iso));

    const filteredIncidents = incidents.filter(
        (i) => selectedType === "all" || i.incident_type?.value === selectedType
    );

    const recentIncidents = filteredIncidents.slice(0, 2);
    const otherIncidents = filteredIncidents.slice(2);

    const handleTypeChange = (e) => {
        setSelectedType(e.target.value);
        setCarouselIndex(0);
    };

    const nextCarouselPage = () => {
        if (carouselIndex + 3 < otherIncidents.length) {
            setCarouselIndex((prev) => prev + 3);
        }
    };

    const prevCarouselPage = () => {
        if (carouselIndex > 0) {
            setCarouselIndex((prev) => Math.max(0, prev - 3));
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
                                Special Incidents
                            </h1>

                            <button
                                className={styles.alertButton}
                                onClick={() => navigate("/add-incidents")}
                            >
                                <span>Report an Incident</span>
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
                        <div className={styles.loaderContainer}>
                            <div className={styles.loader}></div>
                        </div>
                    ) : (
                        <div className={styles.parent}>
                            <div className={styles.div1}>
                                <h2 className={styles.sectionHeading}>Most Recent</h2>
                                <IncidentCard
                                    incident={recentIncidents[0]}
                                    formatDate={formatDate}
                                    navigate={navigate}
                                />
                            </div>

                            <div className={styles.div2}>
                                <h2 className={styles.sectionHeading} style={{ visibility: "hidden" }}>
                                    Spacer
                                </h2>
                                <IncidentCard
                                    incident={recentIncidents[1]}
                                    formatDate={formatDate}
                                    navigate={navigate}
                                />
                            </div>

                            <div className={styles.div3}>
                                <div className={styles.controlsLeft}>
                                    <h2>Other Incidents</h2>
                                    <div className={styles.carouselControls}>
                                        <button
                                            onClick={prevCarouselPage}
                                            disabled={carouselIndex === 0}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button
                                            onClick={nextCarouselPage}
                                            disabled={carouselIndex + 3 >= otherIncidents.length}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>

                                <select
                                    className={styles.categoryDropdown}
                                    value={selectedType}
                                    onChange={handleTypeChange}
                                >
                                    {incidentTypes.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.div4}>
                                <IncidentCard
                                    incident={otherIncidents[carouselIndex]}
                                    formatDate={formatDate}
                                    navigate={navigate}
                                />
                            </div>
                            <div className={styles.div5}>
                                <IncidentCard
                                    incident={otherIncidents[carouselIndex + 1]}
                                    formatDate={formatDate}
                                    navigate={navigate}
                                />
                            </div>
                            <div className={styles.div6}>
                                <IncidentCard
                                    incident={otherIncidents[carouselIndex + 2]}
                                    formatDate={formatDate}
                                    navigate={navigate}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
}