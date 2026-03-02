import React, { useState, useMemo, useEffect } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/profile.module.css";

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

export default function Profile() {
    const [tab, setTab] = useState("overview");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);

    // 1. Initialize form with empty strings to prevent crashing on null 'user'
    const [editForm, setEditForm] = useState({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        biography: "",
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
                    setEditForm({
                        firstName: data.user.firstName || "",
                        lastName: data.user.lastName || "",
                        username: data.user.username || "",
                        email: data.user.email || "",
                        biography: data.user.biography || "",
                    });
                }
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching profile:", error);
                setLoading(false);
            });
    }, []);

    const [newSkill, setNewSkill] = useState({name: "", level: "beginner"});
    const [newObject, setNewObject] = useState({name: "", price: "", available: true});

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

    const addSkill = () => {
        if (!newSkill.name.trim()) return;
        const skill = {id: Date.now(), name: newSkill.name.trim(), level: newSkill.level};
        setUser((prev) => ({...prev, skills: [...prev.skills, skill]}));
        setNewSkill({name: "", level: "beginner"});
    };

    const removeSkill = async (id) => {
        try {
            const response = await fetch(
                `http://localhost:8000/accounts/remove_skill/${id}/`,
                {
                    method: "DELETE", // use POST if your Django view expects POST
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

            // Only update state if backend deletion succeeded
            setUser((prev) => ({
                ...prev,
                skills: prev.skills.filter((s) => s.id !== id),
            }));

        } catch (error) {
            console.error("Error removing skill:", error);
        }
    };

    const addObject = () => {
        if (!newObject.name.trim() || !newObject.price) return;
        const object = {
            id: Date.now(),
            name: newObject.name.trim(),
            price: parseFloat(newObject.price),
            available: !!newObject.available,
        };
        setUser((prev) => ({
            ...prev,
            objects: [...prev.objects, object],
        }));
        setNewObject({name: "", price: "", available: true});
    };

    const removeObject = async (id) => {
        try {
            const response = await fetch(
                `http://localhost:8000/accounts/remove_object/${id}/`,
                {
                    method: "DELETE", // use POST if your Django view expects POST
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

            // Only update state if backend deletion succeeded
            setUser((prev) => ({
                ...prev,
                objects: prev.objects.filter((s) => s.id !== id),
            }));

        } catch (error) {
            console.error("Error removing object:", error);
        }
    };

    // 4. THE LOADING GUARD: Prevents the rest of the code from running while user is null
    if (loading) {
        return <div className={styles.loadingContainer}>Loading Profile...</div>;
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
                                    <div className={styles.avatar}/>
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
                                        <div className={styles.titleRow}>
                                            <h1 className={styles.title}>
                                                {user.firstName} {user.lastName}
                                            </h1>
                                            {user.isVerified && <span className={styles.verified}>✓ Verified</span>}
                                        </div>
                                        <p className={styles.username}>@{user.username} • {user.email}</p>
                                        <p className={styles.biography}>{user.biography}</p>
                                        <button onClick={() => {
                                            // populate edit form with latest user values then open edit mode
                                            setEditForm({
                                                firstName: user.firstName,
                                                lastName: user.lastName,
                                                username: user.username,
                                                email: user.email,
                                                biography: user.biography,
                                            });
                                            setEditMode(true);
                                        }} className={styles.editProfileBtn}>
                                            Edit Profile
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SEGMENTED TABS */}
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

                    {/* TAB CONTENT */}
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
            </div>
        </div>
    );
}