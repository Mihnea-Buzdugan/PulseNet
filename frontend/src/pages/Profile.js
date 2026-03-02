import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/profile.module.css";
import Loading from "../components/Loading";

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
    // Accept both "HH:MM:SS" and "HH:MM"
    return timeString.length >= 5 ? timeString.substring(0, 5) : timeString;
};

export default function Profile() {
    const [tab, setTab] = useState("overview");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // image/upload state
    const [preview, setPreview] = useState(null); // local preview URL or server url
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const lastObjectUrlRef = useRef(null);
    const previousProfileUrlRef = useRef(null);

    // 1. Initialize form with empty strings to prevent crashing on null 'user'
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

        // Handles quiet hours that cross midnight
        if (end < start) {
            if (now >= start) return true;
            const midnight = new Date(start);
            midnight.setHours(24, 0, 0);
            if (now <= end || now >= start) return true;
        }
        return now >= start && now <= end;
    };

    // cleanup object URL on unmount
    useEffect(() => {
        return () => {
            if (lastObjectUrlRef.current) {
                URL.revokeObjectURL(lastObjectUrlRef.current);
                lastObjectUrlRef.current = null;
            }
        };
    }, []);

    const [newSkill, setNewSkill] = useState({name: "", level: "beginner"});
    const [newObject, setNewObject] = useState({name: "", price: "", isAvailable: true});

    // 3. Protect useMemo from null user
    const filteredObjects = useMemo(() => {
        return user ? user.objects : [];
    }, [user]);

    // Handlers
    const handleChange = (e) => {
        const {name, value} = e.target;
        setEditForm((prev) => ({...prev, [name]: value}));
    };

    const handleSave = async () => {
        const csrfToken = getCookie('csrftoken');

        try {
            const response = await fetch("http://localhost:8000/accounts/update_profile/", {
                method: 'PUT', // or 'PATCH'
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify(editForm),
            });

            if (response.ok) {
                const data = await response.json();
                // Update the local user state with the returned data from the server
                setUser(data.user);
                setEditMode(false);
                console.log("Profile updated successfully!");
            } else {
                const errorData = await response.json();
                console.error("Failed to update profile:", errorData);
                alert("Error updating profile. Please try again.");
            }
        } catch (error) {
            console.error("Network error while saving profile:", error);
        }
    };


    // Image handling functions
    const openFilePicker = () => {
        fileInputRef.current?.click();
    };

    const handleFileKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // basic validations — tweak as needed
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

        // create preview
        if (lastObjectUrlRef.current) {
            URL.revokeObjectURL(lastObjectUrlRef.current);
            lastObjectUrlRef.current = null;
        }
        const objectUrl = URL.createObjectURL(file);
        lastObjectUrlRef.current = objectUrl;
        previousProfileUrlRef.current = user?.profilePicture || preview || null;

        // Optimistic UI: show preview immediately in avatar
        setPreview(objectUrl);
        setUser((prev) => prev ? ({ ...prev, profilePicture: objectUrl }) : prev);

        // Upload to server
        const uploadUrl = "http://localhost:8000/accounts/upload_profile_picture/";
        const csrfToken = getCookie("csrftoken");

        const form = new FormData();
        // use backend field name expected by Django view e.g. 'profile_picture'
        form.append("profile_picture", file);

        setUploading(true);
        try {
            const res = await fetch(uploadUrl, {
                method: "POST",
                body: form,
                credentials: "include",
                headers: {
                    "X-CSRFToken": csrfToken,
                    // DO NOT set Content-Type header for FormData — browser sets correct boundary
                },
            });

            if (res.ok) {
                const data = await res.json();
                // server might return { user } or { url }
                if (data.user) {
                    setUser(data.user);
                    setPreview(data.user.profilePicture || null);
                } else if (data.url) {
                    setUser((prev) => prev ? ({ ...prev, profilePicture: data.url }) : prev);
                    setPreview(data.url);
                } else {
                    // fallback: keep optimistic preview (already set)
                    console.warn("Upload response did not include user or url:", data);
                }
            } else {
                const err = await res.json().catch(() => ({}));
                console.error("Upload failed:", err);
                alert("Failed to upload image. Please try again.");
                // revert to previous profile picture
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
            // clear file input so selecting the same file again triggers change
            e.target.value = "";
            // revoke object URL only if server replaced it with a real URL; otherwise keep it until unmount or next change.
            // We'll revoke when component unmounts or when a new file is chosen (handled above).
        }
    };

    const handleDeleteProfilePicture = async () => {
        try {
            const response = await fetch(
                "http://localhost:8000/accounts/delete_profile_picture/",
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to delete profile picture");
            }

            setUser((prev) => ({
                ...prev,
                profilePicture: null,
            }));

            setPreview(null);
            setShowDeleteModal(false);

        } catch (error) {
            console.error("Error deleting profile picture:", error);
            alert("Failed to delete profile picture.");
        }
    };


    // Skills and objects related functions
    const addSkill = async () => {
        if (!newSkill.name.trim()) return;

        try {
            const response = await fetch("http://localhost:8000/accounts/add_skill/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: JSON.stringify({
                    name: newSkill.name.trim(),
                    level: newSkill.level
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setUser((prev) => ({
                    ...prev,
                    skills: [...prev.skills, data.skill]
                }));
                setNewSkill({ name: "", level: "beginner" });
            }
        } catch (error) {
            console.error("Error adding skill:", error);
        }
    };

    const removeSkill = async (id) => {
        try {
            const response = await fetch(
                `http://localhost:8000/accounts/remove_skill/${id}/`,
                {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to delete skill");
            }

            setUser((prev) => ({
                ...prev,
                skills: prev.skills.filter((s) => s.id !== id),
            }));

        } catch (error) {
            console.error("Error removing skill:", error);
        }
    };

    const addObject = async () => {
        if (!newObject.name.trim() || !newObject.price) return;

        try {
            const response = await fetch("http://localhost:8000/accounts/add_object/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: JSON.stringify({
                    name: newObject.name.trim(),
                    price: parseFloat(newObject.price),
                    available: !!newObject.isAvailable,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setUser((prev) => ({
                    ...prev,
                    objects: [...prev.objects, data.object],
                }));
                setNewObject({ name: "", price: "", available: true });
            }
        } catch (error) {
            console.error("Error adding object:", error);
        }
    };

    const removeObject = async (id) => {
        try {
            const response = await fetch(
                `http://localhost:8000/accounts/remove_object/${id}/`,
                {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to delete object");
            }

            setUser((prev) => ({
                ...prev,
                objects: prev.objects.filter((s) => s.id !== id),
            }));

        } catch (error) {
            console.error("Error removing object:", error);
        }
    };
    // 4. THE LOADING GUARD
    if (loading) {
        return <Loading />
    }

    if (!user) {
        return <div className={styles.error}>Could not load user data.</div>;
    }

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar/>

                <div className={styles.container}>
                    {/* Cover Photo */}
                    <div className={styles.coverPhoto}></div>
                    {/* HEADER CARD */}
                    <div className={styles.headerCard}>
                        <div className={styles.headerLayout}>
                            {/* Avatar & Trust Score */}
                            <div className={styles.avatarSection}>
                                <div className={styles.avatarWrapper}>

                                    {/* Avatar Image */}
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

                                    {/* Hidden File Input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={handleFileChange}
                                    />

                                    {/* Edit Button */}
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

                                    {/* Delete Button — only shows if picture exists */}
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
                                            <label className={styles.inputLabel}>biography</label>
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

                    {/* SEGMENTED TABS (unchanged) */}
                    <div className={styles.tabsContainer}>
                        <div className={styles.tabs}>
                            {[
                                {key: "overview", label: "Overview"},
                                {key: "skills", label: "Skills"},
                                {key: "objects", label: "My Objects"},
                            ].map((t) => (
                                <button
                                    key={t.key}
                                    className={tab === t.key ? styles.activeTab : styles.tab}
                                    onClick={() => setTab(t.key)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TAB CONTENT (unchanged) */}
                    <div className={styles.contentArea}>
                        {tab === "overview" && (
                            <div className={styles.statsGrid}>
                                <div className={styles.statBox}>
                                    <span className={styles.statLabel}>Items Listed</span>
                                    <span className={styles.statValue}></span>
                                </div>
                                <div className={styles.statBox}>
                                    <span className={styles.statLabel}>Active Loans</span>
                                    <span className={styles.statValue}></span>
                                </div>
                                <div className={styles.statBox}>
                                    <span className={styles.statLabel}>Endorsements</span>
                                    <span className={styles.statValue}></span>
                                </div>
                                <div className={styles.statBox}>
                                    <span className={styles.statLabel}>Trust Score</span>
                                    <span className={styles.statValue}>{user.trustScore}%</span>
                                </div>
                            </div>
                        )}

                        {tab === "skills" && (
                            <div className={styles.card}>
                                <h2 className={styles.sectionTitle}>Skills & Expertise</h2>

                                {/* Add skill form */}
                                <div className={styles.addFormRow}>
                                    <input
                                        placeholder="Skill name"
                                        value={newSkill.name}
                                        onChange={(e) => setNewSkill({...newSkill, name: e.target.value})}
                                        className={styles.smallInput}
                                    />
                                    <select
                                        value={newSkill.level}
                                        onChange={(e) => setNewSkill({...newSkill, level: e.target.value})}
                                        className={styles.smallSelect}
                                    >
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                    <button onClick={addSkill} className={styles.primaryButton}>Add Skill</button>
                                </div>

                                <div className={styles.skillGrid}>
                                    {user.skills.map((skill) => (
                                        <div key={skill.id} className={styles.skillCard}>
                                            <div>
                                                <span className={styles.skillName}>{skill.name}</span>
                                                <span className={styles.skillLevel}> — {skill.proficiency_level}</span>
                                            </div>
                                            <div>
                                                <button onClick={() => removeSkill(skill.id)}
                                                        className={styles.iconButton}
                                                        aria-label={`Remove ${skill.name}`}>
                                                    ❌
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {tab === "objects" && (
                            <div className={styles.card}>
                                <h2 className={styles.sectionTitle}>Available Objects</h2>

                                {/* Add object form */}
                                <div className={styles.addFormRow}>
                                    <input
                                        placeholder="Object name"
                                        value={newObject.name}
                                        onChange={(e) => setNewObject({...newObject, name: e.target.value})}
                                        className={styles.smallInput}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Price / day"
                                        value={newObject.price}
                                        onChange={(e) => setNewObject({...newObject, price: e.target.value})}
                                        className={styles.smallInput}
                                        min="0"
                                    />
                                    <label className={styles.inlineLabel}>
                                        <input
                                            type="checkbox"
                                            checked={newObject.isAvailable}
                                            onChange={(e) => setNewObject({...newObject, isAvailable: e.target.checked})}
                                        />
                                        Available
                                    </label>
                                    <button onClick={addObject} className={styles.primaryButton}>Add Object</button>
                                </div>

                                <div className={styles.objectGrid}>
                                    {filteredObjects.map((obj) => (
                                        <div key={obj.id} className={styles.objectCard}>
                                            <div className={styles.objectImage}>
                                                <span className={styles.imagePlaceholder}>📸</span>
                                            </div>
                                            <div className={styles.objectInfo}>
                                                <h3 className={styles.objectName}>{obj.name}</h3>
                                                <div className={styles.objectMeta}>
                                                    <span className={styles.price}>${obj.price_per_day}/day</span>
                                                    <span
                                                        className={obj.isAvailable ? styles.availableBadge : styles.unavailableBadge}>
                                                        {obj.isAvailable ? "Available" : "In Use"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={styles.objectActions}>
                                                <button onClick={() => removeObject(obj.id)}
                                                        className={styles.removeBtn}>Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {showDeleteModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>
                                Delete Profile Picture?
                            </h3>

                            <p className={styles.modalText}>
                                This action cannot be undone. Are you sure you want to remove your profile picture?
                            </p>

                            <div className={styles.modalActions}>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className={styles.modalCancel}
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={handleDeleteProfilePicture}
                                    className={styles.modalDelete}
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}