import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "../../styles/index.module.css";
import { useNavigate } from "react-router-dom";
import { Map, MapClusterLayer, MapPopup, MapControls } from "@/components/ui/map";
import "../../App.css";
import Loading from "@/components/Loading";

// Placeholder images (adjust paths as needed)
const DEFAULT_AVATAR = "/defaultImage.png";
const DEFAULT_IMAGE = "/defaultImage.png";

export default function Index() {
    const navigate = useNavigate();

    // feeds
    const [latestPulses, setLatestPulses] = useState([]);
    const [nearestPulses, setNearestPulses] = useState([]);
    const [bestPulses, setBestPulses] = useState([]);

    // pagination / loading
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(false);

    // geolocation
    const [userLocation, setUserLocation] = useState(null);

    // map popup
    const [selectedPoint, setSelectedPoint] = useState(null);

    // -------------------------
    // Helper: open a pulse page
    // -------------------------
    const openPulse = (pulse) => {
        // navigate to /pulse/:type/:id
        navigate(`/pulse/${pulse.type}/${pulse.id}`);
    };

    // -------------------------
    // Handle broken images
    // -------------------------
    const handleImageError = (e) => {
        e.currentTarget.src = DEFAULT_IMAGE;
    };

    const handleAvatarError = (e) => {
        e.currentTarget.src = DEFAULT_AVATAR;
    };

    // -------------------------
    // get user location once
    // -------------------------
    useEffect(() => {
        if (!navigator.geolocation) {
            console.warn("Geolocation not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
            },
            (err) => {
                console.warn("Geolocation error:", err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    // -------------------------
    // WebSocket for real-time pulses
    // -------------------------
    useEffect(() => {
        // Note: change to wss://... in production
        const socket = new WebSocket("ws://localhost:8000/ws/pulses/");

        socket.onopen = () => {
            console.log("Connected to Pulse WebSocket");
        };

        socket.onmessage = (event) => {
            try {
                const newPulse = JSON.parse(event.data);
                // Add to latest pulses (prepended)
                setLatestPulses((prev) => {
                    if (!newPulse || !newPulse.id) return prev;
                    if (prev.find((p) => p.id === newPulse.id)) return prev;
                    return [newPulse, ...prev];
                });

                // If websocket pulse includes coordinates, add to nearest list too
                if (newPulse.lat !== undefined && newPulse.lng !== undefined) {
                    setNearestPulses((prev) => {
                        if (prev.find((p) => p.id === newPulse.id)) return prev;
                        return [newPulse, ...prev];
                    });
                }
            } catch (err) {
                console.error("Error parsing websocket message:", err);
            }
        };

        socket.onerror = (err) => console.error("WebSocket Error:", err);
        socket.onclose = () => console.warn("WebSocket disconnected");

        return () => {
            if (socket.readyState === WebSocket.CONNECTING) {
                socket.onopen = () => socket.close();
            } else if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };
    }, []);

    // -------------------------
    // fetch latest pulses (paginated)
    // -------------------------
    const fetchLatestPulses = async (pageNum = 1) => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await fetch(
                `http://localhost:8000/accounts/get_latest_pulses/?page=${pageNum}`,
                { method: "GET", credentials: "include" }
            );
            const data = await res.json();
            if (data.success) {
                setLatestPulses((prev) =>
                    pageNum === 1 ? data.pulses : [...prev, ...data.pulses]
                );
                setHasNext(!!data.has_next);
                setPage(pageNum);
            } else {
                console.error("get_latest_pulses returned success:false", data);
            }
        } catch (err) {
            console.error("fetchLatestPulses error:", err);
        } finally {
            setLoading(false);
        }
    };

    // -------------------------
    // fetch nearest pulses (when userLocation available)
    // -------------------------
    const fetchNearestPulses = async () => {
        if (!userLocation) return;
        try {
            const res = await fetch(
                `http://localhost:8000/accounts/get_nearest_pulses/?lat=${userLocation.lat}&lng=${userLocation.lng}`,
                { method: "GET", credentials: "include" }
            );
            const data = await res.json();
            if (data.success) {
                setNearestPulses(data.pulses || []);
            } else {
                console.error("get_nearest_pulses returned success:false", data);
            }
        } catch (err) {
            console.error("fetchNearestPulses error:", err);
        }
    };

    // -------------------------
    // fetch best pulses
    // -------------------------
    const fetchBestPulses = async () => {
        try {
            const res = await fetch(
                `http://localhost:8000/accounts/get_best_pulses/`,
                { method: "GET", credentials: "include" }
            );
            const data = await res.json();
            if (data.success) {
                setBestPulses(data.pulses || []);
            } else {
                console.error("get_best_pulses returned success:false", data);
            }
        } catch (err) {
            console.error("fetchBestPulses error:", err);
        }
    };

    // initial load: latest page 1 + best
    useEffect(() => {
        fetchLatestPulses(1);
        fetchBestPulses();
    }, []);

    // when user location appears, fetch nearest
    useEffect(() => {
        fetchNearestPulses();
    }, [userLocation]);

    // load more
    const loadMore = () => {
        if (hasNext && !loading) fetchLatestPulses(page + 1);
    };

    const formatPulseTime = (timestamp) => {
        if (!timestamp) return "";
        // timestamp expected "YYYY-MM-DD HH:MM"
        // convert to ISO by replacing the space with 'T'
        const iso = timestamp.replace(" ", "T");
        const date = new Date(iso);
        if (isNaN(date.getTime())) return timestamp;

        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // -------------------------
    // prepare GeoJSON for pulses (even if empty)
    // -------------------------
    const pulsesGeoJSON = {
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
                type: pulse.type,
                // New Fields Included
                description: pulse.description,
                popularity_score: pulse.popularity_score,
                total_reviews: pulse.total_reviews,
            },
        })),
    };

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

    // -------------------------
    // Render
    // -------------------------
    if (loading || nearestPulses.length === 0) {
        return <Loading />;
    }

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            <div className={styles["main-container"]}>
                <div className={styles.another}>
                    <header className={styles["news-bar"]}>
                        <span className={styles["news-update"]}>News Update:</span>
                        <div className={styles["marquee-container"]}>
                            <div className={styles.marquee}>Nimic momentan</div>
                        </div>
                    </header>
                </div>

                <div className={styles.wholeContaining}>
                    <div className={styles.main}>
                        <div className={styles.test}>
                            <div className={styles.stanga}>
                                <div className={styles.mare}>
                                    <Map center={mapCenter} zoom={12} fadeDuration={0}>
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

                                        {userLocationGeoJSON && (
                                            <MapClusterLayer
                                                data={userLocationGeoJSON}
                                                clusterRadius={0}
                                                pointColor="#22c55e"
                                                clusterColors={["#22c55e"]}
                                                onPointClick={(feature, coordinates) => {
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
                                                <div className="space-y-1 p-1">
                                                    <p className="font-semibold">{selectedPoint.properties.name}</p>

                                                    {/* New: Display Pulse Type */}
                                                    {selectedPoint.properties.type && (
                                                        <p style={{ fontSize: '0.8rem', color: '#666' }}>
                                                            🏷️ {selectedPoint.properties.type}
                                                        </p>
                                                    )}

                                                    {selectedPoint.properties.price !== undefined &&
                                                        selectedPoint.properties.price !== "" && (
                                                            <p>
                                                                💰 {selectedPoint.properties.price}{" "}
                                                                {selectedPoint.properties.currency}
                                                            </p>
                                                        )}

                                                    {/* New: Popularity Score and Reviews */}
                                                    {selectedPoint.properties.popularity_score !== undefined && (
                                                        <p style={{ fontSize: '0.85rem' }}>
                                                            ⭐ {selectedPoint.properties.popularity_score} ({selectedPoint.properties.total_reviews || 0} reviews)
                                                        </p>
                                                    )}

                                                    {selectedPoint.properties.user && <p>👤 @{selectedPoint.properties.user}</p>}

                                                    {selectedPoint.properties.distance !== undefined &&
                                                        selectedPoint.properties.distance !== "" && (
                                                            <p>📍 {selectedPoint.properties.distance} km away</p>
                                                        )}
                                                </div>
                                            </MapPopup>
                                        )}

                                        <MapControls />
                                    </Map>
                                </div>
                            </div>
                        </div>

                        {/* Right column: Latest pulses */}
                        <div className={styles.dreapta}>
                            {latestPulses.slice(0,4).map((pulse) => (
                                <div key={pulse.id} className={styles.stire} onClick={() => openPulse(pulse)}>
                                    <div className={styles.smallimg}>
                                        <img src={pulse.image || DEFAULT_IMAGE} className={styles.ferrari} onError={handleImageError} alt="Pulse" />
                                    </div>

                                    <div className={styles.content}>
                                        <div className={styles.sus}>
                                            <div className={styles.profil}>
                                                <img src={pulse.user_avatar || DEFAULT_AVATAR} className={styles.cafea} onError={handleAvatarError} alt="User" />
                                            </div>
                                            <div className={styles.titlu}>{pulse.user}</div>
                                            <div className={styles.timing}>• {formatPulseTime(pulse.timestamp)}</div>
                                        </div>

                                        <div className={styles.mijloc}>
                                            <div className={styles.context}>{pulse.name} {pulse.type && <span className={styles.badge}>{pulse.type}</span>}</div>
                                        </div>

                                        <div className={styles.jos} style={{justifyContent: 'space-between', alignItems: 'center', width: '300px'}}>
                                            <div className={styles.priceTag}>💰 {pulse.price} {pulse.currency}</div>
                                            {pulse.popularity_score && (
                                                <div className={styles.ratingGroup}>⭐ {pulse.popularity_score}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Load more button */}
                            {hasNext && (
                                <div style={{ textAlign: "center", marginTop: 12 }}>
                                    <button className={styles.vezi} onClick={loadMore} disabled={loading}>
                                        {loading ? "Loading..." : "Load more"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Carousels Helper Component Concept to avoid repeating code, but kept inline as requested */}

                {/* --- NEAREST PULSES SECTION --- */}
                <div className={styles["lastest-news"]}>
                    <h1>Nearest Pulses</h1>
                    <div className={styles.aia}>
                        {nearestPulses.length === 0 ? (
                            <p>No nearby pulses.</p>
                        ) : (
                            nearestPulses.slice(0, 3).map((pulse) => (
                                <div key={pulse.id} className={styles.one} onClick={() => openPulse(pulse)}>
                                    <div className={styles.img}>
                                        <img
                                            src={pulse.image || DEFAULT_IMAGE}
                                            alt="Pulse"
                                            className={styles.aoleu}
                                            onError={handleImageError}
                                        />
                                    </div>

                                    <div className={styles.sus1}>
                                        <div className={styles.profil}>
                                            <img
                                                src={pulse.user_avatar || DEFAULT_AVATAR}
                                                alt="User"
                                                className={styles.cafea}
                                                onError={handleAvatarError}
                                            />
                                        </div>
                                        <div className={styles.titlu}>{pulse.user}</div>
                                        <div className={styles.timing}>• {formatPulseTime(pulse.timestamp)}</div>
                                    </div>

                                    <div className={styles.scris}>
                                        <div style={{ fontSize: '24px', lineHeight: '1.2' }}>
                                            {pulse.name}
                                            {pulse.pulse_type && (
                                                <span className={styles.badge}>{pulse.pulse_type}</span>
                                            )}
                                            {pulse.distance !== undefined && pulse.distance !== null && (
                                                <span className={styles.distantaSpan}>
                📍 {pulse.distance} km away
            </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles["maimult-scris"]}>
                                        {pulse.description && <p className={styles.descriptionLine}>{pulse.description}</p>}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                            <span className={styles.priceTag}>💰 {pulse.price} {pulse.currency}</span>
                                            <span className={styles.ratingGroup}>⭐ {pulse.popularity_score || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* --- BEST PULSES SECTION --- */}
                <div className={styles["lastest-news"]}>
                    <h1>Best Pulses</h1>
                    <div className={styles.aia}>
                        {bestPulses.length === 0 ? (
                            <p>Loading best pulses...</p>
                        ) : (
                            bestPulses.slice(0, 3).map((pulse) => (
                                <div key={pulse.id} className={styles.one} onClick={() => openPulse(pulse)}>
                                    <div className={styles.img}>
                                        <img
                                            src={pulse.image || DEFAULT_IMAGE}
                                            alt="Pulse"
                                            className={styles.aoleu}
                                            onError={handleImageError}
                                        />
                                    </div>

                                    <div className={styles.sus1}>
                                        <div className={styles.profil}>
                                            <img
                                                src={pulse.user_avatar || DEFAULT_AVATAR}
                                                alt="User"
                                                className={styles.cafea}
                                                onError={handleAvatarError}
                                            />
                                        </div>
                                        <div className={styles.titlu}>{pulse.user}</div>
                                        <div className={styles.timing}>• {formatPulseTime(pulse.timestamp)}</div>
                                    </div>

                                    <div className={styles.scris}>
                                        <div style={{ fontSize: '24px', lineHeight: '1.2' }}>{pulse.name} {pulse.pulse_type && <span className={styles.badge}>{pulse.pulse_type}</span>}</div>
                                    </div>

                                    <div className={styles["maimult-scris"]}>
                                        {pulse.description && <p className={styles.descriptionLine}>{pulse.description}</p>}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                            <span className={styles.priceTag}>💰 {pulse.price} {pulse.currency}</span>
                                            <span className={styles.ratingGroup}>⭐ {pulse.popularity_score || 0} ({pulse.total_reviews})</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* --- LATEST PULSES (BOTTOM GRID) SECTION --- */}
                <div className={styles["lastest-news"]}>
                    <h1>Latest Pulses</h1>
                    <div className={styles.aia}>
                        {latestPulses.length === 0 ? (
                            <p>Loading latest pulses...</p>
                        ) : (
                            latestPulses.slice(0, 3).map((pulse) => (
                                <div key={pulse.id} className={styles.one} onClick={() => openPulse(pulse)}>
                                    <div className={styles.img}>
                                        <img
                                            src={pulse.image || DEFAULT_IMAGE}
                                            alt="Pulse"
                                            className={styles.aoleu}
                                            onError={handleImageError}
                                        />
                                    </div>

                                    <div className={styles.sus1}>
                                        <div className={styles.profil}>
                                            <img
                                                src={pulse.user_avatar || DEFAULT_AVATAR}
                                                alt="User"
                                                className={styles.cafea}
                                                onError={handleAvatarError}
                                            />
                                        </div>
                                        <div className={styles.titlu}>{pulse.user}</div>
                                        <div className={styles.timing}>• {formatPulseTime(pulse.timestamp)}</div>
                                    </div>

                                    <div className={styles.scris}>
                                        <div style={{ fontSize: '24px', lineHeight: '1.2' }}>{pulse.name} {pulse.pulse_type && <span className={styles.badge}>{pulse.pulse_type}</span>}</div>
                                    </div>

                                    <div className={styles["maimult-scris"]}>
                                        {pulse.description && <p className={styles.descriptionLine}>{pulse.description}</p>}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                            <span className={styles.priceTag}>💰 {pulse.price} {pulse.currency}</span>
                                            <span className={styles.ratingGroup}>⭐ {pulse.popularity_score || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}