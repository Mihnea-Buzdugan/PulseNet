import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { ArrowLeft, ArrowRight, MessageSquare, Calendar, MapPin, CreditCard } from "lucide-react";
import styles from "../../styles/Pulses_pages/pulseTransaction.module.css";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import "maplibre-gl/dist/maplibre-gl.css";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

function getLocationCoords(location) {
    // default coords (lon, lat)
    const defaultCoords = [27.5766, 47.1585];

    if (!location) return defaultCoords;
    if (Array.isArray(location)) return location;
    if (location.coordinates) return location.coordinates;
    return defaultCoords;
}

function getMapInstance(candidate) {
    if (!candidate) return null;

    // wrapper exposes getMap()
    if (typeof candidate.getMap === "function") {
        try {
            return candidate.getMap();
        } catch (e) {
            // ignore
        }
    }

    // wrapper might expose a property with the instance
    if (candidate.mapInstance) return candidate.mapInstance;
    if (candidate.map) return candidate.map;
    // maybe the ref is already the actual instance
    return typeof candidate.resize === "function" ? candidate : null;
}

export default function PulseTransaction() {
    const { pulseId } = useParams();
    const navigate = useNavigate();

    const [pulse, setPulse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState("");
    const [index, setIndex] = useState(0);

    // Rental period
    const [selectedStart, setSelectedStart] = useState(null);
    const [selectedEnd, setSelectedEnd] = useState(null);

    const [calendarEvents, setCalendarEvents] = useState([]);
    const [transactionLoading, setTransactionLoading] = useState(false);

    const [currentUser, setCurrentUser] = useState(null);
    const [proposedPrice, setProposedPrice] = useState("");
    const [priceError, setPriceError] = useState("");

    const mapRef = useRef(null);

    // Fetch pulse
    useEffect(() => {
        let mounted = true;
        const fetchPulse = async () => {
            try {
                const res = await fetch(`http://localhost:8000/accounts/pulse/${pulseId}/`, {
                    method: "GET",
                    credentials: "include",
                });
                const data = await res.json();
                if (mounted && data.success) {
                    setPulse(data.pulse);

                    // initialize proposed price with the pulse price once we have it
                    setProposedPrice(String(data.pulse?.price ?? ""));

                    const ranges = data.pulse.unavailable_ranges ?? data.pulse.reserved_periods ?? [];
                    const events = ranges
                        .map((r, i) => {
                            const start = r.start ?? r.start_date;
                            const end = r.end ?? r.end_date;
                            if (!start || !end) return null;
                            return {
                                id: `unav-${i}`,
                                start,
                                end,
                                // Use 'block' instead of 'background' to make them easily clickable
                                display: "block",
                                backgroundColor: "#fee2e2", // Light red bg
                                borderColor: "#ef4444",     // Dark red border
                                textColor: "#b91c1c",       // Red text
                                title: "Already Booked",
                                extendedProps: { type: "unavailable" }
                            };
                        })
                        .filter(Boolean);
                    setCalendarEvents(events);
                } else {
                    if (mounted) setStatusMsg("❌ Could not load pulse.");
                }
            } catch (err) {
                console.error("fetchPulse error:", err);
                if (mounted) setStatusMsg("❌ Error loading pulse.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchPulse();
        return () => (mounted = false);
    }, [pulseId]);

    // Fetch current user (so we can tell if the current user is the owner)
    useEffect(() => {
        let mounted = true;
        const fetchUser = async () => {
            try {
                // Adjust this endpoint to your backend's current-user endpoint if different.
                const res = await fetch("http://localhost:8000/accounts/current_user/", {
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

    useEffect(() => {
        if (!pulse) return;

        const coords = getLocationCoords(pulse.location);

        let mounted = true;

        const ensureMapReady = async () => {
            // Small initial delay to allow DOM/CSS layout
            await new Promise((r) => setTimeout(r, 250));

            let mapInst = getMapInstance(mapRef.current);

            // Poll for the instance (some wrappers initialize it slightly later)
            const start = Date.now();
            const timeout = 2000; // ms
            while (!mapInst && Date.now() - start < timeout && mounted) {
                await new Promise((r) => setTimeout(r, 150));
                mapInst = getMapInstance(mapRef.current);
            }

            if (!mounted) return;

            if (mapInst) {
                try {
                    // Resize and recenter/redraw the map
                    if (typeof mapInst.resize === "function") mapInst.resize();
                    if (typeof mapInst.setCenter === "function")
                        mapInst.setCenter([coords[0], coords[1]]);
                    else if (typeof mapInst.flyTo === "function")
                        mapInst.flyTo({ center: [coords[0], coords[1]] });

                    if (typeof mapInst.setZoom === "function") mapInst.setZoom(16);
                } catch (err) {
                    // final fallback
                    window.dispatchEvent(new Event("resize"));
                }
            } else {
                // If we couldn't detect an instance, force a resize event
                window.dispatchEvent(new Event("resize"));
            }
        };

        ensureMapReady();

        return () => {
            mounted = false;
        };
    }, [pulse]);

    useEffect(() => {
        const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 500);
        return () => clearTimeout(t);
    }, []);

    const images = useMemo(() => (pulse?.images ?? []), [pulse]);

    const next = () => images.length && setIndex(i => (i + 1) % images.length);
    const prev = () => images.length && setIndex(i => (i - 1 + images.length) % images.length);

    // Calendar date select handler
    const handleDateSelect = (selectInfo) => {
        const { start, end } = selectInfo;
        setSelectedStart(start);
        // FullCalendar 'end' is exclusive. Subtract 1 day so our local state is inclusive for math.
        setSelectedEnd(new Date(end.getTime() - 86400000));
    };

    // Prevent selecting over already booked/unavailable dates
    const handleSelectAllow = (selectInfo) => {
        const { start, end } = selectInfo;
        for (const ev of calendarEvents) {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.end);
            // If the selected range intersects with an unavailable event, block the selection
            if (start < evEnd && end > evStart) {
                return false;
            }
        }
        return true;
    };

    // Combine unavailable events with the currently selected range for visual feedback
    const displayEvents = useMemo(() => {
        const events = [...calendarEvents];
        if (selectedStart && selectedEnd) {
            events.push({
                id: "current-selection",
                start: selectedStart,
                end: new Date(selectedEnd.getTime() + 86400000),
                display: "block",
                title: "Selected Period",
                backgroundColor: "#10b981", // Emerald green
                borderColor: "#10b981",
            });
        }
        return events;
    }, [calendarEvents, selectedStart, selectedEnd]);

    const isOverlap = () => {
        if (!selectedStart || !selectedEnd) return false;
        for (const ev of calendarEvents) {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.end);
            if (selectedStart < evEnd && selectedEnd >= evStart) return true;
        }
        return false;
    };

    const totalDays = selectedStart && selectedEnd
        ? Math.max(1, Math.ceil((selectedEnd - selectedStart) / (1000 * 60 * 60 * 24)) + 1)
        : 0;

    const computeTotalPrice = () => {
        if (!selectedStart || !selectedEnd) return 0;
        const priceNum = Number(proposedPrice);
        if (!priceNum || priceNum <= 0) return 0;
        return totalDays * priceNum;
    };

    // Whether current user is the owner of this pulse
    const isOwner = !!(currentUser && pulse && Number(currentUser.id) === Number(pulse.user_id));

    const validatePrice = () => {
        const num = Number(proposedPrice);
        if (!proposedPrice) {
            setPriceError("Please enter a proposed price.");
            return false;
        }
        if (Number.isNaN(num) || num <= 0) {
            setPriceError("Price must be a positive number.");
            return false;
        }
        setPriceError("");
        return true;
    };

    const handleCreateRental = async () => {
        // Basic validations
        if (!selectedStart || !selectedEnd) {
            setStatusMsg("❌ Please select a rental period on the calendar.");
            return;
        }
        if (isOverlap()) {
            setStatusMsg("❌ Selected period overlaps with an existing reservation.");
            return;
        }
        if (isOwner) {
            setStatusMsg("❌ You are the owner of this pulse and cannot propose a rental to yourself.");
            return;
        }
        if (!validatePrice()) {
            setStatusMsg("❌ Please fix the proposed price.");
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
                pulse_id: pulse.id,
                start_date: selectedStart.toISOString(),
                end_date: selectedEnd.toISOString(),
                proposed_price: Number(proposedPrice),
            };

            const res = await fetch("http://localhost:8000/accounts/create_pulse_rental/", {
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
                setStatusMsg("✅ Rental proposal created successfully!");
                // Optionally navigate away or show the created proposal details
                setTimeout(() => navigate("/"), 1600);
            } else {
                setStatusMsg(`❌ ${data.error || "Failed to create rental proposal."}`);
            }
        } catch (err) {
            console.error(err);
            setStatusMsg("❌ Error while creating rental proposal.");
        } finally {
            setTransactionLoading(false);
        }
    };

    const handleEventClick = (info) => {
        if (info.event.extendedProps.type === "unavailable") {
            setStatusMsg("ℹ️ This period is already reserved by another user.");
            // Optional: clear message after 3 seconds
            setTimeout(() => setStatusMsg(""), 3000);
        }
    };

    const todayStr = new Date().toISOString().split("T")[0];

    if (loading) return <div className={styles.loader}>Loading...</div>;
    if (!pulse) return <div className={styles.loader}>Pulse not found</div>;

    const coords = getLocationCoords(pulse.location);

    const totalPrice = computeTotalPrice();

    return (
        <div className={styles.body}>
            <Navbar />
            <div className={styles.mainContainer}>

                <div className={styles.header}>
                    <h1 className={styles.title}>Book {pulse.name}</h1>
                    <p className={styles.subtitle}>Review details, select your dates, and confirm your rental proposal.</p>
                </div>

                <div className={styles.pageGrid}>
                    {/* LEFT COLUMN: Carousel + Form */}
                    <div className={styles.leftCard}>
                        <div className={styles.carousel}>
                            <button className={styles.carouselBtn} onClick={prev}><ArrowLeft size={20} /></button>
                            {images.length ? (
                                <img src={images[index]} alt="pulse" className={styles.carouselImg} />
                            ) : (
                                <div className={styles.noImage}>No image available</div>
                            )}
                            <button className={styles.carouselBtn} onClick={next}><ArrowRight size={20}/></button>
                        </div>

                        <div className={styles.detailsSection}>
                            <div className={styles.sellerInfo}>
                                <img src={`https://ui-avatars.com/api/?name=${pulse.user}&background=random`} alt="Seller" className={styles.avatar} />
                                <div>
                                    <p className={styles.sellerName}>Hosted by <strong>@{pulse.user}</strong></p>
                                    <button className={styles.textBtn} onClick={() => navigate(`/direct-chat/${pulse.user_id}`)}>
                                        <MessageSquare size={14} /> Contact Seller
                                    </button>
                                </div>
                            </div>
                            <div className={styles.priceTag}>
                                <h2>{pulse.price} {pulse.currency}</h2>
                                <span>/ day (listed)</span>
                            </div>
                        </div>

                        <hr className={styles.divider} />

                        <div className={styles.formSection}>
                            <h3 className={styles.sectionTitle}><CreditCard size={18}/> Booking Summary</h3>

                            <p className={styles.helperText}>
                                You can propose a custom price for this rental. The pulse owner will review it.
                            </p>

                            <label className={styles.proposedPriceLabel}>
                                Proposed price (per day)
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={proposedPrice}
                                    onChange={(e) => setProposedPrice(e.target.value)}
                                    onBlur={validatePrice}
                                    className={styles.priceInput}
                                />
                            </label>
                            {priceError && <div className={styles.errorAlert}>{priceError}</div>}

                            {selectedStart && selectedEnd ? (
                                <div className={styles.summaryBox}>
                                    <div className={styles.summaryRow}>
                                        <span>{Number(proposedPrice || 0).toFixed(2)} {pulse.currency} x {totalDays} days</span>
                                        <span>{totalPrice.toFixed(2)} {pulse.currency}</span>
                                    </div>
                                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                                        <strong>Total</strong>
                                        <strong>{totalPrice.toFixed(2)} {pulse.currency}</strong>
                                    </div>
                                </div>
                            ) : (
                                <p className={styles.helperText}>Select dates on the calendar to see the total price.</p>
                            )}

                            {isOverlap() && (
                                <div className={styles.errorAlert}>
                                    Selected period overlaps with existing reservations.
                                </div>
                            )}

                            {isOwner ? (
                                <div className={styles.infoAlert}>
                                    You are the owner of this pulse — you cannot propose a rental to yourself.
                                </div>
                            ) : null}

                            <button
                                className={styles.buyBtn}
                                onClick={handleCreateRental}
                                disabled={transactionLoading || !selectedStart || !selectedEnd || isOverlap() || isOwner}
                            >
                                {transactionLoading ? "Processing..." : "Propose Rental"}
                            </button>
                            {statusMsg && <div className={styles.statusMsg}>{statusMsg}</div>}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Calendar + Map */}
                    <div className={styles.sidebar}>
                        <div className={styles.card}>
                            <h3 className={styles.sectionTitle}><Calendar size={18}/> Select Dates</h3>
                            <p className={styles.helperText}>Click and drag to select your rental period.</p>
                            <div className={styles.calendarWrapper}>
                                <FullCalendar
                                    plugins={[dayGridPlugin, interactionPlugin]}
                                    initialView="dayGridMonth"
                                    selectable={true}
                                    selectAllow={handleSelectAllow}
                                    validRange={{ start: todayStr }}
                                    select={handleDateSelect}
                                    events={displayEvents}
                                    eventClick={handleEventClick} // Handle the label click
                                    height={400}
                                    headerToolbar={{
                                        left: "prev",
                                        center: "title",
                                        right: "next"
                                    }}
                                    // Custom styling for the event labels
                                    eventContent={(eventInfo) => (
                                        <div className={styles.calendarEventLabel}>
                                            <b>{eventInfo.event.title}</b>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        <div className={styles.card}>
                            <h3 className={styles.sectionTitle}><MapPin size={18}/> Pickup Location</h3>
                            <div className={styles.mapWrapper}>
                                <Map
                                    key={`${coords[0]}-${coords[1]}-${pulse.id}`}
                                    ref={mapRef}
                                    center={coords}
                                    zoom={16}
                                >
                                    <MapMarker longitude={coords[0]} latitude={coords[1]}>
                                        <MarkerContent>
                                        </MarkerContent>
                                    </MapMarker>
                                </Map>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}