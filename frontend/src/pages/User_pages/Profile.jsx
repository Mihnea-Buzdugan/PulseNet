import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "../../components/Navbar";
import styles from "../../styles/User_pages/profile.module.css";
import Loading from "../../components/Loading";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
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

export default function Profile() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Pulse filter — "obiecte" by default
    const [pulseFilter, setPulseFilter] = useState("obiecte");

    // image/upload state
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
    });

    useEffect(() => {
        const csrfToken = getCookie('csrftoken');
        fetch("http://localhost:8000/accounts/profile/", {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            credentials: 'include',
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.user) {
                    setUser(data.user);
                    setPreview(data.user.profilePicture || null);
                }
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching profile:", error);
                setLoading(false);
            });
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
        return user.pulses.filter(p => p.pulseType === pulseFilter);
    }, [user, pulseFilter]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const csrfToken = getCookie('csrftoken');
        try {
            const response = await fetch("http://localhost:8000/accounts/update_profile/", {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify(editForm),
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
        setUser((prev) => prev ? ({ ...prev, profilePicture: objectUrl }) : prev);

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
                    setUser((prev) => prev ? ({ ...prev, profilePicture: data.url }) : prev);
                    setPreview(data.url);
                } else {
                    console.warn("Upload response did not include user or url:", data);
                }
            } else {
                alert("Failed to upload image. Please try again.");
                const prevUrl = previousProfileUrlRef.current;
                setPreview(prevUrl);
                setUser((prev) => prev ? ({ ...prev, profilePicture: prevUrl }) : prev);
            }
        } catch (uploadError) {
            console.error("Network error during upload:", uploadError);
            alert("Network error while uploading. Please try again.");
            const prevUrl = previousProfileUrlRef.current;
            setPreview(prevUrl);
            setUser((prev) => prev ? ({ ...prev, profilePicture: prevUrl }) : prev);
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
                                                    : "url(/defaultImage.png)"
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
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className={styles.editIcon}
                                        >
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
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
                                        <div className={styles.statusBottomRight}>
                                            <div className={styles.statusRowInline}>
                                                <div className={styles.statusItem}>
                                                    <span
                                                        className={
                                                            user.onlineStatus === "online"
                                                                ? styles.statusOnline
                                                                : user.onlineStatus === "away"
                                                                    ? styles.statusAway
                                                                    : user.onlineStatus === "do_not_disturb"
                                                                        ? styles.statusDnd
                                                                        : styles.statusOffline
                                                        }
                                                    >
                                                        ●
                                                    </span>
                                                    <span className={styles.statusText}>
                                                        {user.onlineStatus?.replace("_", " ")}
                                                    </span>
                                                </div>
                                                {user.quiet_hours_start &&
                                                    user.quiet_hours_end &&
                                                    isUserSleeping() && (
                                                        <div className={styles.sleepingBadge}>
                                                            😴 Sleeping
                                                        </div>
                                                    )}
                                            </div>
                                        </div>

                                        <div className={styles.titleRow}>
                                            <h1 className={styles.title}>
                                                {user.firstName} {user.lastName}
                                            </h1>
                                            {user.isVerified && (
                                                <span className={styles.verified}>✓ Verified</span>
                                            )}
                                        </div>

                                        <p className={styles.username}>
                                            @{user.username} • {user.email}
                                        </p>

                                        <p className={styles.biography}>
                                            {user.biography}
                                        </p>

                                        <button
                                            onClick={() => {
                                                setEditForm({
                                                    firstName: user.firstName || "",
                                                    lastName: user.lastName || "",
                                                    username: user.username || "",
                                                    email: user.email || "",
                                                    biography: user.biography || "",
                                                    online_status:
                                                        user.online_status ??
                                                        user.onlineStatus ??
                                                        "offline",
                                                    quiet_hours_start: formatTimeForInput(
                                                        user.quiet_hours_start ?? user.quietHoursStart
                                                    ),
                                                    quiet_hours_end: formatTimeForInput(
                                                        user.quiet_hours_end ?? user.quietHoursEnd
                                                    ),
                                                });
                                                setEditMode(true);
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
                                    <p className={styles.emptyState}>
                                        Niciun anunț de tip „{pulseFilter}" încă.
                                    </p>
                                )}
                                {filteredPulses.map((pulse) => (
                                    <div key={pulse.id} className={styles.objectCard}>
                                        <div className={styles.objectImage}>
                                            {pulse.images && pulse.images.length > 0 ? (
                                                <img
                                                    src={pulse.images[0]}
                                                    alt={pulse.title}
                                                    className={styles.pulseImage}
                                                />
                                            ) : (
                                                <span className={styles.imagePlaceholder}>
                    {pulseFilter === "obiecte" ? "📦" : "🛠️"}
                </span>
                                            )}
                                        </div>
                                        <div className={styles.objectInfo}>
                                            <h3 className={styles.objectName}>{pulse.title}</h3>
                                            {pulse.category && (
                                                <p className={styles.pulseCategory}>{pulse.category}</p>
                                            )}
                                            {pulse.phone_number && (
                                                <p className={styles.pulsePhone}>📞 {pulse.phone_number}</p>
                                            )}
                                            <p className={styles.pulseDate}>
                                                Postat: {new Date(pulse.created_at || Date.now()).toLocaleString('ro-RO', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
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
                                            <button
                                                onClick={() => handleRemovePulse(pulse.id)}
                                                className={styles.removeBtn}
                                            >
                                                Șterge
                                            </button>
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
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className={styles.modalCancel}
                                >
                                    Anulează
                                </button>
                                <button
                                    onClick={handleDeleteProfilePicture}
                                    className={styles.modalDelete}
                                >
                                    Da, șterge
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}