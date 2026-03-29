import React, { useEffect, useState } from "react";
import styles from '../../styles/Requests/UrgentRequests.module.css';
import Navbar from "@/components/Navbar";
import {useNavigate} from "react-router-dom";
import Loading from "@/components/Loading";
import Footer from "@/components/Footer";

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

    useEffect(() => {
        const delay = setTimeout(() => {
            fetchPulses(1);
        }, 400);

        return () => clearTimeout(delay);
    }, [search, category, pulseType, minPrice, maxPrice]);

    const navigate = useNavigate();
    const fetchDetailedAddress = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
                {
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'YourAppName/1.0'
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

            const res = await fetch(
                `http://localhost:8000/accounts/list-all-pulses/?${params}`
            );

            if (!res.ok) throw new Error("Failed to load pulses");

            const data = await res.json();

            const pulsesWithDetails = await Promise.all(
                data.results.map(async (pulse) => {
                    if (pulse.location) {
                        const address = await fetchDetailedAddress(
                            pulse.location.lat,
                            pulse.location.lng
                        );
                        return { ...pulse, address };
                    }
                    return { ...pulse, address: "Global / Online" };
                })
            );

            setPulses(pulsesWithDetails);
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
        fetchPulses(page);
    }, []);

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
                        <option value="servicii">Servicii</option>
                        <option value="obiecte">Obiecte</option>
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
                        <div className={styles.urgentRequestCard} key={pulse.id} onClick={() => navigate(`/pulse/${pulse.pulseType}/${pulse.id}`)}>
                            <div className={styles.cardHeader}>
                                {pulse.images?.length > 0 ? (
                                    <img src={pulse.images[0]} alt={pulse.title} className={styles.urgentRequestImage} />
                                ) : (
                                    <div className={styles.imagePlaceholder}>No Preview</div>
                                )}
                                <span className={styles.categoryBadge}>{pulse.category || 'General'}</span>
                            </div>

                            <div className={styles.cardBody}>
                                <h3 className={styles.cardTitle}>{pulse.title}</h3>
                                <p className={styles.cardUser}>@{pulse.user}</p>
                                <p className={styles.cardDescription}>{pulse.description}</p>

                                <div className={styles.metaData}>
                                    <div className={styles.metaRow}>
                                        <strong>📍 Address:</strong>
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