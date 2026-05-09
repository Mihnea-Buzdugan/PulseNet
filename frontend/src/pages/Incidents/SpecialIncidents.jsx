import React, { useEffect, useState, useRef, useMemo } from "react";
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
import { Map, MapClusterLayer, MapControls, MapPopup } from "@/components/ui/map";

// ─── culori explicite per slug ──────────────────────────────
const EXPLICIT_COLORS = {
    flood:                 "#3b82f6", // albastru
    blackout:              "#1e1e1e", // negru
    fire:                  "#f97316", // portocaliu
    earthquake:            "#eab308", // galben
    infrastructure_damage: "#ef4444", // roșu
    accident:              "#ec4899", // roz
    chemical_spill:        "#14b8a6", // teal
    other:                 "#6366f1", // violet
};

const FALLBACK_COLORS = [
    "#06b6d4", "#8b5cf6", "#f43f5e", "#84cc16", "#0ea5e9",
];

function generateTypeColors(incidents) {
    const slugs = incidents
        .map(i => i.incident_type?.value)
        .filter((v, i, a) => v && a.indexOf(v) === i);

    let fallbackIndex = 0;
    const map = {};
    slugs.forEach(slug => {
        map[slug] = EXPLICIT_COLORS[slug] ?? FALLBACK_COLORS[fallbackIndex++ % FALLBACK_COLORS.length];
    });
    return map;
}

