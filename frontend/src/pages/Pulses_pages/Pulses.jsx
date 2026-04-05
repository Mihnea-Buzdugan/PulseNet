import React, {useEffect, useRef, useState} from "react";
import styles from '../../styles/Requests/UrgentRequests.module.css';
import Navbar from "@/components/Navbar";
import {useNavigate} from "react-router-dom";
import Loading from "@/components/Loading";
import Footer from "@/components/Footer";
import {MapPin} from "lucide-react"

export default function Pulses() {
    const [pulses, setPulses] = useState([]);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [pulseType, setPulseType] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");

    const socketRef = useRef(null);
    useEffect(() => {
        socketRef.current = new WebSocket("ws://localhost:8000/ws/pulses/");

        socketRef.current.onopen = () => {
            console.log("Connected to Pulse WebSocket");
        };

        socketRef.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle deleted pulses
                if (message.type === "pulse_deleted" && message.id) {
                    setPulses((prev) => prev.filter((p) => p.id !== message.id));
                    return;
                }

                if (message.type === "address_updated") {
                    setPulses((prev) =>
                        prev.map((p) =>
                            p.id === message.id ? { ...p, address: message.address } : p
                        )
                    );
                    return;
                }

                if (!message.id) return;

                let lat, lng;
                if (message.location && message.location.coordinates) {
                    [lng, lat] = message.location.coordinates;
                }

                const newPulse = { ...message, lat, lng };

                setPulses((prev) => {
                    if (prev.find((p) => p.id === newPulse.id)) return prev;
                    return [newPulse, ...prev];
                });

            } catch (err) {
                console.error("Error parsing websocket message:", err);
            }
        };

        socketRef.current.onerror = (err) => console.error("WebSocket Error:", err);

        socketRef.current.onclose = () => console.warn("WebSocket disconnected");

        return () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, []);

    useEffect(() => {
        const delay = setTimeout(() => {
            fetchPulses(1);
        }, 400);

        return () => clearTimeout(delay);
    }, [search, category, pulseType, minPrice, maxPrice, page]);

    const navigate = useNavigate();
    const fetchPulses = async (pageNumber = 1) => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                page: pageNumber,
                search,
                category,
                pulse_type: pulseType,
                min_price: minPrice,
                max_price: maxPrice,
            });

            const res = await fetch(`http://localhost:8000/accounts/list-all-pulses/?${params}`);
            if (!res.ok) throw new Error("Failed to load pulses");

            const data = await res.json();

            // Acum adresa vine direct din backend (pulse.address)
            const pulsesWithAddress = data.results.map(pulse => ({
                ...pulse,
                address: pulse.address || (pulse.location ? "Se caută adresa..." : "Global / Online")
            }));

            setPulses(pulsesWithAddress);
            setHasNext(data.has_next);
            setHasPrevious(data.has_previous);
            setPage(data.page);
        } catch (err) {
            setError(err.message || "Error");
        } finally {
            setLoading(false);
        }
    };


    const handleNext = () => { if (hasNext) fetchPulses(page + 1); };
    const handlePrevious = () => { if (hasPrevious) fetchPulses(page - 1); };

    const formatDate = (isoString) => {
        if (!isoString) return "N/A";
        return new Date(isoString).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    if (loading) return <Loading />

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
            <div className={styles.urgentRequestsWrap}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Pulses</h2>
                    <div className={styles.statusWrap}>
                        {loading && <span className={styles.loadingPulse}>Scanning Locations...</span>}
                        {error && <span className={styles.errorMessage}>{error}</span>}
                    </div>
                </div>

                <div className={styles.filterBar}>
                    <input
                        type="text"
                        placeholder="Search pulses..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select value={pulseType} onChange={(e) => setPulseType(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="servicii">Services</option>
                        <option value="obiecte">Objects</option>
                    </select>

                    <input
                        type="number"
                        placeholder="Min Price"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                    />

                    <input
                        type="number"
                        placeholder="Max Price"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                    />

                    <button className={styles.filterBtn} onClick={() => fetchPulses(1)}>Search</button>
                </div>

                <div className={styles.urgentRequestsGrid}>
                    {pulses.map((pulse) => (
                        <div className={styles.urgentRequestCard} key={pulse.id} onClick={() => navigate(`/pulse/${pulse.pulse_type}/${pulse.id}`)}>
                            <div className={styles.cardHeader}>
                                {pulse.images ? (
                                    <img src={pulse.images[0]} alt={pulse.title} className={styles.urgentRequestImage} />
                                ) : (
                                    <div className={styles.imagePlaceholder}>No Preview</div>
                                )}
                                <span className={styles.categoryBadge}>
                                {pulse.pulse_type === "servicii"
                                ? "Services"
                                : pulse.pulse_type === "obiecte" ? "Objects"
                                : "General"}
                                </span>
                            </div>

                            <div className={styles.cardBody}>
                                <h3 className={styles.cardTitle}>{pulse.title}</h3>
                                <p className={styles.cardUser}>@{pulse.user}</p>
                                <p className={styles.cardDescription}>{pulse.description}</p>

                                <div className={styles.metaData}>
                                    <div className={styles.metaRow}>
                                        <strong><MapPin className="mb-2"/> Address:</strong>
                                        <span className={styles.addressText}>{pulse.address}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.priceWrap}>
                                    <span className={styles.priceLabel}>Price</span>
                                    <span className={styles.priceValue}>
                                    {pulse.price ? `$${pulse.price}` : "Negotiable"}
                                </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {pulses.length > 0 && (
                    <div className={styles.carouselControls}>
                        <button onClick={handlePrevious} disabled={!hasPrevious || loading} className={styles.carouselBtn}>←</button>
                        <span className={styles.carouselPage}>{page}</span>
                        <button onClick={handleNext} disabled={!hasNext || loading} className={styles.carouselBtn}>→</button>
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
}