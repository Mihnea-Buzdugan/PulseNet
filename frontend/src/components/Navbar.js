import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Components/navbar.module.css';

// Helper to get CSRF token for POST requests
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

    // --- Search & Dropdown States ---
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);

    const navigate = useNavigate();

    // 1. Auth Logic: Check tokens on mount
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

    // 2. Fetch Current User Data
    useEffect(() => {
        fetch('http://localhost:8000/accounts/user/', { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => setUser(data))
            .catch(console.error);
    }, []);

    // 3. Search Logic with 300ms Debounce
    useEffect(() => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
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
                setShowDropdown(true);
            } catch (err) {
                console.error("Navbar search error:", err);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [query]);

    // 4. Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Action Handlers ---

    const handleLogout = async () => {
        await fetch('http://localhost:8000/accounts/logout/', { method: 'POST', credentials: 'include' });
        localStorage.removeItem('auth-token');
        localStorage.removeItem('token-expiration');
        setIsAuthenticated(false);
        navigate('/Login');
    };

    const navItems = isAuthenticated
        ? [
            'Home',
            'Profile',
            'Add Pulse',
            'Logout',

        ]
        : ['Home', 'Login'];
    const handleUserAction = async (e, targetUser, action) => {
        e.stopPropagation(); // Don't trigger the parent div's navigate
        const csrf = getCookie("csrftoken");
        const url = `http://localhost:8000/accounts/${action}/${targetUser.id}/`;

        try {
            await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "X-CSRFToken": csrf },
            });

            // Optimistic UI Update for the search results
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

    const openChat = (e, username) => {
        e.stopPropagation();
        navigate(`/chat/${username}`);
        setShowDropdown(false);
        setQuery("");
    };

    const toggleMenu = () => setMenuActive(!menuActive);


    const renderNavItem = (item, index) => {
        if (!item) return null;

        const handlers = {
            Logout: handleLogout,
            Profile: () => navigate('/profile'),
            Login: () => navigate('/login'),
            Home: () => navigate('/'),
        };

        return (
            <div key={index} className={styles.sus} onClick={handlers[item] || null}>
                {item}
            </div>
        );
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.right}>
                <img src="/logo.png" alt="Logo" className={styles.logo} onClick={() => navigate('/')} />
                <div className={styles.name}>PulseNet</div>
            </div>

            {/* --- SEARCH BAR --- */}
            <div className={styles.searchContainer} ref={searchRef}>
                <input
                    type="text"
                    placeholder="Search PulseNet..."
                    className={styles.searchInput}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && setShowDropdown(true)}
                />

                {showDropdown && searchResults.length > 0 && (
                    <div className={styles.searchDropdown}>
                        {searchResults.map((u) => (
                            <div
                                key={u.id}
                                className={styles.searchResultItem}
                                onClick={() => {
                                    navigate(`/user-profile/${u.id}`);
                                    setShowDropdown(false);
                                    setQuery("");
                                }}
                            >
                                <div className={styles.userInfo}>
                                    <span className={styles.userName}>{u.first_name} {u.last_name}</span>
                                    <span className={styles.userHandle}>@{u.username}</span>
                                    {u.is_friend && <span className={styles.friendBadge}>🤝 Friend</span>}
                                </div>

                                <div className={styles.userActions}>
                                    {/* DM Button */}
                                    {(u.is_friend || !u.private_account) && (
                                        <button className={styles.msgBtn} onClick={(e) => openChat(e, u.username)}>
                                            DM
                                        </button>
                                    )}

                                    {/* Follow/Unfollow/Cancel Buttons */}
                                    {u.is_friend || u.is_following ? (
                                        <button className={styles.unfollowBtn} onClick={(e) => handleUserAction(e, u, 'unfollow')}>
                                            Unfollow
                                        </button>
                                    ) : u.pending_follow ? (
                                        <button className={styles.pendingBtn} onClick={(e) => handleUserAction(e, u, 'unfollow')}>
                                            Cancel
                                        </button>
                                    ) : (
                                        <button className={styles.followBtn} onClick={(e) => handleUserAction(e, u, 'follow')}>
                                            {u.private_account ? "Request" : "Follow"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.left}>
                {navItems.map((item, i) => renderNavItem(item, i))}
            </div>

            <button className={styles.hamburger} onClick={toggleMenu}>
                &#9776;
            </button>

            <div className={`${styles.mobileMenu} ${menuActive ? styles.active : ''}`}>
                {navItems.map((item, i) => renderNavItem(item, i))}
            </div>
        </nav>
    );
}

export default Navbar;