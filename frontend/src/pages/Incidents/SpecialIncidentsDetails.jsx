import React, { useEffect, useRef, useState } from "react";
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
    useMap,
} from "react-leaflet";
import { MapPinned } from "lucide-react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import Loading from "../../components/Loading";
import Footer from "@/components/Footer";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

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

export default function SpecialIncidentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [incident, setIncident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imgIndex, setImgIndex] = useState(0);
    const [toast, setToast] = useState(null);
    const [address, setAddress] = useState("Loading address...");
    const carouselRef = useRef(null);

    const fetchDetailedAddress = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
                { headers: { "Accept-Language": "en" } }
            );
            if (!res.ok) return "Location unavailable";
            const data = await res.json();
            const addr = data.address || {};
            const street = addr.road || addr.pedestrian || addr.path || "";
            const number = addr.house_number || "";
            const city = addr.city || addr.town || addr.village || addr.suburb || "";
            const shortAddress = [street, number, city].filter(Boolean).join(", ");
            if (shortAddress) return shortAddress;
            if (city) return city;
            if (data.display_name) return data.display_name.split(",").slice(0, 3).join(", ");
            return "Unknown location";
        } catch {
            return "Unknown location";
        }
    };

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`http://localhost:8000/accounts/special-incidents/${id}/`, {
            credentials: "include",
            headers: { "X-CSRFToken": getCookie("csrftoken") },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setIncident(data.incident);
                else setToast({ type: "error", text: data.error || "Incident not found." });
            })
            .catch(() => setToast({ type: "error", text: "Network error." }))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (incident?.location?.lat && incident?.location?.lng) {
            fetchDetailedAddress(incident.location.lat, incident.location.lng).then(setAddress);
        } else {
            setAddress("No location provided");
        }
    }, [incident]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    if (loading || !incident) return <Loading />;

    const images = incident.images?.length ? incident.images : ["/default-alert.jpg"];
    const lat = incident.location?.lat;
    const lng = incident.location?.lng;

    const nextImage = (e) => {
        e.stopPropagation();
        setImgIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e) => {
        e.stopPropagation();
        setImgIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const openInMaps = () => {
        if (!lat || !lng) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            <div className={styles.pageWrap}>
                <div className={styles.container}>
                    <button className={styles.backBtn} onClick={() => navigate(-1)}>
                        <span className={styles.arrow}>←</span> Back to Incidents
                    </button>

                    <div className={styles.headerCard}>
                        <div className={styles.headerLeft}>
                            <div className={styles.badgeContainer}>
                                <span className={styles.badge}>
                                    {incident.incident_type?.label || "Incident"}
                                </span>
                                <span className={styles.time}>
                                    {new Intl.DateTimeFormat("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                    }).format(new Date(incident.created_at))}
                                </span>
                            </div>

                            <h1 className={styles.title}>{incident.title}</h1>
                            <span className={styles.postedBy}>
                                Reported by{" "}
                                <span className={styles.highlightedUser}>
                                    @{incident.user?.username}
                                </span>
                            </span>
                            <p className={styles.excerpt}>{incident.description}</p>

                            <div className={styles.actionRow}>
                                <button
                                    className={`${styles.actionBtn} ${styles.mapBtn}`}
                                    onClick={openInMaps}
                                >
                                    <MapPinned /> Open in Maps
                                </button>
                            </div>
                        </div>

                        <div className={styles.headerRight}>
                            <div className={styles.imagePanel} ref={carouselRef}>
                                <div className={styles.carouselViewport}>
                                    <img
                                        src={images[imgIndex]}
                                        alt="incident"
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
                        </div>
                    </div>

                    <div className={styles.contentGrid}>
                        <div className={styles.mainColumn}>
                            <div className={styles.mapSection}>
                                <h3>Incident Location</h3>
                                <div className={styles.mapWrap}>
                                    {lat && lng ? (
                                        <MapContainer
                                            center={[lat, lng]}
                                            zoom={15}
                                            className={styles.map}
                                            style={{ height: "400px", width: "100%", zIndex: 0 }}
                                        >
                                            <RecenterMap lat={lat} lng={lng} />
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            <Marker position={[lat, lng]}>
                                                <Popup>
                                                    {incident.title} <br /> @{incident.user?.username}
                                                </Popup>
                                            </Marker>
                                            <Circle
                                                center={[lat, lng]}
                                                radius={40}
                                                pathOptions={{ color: "#ef4444", fillOpacity: 0.2 }}
                                            />
                                        </MapContainer>
                                    ) : (
                                        <div className={styles.noMap}>No location provided.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.sideColumn}>
                            <div className={styles.detailPanel}>
                                <h3>Incident Details</h3>
                                <dl className={styles.detailsList}>
                                    <div className={styles.detailItem}>
                                        <dt>Type</dt>
                                        <dd>{incident.incident_type?.label || "Unknown"}</dd>
                                    </div>
                                    <div
                                        className={styles.detailItem}
                                        onClick={() => navigate(`/user-profile/${incident.user?.id}`)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <dt>Reporter</dt>
                                        <dd>@{incident.user?.username}</dd>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <dt>Address</dt>
                                        <dd>{address}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {toast && (
                    <div className={`${styles.toast} ${styles[toast.type]}`}>
                        {toast.text}
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
}