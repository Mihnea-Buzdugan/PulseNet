import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/User_pages/profile.module.css";
import Loading from "../components/Loading";
import {useParams} from "react-router-dom";
import { useNavigate } from 'react-router-dom';

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
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    // Pulse filter — "obiecte" by default
    const [pulseFilter, setPulseFilter] = useState("obiecte");

    // image/upload state
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);
    const { id } = useParams();


    useEffect(() => {
        const csrfToken = getCookie('csrftoken');
        fetch(`http://localhost:8000/accounts/user_profile/${id}`, {
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


    const handleUserAction = async (e, targetUser, action) => {
        e.stopPropagation();
        const csrf = getCookie("csrftoken");
        // Use targetUser.id to ensure we hit the right endpoint
        const url = `http://localhost:8000/accounts/${action}/${targetUser.id}/`;

        try {
            await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "X-CSRFToken": csrf },
            });

            // Optimistic UI Update for a SINGLE object
            setUser(prev => {
                if (!prev) return null;

                if (action === 'follow') {
                    return {
                        ...prev,
                        is_following: !prev.private_account,
                        pending_follow: prev.private_account
                    };
                } else {
                    // handles 'unfollow'
                    return {
                        ...prev,
                        is_following: false,
                        is_friend: false,
                        pending_follow: false
                    };
                }
            });
        } catch (err) {
            console.error(`${action} failed:`, err);
        }
    };

    const filteredPulses = useMemo(() => {
        if (!user || !user.pulses) return [];
        return user.pulses.filter(p => p.pulseType === pulseFilter);
    }, [user, pulseFilter]);



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

                                </div>

                                <div className={styles.trustBadge}>
                                    <span className={styles.trustIcon}>🛡️</span>
                                    <span className={styles.trustValue}>{user.trustScore}% Trust</span>
                                </div>
                            </div>

                            <div className={styles.actionWrapper}>
                                {(user.is_friend || !user.private_account) && (
                                    <button
                                        className={styles.msgBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/direct-chat/${id}`);
                                        }}
                                    >
                                        DM
                                    </button>
                                )}
                                {user.is_friend || user.is_following ? (
                                    <button className={styles.unfollowBtn} onClick={(e) => handleUserAction(e, user, 'unfollow')}>
                                        Unfollow
                                    </button>
                                ) : user.pending_follow ? (
                                    <button className={styles.pendingBtn} onClick={(e) => handleUserAction(e, user, 'unfollow')}>
                                        Cancel
                                    </button>
                                ) : (
                                    <button className={styles.followBtn} onClick={(e) => handleUserAction(e, user, 'follow')}>
                                        {user.private_account ? "Request" : "Follow"}
                                    </button>
                                )}
                            </div>
                            {/* Profile Info / Edit Form */}
                            <div className={styles.profileInfo}>
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
                                    </div>
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}