import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/User_pages/profile.module.css";
import Loading from "../components/Loading";
import {useParams} from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import {AnimatePresence, motion} from "framer-motion";
import {
    X,
    Plus,
    SquarePen,
    Shield,
    Phone,
    Pencil,
    CalendarDays,
    DollarSign,
    Boxes,
    BriefcaseBusiness,
    Handshake,
    Repeat, Undo, Save
} from 'lucide-react';
import {Circle, MapContainer, Marker, TileLayer} from "react-leaflet";
import Footer from "@/components/Footer";

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

const btnMotion = {
    whileHover: {scale: 1.05},
    whileTap: {scale: 0.95},
    transition: {duration: 0.15}
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


    const [currentIndex, setCurrentIndex] = useState(0);

    const itemsPerPage = 4;

    const handleFilterChange = (type) => {
        setPulseFilter(type);
        setCurrentIndex(0);
    };

    const currentPulses = filteredPulses.slice(currentIndex, currentIndex + itemsPerPage);

    const handleNext = () => {
        if (currentIndex + itemsPerPage < filteredPulses.length) {
            setCurrentIndex(prev => prev + itemsPerPage);
        }
    };

    const handlePrev = () => {
        if (currentIndex - itemsPerPage >= 0) {
            setCurrentIndex(prev => prev - itemsPerPage);
        }
    };

    if (loading) return <Loading />;
    if (!user) return <div className={styles.error}>Could not load user data.</div>;

    return (
        <div className={styles.body}>
            <div className={styles.topGreenBar}></div>

            <div className={styles.mainContainer}>
                <div className={styles.navWrapper}>
                    <Navbar />
                </div>

                <div className={styles.container}>

                    {/* HEADER CARD */}
                    <motion.div
                        className={styles.headerCard}
                        whileHover={{scale: 1.02}}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}>

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
                                </div>

                                <div className={styles.resWrapperForButtonAndTag}>
                                    <div className={`${styles.trustBadge} ${styles["comments" + user.trustLevel]}`}>
                                        <span className={styles.trustIcon}><Shield size={16}/></span>
                                        <span className={styles.trustValue}>{user.trustLevel} • {user.trustScore} </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.actionWrapper}>
                                {(user.is_friend || !user.private_account) ? (
                                    <button
                                        className={styles.msgBtn}
                                        onClick={(e) => { e.stopPropagation(); navigate(`/direct-chat/${pulse.user_id}`, {
                                            state: {
                                                fromPulse: false,
                                            }
                                        }); }}
                                    >
                                        DM
                                    </button>
                                ) : (
                                    <button
                                        className={styles.msgBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                        }}
                                    >
                                        Can't contact until you are friends
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
                                        {user.private_account ? "Request to follow" : "Follow"}
                                    </button>
                                )}
                            </div>

                            {/* Profile Info / Edit Form */}
                            <div className={styles.profileInfo}>
                                    <div className={styles.infoContent}>
                                        {/* ...same display as before... */}
                                        <div className={styles.titleRow}>
                                            <h1 className={styles.title}>
                                                {user.firstName} {user.lastName}
                                            </h1>
                                            {user.isVerified && <span className={styles.verified}>✓ Verified neighbour</span>}
                                        </div>

                                        <p className={styles.username}>
                                            @{user.username} • {user.email}
                                        </p>

                                        <p className={styles.biography}>{user.biography}</p>

                                        <div className={styles.publicTagsContainer}>
                                            {user?.skills?.map((skill, index) => (
                                                <span key={index} className={styles.publicTag}>
                                                    {skill}
                                                 </span>
                                            ))}
                                        </div>


                                    </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* PULSES SECTION */}
                    <motion.div className={styles.contentArea}>
                        <motion.div
                            className={styles.card}
                            whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Header modificat cu butoane */}
                            <div className={styles.pulsesHeader}>
                                <h2 className={styles.sectionTitle}>User listings</h2>
                                <div className={styles.filterButtonsRow}>
                                    <motion.button {...btnMotion}
                                                   className={`${styles.filterBtn} ${pulseFilter === "obiecte" ? styles.activeFilter : ""}`}
                                                   onClick={() => handleFilterChange("obiecte")}
                                    >
                                        Objects
                                    </motion.button>
                                    <motion.button {...btnMotion}
                                                   className={`${styles.filterBtn} ${pulseFilter === "servicii" ? styles.activeFilter : ""}`}
                                                   onClick={() => handleFilterChange("servicii")}
                                    >
                                        Services
                                    </motion.button>
                                </div>
                            </div>

                            {/* Pulse list - Acum mapează doar elementele din pagina curentă (currentPulses) */}
                            <div className={styles.objectGrid}>
                                {filteredPulses.length === 0 && (
                                    <p className={styles.emptyState}>No posts of type „{pulseFilter}” yet.</p>
                                )}

                                {currentPulses.map((pulse) => (
                                    <motion.div
                                        key={pulse.id}
                                        className={styles.objectCard}
                                        onClick={() => navigate(`/pulse/${pulse.pulseType}/${pulse.id}`)}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3}}
                                        whileHover={{ y: -3, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }} >
                                        <div className={styles.objectImage}>
                                            {pulse.images && pulse.images.length > 0 ? (
                                                <img src={pulse.images[0]} alt={pulse.title} className={styles.pulseImage} />
                                            ) : (
                                                <span className={styles.imagePlaceholder}>{pulseFilter === "obiecte" ? <Boxes size={80} color={'black'}/> : <BriefcaseBusiness size={80} color={'black'}/>}</span>
                                            )}
                                        </div>
                                        <div className={styles.objectInfo}>
                                            <h3 className={styles.objectName}>{pulse.title}</h3>
                                            {pulse.phone_number && (
                                                <p className={styles.pulsePhone}>
                                                    <Phone size={16} color={'black'} style={{marginTop: '2px', marginRight: '5px'}}/>
                                                    {pulse.phone_number}
                                                </p>
                                            )}
                                            <div className='flex'>
                                                <CalendarDays color={'black'}/>
                                                <p className={styles.pulseDate}>
                                                    Postat:{" "}
                                                    {pulse.timestamp ? new Date(pulse.timestamp.replace(" ", "T") + "Z").toLocaleString("ro-RO", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }) : "—"}
                                                </p>
                                            </div>
                                            <div className='flex'>
                                                <DollarSign color={'green'}/>
                                                {pulse.price != null && (
                                                    <span className="font-bold">
                                    {pulse.price} {pulse.currencyType || "lei"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {filteredPulses.length > itemsPerPage && (
                                <div className={styles.carouselControls}>
                                    <motion.button {...btnMotion}
                                                   onClick={handlePrev}
                                                   disabled={currentIndex === 0}
                                                   className={styles.carouselBtn}
                                    >
                                        &larr; Prev
                                    </motion.button>

                                    <span className={styles.carouselIndicator}>
                    {Math.floor(currentIndex / itemsPerPage) + 1} / {Math.ceil(filteredPulses.length / itemsPerPage)}
                </span>

                                    <motion.button {...btnMotion}
                                                   onClick={handleNext}
                                                   disabled={currentIndex + itemsPerPage >= filteredPulses.length}
                                                   className={styles.carouselBtn}
                                    >
                                        Next &rarr;
                                    </motion.button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>

            </div>
        </div>
            <Footer />
        </div>
    );
}