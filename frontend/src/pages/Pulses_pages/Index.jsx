import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../styles/index.module.css";
import Navbar from "@/components/Navbar";
import {Map, MapClusterLayer, MapControls, MapPopup} from "@/components/ui/map";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";

const initialFilters = {
    Pulses: {
        search: "",
        sortBy: "latest",
        minRating: "",
    },
    Request: {
        search: "",
        sortBy: "latest",
        expiresIn: "",
    },
};

const initialVisibleCounts = {
    Pulses: 10,
    Request: 10,
};

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function parseDistance(value) {
    if (typeof value === "number") return value;
    if (!value) return Number.POSITIVE_INFINITY;
    return Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
}

function parsePrice(value) {
    if (typeof value === "number") return value;
    if (!value) return Number.POSITIVE_INFINITY;
    return Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
}

function getDaysUntilExpiration(value) {
    if (!value) return Number.POSITIVE_INFINITY;

    const expiration = new Date(value);
    if (Number.isNaN(expiration.getTime())) return Number.POSITIVE_INFINITY;

    const now = new Date();
    const diffMs = expiration.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function normalizePulse(item) {
    return {
        id: item.id,
        user: item.user || "Unknown user",
        createdAt: item.timestamp || "",
        image: item.image || "https://via.placeholder.com/400x250",
        title: item.name || item.title || "Untitled pulse",
        description: item.description || "",
        category: item.pulse_type || item.type || "Pulses",
        distance:
            item.distance !== undefined && item.distance !== null
                ? `${item.distance} km`
                : "-",
        price:
            item.price !== undefined && item.price !== null
                ? `${item.price} ${item.currency || ""}`.trim()
                : "-",
        rating: item.popularity_score,
        totalReviews: item.total_reviews || 0,
        lat: item.lat,
        lng: item.lng,
    };
}

function normalizeRequest(item) {
    return {
        id: item.id,
        user: item.user || "Unknown user",
        createdAt: item.created_at || "",
        image: item.image || "https://via.placeholder.com/400x250",
        title: item.title || "Untitled request",
        description: item.description || "",
        category: item.category || "Request",
        distance: item.location ? "-" : "-",
        price:
            item.max_price !== null && item.max_price !== undefined
                ? `${item.max_price} RON`
                : "-",
        rating: typeof item.match_score === "number" ? item.match_score : 0,
        expirationDate: item.expires_at || "",
        matchScore: item.match_score || 0,
        images: item.images || [],
        location: item.location || null,
    };
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export default function Index() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Pulses");
    const [filters, setFilters] = useState(initialFilters);
    const [visibleCounts, setVisibleCounts] = useState(initialVisibleCounts);
    const [locationDenied, setLocationDenied] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [nearestPulses, setNearestPulses] = useState([]);
    const [urgentRequests, setUrgentRequests] = useState([]);
    const [loadingPulses, setLoadingPulses] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [locationError, setLocationError] = useState("");

    const pulseSocketRef = useRef(null);
    const requestSocketRef = useRef(null);
    const [userRadius, setUserRadius] = useState(10); // you can tweak default radius
    const mapRef = useRef(null);
    const [selectedPoint, setSelectedPoint] = useState(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationDenied(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setUserLocation({ lat, lng });

                fetch("http://localhost:8000/accounts/update_location/", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                    body: JSON.stringify({ lat, lng }),
                }).catch(() => { });
            },
            () => {
                setLocationDenied(true);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    useEffect(() => {
        pulseSocketRef.current = new WebSocket("ws://localhost:8000/ws/pulses/");

        pulseSocketRef.current.onopen = () => {
            console.log("Connected to Pulse WebSocket");

            if (userLocation) {
                pulseSocketRef.current.send(
                    JSON.stringify({
                        type: "set_location",
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        radius: userRadius,
                    })
                );
            }
        };

        pulseSocketRef.current.onmessage = (event) => {
            try {
                const newPulse = JSON.parse(event.data);

                if (newPulse.type === "pulse_deleted" && newPulse.id) {
                    setNearestPulses((prev) => prev.filter((p) => p.id !== newPulse.id));
                    return;
                }

                // 🔥 Add to nearest pulses (used in UI)
                setNearestPulses((prev) => {
                    if (!newPulse || !newPulse.id) return prev;
                    if (prev.find((p) => p.id === newPulse.id)) return prev;
                    return [newPulse, ...prev];
                });

            } catch (err) {
                console.error("Error parsing websocket message:", err);
            }
        };

        pulseSocketRef.current.onerror = (err) =>
            console.error("WebSocket Error:", err);

        pulseSocketRef.current.onclose = () =>
            console.warn("WebSocket disconnected");

        const onHeroAlert = () => fetchUrgentRequests();
        window.addEventListener("hero_alert", onHeroAlert);

        return () => {
            if (pulseSocketRef.current) pulseSocketRef.current.close();
            window.removeEventListener("hero_alert", onHeroAlert);
        };
    }, []);


    useEffect(() => {
        // Initialize WebSocket
        requestSocketRef.current = new WebSocket("ws://localhost:8000/ws/requests/");

        requestSocketRef.current.onopen = () => {
            console.log("Connected to Request WebSocket");
        };

        requestSocketRef.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle deleted requests
                if (message.type === "request_deleted" && message.id) {
                    setUrgentRequests((prev) => prev.filter((p) => p.id !== message.id));
                    return;
                }

                // Handle new/updated requests
                if (!message.id) return;

                // Calculate lat/lng from GeoJSON location for frontend
                let lat, lng;
                if (message.location && message.location.coordinates) {
                    [lng, lat] = message.location.coordinates;
                }

                const newRequest = { ...message, lat, lng };

                // Add to state if not already present
                setUrgentRequests((prev) => {
                    if (prev.find((p) => p.id === newRequest.id)) return prev;
                    return [newRequest, ...prev];
                });

            } catch (err) {
                console.error("Error parsing websocket message:", err);
            }
        };

        requestSocketRef.current.onerror = (err) => console.error("WebSocket Error:", err);

        requestSocketRef.current.onclose = () => console.warn("WebSocket disconnected");

        return () => {
            if (requestSocketRef.current) requestSocketRef.current.close();
        };
    }, []);


    useEffect(() => {
        if (
            userLocation &&
            pulseSocketRef.current &&
            pulseSocketRef.current.readyState === WebSocket.OPEN
        ) {
            pulseSocketRef.current.send(
                JSON.stringify({
                    type: "set_location",
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    radius: userRadius,
                })
            );
        }
    }, [userLocation, userRadius]);


    const fetchNearestPulses = async () => {
        if (!userLocation) return;

        try {
            setLoadingPulses(true);
            const res = await fetch(
                `http://localhost:8000/accounts/get_nearest_pulses/?lat=${userLocation.lat}&lng=${userLocation.lng}`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );

            const data = await res.json();

            if (res.ok && data.success) {
                setNearestPulses(data.pulses || []);
            } else {
                console.error("get_nearest_pulses returned error", data);
                setNearestPulses([]);
            }
        } catch (err) {
            console.error("fetchNearestPulses error:", err);
        } finally {
            setLoadingPulses(false);
        }
    };

    const fetchUrgentRequests = async () => {
        try {
            setLoadingRequests(true);
            const res = await fetch("http://localhost:8000/accounts/urgent-requests/", {
                method: "GET",
                credentials: "include",
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setUrgentRequests(data.urgent_requests || []);
            } else {
                console.error("urgent-requests returned error", data);
                setUrgentRequests([]);
            }
        } catch (err) {
            console.error("fetchUrgentRequests error:", err);
        } finally {
            setLoadingRequests(false);
        }
    };

    useEffect(() => {
        fetchUrgentRequests();
    }, []);

    useEffect(() => {
        if (userLocation) {
            fetchNearestPulses();
        }
    }, [userLocation]);

    const products =
        activeTab === "Pulses"
            ? nearestPulses.map(normalizePulse)
            : urgentRequests.map(normalizeRequest);

    const currentFilters = filters[activeTab];

    const filteredProducts = useMemo(() => {
        const search = currentFilters.search.trim().toLowerCase();
        const minRatingValue =
            activeTab === "Pulses" && currentFilters.minRating
                ? Number.parseFloat(currentFilters.minRating)
                : 0;

        const expiresInLimit =
            activeTab === "Request" && currentFilters.expiresIn
                ? Number.parseInt(currentFilters.expiresIn, 10)
                : null;

        return products
            .filter((product) => {
                const matchesSearch =
                    String(product.title || "").toLowerCase().includes(search) ||
                    String(product.description || "").toLowerCase().includes(search) ||
                    String(product.user || "").toLowerCase().includes(search) ||
                    String(product.category || "").toLowerCase().includes(search);

                const matchesRating =
                    activeTab === "Pulses" ? (product.rating || 0) >= minRatingValue : true;

                const matchesExpiration =
                    activeTab === "Request" && expiresInLimit !== null
                        ? (() => {
                            const daysLeft = getDaysUntilExpiration(product.expirationDate);
                            return daysLeft >= 0 && daysLeft <= expiresInLimit;
                        })()
                        : true;

                return matchesSearch && matchesRating && matchesExpiration;
            })
            .sort((a, b) => {
                switch (currentFilters.sortBy) {
                    case "distance":
                        return parseDistance(a.distance) - parseDistance(b.distance);
                    case "price":
                        return parsePrice(a.price) - parsePrice(b.price);
                    case "rating":
                        return (b.rating || 0) - (a.rating || 0);
                    case "latest":
                    default:
                        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                }
            });
    }, [products, currentFilters, activeTab]);

    const visibleProducts = filteredProducts.slice(0, visibleCounts[activeTab]);

    const updateFilter = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [key]: value,
            },
        }));
    };

    const resetFilters = () => {
        setFilters((prev) => ({
            ...prev,
            [activeTab]: initialFilters[activeTab],
        }));
        setVisibleCounts((prev) => ({
            ...prev,
            [activeTab]: 3,
        }));
    };

    const handleSeeMore = () => {
        if (activeTab === "Pulses") {
            navigate(`/pulses`);
        } else {
            navigate(`/urgent-requests`);
        }
    };

    const handleCardClick = (product) => {
        if (activeTab === "Pulses") {
            navigate(`/pulse/${product.category}/${product.id}`);
        } else {
            navigate(`/request/${product.id}`);
        }
    };

    const pulsesGeoJSON = useMemo(() => ({
        type: "FeatureCollection",
        features: nearestPulses.map((pulse) => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [pulse.lng ?? 0, pulse.lat ?? 0],
            },
            properties: {
                id: pulse.id,
                name: pulse.name,
                price: pulse.price,
                currency: pulse.currency,
                user: pulse.user,
                distance: pulse.distance,
                pulseType: pulse.type,
                type: "Pulse",
                description: pulse.description,
                popularity_score: pulse.popularity_score,
                total_reviews: pulse.total_reviews,
            },
        })),
    }), [nearestPulses]);

    const requestsGeoJSON = useMemo(() => ({
        type: "FeatureCollection",
        features: urgentRequests
            .filter(r => r.location && r.location.length === 2)
            .map(r => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [r.location[0], r.location[1]],
                },
                properties: {
                    id: r.id,
                    user_id: r.user_id,
                    user: r.user,
                    title: r.title,
                    description: r.description,
                    category: r.category,
                    price: r.max_price,
                    distance: r.distance,
                    type: "Request",
                    match_score: r.match_score,
                    image: r.image,
                    images: r.images,
                    expires_at: r.expires_at,
                },
            })),
    }), [urgentRequests]);

    // user location geojson
    const userLocationGeoJSON = userLocation
        ? {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [userLocation.lng, userLocation.lat],
                    },
                    properties: {
                        name: "You are here",
                    },
                },
            ],
        }
        : null;

    // map center (user fallback to Iași)
    const mapCenter = userLocation ? [userLocation.lng, userLocation.lat] : [27.6014, 47.1585];


    if (locationDenied) {
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#e9e6e6",
                gap: "16px",
                textAlign: "center",
                padding: "24px",
            }}>
                <div style={{ fontSize: "48px" }}>📍</div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b" }}>
                    Location access required
                </h2>
                <p style={{ color: "#64748b", maxWidth: "360px", lineHeight: "1.6" }}>
                    PulseNet uses your location to show pulses near you.
                    Please enable location access in your browser settings and reload the page.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        marginTop: "8px",
                        padding: "10px 28px",
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        borderRadius: "999px",
                        fontWeight: "700",
                        fontSize: "15px",
                        cursor: "pointer",
                    }}
                >
                    Reload page
                </button>
            </div>
        );
    }

    if (loadingRequests || loadingPulses)
        return <Loading />

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.leftPanel}>
                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tab} ${
                                    activeTab === "Pulses" ? styles.activeTab : ""
                                }`}
                                onClick={() => setActiveTab("Pulses")}
                            >
                                Pulses
                            </button>
                            <button
                                className={`${styles.tab} ${
                                    activeTab === "Request" ? styles.activeTab : ""
                                }`}
                                onClick={() => setActiveTab("Request")}
                            >
                                Request
                            </button>
                        </div>

                        <div className={styles.filtersBar}>
                            <div className={styles.filtersTitle}>{activeTab} filters</div>

                            <div className={styles.filtersControls}>
                                <input
                                    type="text"
                                    className={styles.searchInput}
                                    placeholder={`Search ${activeTab.toLowerCase()}...`}
                                    value={currentFilters.search}
                                    onChange={(e) => updateFilter("search", e.target.value)}
                                />

                                <select
                                    className={styles.selectInput}
                                    value={currentFilters.sortBy}
                                    onChange={(e) => updateFilter("sortBy", e.target.value)}
                                >
                                    <option value="latest">Newest</option>
                                    <option value="distance">Nearest</option>
                                    <option value="price">Lowest price</option>
                                    <option value="rating">
                                        {activeTab === "Request" ? "Match score" : "Top rating"}
                                    </option>
                                </select>

                                {activeTab === "Pulses" ? (
                                    <select
                                        className={styles.selectInput}
                                        value={currentFilters.minRating}
                                        onChange={(e) => updateFilter("minRating", e.target.value)}
                                    >
                                        <option value="">All ratings</option>
                                        <option value="3">3.0+</option>
                                        <option value="5">5.0+</option>
                                        <option value="7">7.0+</option>
                                        <option value="9">9.0+</option>
                                    </select>
                                ) : (
                                    <select
                                        className={styles.selectInput}
                                        value={currentFilters.expiresIn}
                                        onChange={(e) => updateFilter("expiresIn", e.target.value)}
                                    >
                                        <option value="">Expires in</option>
                                        <option value="1">1 day</option>
                                        <option value="3">3 days</option>
                                        <option value="7">7 days</option>
                                        <option value="14">14 days</option>
                                    </select>
                                )}

                                <button className={styles.resetButton} onClick={resetFilters}>
                                    Reset
                                </button>
                            </div>
                        </div>

                        {activeTab === "Pulses" && loadingPulses && (
                            <div className={styles.noResults}>Loading pulses...</div>
                        )}

                        {activeTab === "Request" && loadingRequests && (
                            <div className={styles.noResults}>Loading requests...</div>
                        )}

                        {locationError && activeTab === "Pulses" && (
                            <div className={styles.noResults}>{locationError}</div>
                        )}

                        <div className={styles.cardsGrid}>
                            {!loadingPulses && !loadingRequests && visibleProducts.length > 0 ? (
                                visibleProducts.map((product) => {
                                    const isRequest = activeTab === "Request";
                                    const scoreClass =
                                        product.rating >= 80
                                            ? styles.highScore
                                            : product.rating >= 50
                                                ? styles.mediumScore
                                                : styles.lowScore;

                                    return (
                                        <div
                                            key={product.id}
                                            className={styles.card}
                                            onClick={() => handleCardClick(product)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <img
                                                src={product.image}
                                                alt={product.title}
                                                className={styles.cardImage}
                                            />

                                            <div className={styles.cardContent}>
                                                <div className={styles.cardHeader}>
                                                    <div>
                                                        <h3 className={styles.title}>
                                                            {product.title}
                                                        </h3>
                                                        <p className={styles.user}>
                                                            Posted by {product.user}
                                                        </p>
                                                    </div>

                                                    <div
                                                        className={
                                                            isRequest
                                                                ? `${styles.rating} ${styles.matchScore} ${scoreClass}`
                                                                : styles.rating
                                                        }
                                                    >
                                                        {isRequest
                                                            ? `${product.rating}% match`
                                                            : `★ ${product.rating}`}
                                                    </div>
                                                </div>

                                                <p className={styles.description}>
                                                    {product.description}
                                                </p>

                                                <div className={styles.metaGrid}>
                                                    <div>
                                                        <span className={styles.metaLabel}>
                                                            Category
                                                        </span>
                                                        <span className={styles.metaValue}>
                                                            {product.category}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className={styles.metaLabel}>
                                                            Distance
                                                        </span>
                                                        <span className={styles.metaValue}>
                                                            {product.distance}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className={styles.metaLabel}>
                                                            Price
                                                        </span>
                                                        <span className={styles.metaValue}>
                                                            {product.price}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className={styles.metaLabel}>
                                                            Created
                                                        </span>
                                                        <span className={styles.metaValue}>
                                                            {formatTimestamp(product.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {activeTab === "Request" && product.expirationDate && (
                                                    <div className={styles.expiration}>
                                                        Expires on: {formatDate(product.expirationDate)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                !loadingPulses &&
                                !loadingRequests && (
                                    <div className={styles.noResults}>No results found.</div>
                                )
                            )}
                        </div>


                            <div className={styles.seeMoreRow}>
                                <button className={styles.seeMoreButton} onClick={handleSeeMore}>
                                    See more {activeTab}
                                </button>
                            </div>

                    </div>

                    <div className={styles.mapPanel}>
                        <div className={styles.mapBox}>
                            <Map ref={mapRef} center={mapCenter} zoom={12} fadeDuration={0}>
                                <MapClusterLayer
                                    data={pulsesGeoJSON}
                                    clusterRadius={50}
                                    clusterMaxZoom={14}
                                    clusterColors={["#1d8cf8", "#6d5dfc", "#e23670"]}
                                    pointColor="#1d8cf8"
                                    onPointClick={(feature, coordinates) => {
                                        setSelectedPoint({
                                            coordinates,
                                            properties: feature.properties,
                                        });
                                    }}
                                />

                                <MapClusterLayer
                                    data={requestsGeoJSON}
                                    clusterRadius={50}
                                    clusterMaxZoom={14}
                                    clusterColors={["#f59e0b", "#f97316", "#dc2626"]}
                                    pointColor="#f97316"
                                    onPointClick={(feature, coordinates) => {
                                        setSelectedPoint({
                                            coordinates,
                                            properties: feature.properties,
                                        });
                                    }}
                                />

                                {userLocationGeoJSON && (
                                    <MapClusterLayer
                                        data={userLocationGeoJSON}
                                        clusterRadius={0}
                                        pointColor="#22c55e"
                                        clusterColors={["#22c55e"]}
                                        onPointClick={(_feature, coordinates) => {
                                            setSelectedPoint({
                                                coordinates,
                                                properties: {
                                                    name: "Your location",
                                                    user: "",
                                                    price: "",
                                                    currency: "",
                                                    distance: "",
                                                },
                                            });
                                        }}
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
                                        <div
                                            className="space-y-1 p-1 cursor-pointer"
                                            onClick={() => {
                                                if (selectedPoint.properties.type === "Pulse") {
                                                    navigate(`/pulse/${selectedPoint.properties.pulseType}/${selectedPoint.properties.id}`);
                                                } else if (selectedPoint.properties.type === "Request") {
                                                    navigate(`/request/${selectedPoint.properties.id}`);
                                                }
                                            }}
                                        >
                                            {/* Title / Name */}
                                            <p className="font-semibold">{selectedPoint.properties.title || selectedPoint.properties.name}</p>

                                            {/* Type */}
                                            {selectedPoint.properties.type && (
                                                <p style={{ fontSize: '0.8rem', color: '#666' }}>
                                                    🏷️ {selectedPoint.properties.type} - {selectedPoint.properties.pulseType}
                                                </p>
                                            )}

                                            {/* Pulse-specific fields */}
                                            {selectedPoint.properties.type === "Pulse" && (
                                                <>
                                                    {selectedPoint.properties.user && <p>👤 @{selectedPoint.properties.user}</p>}
                                                    {selectedPoint.properties.price !== undefined &&
                                                        selectedPoint.properties.price !== "" && (
                                                            <p>💰 {selectedPoint.properties.price} {selectedPoint.properties.currency}</p>
                                                        )}
                                                    {selectedPoint.properties.popularity_score !== undefined && (
                                                        <p style={{ fontSize: '0.85rem' }}>
                                                            ⭐ {selectedPoint.properties.popularity_score} ({selectedPoint.properties.total_reviews || 0} reviews)
                                                        </p>
                                                    )}
                                                    {selectedPoint.properties.distance !== undefined &&
                                                        selectedPoint.properties.distance !== "" && (
                                                            <p>📍 {selectedPoint.properties.distance} km away</p>
                                                        )}
                                                </>
                                            )}

                                            {/* Request-specific fields */}
                                            {selectedPoint.properties.type === "Request" && (
                                                <>
                                                    {selectedPoint.properties.user && <p>👤 @{selectedPoint.properties.user}</p>}
                                                    {selectedPoint.properties.price !== undefined && (
                                                        <p>💰 Max Price: {selectedPoint.properties.price} RON</p>
                                                    )}
                                                    {selectedPoint.properties.distance !== undefined &&
                                                        selectedPoint.properties.distance !== "" && (
                                                            <p>📍 {selectedPoint.properties.distance} km away</p>
                                                        )}
                                                    {selectedPoint.properties.expires_at && (
                                                        <p>⏰ Expires: {new Date(selectedPoint.properties.expires_at).toLocaleDateString()}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </MapPopup>
                                )}

                                <MapControls />
                            </Map>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}