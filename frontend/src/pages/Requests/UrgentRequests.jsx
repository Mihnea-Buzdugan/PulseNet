import React, {useEffect, useRef, useState} from "react";
import styles from '../../styles/Requests/UrgentRequests.module.css';
import Navbar from "@/components/Navbar";
import {useNavigate} from "react-router-dom";
import Loading from "@/components/Loading";
import {Dog, Hammer, Leaf, Monitor, MoreHorizontal, Package, Sparkles, Truck, Wrench, Zap} from "lucide-react";
import Footer from "@/components/Footer";

const CATEGORIES = [
    { id: 'transport', label: 'Transport', icon: Truck },
    { id: 'labor', label: 'Help / Labor', icon: Wrench },
    { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
    { id: 'tech', label: 'IT Support', icon: Monitor },
    { id: 'delivery', label: 'Delivery', icon: Package },
    { id: 'pet_care', label: 'Pet Care', icon: Dog },
    { id: 'repair', label: 'Home Repair', icon: Hammer },
    { id: 'landscaping', label: 'Landscaping', icon: Leaf },
    { id: 'electrical', label: 'Electrical', icon: Zap },
    { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export default function UrgentRequests() {
    const [requests, setRequests] = useState([]);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");

    useEffect(() => {
        const delay = setTimeout(() => {
            fetchRequests(1);
        }, 400);

        return () => clearTimeout(delay);
    }, [search, category, minPrice, maxPrice]);

    const socketRef = useRef(null);
    useEffect(() => {
        // Initialize WebSocket
        socketRef.current = new WebSocket("ws://localhost:8000/ws/requests/");

        socketRef.current.onopen = () => {
            console.log("Connected to Request WebSocket");
        };

        socketRef.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // Handle deleted requests
                if (message.type === "request_deleted" && message.id) {
                    setRequests((prev) => prev.filter((p) => p.id !== message.id));
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
                setRequests((prev) => {
                    if (prev.find((p) => p.id === newRequest.id)) return prev;
                    return [newRequest, ...prev];
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

    const navigate = useNavigate();
    const fetchDetailedAddress = async (lat, lng) => {
        try {

            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
                {
                    headers: {
                        'Accept-Language': 'en'
                    }
                }
            );

            if (!res.ok) return "Location details unavailable";

            const data = await res.json();
            const addr = data.address;

            // 1. Get the Street
            const street = addr.road || "";

            // 2. Get the Number
            const houseNumber = addr.house_number || "";

            // 3. Get the City (with fallbacks for smaller towns/villages)
            const city = addr.city || addr.town || addr.village || addr.suburb || "";

            // Combine into "Street, Number, City"
            // .filter(Boolean) ensures we don't have double commas if a value is missing
            const formattedAddress = [street, houseNumber, city]
                .filter(Boolean)
                .join(", ");

            return formattedAddress || data.display_name.split(',').slice(0, 3).join(', ');

        } catch (err) {
            console.error("Geocoding error:", err);
            return "Unknown Location";
        }
    };

    const fetchRequests = async (pageNumber) => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                page: pageNumber,
                search,
                category,
                min_price: minPrice,
                max_price: maxPrice,
            });

            const res = await fetch(`http://localhost:8000/accounts/list-all-requests/?${params}`);
            if (!res.ok) throw new Error("Failed to load requests");

            const data = await res.json();
            const fetchedResults = data.results || [];

            // Run geocoding for all items in parallel
            const requestsWithDetails = await Promise.all(
                fetchedResults.map(async (req) => {
                    if (req.location) {
                        const address = await fetchDetailedAddress(req.location.lat, req.location.lng);
                        return { ...req, address };
                    }
                    return { ...req, address: "Global / Online" };
                })
            );

            setRequests(requestsWithDetails);
            setHasNext(data.has_next);
            setHasPrevious(data.has_previous);
            setPage(data.page);
        } catch (err) {
            setError(err.message || "Error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests(page);
    }, []);

    const handleNext = () => { if (hasNext) fetchRequests(page + 1); };
    const handlePrevious = () => { if (hasPrevious) fetchRequests(page - 1); };

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
                <h2 className={styles.title}>Urgent Requests</h2>
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

                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All Categories</option>

                    {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.label}
                        </option>
                    ))}
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

                <button className={styles.filterBtn} onClick={() => fetchRequests(1)}>Search</button>
            </div>

            <div className={styles.urgentRequestsGrid}>
                {requests.map((req) => (
                    <div className={styles.urgentRequestCard} key={req.id} onClick={() => navigate(`/request/${req.id}`)}>
                        <div className={styles.cardHeader}>
                            {req.image ? (
                                <img src={req.image} alt={req.title} className={styles.urgentRequestImage} />
                            ) : (
                                <div className={styles.imagePlaceholder}>No Preview</div>
                            )}
                            <span className={styles.categoryBadge}>{req.category || 'General'}</span>
                        </div>

                        <div className={styles.cardBody}>
                            <h3 className={styles.cardTitle}>{req.title}</h3>
                            <p className={styles.cardUser}>@{req.user}</p>
                            <p className={styles.cardDescription}>{req.description}</p>

                            <div className={styles.metaData}>
                                <div className={styles.metaRow}>
                                    <strong>⏰ Expires:</strong> {formatDate(req.expires_at)}
                                </div>
                                <div className={styles.metaRow}>
                                    <strong>📍 Address:</strong>
                                    <span className={styles.addressText}>{req.address}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.priceWrap}>
                                <span className={styles.priceLabel}>Budget</span>
                                <span className={styles.priceValue}>
                                    {req.max_price ? `$${req.max_price}` : "Negotiable"}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {requests.length > 0 && (
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