import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../styles/Components/navbar.module.css';
import { FaHeart, FaBell } from "react-icons/fa";
import { clearUserIdCache } from "@/utils/cryptoUtils";
import {IoNotificationsOutline} from "react-icons/io5";


function getCookie(name) {
    let cookieValue = null;
    if (document.cookie) {
        document.cookie.split(";").forEach((cookie) => {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
            }
        });
    }
    return cookieValue;
}

function Navbar() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [menuActive, setMenuActive] = useState(false);
    const [user, setUser] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);


    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    const searchRef = useRef(null);
    const notifRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    const unreadNotifCount = notifications.filter(n => !n.is_read).length;


    useEffect(() => {
        const token = localStorage.getItem('auth-token');
        const tokenExpiration = localStorage.getItem('token-expiration');
        if (token && tokenExpiration) {
            const expirationTime = new Date(tokenExpiration);
            if (new Date() < expirationTime) {
                setIsAuthenticated(true);
            } else {
                localStorage.removeItem('auth-token');
                localStorage.removeItem('token-expiration');
            }
        }
    }, []);


    const fetchData = async () => {
        if (!isAuthenticated) return;
        try {

            const userRes = await fetch('http://localhost:8000/accounts/user/', { credentials: 'include' });
            const userData = await userRes.json();
            setUser(userData);


            const notifRes = await fetch('http://localhost:8000/accounts/notifications/', { credentials: 'include' });
            const notifData = await notifRes.json();
            setNotifications(notifData.notifications || []);
        } catch (err) {
            console.error("Navbar data fetch error:", err);
        }
    };

    useEffect(() => {
        fetchData();

        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    useEffect(() => {
        const handler = () => fetchData();
        window.addEventListener("pet_match_notification", handler);
        return () => window.removeEventListener("pet_match_notification", handler);
    }, [isAuthenticated]);


    useEffect(() => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(
                    `http://localhost:8000/accounts/search-users/?q=${encodeURIComponent(query)}`,
                    { credentials: "include" }
                );
                const data = await res.json();
                setSearchResults(data.users || []);
                setShowSearchDropdown(true);
                setShowNotifDropdown(false);
            } catch (err) {
                console.error("Search error:", err);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [query]);


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearchDropdown(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);



    const handleLogout = async () => {
        await fetch('http://localhost:8000/accounts/logout/', { method: 'POST', credentials: 'include' });
        localStorage.removeItem('auth-token');
        localStorage.removeItem('token-expiration');
        clearUserIdCache();
        setIsAuthenticated(false);
        navigate('/Login');
    };

    const toggleNotifications = async () => {
        const nextState = !showNotifDropdown;
        setShowNotifDropdown(nextState);
        setShowSearchDropdown(false);


        if (nextState && unreadNotifCount > 0) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            try {
                await fetch('http://localhost:8000/accounts/notifications/mark-read/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') },
                    credentials: 'include'
                });
            } catch (err) {
                console.error("Failed to mark notifications read", err);
            }
        }
    };

    const handleNotifClick = (n) => {
        setShowNotifDropdown(false);

        if (n.type === 'chat_message') {
            navigate(`/direct-chat/${n.sender_id}`);
        } else if (n.type === 'rental_proposal') {
            navigate(`/profile`);
        } else if (n.pulse_id) {
            navigate(`/pulse/${n.pulse_id}`);
        } else if (n.type === 'hero_alert' && n.metadata?.request_id) {
            navigate(`/request/${n.metadata.request_id}`);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await fetch(`http://localhost:8000/accounts/delete_notification/${id}/`, {
                method: "DELETE",
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include'
            });

            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error("Failed to delete notification:", err);
        }
    };


    const handleUserAction = async (e, targetUser, action) => {
        e.stopPropagation();
        const csrf = getCookie("csrftoken");
        const url = `http://localhost:8000/accounts/${action}/${targetUser.id}/`;

        try {
            await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "X-CSRFToken": csrf },
            });

            setSearchResults(prev => prev.map(u => {
                if (u.id === targetUser.id) {
                    if (action === 'follow') {
                        return { ...u, is_following: !u.private_account, pending_follow: u.private_account };
                    } else {
                        return { ...u, is_following: false, is_friend: false, pending_follow: false };
                    }
                }
                return u;
            }));
        } catch (err) {
            console.error(`${action} failed:`, err);
        }
    };

    const openChat = (e, userId) => {
        e.stopPropagation();
        navigate(`/direct-chat/${userId}`);
        setShowSearchDropdown(false);
        setQuery("");
    };

    const navItems = isAuthenticated
        ? ['Home', 'Alerts', 'Profile', 'Add Pulse', 'Logout']
        : ['Home', 'Login'];

    const renderNavItem = (item, index) => {
        const handlers = {
            Logout: handleLogout,
            Profile: () => navigate('/profile'),
            Login: () => navigate('/login'),
            Home: () => navigate('/'),
            Alerts: () => navigate('/alerts'),
            "Add Pulse": () => navigate('/add-pulse'),
        };

        return (
            <div key={index} className={styles.sus} onClick={handlers[item] || null}>
                {item}
            </div>
        );
    };

    return (
        <nav className={styles.navbar}>
            {/* LEFT */}
            <div className={styles.brandContainer} onClick={() => navigate('/')}>
                <img src="/logo.png" alt="Logo" className={styles.logo} />
                <div className={styles.name}>PulseNet</div>
            </div>

            {/* MIDDLE */}
            <div className={styles.middleSection}>
                <div className={styles.searchContainer} ref={searchRef}>
                    <input
                        type="text"
                        placeholder="Search PulseNet..."
                        className={styles.searchInput}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => query && setShowSearchDropdown(true)}
                    />

                    {showSearchDropdown && searchResults.length > 0 && (
                        <div className={styles.searchDropdown}>
                            {searchResults.map((u) => (
                                <div
                                    key={u.id}
                                    className={styles.searchResultItem}
                                    onClick={() => {
                                        navigate(`/user-profile/${u.id}`);
                                        setShowSearchDropdown(false);
                                        setQuery("");
                                    }}
                                >
                                    <div className={styles.userInfo}>
                                        <span className={styles.userName}>{u.first_name} {u.last_name}</span>
                                        <span className={styles.userHandle}>@{u.username}</span>
                                    </div>

                                    <div className={styles.userActions}>
                                        {(u.is_friend || !u.private_account) && (
                                            <button className={styles.msgBtn} onClick={(e) => openChat(e, u.id)}>DM</button>
                                        )}
                                        {u.is_following ? (
                                            <button
                                                className={styles.unfollowBtn}
                                                onClick={(e) => handleUserAction(e, u, 'unfollow')}
                                            >
                                                Unfollow
                                            </button>
                                        ) : u.pending_follow ? (
                                            <button className={styles.pendingBtn} onClick={(e) => handleUserAction(e, u, 'unfollow')}>
                                                Pending
                                            </button>
                                        ) : (
                                            <button
                                                className={styles.followBtn}
                                                onClick={(e) => handleUserAction(e, u, 'follow')}
                                            >
                                                Follow
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isAuthenticated && (
                    <div className={styles.iconButtonsContainer}>
                        {/* DM BUTTON */}
                        <div className={`${styles.dmButton} ${location.pathname.startsWith('/messages') ? styles.activeDm : ''}`} onClick={() => navigate('/messages')}>
                            <svg aria-label="Direct Messaging" color="currentColor" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
                                <line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line>
                                <polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon>
                            </svg>
                            {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                        </div>

                        {/* NOTIFICATIONS BUTTON */}
                        <div className={styles.notifWrapper} ref={notifRef}>
                            <div className={`${styles.notifButton} ${showNotifDropdown ? styles.activeNotif : ''}`} onClick={toggleNotifications}>
                                <IoNotificationsOutline className={styles.notifIcon} />
                                {unreadNotifCount > 0 && <span className={styles.badge}>{unreadNotifCount}</span>}
                            </div>

                            {showNotifDropdown && (
                                <div className={styles.notifDropdown}>

                                    <div className={styles.notifList}>
                                        {notifications.length > 0 ? (
                                            notifications.map((n) => (
                                                <div
                                                    key={n.id}
                                                    className={styles.notifItem}
                                                    onClick={() => handleNotifClick(n)}
                                                >
                                                    <div className={styles.notifContent}>
                                                        <div className={styles.notifTitle}>{n.title}</div>
                                                        <div className={styles.notifText}>{n.message}</div>
                                                        <div className={styles.notifTime}>{n.created_at}</div>
                                                    </div>

                                                    {/* DELETE BUTTON */}
                                                    <button
                                                        className={styles.deleteNotifBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(n.id);
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className={styles.emptyNotifs}>No new notifications</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FAVORITES */}
                        <div className={styles.favoriteNavButton} onClick={() => navigate('/favorites')}>
                            <FaHeart className={styles.heartIcon} />
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT */}
            <div className={styles.navLinks}>
                {navItems.map((item, i) => renderNavItem(item, i))}
            </div>

            <button className={styles.hamburger} onClick={() => setMenuActive(!menuActive)}>&#9776;</button>

            <div className={`${styles.mobileMenu} ${menuActive ? styles.active : ''}`}>
                {navItems.map((item, i) => renderNavItem(item, i))}
            </div>
        </nav>
    );
}

export default Navbar;