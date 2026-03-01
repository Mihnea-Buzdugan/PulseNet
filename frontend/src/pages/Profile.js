// ProfilePage.jsx
import React, { useState, useMemo } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/profile.module.css";

export default function Profile() {
    const [tab, setTab] = useState("overview");
    const [editing, setEditing] = useState(false);

    const [user, setUser] = useState({
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
        bio: "Profile bio here with extended description and achievements.",
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
            { id: 1, name: "Drill", price: 10, available: true },
            { id: 2, name: "Camera", price: 15, available: false },
            { id: 3, name: "Projector", price: 20, available: true },
        ],
    });

    // form state for editing
    const [form, setForm] = useState({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        bio: user.bio,
    });

    // Keep form synced when opening editor (in case user state changed)
    function openEdit() {
        setForm({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            username: user.username || "",
            email: user.email || "",
            bio: user.bio || "",
        });
        setEditing(true);
    }

    function saveProfile() {
        // Basic validation example
        if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim()) {
            alert("First name, last name and username are required.");
            return;
        }

        setUser((u) => ({
            ...u,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            bio: form.bio,
        }));

        setEditing(false);
    }

    const filteredObjects = useMemo(() => {
        return user.objects;
    }, [user.objects]);

    return (
        <div className={styles.body}>
            <Navbar />

            <div className={styles.container}>
                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>
                            {user.firstName} {user.lastName}
                        </h1>
                        <p className={styles.email}>@{user.username}</p>
                        <p className={styles.email}>{user.email}</p>
                        {user.verified && <span className={styles.verified}>Verified</span>}
                        <p className={styles.bio}>{user.bio}</p>

                        <div style={{ marginTop: "1rem" }}>
                            <button onClick={openEdit} className={styles.editButton}>
                                Edit Profile
                            </button>
                        </div>
                    </div>

                    <div className={styles.avatarSection}>
                        <div className={styles.avatar} />
                        <div className={styles.trustBox}>
                            <span className={styles.trustLabel}>Trust Score</span>
                            <span className={styles.trustValue}>{user.trustScore}%</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    {[
                        { key: "overview", label: "Overview" },
                        { key: "skills", label: "Skills" },
                        { key: "objects", label: "Objects" },
                        { key: "analytics", label: "Analytics" },
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

                {/* TAB CONTENT */}
                <div className={styles.card}>
                    {tab === "overview" && (
                        <div className={styles.gridTwo}>
                            <div className={styles.statBox}>
                                Items
                                <br />
                                {user.stats.items}
                            </div>
                            <div className={styles.statBox}>
                                Loans
                                <br />
                                {user.stats.loans}
                            </div>
                            <div className={styles.statBox}>
                                Endorsements
                                <br />
                                {user.stats.endorsements}
                            </div>
                            <div className={styles.statBox}>
                                Trust
                                <br />
                                {user.trustScore}%
                            </div>
                        </div>
                    )}

                    {tab === "skills" && (
                        <div>
                            <h2 className={styles.sectionTitle}>Skills</h2>
                            <div className={styles.skillGrid}>
                                {user.skills.map((skill) => (
                                    <div key={skill.id} className={styles.skillCard}>
                                        <span>{skill.name}</span>
                                        <span className={styles.skillLevel}>{skill.level}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === "objects" && (
                        <div>
                            <h2 className={styles.sectionTitle}>My Objects</h2>
                            <div className={styles.objectGrid}>
                                {filteredObjects.map((obj) => (
                                    <div key={obj.id} className={styles.objectCard}>
                                        <div className={styles.objectImage} />
                                        <div className={styles.objectInfo}>
                                            <h3>{obj.name}</h3>
                                            <span className={styles.price}>${obj.price}/day</span>
                                            <span
                                                className={
                                                    obj.available ? styles.availableBadge : styles.unavailableBadge
                                                }
                                            >
                        {obj.available ? "Available" : "Unavailable"}
                      </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === "analytics" && (
                        <div>
                            <h2 className={styles.sectionTitle}>Profile Analytics</h2>
                            <div className={styles.analyticsBox}>
                                <div className={styles.analyticsRow}>Activity Growth Chart</div>
                                <div className={styles.analyticsPlaceholder}>Chart will be rendered here</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalBox} role="dialog" aria-modal="true">
                        <h2 className={styles.sectionTitle}>Edit Profile</h2>

                        <label className={styles.inputLabel}>First name</label>
                        <input
                            className={styles.input}
                            placeholder="First name"
                            value={form.firstName}
                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        />

                        <label className={styles.inputLabel}>Last name</label>
                        <input
                            className={styles.input}
                            placeholder="Last name"
                            value={form.lastName}
                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        />

                        <label className={styles.inputLabel}>Username</label>
                        <input
                            className={styles.input}
                            placeholder="Username"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />

                        <label className={styles.inputLabel}>Email</label>
                        <input
                            className={styles.input}
                            placeholder="Email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />

                        <label className={styles.inputLabel}>Bio</label>
                        <textarea
                            className={styles.input}
                            rows={4}
                            placeholder="Short bio"
                            value={form.bio}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        />

                        <div className={styles.modalActions}>
                            <button onClick={() => setEditing(false)} className={styles.cancelBtn}>
                                Cancel
                            </button>
                            <button onClick={saveProfile} className={styles.saveBtn}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}