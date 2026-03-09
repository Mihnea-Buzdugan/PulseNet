import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "../../styles/index.module.css";
import { useNavigate } from "react-router-dom";
import { Map, MapClusterLayer, MapPopup, MapControls } from "@/components/ui/map";
import "../../App.css";

export default function Index() {
    const navigate = useNavigate();

    // feeds
    const [latestPulses, setLatestPulses] = useState([]);
    const [nearestPulses, setNearestPulses] = useState([]);

    // pagination / loading
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(false);

    // geolocation
    const [userLocation, setUserLocation] = useState(null);

    // map popup
    const [selectedPoint, setSelectedPoint] = useState(null);

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

    useEffect(() => {
        // 1. Initialize the connection
        // Note: use 'ws' for localhost and 'wss' for production (HTTPS)
        const socket = new WebSocket("ws://localhost:8000/ws/pulses/");

        // 2. Listen for the "Open" event
        socket.onopen = () => {
            console.log("Connected to Pulse WebSocket");
        };

        // 3. Handle incoming data
        socket.onmessage = (event) => {
            const newPulse = JSON.parse(event.data);
            console.log("New Pulse received:", newPulse);

            setLatestPulses((prev) => {
                // Only add if it doesn't already exist in the list
                if (prev.find(p => p.id === newPulse.id)) return prev;
                return [newPulse, ...prev];
            });

            // B. Update the Map (if it has coordinates)
            if (newPulse.lat && newPulse.lng) {
                setNearestPulses((prev) => {
                    // Prevent duplicates if the signal fires twice
                    if (prev.find(p => p.id === newPulse.id)) return prev;
                    return [newPulse, ...prev];
                });
            }
        };

        // 4. Handle errors/closure
        socket.onerror = (err) => console.error("WebSocket Error:", err);
        socket.onclose = () => console.warn(" WebSocket disconnected");

        // 5. Cleanup: Close the connection when the component unmounts
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
                setLatestPulses((prev) => (pageNum === 1 ? data.pulses : [...prev, ...data.pulses]));
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

    // initial load: latest page 1
    useEffect(() => {
        fetchLatestPulses(1);
    }, []);

    // when user location appears, fetch nearest
    useEffect(() => {
        fetchNearestPulses();
    }, [userLocation]);

    // -------------------------
    // prepare GeoJSON for pulses (even if empty)
    // -------------------------
    const pulsesGeoJSON = {
        type: "FeatureCollection",
        features: nearestPulses.map((pulse) => ({
            type: "Feature",
            geometry: {
                type: "Point",
                // ensure your backend sends lat & lng
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
            },
        })),
    };

    // -------------------------
    // user location GeoJSON (single point)
    // -------------------------
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

    // -------------------------
    // map center (user fallback to Iași)
    // -------------------------
    const mapCenter = userLocation ? [userLocation.lng, userLocation.lat] : [27.6014, 47.1585];

    // -------------------------
    // UI helpers
    // -------------------------
    const openPulse = (pulse) => navigate(`/pulse/${pulse.type}/${pulse.id}`);

    const loadMore = () => {
        if (hasNext && !loading) fetchLatestPulses(page + 1);
    };

    // -------------------------
    // render
    // -------------------------
    return (
        <div className={styles.body}>
            <Navbar />
            <div className={styles.mainContainer}>
                {/* MAP */}
                <div className={styles.mapContainer}>
                    <Map center={mapCenter} zoom={12} fadeDuration={0}>
                        {/* pulses layer (clustered) */}
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

                        {/* user location as green single-point layer (clusterRadius 0 so no clustering) */}
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

                        {/* popup (works for pulses & user) */}
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

                                    {selectedPoint.properties.price !== undefined && selectedPoint.properties.price !== "" && (
                                        <p>💰 {selectedPoint.properties.price} {selectedPoint.properties.currency}</p>
                                    )}

                                    {selectedPoint.properties.user && (
                                        <p>👤 @{selectedPoint.properties.user}</p>
                                    )}

                                    {selectedPoint.properties.distance !== undefined && selectedPoint.properties.distance !== "" && (
                                        <p>📍 {selectedPoint.properties.distance} km away</p>
                                    )}
                                </div>
                            </MapPopup>
                        )}

                        <MapControls />
                    </Map>
                </div>

                {/* NEARBY PULSES LIST */}
                {/* LATEST PULSES */}
                <h2 className={styles.feedTitle}>Latest Pulses</h2>
                <div className={styles.pulseGrid}>
                    {latestPulses.map((pulse, index) => (
                        <div
                            key={`${pulse.id}-${index}`}
                            className={styles.productCard}
                            onClick={() => openPulse(pulse)}
                            style={{ cursor: "pointer" }}
                        >
                            <div className={styles.imageContainer}>
                                <div className={styles.typeBadge}>{pulse.type}</div>
                                {pulse.image ? (
                                    <img src={pulse.image} alt={pulse.name} className={styles.productImage} />
                                ) : (
                                    <div className={styles.noImagePlaceholder}>📦</div>
                                )}
                            </div>

                            <div className={styles.contentWrapper}>
                                <h3 className={styles.productTitle}>{pulse.name}</h3>
                                <span className={styles.postDate}>🕒 {pulse.timestamp}</span>

                                <div className={styles.priceContainer}>
                                    <div>
                                        <span className={styles.priceLabel}>{pulse.price}</span>
                                        <span className={styles.currencyLabel}>{pulse.currency}</span>
                                    </div>
                                    <span className={styles.userName}>@{pulse.user}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* LOAD MORE */}
                {hasNext && (
                    <button onClick={loadMore} className={styles.loadMoreBtn} disabled={loading}>
                        {loading ? "Se încarcă..." : "Vezi mai multe"}
                    </button>
                )}
            </div>
        </div>
    );
}