import React, { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "../../styles/index.module.css";
import { useNavigate } from "react-router-dom";
import { Map, MapClusterLayer, MapPopup, MapControls } from "@/components/ui/map";
import "../../App.css";
import Loading from "@/components/Loading";

// Placeholder images (adjust paths as needed)
const DEFAULT_AVATAR = "/defaultImage.png";
const DEFAULT_IMAGE = "/defaultImage.png";

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

    // feeds
    const [latestPulses, setLatestPulses] = useState([]);
    const [nearestPulses, setNearestPulses] = useState([]);
    const [urgentRequests, setUrgentRequests] = useState([]);

    // pagination / loading
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(false);

    // geolocation
    const [userLocation, setUserLocation] = useState(null);
    const [userRadius, setUserRadius] = useState(1);
    const [locationDenied, setLocationDenied] = useState(false);
    const [weatherWarning, setWeatherWarning] = useState("Nimic momentan");
    const [alertPriority, setAlertPriority] = useState("normal");
    const [currentWeather, setCurrentWeather] = useState(null);
    const [weatherAlerts, setWeatherAlerts] = useState([]);
    // map popup
    const [selectedPoint, setSelectedPoint] = useState(null);

    //weather

    // map ref for imperative control

    const mapRef = useRef(null);

    // -------------------------
    // Helper: open a pulse page
    // -------------------------
    const openPulse = (pulse) => {
        // navigate to /pulse/:type/:id
        navigate(`/pulse/${pulse.type}/${pulse.id}`);
    };

    const openRequest = (req) => {
        // navigate to /pulse/:type/:id
        navigate(`/request/${req.id}`);
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

    // fetch visibility radius from profile
    useEffect(() => {
        fetch("http://localhost:8000/accounts/profile/", {
            method: "GET",
            credentials: "include",
        })
            .then((r) => r.json())
            .then((data) => {
                const radius = data.user?.visibility_radius;
                if (radius) setUserRadius(radius);

                // seed map immediately with last saved location
                const loc = data.user?.location;
                if (loc?.coordinates) {
                    setUserLocation((prev) =>
                        prev ?? { lat: loc.coordinates[1], lng: loc.coordinates[0] }
                    );
                }
            })
            .catch(() => { });
    }, []);

    // -------------------------
    // WebSocket for real-time pulses
    // -------------------------
    const socketRef = useRef(null);
    useEffect(() => {
        // 1. Inițializăm socket-ul o singură dată
        socketRef.current = new WebSocket("ws://localhost:8000/ws/pulses/");

        socketRef.current.onopen = () => {
            console.log("Connected to Pulse WebSocket");
            // Dacă din întâmplare locația a fost adusă extrem de repede, o trimitem
            if (userLocation) {
                socketRef.current.send(JSON.stringify({
                    type: "set_location",
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    radius: userRadius,
                }));
            }
        };

        socketRef.current.onmessage = (event) => {
            try {
                const newPulse = JSON.parse(event.data);

                // Adăugăm postarea nouă la 'Latest'
                setLatestPulses((prev) => {
                    if (!newPulse || !newPulse.id) return prev;
                    if (prev.find((p) => p.id === newPulse.id)) return prev;
                    return [newPulse, ...prev];
                });

                // Adăugăm postarea nouă și la 'Nearest' (pentru hartă)
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

        socketRef.current.onerror = (err) => console.error("WebSocket Error:", err);
        socketRef.current.onclose = () => console.warn("WebSocket disconnected");

        const onHeroAlert = () => fetchUrgentRequests();
        window.addEventListener("hero_alert", onHeroAlert);

        return () => {
            if (socketRef.current) socketRef.current.close();
            window.removeEventListener("hero_alert", onHeroAlert);
        };
    }, []);

    useEffect(() => {
        if (userLocation && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: "set_location",
                lat: userLocation.lat,
                lng: userLocation.lng,
                radius: userRadius,
            }));
        }
    }, [userLocation, userRadius]);

    useEffect(() => {
        let socket;
        let reconnectTimeout;

        const connectWebSocket = () => {
            socket = new WebSocket("ws://localhost:8000/ws/alerts/");

            socket.onopen = () => {
                console.log("Connected to Alerts WebSocket");
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "weather_alert" || data.action === "new_weather_alert") {
                        if (data.id && data.title) {
                            setWeatherAlerts((prev) =>
                                prev.find((a) => a.id === data.id) ? prev : [data, ...prev]
                            );
                        }
                        setWeatherWarning(`${data.title || "Alertă"}: ${data.message}`);

                        setTimeout(() => {
                            setWeatherWarning("Nimic momentan");
                        }, 1000 * 60 * 30);

                    } else if (data.type === "clear_alerts") {
                        setWeatherWarning("Nimic momentan");
                    }
                } catch (err) {
                    console.error("Error parsing alert message:", err);
                }
            };

            socket.onerror = (err) => {
                console.error("WebSocket Alert Error:", err);
            };

            socket.onclose = (e) => {
                console.warn("Alerts WebSocket closed. Reconnecting in 5s...", e.reason);
                reconnectTimeout = setTimeout(connectWebSocket, 5000);
            };
        };

        connectWebSocket();

        return () => {
            if (socket) {
                socket.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, []);

    useEffect(() => {
        if(userLocation) {
            const fetchWeather = async () => {

                try {
                    const res = await fetch(`http://localhost:8000/accounts/alerts/weather?lat=${userLocation.lat}&lon=${userLocation.lng}`);

                    if (res.ok) {
                        const data = await res.json();
                        setCurrentWeather(data.current);
                    } else {
                        console.error("Server error:", res.status);
                    }
                } catch (err) {
                    console.error("Error parsing weather location:", err);
                }
            };
            fetchWeather();
        }
    }, [userLocation]);

    // -------------------------
    // fetch latest pulses (paginated)
    // -------------------------
    const fetchLatestPulses = async (pageNum = 1) => {
        if (loading) return;
        setLoading(true);

        try {
            const locationParams = userLocation
                ? `&lat=${userLocation.lat}&lng=${userLocation.lng}`
                : "";
            const res = await fetch(
                `http://localhost:8000/accounts/get_latest_pulses/?page=${pageNum}${locationParams}`,
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
    // fetch urgent requests
    // -------------------------
    const fetchUrgentRequests = async () => {
        try {
            const res = await fetch(
                `http://localhost:8000/accounts/urgent-requests/`,
                { method: "GET", credentials: "include" }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setUrgentRequests(data.urgent_requests || []);
            } else {
                console.error("urgent-requests returned error", data);
            }
        } catch (err) {
            console.error("fetchUrgentRequests error:", err);
        }
    };

    // fetch admin-posted weather alerts
    useEffect(() => {
        fetch("http://localhost:8000/accounts/alerts/?category=weather", {
            credentials: "include",
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setWeatherAlerts(data.alerts || []);
            })
            .catch(() => {});
    }, []);

    // initial load: latest page 1 + urgent requests
    useEffect(() => {
        fetchLatestPulses(1);
        fetchUrgentRequests();
    }, []);

    // when user location appears, fetch nearest + latest + center map
    useEffect(() => {
        fetchNearestPulses();
        if (userLocation) fetchLatestPulses(1);
        if (userLocation && mapRef.current) {
            mapRef.current.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 12,
                duration: 1000,
            });
        }
    }, [userLocation]);

    // load more
    const loadMore = () => {
        if (hasNext && !loading) fetchLatestPulses(page + 1);
    };

    const formatPulseTime = (timestamp) => {
        if (!timestamp) return "";
        // timestamp expected "YYYY-MM-DD HH:MM"
        // convert to ISO by replacing the space with 'T'
        const iso = timestamp.replace(" ", "T") + "Z";
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

    if (loading && latestPulses.length === 0) {
        return <Loading />;
    }

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            <div className={styles["main-container"]}>
                <div className={styles.another}>
                    {(() => {
                        // Setările implicite (când pagina abia se încarcă)
                        let label = "News Update:";
                        let text = "Se caută actualizări...";
                        let barStyle = {};
                        let labelStyle = {};

                        // 1. Admin-posted weather alerts take highest priority
                        if (weatherAlerts.length > 0) {
                            label = "⚠️ Weather Alert:";
                            text = weatherAlerts.map((a) => a.title).join("  •  ");
                            barStyle = { backgroundColor: "#dc2626", color: "white" };
                            labelStyle = { color: "white" };
                        }
                        // 2. Verificăm dacă avem o alertă activă de la WebSocket
                        else if (weatherWarning !== "Nimic momentan") {
                            text = `🚨 ${weatherWarning}`;

                            if (alertPriority === "high") {
                                label = "URGENT:";
                                barStyle = { backgroundColor: "#dc2626", color: "white" }; // Roșu pentru Safety Check-in
                                labelStyle = { color: "white" };
                            } else if (alertPriority === "medium") {
                                label = "WARNING:";
                                barStyle = { backgroundColor: "#f59e0b", color: "black" }; // Portocaliu pentru vreme rea iminentă
                            }
                        }
                        // 3. Dacă nu avem alertă, dar s-a încărcat vremea din REST API
                        else if (currentWeather) {
                            label = "Vremea Locală:";
                            text = `${currentWeather.temp}°C (Se simte ca ${currentWeather.feels_like}°C) - ${currentWeather.description}`;
                        }

                        return (
                            <header className={styles["news-bar"]} style={barStyle}>
                <span className={styles["news-update"]} style={labelStyle}>
                    {label}
                </span>
                                <div className={styles["marquee-container"]}>
                                    <div className={styles.marquee}>
                                        {/* Dacă avem iconița de vreme și nu e alertă, o putem afișa */}
                                        {!weatherWarning && currentWeather?.icon && (
                                            <img
                                                src={`https://openweathermap.org/img/wn/${currentWeather.icon}.png`}
                                                alt="weather icon"
                                                style={{ verticalAlign: "middle", height: "24px", marginRight: "8px" }}
                                            />
                                        )}
                                        {text}
                                    </div>
                                </div>
                            </header>
                        );
                    })()}
                </div>

                <div className={styles.wholeContaining}>
                    <div className={styles.main}>
                        <div className={styles.test}>
                            <div className={styles.stanga}>
                                <div className={styles.mare}>
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
                            {latestPulses.slice(0, 4).map((pulse) => (
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

                                        <div className={styles.jos} style={{ justifyContent: 'space-between', alignItems: 'center', width: '300px' }}>
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

                {/* --- URGENT REQUESTS SECTION --- */}
                <div className={styles["lastest-news"]}>
                    <h1>Urgent Requests</h1>
                    <div className={styles.aia}>
                        {urgentRequests.length === 0 ? (
                            <p>No urgent requests at the moment.</p>
                        ) : (
                            urgentRequests.slice(0, 3).map((req) => (
                                <div key={req.id} className={styles.one} onClick={() => openRequest(req)}>
                                    <div className={styles.img}>
                                        <img
                                            src={req.image || DEFAULT_IMAGE}
                                            alt="Pulse"
                                            className={styles.aoleu}
                                            onError={handleImageError}
                                        />
                                    </div>
                                    <div className={styles.sus1}>
                                        <div className={styles.profil}>
                                            <img
                                                src={req.user_avatar || DEFAULT_AVATAR}
                                                alt="User"
                                                className={styles.cafea}
                                                onError={handleAvatarError}
                                            />
                                        </div>
                                        <div className={styles.titlu}>@{req.user}</div>
                                        <div className={styles.timing}>• {new Date(req.created_at).toLocaleString()}</div>
                                    </div>

                                    <div className={styles.scris}>
                                        <div style={{ fontSize: '24px', lineHeight: '1.2' }}>
                                            {req.title}
                                            {req.pulse_type && <span className={styles.badge}>{req.pulse_type}</span>}
                                            {req.category && <span className={styles.badge}>{req.category}</span>}
                                        </div>
                                    </div>

                                    <div className={styles["maimult-scris"]}>
                                        {req.description && <p className={styles.descriptionLine}>{req.description}</p>}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                            {req.max_price && <span className={styles.priceTag}>💰 up to {req.max_price} €</span>}
                                            {req.expires_at && <span className={styles.timing}>⏰ {new Date(req.expires_at).toLocaleDateString()}</span>}
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
                <div className={styles.nush}>
                        <div>
                            <button className={styles.scrie} onClick={() => navigate(`/pulses`)}>See all pulses</button>
                        </div>
                    <div>
                        <button className={styles.vezi} onClick={() => navigate(`/urgent-requests`)}>See all requests</button>
                    </div>
                </div>
            </div>
        </div>
    );
}