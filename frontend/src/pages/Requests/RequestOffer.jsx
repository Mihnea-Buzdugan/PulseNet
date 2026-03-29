import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { ArrowLeft, ArrowRight, MessageSquare, MapPin, CreditCard } from "lucide-react";
// Assuming you reuse the same stylesheet or create a similar one
import styles from "../../styles/Pulses_pages/pulseTransaction.module.css";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import "maplibre-gl/dist/maplibre-gl.css";
import Footer from "@/components/Footer";

function getLocationCoords(location) {
    const defaultCoords = [27.5766, 47.1585];
    if (!location) return defaultCoords;
    if (Array.isArray(location)) return location;
    if (location.coordinates) return location.coordinates;
    return defaultCoords;
}

function getMapInstance(candidate) {
    if (!candidate) return null;
    if (typeof candidate.getMap === "function") {
        try { return candidate.getMap(); } catch (e) { /* ignore */ }
    }
    if (candidate.mapInstance) return candidate.mapInstance;
    if (candidate.map) return candidate.map;
    return typeof candidate.resize === "function" ? candidate : null;
}

export default function RequestOffer() {
    const { requestId } = useParams();
    const navigate = useNavigate();

    const [requestItem, setRequestItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState("");
    const [index, setIndex] = useState(0);

    const [transactionLoading, setTransactionLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // For the UrgentRequestOffer total_price
    const [offerPrice, setOfferPrice] = useState("");
    const [priceError, setPriceError] = useState("");

    const mapRef = useRef(null);

    // Fetch Urgent Request Details
    useEffect(() => {
        let mounted = true;
        const fetchRequest = async () => {
            try {
                // UPDATE THIS ENDPOINT to match your Django URL for fetching a single UrgentRequest
                const res = await fetch(`http://localhost:8000/accounts/urgent-request/${requestId}/`, {
                    method: "GET",
                    credentials: "include",
                });
                const data = await res.json();
                if (mounted && data.success) {
                    setRequestItem(data.request);
                    // Initialize with a default budget/price if the request model has one
                    setOfferPrice(String(data.request?.max_price ?? ""));
                } else {
                    if (mounted) setStatusMsg("❌ Could not load the request.");
                }
            } catch (err) {
                console.error("fetchRequest error:", err);
                if (mounted) setStatusMsg("❌ Error loading the request.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchRequest();
        return () => (mounted = false);
    }, [requestId]);

    // Fetch Current User
    useEffect(() => {
        let mounted = true;
        const fetchUser = async () => {
            try {
                const res = await fetch("http://localhost:8000/accounts/user/", {
                    method: "GET",
                    credentials: "include",
                });
                if (!mounted) return;
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.user) setCurrentUser(data.user);
                    else setCurrentUser(null);
                } else {
                    setCurrentUser(null);
                }
            } catch (err) {
                console.warn("Could not fetch current user:", err);
                if (mounted) setCurrentUser(null);
            }
        };
        fetchUser();
        return () => (mounted = false);
    }, []);

    // Map Initialization
    useEffect(() => {
        if (!requestItem) return;

        const coords = getLocationCoords(requestItem.location);
        let mounted = true;

        const ensureMapReady = async () => {
            await new Promise((r) => setTimeout(r, 250));
            let mapInst = getMapInstance(mapRef.current);
            const start = Date.now();
            const timeout = 2000;

            while (!mapInst && Date.now() - start < timeout && mounted) {
                await new Promise((r) => setTimeout(r, 150));
                mapInst = getMapInstance(mapRef.current);
            }

            if (!mounted) return;

            if (mapInst) {
                try {
                    if (typeof mapInst.resize === "function") mapInst.resize();
                    if (typeof mapInst.setCenter === "function")
                        mapInst.setCenter([coords[0], coords[1]]);
                    else if (typeof mapInst.flyTo === "function")
                        mapInst.flyTo({ center: [coords[0], coords[1]] });

                    if (typeof mapInst.setZoom === "function") mapInst.setZoom(16);
                } catch (err) {
                    window.dispatchEvent(new Event("resize"));
                }
            } else {
                window.dispatchEvent(new Event("resize"));
            }
        };

        ensureMapReady();
        return () => { mounted = false; };
    }, [requestItem]);

    // Resize fallback
    useEffect(() => {
        const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 500);
        return () => clearTimeout(t);
    }, []);

    const images = useMemo(() => (requestItem?.images ?? []), [requestItem]);
    const next = () => images.length && setIndex(i => (i + 1) % images.length);
    const prev = () => images.length && setIndex(i => (i - 1 + images.length) % images.length);

    // Validate if current user is the original requester
    const isOwner = !!(currentUser && requestItem && Number(currentUser.id) === Number(requestItem.user_id));

    const validatePrice = () => {
        const num = Number(offerPrice);
        if (!offerPrice) {
            setPriceError("Please enter a proposed offer.");
            return false;
        }
        if (Number.isNaN(num) || num <= 0) {
            setPriceError("Offer must be a positive number.");
            return false;
        }

        // --- NEW VALIDATION: Ensure price doesn't exceed the max budget ---
        if (requestItem && requestItem.max_price !== null && requestItem.max_price !== undefined) {
            const maxBudget = Number(requestItem.max_price);
            if (!Number.isNaN(maxBudget) && num > maxBudget) {
                setPriceError(`Offer cannot exceed the target budget of ${requestItem.max_price} ${requestItem.currency || "USD"}.`);
                return false;
            }
        }

        setPriceError("");
        return true;
    };

    const handleCreateOffer = async () => {
        if (isOwner) {
            setStatusMsg("❌ You cannot make an offer on your own request.");
            return;
        }
        if (!validatePrice()) {
            setStatusMsg("❌ Please fix the proposed offer price.");
            return;
        }

        setTransactionLoading(true);
        setStatusMsg("");

        try {
            const csrfToken = document.cookie
                .split("; ")
                .find(row => row.startsWith("csrftoken="))
                ?.split("=")[1];

            const payload = {
                request_id: requestItem.id,
                proposed_price: Number(offerPrice),
            };

            // UPDATE THIS ENDPOINT to match your Django URL for creating a RequestOffer
            const res = await fetch(`http://localhost:8000/accounts/create_request_offer/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setStatusMsg("✅ Offer submitted successfully!");
                setTimeout(() => navigate("/"), 1600); // Navigate to a success/dashboard page
            } else {
                setStatusMsg(`❌ ${data.error || "Failed to submit offer."}`);
            }
        } catch (err) {
            console.error(err);
            setStatusMsg("❌ Error while submitting offer.");
        } finally {
            setTransactionLoading(false);
        }
    };

    if (loading) return <div className={styles.loader}>Loading...</div>;
    if (!requestItem) return <div className={styles.loader}>Request not found</div>;

    const coords = getLocationCoords(requestItem.location);

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />
                <div className={styles.header}>
                    <h1 className={styles.title}>Make an Offer for {requestItem.title || requestItem.name}</h1>
                    <p className={styles.subtitle}>Review the request details and submit your price offer.</p>
                </div>

                <div className={styles.pageGrid}>
                    {/* LEFT COLUMN: Carousel + Form */}
                    <div className={styles.leftCard}>
                        <div className={styles.carousel}>
                            <button className={styles.carouselBtn} onClick={prev}><ArrowLeft size={20} /></button>
                            {images.length ? (
                                <img src={images[index]} alt="Request" className={styles.carouselImg} />
                            ) : (
                                <div className={styles.noImage}>No image available</div>
                            )}
                            <button className={styles.carouselBtn} onClick={next}><ArrowRight size={20}/></button>
                        </div>

                        <div className={styles.detailsSection}>
                            <div className={styles.sellerInfo}>
                                <img src={`https://ui-avatars.com/api/?name=${requestItem.user}&background=random`} alt="Requester" className={styles.avatar} />
                                <div>
                                    <p className={styles.sellerName}>Requested by <strong>@{requestItem.user}</strong></p>
                                    <button className={styles.textBtn} onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/direct-chat/${requestItem.user_id}`, { state: { fromRequest: true } });
                                    }}>
                                        <MessageSquare size={14} /> Contact Requester
                                    </button>
                                </div>
                            </div>
                            {/* Target budget display */}
                            {requestItem.max_price && (
                                <div className={styles.priceTag}>
                                    <h2>{requestItem.max_price} {requestItem.currency || "USD"}</h2>
                                    <span>(Target Budget)</span>
                                </div>
                            )}
                        </div>

                        <hr className={styles.divider} />

                        <div className={styles.formSection}>
                            <h3 className={styles.sectionTitle}><CreditCard size={18}/> Submit Your Offer</h3>

                            <p className={styles.helperText}>
                                Enter the total amount you are asking to fulfill this request. It cannot exceed the target budget.
                            </p>

                            <label className={styles.proposedPriceLabel}>
                                Your Offer Price
                                <input
                                    type="number"
                                    min="0.01"
                                    max={requestItem.max_price || ""}
                                    step="0.01"
                                    value={offerPrice}
                                    onChange={(e) => setOfferPrice(e.target.value)}
                                    onBlur={validatePrice}
                                    className={styles.priceInput}
                                    placeholder={`Max ${requestItem.max_price || "budget"}`}
                                />
                            </label>
                            {priceError && <div className={styles.errorAlert}>{priceError}</div>}

                            {isOwner && (
                                <div className={styles.infoAlert}>
                                    You are the creator of this request — you cannot make an offer to yourself.
                                </div>
                            )}

                            <button
                                className={styles.buyBtn}
                                onClick={handleCreateOffer}
                                // Added `!!priceError` to instantly disable the button if the validation fails
                                disabled={transactionLoading || isOwner || !offerPrice || !!priceError}
                            >
                                {transactionLoading ? "Submitting..." : "Submit Offer"}
                            </button>
                            {statusMsg && <div className={styles.statusMsg}>{statusMsg}</div>}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Map */}
                    <div className={styles.sidebar}>
                        <div className={styles.card}>
                            <h3 className={styles.sectionTitle}><MapPin size={18}/> Request Location</h3>
                            <p className={styles.helperText}>This is where the requester needs the service/item.</p>
                            <div className={styles.mapWrapper}>
                                <Map
                                    key={`${coords[0]}-${coords[1]}-${requestItem.id}`}
                                    ref={mapRef}
                                    center={coords}
                                    zoom={16}
                                >
                                    <MapMarker longitude={coords[0]} latitude={coords[1]}>
                                        <MarkerContent />
                                    </MapMarker>
                                </Map>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            <Footer />
        </div>
    );
}