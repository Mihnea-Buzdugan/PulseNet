import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "../../components/Navbar";
import styles from "../../styles/User_pages/profile.module.css";
import Loading from "../../components/Loading";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function ChangeView({ center, radiusKm }) {
    const map = useMap();
    useEffect(() => {
        const radiusM = (radiusKm || 1) * 1000;
        const lat = center[0];
        const lng = center[1];
        const latDelta = radiusM / 111320;
        const lngDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
        map.fitBounds(
            [
                [lat - latDelta, lng - lngDelta],
                [lat + latDelta, lng + lngDelta],
            ],
            { padding: [30, 30] }
        );
    }, [center, radiusKm]);
    return null;
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

const formatTimeForInput = (timeString) => {
    if (!timeString) return "";
    return timeString.length >= 5 ? timeString.substring(0, 5) : timeString;
};

const formatDate = (dateString) => {
    try {
        const d = new Date(dateString);
        return d.toLocaleString("ro-RO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return dateString;
    }
};

const formatCurrency = (value, currency = "lei") => {
    if (value == null) return "";
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${currency}`;
};

export default function Profile() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [pulseFilter, setPulseFilter] = useState("obiecte");

    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const lastObjectUrlRef = useRef(null);
    const previousProfileUrlRef = useRef(null);
    const [editForm, setEditForm] = useState({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        biography: "",
        online_status: "offline",
        quiet_hours_start: "",
        quiet_hours_end: "",
        visibility_radius: 1,
        lat: null,
        lng: null,
    });

    // rental offers state (offers for user's pulses)
    const [rentalOffers, setRentalOffers] = useState([]);
    const [offersLoading, setOffersLoading] = useState(true);

    const [rentalProposals, setRentalProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(true);
    // counteroffer modal state
    const [counterModal, setCounterModal] = useState({
        show: false,
        id: null,
        price: "",
    });

    const [deleteProposalModal, setDeleteProposalModal] = useState({
        show: false,
        id: null,
    });

    // accept/decline modals
    const [acceptModal, setAcceptModal] = useState({ show: false, id: null });
    const [declineModal, setDeclineModal] = useState({ show: false, id: null });

    const openDeleteModal = (proposal) => {
        setDeleteProposalModal({ show: true, id: proposal.id });
    };

    const closeDeleteModal = () => {
        setDeleteProposalModal({ show: false, id: null });
    };

    useEffect(() => {
        const csrfToken = getCookie("csrftoken");
        fetch("http://localhost:8000/accounts/profile/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            credentials: "include",
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.user) {
                    setUser(data.user);
                    setPreview(data.user.profilePicture || null);

                    if (data.user.location?.coordinates) {
                        setEditForm((prev) => ({
                            ...prev,
                            lng: data.user.location.coordinates[0],
                            lat: data.user.location.coordinates[1],
                        }));
                    }
                }
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching profile:", error);
                setLoading(false);
            });
    }, []);

    // fetch rental offers for pulses owned by the user
    useEffect(() => {
        const fetchData = async () => {
            setOffersLoading(true);
            setProposalsLoading(true);

            try {
                // Fetch rental offers (as owner)
                const offersRes = await fetch("http://localhost:8000/accounts/pulse_rentals/", {
                    method: "GET",
                    credentials: "include", // ✅ send session cookies
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                });

                if (offersRes.ok) {
                    const offersData = await offersRes.json();
                    setRentalOffers(Array.isArray(offersData) ? offersData : offersData.rentals || []);
                } else {
                    console.warn("Failed to fetch rental offers:", offersRes.status);
                }

                // Fetch rental proposals (as renter)
                const proposalsRes = await fetch("http://localhost:8000/accounts/pulse_own_proposals/", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                });

                if (proposalsRes.ok) {
                    const proposalsData = await proposalsRes.json();
                    setRentalProposals(proposalsData);
                } else {
                    console.warn("Failed to fetch rental proposals:", proposalsRes.status);
                }
            } catch (err) {
                console.error("Network error fetching rental data:", err);
            } finally {
                setOffersLoading(false);
                setProposalsLoading(false);
            }
        };

        fetchData();
    }, []);

    const isUserSleeping = () => {
        if (!user?.quiet_hours_start || !user?.quiet_hours_end) return false;
        const now = new Date();
        const [startHour, startMinute] = user.quiet_hours_start.split(":").map(Number);
        const [endHour, endMinute] = user.quiet_hours_end.split(":").map(Number);
        const start = new Date();
        start.setHours(startHour, startMinute, 0);
        const end = new Date();
        end.setHours(endHour, endMinute, 0);
        if (end < start) {
            if (now >= start) return true;
            if (now <= end || now >= start) return true;
        }
        return now >= start && now <= end;
    };

    useEffect(() => {
        return () => {
            if (lastObjectUrlRef.current) {
                URL.revokeObjectURL(lastObjectUrlRef.current);
                lastObjectUrlRef.current = null;
            }
        };
    }, []);

    const filteredPulses = useMemo(() => {
        if (!user || !user.pulses) return [];
        return user.pulses.filter((p) => p.pulseType === pulseFilter);
    }, [user, pulseFilter]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const csrfToken = getCookie("csrftoken");
        try {
            const response = await fetch("http://localhost:8000/accounts/update_profile/", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify({
                    ...editForm,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                setEditMode(false);
            } else {
                const errorData = await response.json();
                console.error("Failed to update profile:", errorData);
                alert("Error updating profile. Please try again.");
            }
        } catch (error) {
            console.error("Network error while saving profile:", error);
        }
    };

    const openFilePicker = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            e.target.value = "";
            return;
        }
        const maxMB = 20;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`Please choose an image smaller than ${maxMB} MB.`);
            e.target.value = "";
            return;
        }
        if (lastObjectUrlRef.current) {
            URL.revokeObjectURL(lastObjectUrlRef.current);
            lastObjectUrlRef.current = null;
        }
        const objectUrl = URL.createObjectURL(file);
        lastObjectUrlRef.current = objectUrl;
        previousProfileUrlRef.current = user?.profilePicture || preview || null;
        setPreview(objectUrl);
        setUser((prev) => (prev ? { ...prev, profilePicture: objectUrl } : prev));

        const uploadUrl = "http://localhost:8000/accounts/upload_profile_picture/";
        const csrfToken = getCookie("csrftoken");
        const form = new FormData();
        form.append("profile_picture", file);
        setUploading(true);
        try {
            const res = await fetch(uploadUrl, {
                method: "POST",
                body: form,
                credentials: "include",
                headers: { "X-CSRFToken": csrfToken },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    setUser(data.user);
                    setPreview(data.user.profilePicture || null);
                } else if (data.url) {
                    setUser((prev) => (prev ? { ...prev, profilePicture: data.url } : prev));
                    setPreview(data.url);
                } else {
                    console.warn("Upload response did not include user or url:", data);
                }
            } else {
                alert("Failed to upload image. Please try again.");
                const prevUrl = previousProfileUrlRef.current;
                setPreview(prevUrl);
                setUser((prev) => (prev ? { ...prev, profilePicture: prevUrl } : prev));
            }
        } catch (uploadError) {
            console.error("Network error during upload:", uploadError);
            alert("Network error while uploading. Please try again.");
            const prevUrl = previousProfileUrlRef.current;
            setPreview(prevUrl);
            setUser((prev) => (prev ? { ...prev, profilePicture: prevUrl } : prev));
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleDeleteProfilePicture = async () => {
        try {
            const response = await fetch("http://localhost:8000/accounts/delete_profile_picture/", {
                method: "POST",
                credentials: "include",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            });
            if (!response.ok) throw new Error("Failed to delete profile picture");
            setUser((prev) => ({ ...prev, profilePicture: null }));
            setPreview(null);
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting profile picture:", error);
            alert("Failed to delete profile picture.");
        }
    };

    const handleRemovePulse = async (id) => {
        if (!window.confirm("Sigur vrei să ștergi acest anunț?")) return;
        try {
            const response = await fetch(`http://localhost:8000/accounts/remove_pulse/${id}/`, {
                method: "DELETE",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                credentials: "include",
            });
            if (response.ok) {
                setUser((prev) => ({
                    ...prev,
                    pulses: prev.pulses.filter((p) => p.id !== id),
                }));
            }
        } catch (error) {
            console.error("Error removing pulse:", error);
        }
    };

    // --- Rental Offers actions ---
    const updateOfferInState = (id, newValues) => {
        setRentalOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...newValues } : o)));
    };

    const updateProposalInState = (id, updatedFields) => {
        setRentalProposals((prevProposals) =>
            prevProposals.map((proposal) =>
                proposal.id === id ? { ...proposal, ...updatedFields } : proposal
            )
        );
    };

    const handleAcceptOffer = async (id) => {
        // decide which endpoint to call based on whether id is in rentalProposals
        const isProposal = rentalProposals.some((p) => p.id === id);
        const url = `http://localhost:8000/accounts/pulse_rentals/${id}/`;

        try {
            const res = await fetch(url, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ status: "confirmed" }),
            });
            if (res.ok) {
                const updated = await res.json();

                if (isProposal) {
                    updateProposalInState(id, { status: updated.status || "confirmed" });
                } else {
                    updateOfferInState(id, { status: updated.status || "confirmed" });
                }
            } else {
                alert("Eroare la acceptarea ofertei.");
            }
        } catch (err) {
            console.error("Network error while accepting offer:", err);
            alert("Eroare de rețea. Încearcă din nou.");
        } finally {
            setAcceptModal({ show: false, id: null });
        }
    };

    const handleDeclineOffer = async (id) => {
        // decide which endpoint to call based on whether id is in rentalProposals
        const isProposal = rentalProposals.some((p) => p.id === id);
        const url = `http://localhost:8000/accounts/pulse_rentals/${id}/`;

        try {
            const res = await fetch(url, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ status: "declined" }),
            });
            if (res.ok) {
                const updated = await res.json();

                if (isProposal) {
                    updateProposalInState(id, { status: updated.status || "declined" });
                } else {
                    updateOfferInState(id, { status: updated.status || "declined" });
                }
            } else {
                alert("Eroare la refuzarea ofertei.");
            }
        } catch (err) {
            console.error("Network error while declining offer:", err);
            alert("Eroare de rețea. Încearcă din nou.");
        } finally {
            setDeclineModal({ show: false, id: null });
        }
    };

    const handleDeleteProposal = async () => {
        const id = deleteProposalModal.id;
        if (!id) return;

        try {
            const response = await fetch(`http://localhost:8000/accounts/pulse_rentals/${id}/`, {
                method: "DELETE",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                credentials: "include",
            });

            if (response.ok) {
                setRentalProposals((prev) => prev.filter((p) => p.id !== id));
                closeDeleteModal();
            } else {
                alert("Nu s-a putut anula propunerea.");
            }
        } catch (err) {
            console.error("Network error deleting proposal:", err);
            alert("Eroare de rețea. Încearcă din nou.");
        }
    };

    const openCounterModal = (offer) => {
        setCounterModal({
            show: true,
            id: offer.id,
            price: offer.total_price != null ? String(offer.total_price) : "",
        });
    };

    const closeCounterModal = () => {
        setCounterModal({ show: false, id: null, price: "" });
    };

    const handleCounterPriceChange = (e) => {
        setCounterModal((prev) => ({ ...prev, price: e.target.value }));
    };

    const handleSubmitCounter = async () => {
        const id = counterModal.id;
        const parsed = parseFloat(counterModal.price);
        if (Number.isNaN(parsed) || parsed < 0) {
            alert("Introduceți un preț valid.");
            return;
        }

        // decide whether this id belongs to a proposal (renter side) or an offer (owner side)
        const isProposal = rentalProposals.some((p) => p.id === id);
        try {
            const res = await fetch(`http://localhost:8000/accounts/pulse_rentals/${id}/`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ total_price: parsed }),
            });
            if (res.ok) {
                const updated = await res.json();

                if (isProposal) {
                    updateProposalInState(id, {
                        total_price: updated.total_price != null ? updated.total_price : parsed,
                        status: updated.status || "pending",
                        last_offer_by: updated.last_offer_by // ← add this line
                    });
                } else {
                    updateOfferInState(id, {
                        total_price: updated.total_price != null ? updated.total_price : parsed,
                        status: updated.status || "pending",
                        last_offer_by: updated.last_offer_by // ← add this line
                    });
                }

                closeCounterModal();
            } else {
                alert("Eroare la trimiterea contraofertei.");
            }
        } catch (err) {
            console.error("Network error sending counteroffer:", err);
            alert("Eroare de rețea. Încearcă din nou.");
        }
    };


    // open/close accept/decline confirmation modals
    const openAcceptModal = (offer) => setAcceptModal({ show: true, id: offer.id });
    const closeAcceptModal = () => setAcceptModal({ show: false, id: null });

    const openDeclineModal = (offer) => setDeclineModal({ show: true, id: offer.id });
    const closeDeclineModal = () => setDeclineModal({ show: false, id: null });

    // --- end rental offers actions ---

    if (loading) return <Loading />;
    if (!user) return <div className={styles.error}>Could not load user data.</div>;

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />

                <div className={styles.container}>
                    {/* Cover Photo */}
                    <div className={styles.coverPhoto}></div>

                    {/* HEADER CARD */}
                    <div className={styles.headerCard}>
                        <div className={styles.headerLayout}>
                            {/* Avatar & Trust Score */}
                            <div className={styles.avatarSection}>
                                <div className={styles.avatarWrapper}>
                                    <div
                                        className={styles.avatar}
                                        style={{
                                            backgroundImage: preview
                                                ? `url(${preview})`
                                                : user.profilePicture
                                                    ? `url(${user.profilePicture})`
                                                    : "url(/defaultImage.png)",
                                        }}
                                    />

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={handleFileChange}
                                    />

                                    <button
                                        className={styles.editButton}
                                        title="Change Profile Picture"
                                        type="button"
                                        onClick={openFilePicker}
                                    >
                                        ✏️
                                    </button>

                                    {user.profilePicture && (
                                        <button
                                            onClick={() => setShowDeleteModal(true)}
                                            className={styles.deleteButton}
                                            type="button"
                                            title="Delete Profile Picture"
                                        >
                                            ❌
                                        </button>
                                    )}
                                </div>

                                <div className={styles.trustBadge}>
                                    <span className={styles.trustIcon}>🛡️</span>
                                    <span className={styles.trustValue}>{user.trustScore}% Trust</span>
                                </div>
                            </div>

                            {/* Profile Info / Edit Form */}
                            <div className={styles.profileInfo}>
                                {editMode ? (
                                    <div className={styles.editForm}>
                                        {/* ...same edit form as before... */}
                                        <div className={styles.editGrid}>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>First Name</label>
                                                <input
                                                    name="firstName"
                                                    className={styles.editInput}
                                                    value={editForm.firstName}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Last Name</label>
                                                <input
                                                    name="lastName"
                                                    className={styles.editInput}
                                                    value={editForm.lastName}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Username</label>
                                                <input
                                                    name="username"
                                                    className={styles.editInput}
                                                    value={editForm.username}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Email</label>
                                                <input
                                                    name="email"
                                                    className={styles.editInput}
                                                    value={editForm.email}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Quiet Hours Start</label>
                                                <input
                                                    type="time"
                                                    name="quiet_hours_start"
                                                    className={styles.editInput}
                                                    value={editForm.quiet_hours_start}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Quiet Hours End</label>
                                                <input
                                                    type="time"
                                                    name="quiet_hours_end"
                                                    className={styles.editInput}
                                                    value={editForm.quiet_hours_end}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Biography</label>
                                            <textarea
                                                name="biography"
                                                className={styles.editTextarea}
                                                value={editForm.biography}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Online Status</label>
                                            <select
                                                name="online_status"
                                                className={styles.editInput}
                                                value={editForm.online_status}
                                                onChange={handleChange}
                                            >
                                                <option value="online">Online</option>
                                                <option value="away">Away</option>
                                                <option value="do_not_disturb">Do Not Disturb</option>
                                            </select>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <div className={styles.labelWrapper}>
                                                <label htmlFor="visibility-range" className={styles.inputLabel}>
                                                    Visibility Range
                                                </label>
                                                <span className={styles.rangeValue}>{editForm.visibility_radius} km</span>
                                            </div>
                                            <input
                                                type="range"
                                                id="visibility-range"
                                                min="1"
                                                max="10"
                                                step="1"
                                                value={editForm.visibility_radius}
                                                className={styles.rangeInput}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        visibility_radius: Number(e.target.value),
                                                    }))
                                                }
                                            />

                                            <div className={styles.mapContainer}>
                                                {/* Folosim coordonatele din editForm, sau un fallback (București) dacă sunt null */}
                                                <MapContainer
                                                    center={editForm.lat && editForm.lng ? [editForm.lat, editForm.lng] : [44.4268, 26.1025]}
                                                    zoom={13}
                                                    style={{ height: "100%", width: "100%" }}
                                                >
                                                    <TileLayer
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    />

                                                    {/* Asigură-te că harta se recentrează când se schimbă locația */}
                                                    {editForm.lat && editForm.lng && (
                                                        <ChangeView center={[editForm.lat, editForm.lng]} radiusKm={editForm.visibility_radius} />
                                                    )}

                                                    {/* Marker-ul și Cercul se afișează doar dacă avem coordonate setate */}
                                                    {editForm.lat && editForm.lng && (
                                                        <>
                                                            <Marker position={[editForm.lat, editForm.lng]} />
                                                            <Circle
                                                                center={[editForm.lat, editForm.lng]}
                                                                radius={editForm.visibility_radius * 1000} // radius e în metri, editForm e în km
                                                                pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }}
                                                            />
                                                        </>
                                                    )}
                                                </MapContainer>
                                            </div>
                                        </div>
                                        <div className={styles.editActions}>
                                            <button onClick={handleSave} className={styles.saveButton}>
                                                Save Changes
                                            </button>
                                            <button onClick={() => setEditMode(false)} className={styles.cancelButton}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.infoContent}>
                                        {/* ...same display as before... */}
                                        <div className={styles.titleRow}>
                                            <h1 className={styles.title}>
                                                {user.firstName} {user.lastName}
                                            </h1>
                                            {user.isVerified && <span className={styles.verified}>✓ Verified</span>}
                                        </div>

                                        <p className={styles.username}>
                                            @{user.username} • {user.email}
                                        </p>

                                        <p className={styles.biography}>{user.biography}</p>

                                        <button
                                            onClick={() => {
                                                setEditForm((prev) => ({
                                                    firstName: user.firstName || "",
                                                    lastName: user.lastName || "",
                                                    username: user.username || "",
                                                    email: user.email || "",
                                                    biography: user.biography || "",
                                                    online_status: user.online_status ?? user.onlineStatus ?? "offline",
                                                    quiet_hours_start: formatTimeForInput(user.quiet_hours_start ?? user.quietHoursStart),
                                                    quiet_hours_end: formatTimeForInput(user.quiet_hours_end ?? user.quietHoursEnd),
                                                    visibility_radius: user.visibility_radius || 1,
                                                    lat: user.location?.coordinates?.[1] ?? prev.lat,
                                                    lng: user.location?.coordinates?.[0] ?? prev.lng,
                                                }));
                                                setEditMode(true);
                                                navigator.geolocation?.getCurrentPosition((position) => {
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        lat: position.coords.latitude,
                                                        lng: position.coords.longitude,
                                                    }));
                                                });
                                            }}
                                            className={styles.editProfileBtn}
                                        >
                                            Edit Profile
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* PULSES SECTION */}
                    <div className={styles.contentArea}>
                        <div className={styles.card}>
                            <div className={styles.pulsesHeader}>
                                <h2 className={styles.sectionTitle}>Anunțurile mele</h2>
                                <select
                                    className={styles.pulseTypeDropdown}
                                    value={pulseFilter}
                                    onChange={(e) => setPulseFilter(e.target.value)}
                                >
                                    <option value="obiecte">Obiecte</option>
                                    <option value="servicii">Servicii</option>
                                </select>
                            </div>

                            {/* Pulse list */}
                            <div className={styles.objectGrid}>
                                {filteredPulses.length === 0 && (
                                    <p className={styles.emptyState}>Niciun anunț de tip „{pulseFilter}" încă.</p>
                                )}
                                {filteredPulses.map((pulse) => (
                                    <div key={pulse.id} className={styles.objectCard}>
                                        <div className={styles.objectImage}>
                                            {pulse.images && pulse.images.length > 0 ? (
                                                <img src={pulse.images[0]} alt={pulse.title} className={styles.pulseImage} />
                                            ) : (
                                                <span className={styles.imagePlaceholder}>{pulseFilter === "obiecte" ? "📦" : "🛠️"}</span>
                                            )}
                                        </div>
                                        <div className={styles.objectInfo}>
                                            <h3 className={styles.objectName}>{pulse.title}</h3>
                                            {pulse.category && <p className={styles.pulseCategory}>{pulse.category}</p>}
                                            {pulse.phone_number && <p className={styles.pulsePhone}>📞 {pulse.phone_number}</p>}
                                            <p className={styles.pulseDate}>
                                                Postat:{" "}
                                                {new Date(pulse.created_at || Date.now()).toLocaleString("ro-RO", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                            <div className={styles.objectMeta}>
                                                {pulse.price != null && (
                                                    <span className={styles.price}>
                                                        {pulse.price} {pulse.currencyType || "lei"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.objectActions}>
                                            <button onClick={() => handleRemovePulse(pulse.id)} className={styles.removeBtn}>
                                                Șterge
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RENTAL OFFERS SECTION */}
                    <div className={styles.contentArea}>
                        <div className={styles.card}>
                            <div className={styles.pulsesHeader}>
                                <h2 className={styles.sectionTitle}>Oferte de închiriere</h2>
                                <p className={styles.sectionSubtitle}>
                                    Aici vezi cererile de închiriere pentru anunțurile tale — poți accepta, refuza sau trimite o contraofertă.
                                </p>
                            </div>

                            <div className={styles.offersList}>
                                {offersLoading && <p>Se încarcă oferte...</p>}
                                {!offersLoading && rentalOffers.length === 0 && (
                                    <p className={styles.emptyState}>Momentan nu există oferte pentru anunțurile tale.</p>
                                )}

                                {rentalOffers.map((offer) => (
                                    <div key={offer.id} className={styles.offerCard}>
                                        <div className={styles.offerLeft}>
                                            <div className={styles.offerPulseTitle}>{offer.pulse?.title || "—"}</div>
                                            <div className={styles.offerMeta}>
                                                <div>
                                                    De la: <strong>{offer.renter?.username || offer.renter}</strong>
                                                </div>
                                                <div>
                                                    {offer.pulse_type === "servicii" ? (
                                                        <span>Serviciu: <strong>{offer.pulse_title}</strong></span>
                                                    ) : (
                                                        <span>Produs: <strong>{offer.pulse_title}</strong></span>
                                                    )}
                                                </div>
                                                <div>
                                                    Perioadă: {formatDate(offer.start_date)} — {formatDate(offer.end_date)}
                                                </div>
                                                <div>
                                                    Preț propus:{" "}
                                                    <strong>{formatCurrency(offer.total_price, offer.currencyType || "lei")}</strong>
                                                </div>
                                                {offer.total_price !== offer.initial_price && (
                                                    <div>
                                                        Preț inițial:{" "}
                                                        <strong>
                                                            {formatCurrency(offer.initial_price, offer.currencyType || "lei")}
                                                        </strong>
                                                    </div>
                                                )}
                                                <div>Status: <strong>{offer.status}</strong></div>
                                            </div>
                                        </div>

                                        <div className={styles.offerActions}>
                                            {offer.status === "pending" && offer.last_offer_by !== user.id ? (
                                                <>
                                                    <button onClick={() => openAcceptModal(offer)} className={styles.acceptBtn}>
                                                        Acceptă
                                                    </button>
                                                    <button onClick={() => openDeclineModal(offer)} className={styles.rejectBtn}>
                                                        Refuză
                                                    </button>
                                                    <button onClick={() => openCounterModal(offer)} className={styles.counterBtn}>
                                                        Contraofertă
                                                    </button>
                                                </>
                                            ) : (
                                                <div className={styles.smallNote}>
                                                    {offer.status === "confirmed" && "Ofertă acceptată"}
                                                    {offer.status === "declined" && "Ofertă refuzată"}
                                                    {offer.status === "completed" && "Închiriere finalizată"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={styles.contentArea}>
                        <div className={styles.card}>
                            <div className={styles.pulsesHeader}>
                                <h2 className={styles.sectionTitle}>Propunerile mele de închiriere</h2>
                                <p className={styles.sectionSubtitle}>
                                    Aici vezi toate propunerile trimise de tine și statusul lor.
                                </p>
                            </div>

                            <div className={styles.offersList}>
                                {proposalsLoading && <p>Se încarcă propunerile...</p>}

                                {!proposalsLoading && rentalProposals.length === 0 && (
                                    <p className={styles.emptyState}>
                                        Nu ai trimis încă nicio propunere de închiriere.
                                    </p>
                                )}

                                {rentalProposals.map((proposal) => (
                                    <div key={proposal.id} className={styles.offerCard}>

                                        <div className={styles.offerLeft}>
                                            <div className={styles.offerPulseTitle}>
                                                {proposal.pulse_title}
                                            </div>

                                            <div className={styles.offerMeta}>
                                                <div>
                                                    Tip:{" "}
                                                    <strong>
                                                        {proposal.pulse_type === "servicii"
                                                            ? "Serviciu"
                                                            : "Produs"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    Perioadă: {formatDate(proposal.start_date)} —{" "}
                                                    {formatDate(proposal.end_date)}
                                                </div>

                                                <div>
                                                    Preț propus:{" "}
                                                    <strong>
                                                        {formatCurrency(
                                                            proposal.total_price,
                                                            "lei"
                                                        )}
                                                    </strong>
                                                </div>

                                                {proposal.initial_price &&
                                                    proposal.initial_price !==
                                                    proposal.total_price && (
                                                        <div>
                                                            Preț inițial:{" "}
                                                            <strong>
                                                                {formatCurrency(
                                                                    proposal.initial_price,
                                                                    "lei"
                                                                )}
                                                            </strong>
                                                        </div>
                                                    )}

                                                <div>
                                                    Status: <strong>{proposal.status}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.offerActions}>
                                            {proposal.status === "pending" && (
                                                <>
                                                    <button
                                                        onClick={() => openDeleteModal(proposal)}
                                                        className={styles.rejectBtn}
                                                    >
                                                        Anulează propunerea
                                                    </button>

                                                    {/* Counteroffer button for renter's own proposals */}
                                                </>
                                            )}

                                            {proposal.total_price !== proposal.initial_price &&
                                                proposal.last_offer_by !== user.id &&
                                                proposal.status === "pending" &&
                                                (
                                                    <>
                                                        <button
                                                            onClick={() => openCounterModal(proposal)}
                                                            className={styles.counterBtn}
                                                            style={{ marginLeft: "8px" }}
                                                        >
                                                            Contraofertă
                                                        </button>

                                                        <button
                                                            onClick={() => openAcceptModal(proposal)}
                                                            className={styles.acceptBtn}
                                                        >
                                                            Acceptă oferta
                                                        </button>

                                                        <button
                                                            onClick={() => openDeclineModal(proposal)}
                                                            className={styles.rejectBtn}
                                                        >
                                                            Refuză oferta
                                                        </button>
                                                    </>
                                                )}

                                            {proposal.status === "confirmed" && (
                                                <div className={styles.smallNote}>Închiriere confirmată</div>
                                            )}

                                            {proposal.status === "declined" && (
                                                <div className={styles.smallNote}>Oferta a fost refuzată</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delete Profile Picture Modal */}
                {showDeleteModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>Șterge poza de profil?</h3>
                            <p className={styles.modalText}>
                                Această acțiune nu poate fi anulată. Ești sigur că vrei să ștergi poza de profil?
                            </p>
                            <div className={styles.modalActions}>
                                <button onClick={() => setShowDeleteModal(false)} className={styles.modalCancel}>
                                    Anulează
                                </button>
                                <button onClick={handleDeleteProfilePicture} className={styles.modalDelete}>
                                    Da, șterge
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Counteroffer Modal */}
                {counterModal.show && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>Trimite contraofertă</h3>
                            <p className={styles.modalText}>Introdu noul preț total (valoare numerică, ex: 150.00):</p>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Preț total</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={counterModal.price}
                                    onChange={handleCounterPriceChange}
                                    className={styles.editInput}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button onClick={closeCounterModal} className={styles.modalCancel}>
                                    Anulează
                                </button>
                                <button onClick={handleSubmitCounter} className={styles.saveButton}>
                                    Trimite contraofertă
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Accept Confirmation Modal */}
                {acceptModal.show && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>Acceptă oferta?</h3>
                            <p className={styles.modalText}>Ești sigur că vrei să accepți această ofertă?</p>
                            <div className={styles.modalActions}>
                                <button onClick={closeAcceptModal} className={styles.modalCancel}>
                                    Anulează
                                </button>
                                <button
                                    onClick={() => handleAcceptOffer(acceptModal.id)}
                                    className={styles.saveButton}
                                >
                                    Acceptă
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Proposal Modal */}
                {deleteProposalModal.show && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>Anulează propunerea?</h3>
                            <p className={styles.modalText}>
                                Această acțiune nu poate fi anulată. Ești sigur că vrei să anulezi propunerea?
                            </p>
                            <div className={styles.modalActions}>
                                <button onClick={closeDeleteModal} className={styles.modalCancel}>
                                    Anulează
                                </button>
                                <button onClick={handleDeleteProposal} className={styles.modalDelete}>
                                    Da, anulează
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Decline Confirmation Modal */}
                {declineModal.show && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>Refuză oferta?</h3>
                            <p className={styles.modalText}>Ești sigur că vrei să refuzi această ofertă?</p>
                            <div className={styles.modalActions}>
                                <button onClick={closeDeclineModal} className={styles.modalCancel}>
                                    Anulează
                                </button>
                                <button
                                    onClick={() => handleDeclineOffer(declineModal.id)}
                                    className={styles.modalDelete}
                                >
                                    Refuză
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}