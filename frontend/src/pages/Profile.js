import React, { useState, useMemo } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/profile.module.css";

export default function Profile() {
    const [tab, setTab] = useState("overview");

    const [user, setUser] = useState({
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
        bio: "Creative developer and tech enthusiast. Building tools that help people connect and share resources efficiently.",
        trustScore: 87,
        verified: true,
        stats: {
            items: 4,
            loans: 12,
            endorsements: 7,
        },
        skills: [
            { id: 1, name: "React", level: "expert" },
            { id: 2, name: "Django", level: "intermediate" },
            { id: 3, name: "Tailwind", level: "expert" },
        ],
        objects: [
            { id: 1, name: "Makita Power Drill", price: 10, available: true },
            { id: 2, name: "Sony A7III Camera", price: 45, available: false },
            { id: 3, name: "4K Home Projector", price: 20, available: true },
        ],
    });

    const [editMode, setEditMode] = useState(false);

    const [editForm, setEditForm] = useState({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        bio: user.bio,
    });

    const filteredObjects = useMemo(() => {
        return user.objects;
    }, [user.objects]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSave = () => {
        setUser((prev) => ({ ...prev, ...editForm }));
        setEditMode(false);
    };

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
            <Navbar />

            <div className={styles.container}>
                {/* NEW: Cover Photo */}
                <div className={styles.coverPhoto}></div>

                {/* HEADER CARD */}
                <div className={styles.headerCard}>
                    <div className={styles.headerLayout}>
                        {/* Avatar & Trust Score */}
                        <div className={styles.avatarSection}>
                            <div className={styles.avatarWrapper}>
                                <div className={styles.avatar} />
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
                                            <input name="firstName" className={styles.editInput} value={editForm.firstName} onChange={handleChange} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Last Name</label>
                                            <input name="lastName" className={styles.editInput} value={editForm.lastName} onChange={handleChange} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Username</label>
                                            <input name="username" className={styles.editInput} value={editForm.username} onChange={handleChange} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Email</label>
                                            <input name="email" className={styles.editInput} value={editForm.email} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label className={styles.inputLabel}>Bio</label>
                                        <textarea name="bio" className={styles.editTextarea} value={editForm.bio} onChange={handleChange} />
                                    </div>
                                    <div className={styles.editActions}>
                                        <button onClick={handleSave} className={styles.saveButton}>Save Changes</button>
                                        <button onClick={() => setEditMode(false)} className={styles.cancelButton}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.infoContent}>
                                    <div className={styles.titleRow}>
                                        <h1 className={styles.title}>
                                            {user.firstName} {user.lastName}
                                        </h1>
                                        {user.verified && <span className={styles.verified}>✓ Verified</span>}
                                    </div>
                                    <p className={styles.username}>@{user.username} • {user.email}</p>
                                    <p className={styles.bio}>{user.bio}</p>
                                    <button onClick={() => setEditMode(true)} className={styles.editProfileBtn}>
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
                            { key: "overview", label: "Overview" },
                            { key: "skills", label: "Skills" },
                            { key: "objects", label: "My Objects" },
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
                                <span className={styles.statValue}>{user.stats.items}</span>
                            </div>
                            <div className={styles.statBox}>
                                <span className={styles.statLabel}>Active Loans</span>
                                <span className={styles.statValue}>{user.stats.loans}</span>
                            </div>
                            <div className={styles.statBox}>
                                <span className={styles.statLabel}>Endorsements</span>
                                <span className={styles.statValue}>{user.stats.endorsements}</span>
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
                            <div className={styles.skillGrid}>
                                {user.skills.map((skill) => (
                                    <div key={skill.id} className={styles.skillCard}>
                                        <span className={styles.skillName}>{skill.name}</span>
                                        <span className={styles.skillLevel}>{skill.level}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === "objects" && (
                        <div className={styles.card}>
                            <h2 className={styles.sectionTitle}>Available Objects</h2>
                            <div className={styles.objectGrid}>
                                {filteredObjects.map((obj) => (
                                    <div key={obj.id} className={styles.objectCard}>
                                        <div className={styles.objectImage}>
                                            {/* Placeholder for actual image */}
                                            <span className={styles.imagePlaceholder}>📸</span>
                                        </div>
                                        <div className={styles.objectInfo}>
                                            <h3 className={styles.objectName}>{obj.name}</h3>
                                            <div className={styles.objectMeta}>
                                                <span className={styles.price}>${obj.price}/day</span>
                                                <span className={obj.available ? styles.availableBadge : styles.unavailableBadge}>
                                                    {obj.available ? "Available" : "In Use"}
                                                </span>
                                            </div>
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