// ─── IncidentMap ────────────────────────────────────────────
function IncidentMap({ incidents, userLocation }) {
    const [selectedPoint, setSelectedPoint] = useState(null);

    const typeColors = useMemo(() => generateTypeColors(incidents), [incidents]);

    const layersByType = useMemo(() => {
        const groups = {};
        incidents
            .filter(i => i.location?.lat && i.location?.lng)
            .forEach(i => {
                const slug = i.incident_type?.value || "other";
                if (!groups[slug]) {
                    groups[slug] = {
                        slug,
                        label: i.incident_type?.label || "Incident",
                        color: typeColors[slug] || "#6366f1",
                        features: [],
                    };
                }
                groups[slug].features.push({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [i.location.lng, i.location.lat],
                    },
                    properties: {
                        id: i.id,
                        title: i.title,
                        description: i.description,
                        type_label: i.incident_type?.label || "Incident",
                        type_slug: slug,
                        username: i.user?.username,
                        created_at: i.created_at,
                        preview_image: i.images?.[0] || null,
                    },
                });
            });
        return Object.values(groups);
    }, [incidents, typeColors]);

    const userLocationGeoJSON = useMemo(() => userLocation ? ({
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: { type: "Point", coordinates: [userLocation.lng, userLocation.lat] },
            properties: { name: "Your location" },
        }],
    }) : null, [userLocation]);

    const mapCenter = userLocation
        ? [userLocation.lng, userLocation.lat]
        : [27.6, 47.15];

    return (
        <div style={{ marginTop: "40px" }}>
            <h2 style={{ marginBottom: "16px", fontSize: "1.3rem", fontWeight: 700 }}>
                Incident Map
            </h2>
            <div style={{ position: "relative", height: "500px", borderRadius: "16px", overflow: "hidden" }}>
                <Map center={mapCenter} zoom={13} fadeDuration={0}>

                    {layersByType.map(group => (
                        <MapClusterLayer
                            key={group.slug}
                            data={{
                                type: "FeatureCollection",
                                features: group.features,
                            }}
                            clusterRadius={50}
                            clusterMaxZoom={14}
                            clusterColors={[group.color, group.color, group.color]}
                            pointColor={group.color}
                            onPointClick={(feature, coordinates) => {
                                setSelectedPoint({
                                    coordinates,
                                    properties: feature.properties,
                                });
                            }}
                        />
                    ))}

                    {userLocationGeoJSON && (
                        <MapClusterLayer
                            data={userLocationGeoJSON}
                            clusterRadius={0}
                            pointColor="#22c55e"
                            clusterColors={["#22c55e"]}
                            onPointClick={() => {}}
                        />
                    )}

                    {selectedPoint && (
                        <MapPopup
                            longitude={selectedPoint.coordinates[0]}
                            latitude={selectedPoint.coordinates[1]}
                            onClose={() => setSelectedPoint(null)}
                            closeOnClick={false}
                            focusAfterOpen={false}
                            closeButton
                        >
                            <div style={{ padding: "8px", minWidth: "200px", maxWidth: "240px" }}>
                                <span style={{
                                    display: "inline-block",
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    padding: "2px 6px",
                                    marginBottom: "6px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}>
                                    {selectedPoint.properties.type_label}
                                </span>

                                <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "4px", color: "#1e293b" }}>
                                    {selectedPoint.properties.title}
                                </p>

                                {selectedPoint.properties.description && (
                                    <p style={{
                                        fontSize: "0.78rem",
                                        color: "#64748b",
                                        marginBottom: "6px",
                                        lineHeight: 1.4,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}>
                                        {selectedPoint.properties.description}
                                    </p>
                                )}

                                {selectedPoint.properties.preview_image && (
                                    <img
                                        src={selectedPoint.properties.preview_image}
                                        alt="Incident preview"
                                        style={{
                                            width: "100%",
                                            height: "100px",
                                            objectFit: "cover",
                                            borderRadius: "6px",
                                            marginBottom: "6px",
                                        }}
                                    />
                                )}

                                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                                        👤 @{selectedPoint.properties.username}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                                        🕐 {new Date(selectedPoint.properties.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </MapPopup>
                    )}

                    <MapControls />
                </Map>

                {layersByType.length > 0 && (
                    <div style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                        background: "rgba(255,255,255,0.95)",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                        zIndex: 10,
                        maxWidth: "200px",
                    }}>
                        <p style={{ fontWeight: 700, fontSize: "0.78rem", marginBottom: "8px", color: "#1e293b" }}>
                            LEGEND
                        </p>
                        {layersByType.map(group => (
                            <div key={group.slug} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                                <div style={{
                                    width: "12px", height: "12px",
                                    borderRadius: "50%",
                                    background: group.color,
                                    flexShrink: 0,
                                    // border pentru negru să se vadă pe fond alb
                                    border: group.color === "#1e1e1e" ? "1px solid #94a3b8" : "none",
                                }} />
                                <span style={{ fontSize: "0.78rem", color: "#475569" }}>
                                    {group.label}
                                </span>
                            </div>
                        ))}
                        {userLocation && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", paddingTop: "5px", borderTop: "1px solid #e2e8f0" }}>
                                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                                <span style={{ fontSize: "0.78rem", color: "#475569" }}>Your location</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── IncidentCarousel ───────────────────────────────────────
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

    if (!hasImages) return <div className={styles.noImagePlaceholder}>No Preview</div>;

    return (
        <div className={styles.carouselContainer}>
            <img src={images[currentIndex]} alt="Incident visual" className={styles.carouselImg} />
            {images.length > 1 && (
                <>
                    <button type="button" className={`${styles.navBtn} ${styles.left}`} onClick={prevImage}>
                        <ChevronLeft size={20} />
                    </button>
                    <button type="button" className={`${styles.navBtn} ${styles.right}`} onClick={nextImage}>
                        <ChevronRight size={20} />
                    </button>
                    <div className={styles.imageCounter}>{currentIndex + 1} / {images.length}</div>
                </>
            )}
        </div>
    );
};

// ─── IncidentCard ───────────────────────────────────────────
const IncidentCard = ({ incident, formatDate, navigate }) => {
    if (!incident) return <div className={styles.emptyCardSlot} />;

    return (
        <div className={styles.card} style={{ cursor: "pointer" }} onClick={() => navigate(`/special-incident/${incident.id}`)}>
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

// ─── SpecialIncidents (main) ────────────────────────────────
export default function SpecialIncidents() {
    const [incidents, setIncidents] = useState([]);
    const [incidentTypes, setIncidentTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState("all");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [userLocation, setUserLocation] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        fetch("http://localhost:8000/accounts/get-incident-types/", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
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
        fetch("http://localhost:8000/accounts/special-incidents/", { credentials: "include" })
            .then(res => res.json())
            .then(data => setIncidents(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {}
        );
    }, []);

    const formatDate = (iso) =>
        new Intl.DateTimeFormat("en-US", {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        }).format(new Date(iso));

    const filteredIncidents = incidents.filter(
        i => selectedType === "all" || i.incident_type?.value === selectedType
    );
    const recentIncidents = filteredIncidents.slice(0, 2);
    const otherIncidents = filteredIncidents.slice(2);

    const handleTypeChange = (e) => {
        setSelectedType(e.target.value);
        setCarouselIndex(0);
    };

    const nextCarouselPage = () => {
        if (carouselIndex + 3 < otherIncidents.length)
            setCarouselIndex(prev => prev + 3);
    };
    const prevCarouselPage = () => {
        if (carouselIndex > 0)
            setCarouselIndex(prev => Math.max(0, prev - 3));
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}><Navbar /></div>

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
                            <button className={styles.alertButton} onClick={() => navigate("/add-incidents")}>
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
                        <>
                            <div className={styles.parent}>
                                <div className={styles.div1}>
                                    <h2 className={styles.sectionHeading}>Most Recent</h2>
                                    <IncidentCard incident={recentIncidents[0]} formatDate={formatDate} navigate={navigate} />
                                </div>
                                <div className={styles.div2}>
                                    <h2 className={styles.sectionHeading} style={{ visibility: "hidden" }}>Spacer</h2>
                                    <IncidentCard incident={recentIncidents[1]} formatDate={formatDate} navigate={navigate} />
                                </div>
                                <div className={styles.div3}>
                                    <div className={styles.controlsLeft}>
                                        <h2>Other Incidents</h2>
                                        <div className={styles.carouselControls}>
                                            <button onClick={prevCarouselPage} disabled={carouselIndex === 0}>
                                                <ChevronLeft size={20} />
                                            </button>
                                            <button onClick={nextCarouselPage} disabled={carouselIndex + 3 >= otherIncidents.length}>
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <select className={styles.categoryDropdown} value={selectedType} onChange={handleTypeChange}>
                                        {incidentTypes.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.div4}>
                                    <IncidentCard incident={otherIncidents[carouselIndex]} formatDate={formatDate} navigate={navigate} />
                                </div>
                                <div className={styles.div5}>
                                    <IncidentCard incident={otherIncidents[carouselIndex + 1]} formatDate={formatDate} navigate={navigate} />
                                </div>
                                <div className={styles.div6}>
                                    <IncidentCard incident={otherIncidents[carouselIndex + 2]} formatDate={formatDate} navigate={navigate} />
                                </div>
                            </div>

                            <IncidentMap
                                incidents={incidents}
                                userLocation={userLocation}
                            />
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}