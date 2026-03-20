import React, { useEffect, useState } from "react";
import styles from '../../styles/Requests/UrgentRequests.module.css';
import Navbar from "@/components/Navbar";

export default function UrgentRequests() {
    const [requests, setRequests] = useState([]);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    const fetchRequests = async (pageNumber) => {
        try {
            setLoading(true);
            setError("");

            const res = await fetch(`http://localhost:8000/accounts/list-all-requests/?page=${pageNumber}`);
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

            <div className={styles.urgentRequestsGrid}>
                {requests.map((req) => (
                    <div className={styles.urgentRequestCard} key={req.id}>
                        <div className={styles.cardHeader}>
                            {req.images?.length > 0 ? (
                                <img src={req.images[0]} alt={req.title} className={styles.urgentRequestImage} />
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
                            <button className={styles.actionBtn}>Help Out</button>
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
        </div>
    );
}