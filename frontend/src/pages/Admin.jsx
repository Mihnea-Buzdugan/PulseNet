import React, { useState } from 'react';
import styles from '../styles/Admin.module.css';

function getCookie(name) {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie ? document.cookie.split(";") : [];
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + "=")) {
            return decodeURIComponent(cookie.substring(name.length + 1));
        }
    }
    return null;
}

const Admin = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [banDuration, setBanDuration] = useState(24); // Default to 24 hours

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/accounts/search_users/?q=${query}`, {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" },
            });
            const data = await response.json();
            setResults(data.users || []);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBanUser = async (userId) => {
        if (!window.confirm(`Initiate protocol: Ban User #${userId} for ${banDuration} hours?`)) return;

        try {
            const response = await fetch(`http://localhost:8000/accounts/ban-user/${userId}/`, {
                method: 'POST',
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRFToken": getCookie('csrftoken')
                },
                body: JSON.stringify({ duration: banDuration })
            });

            if (response.ok) {
                alert("Target neutralized. User access revoked.");
                // Remove the banned user from results
                setResults(results.filter(user => user.id !== userId));
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error || "Override failed"}`);
            }
        } catch (error) {
            console.error("Ban failed:", error);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>System Control <span className={styles.accent}>Nexus</span></h1>
                <p className={styles.subtitle}>User Search & Enforcement Terminal</p>

                <form onSubmit={handleSearch} className={styles.searchContainer}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Scan for username or real name..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" className={styles.searchButton}>Search</button>
                </form>

                <div className={styles.banSettings}>
                    <label>Ban Duration (Hours):</label>
                    <input
                        type="number"
                        value={banDuration}
                        onChange={(e) => setBanDuration(e.target.value)}
                        className={styles.durationInput}
                    />
                </div>
            </header>

            <div className={styles.tableWrapper}>
                {loading ? (
                    <div className={styles.loader}>Accessing Database...</div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                        <tr>
                            <th>Identity</th>
                            <th>Username</th>
                            <th>Full Name</th>
                            <th>Account Status</th>
                            <th>Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {results.map((user) => (
                            <tr key={user.id} className={styles.row}>
                                <td>
                                    <img
                                        src={user.profile_picture || 'https://via.placeholder.com/40'}
                                        alt="avatar"
                                        className={styles.avatar}
                                    />
                                </td>
                                <td className={styles.idCell}>{user.username}</td>
                                <td>{user.first_name} {user.last_name}</td>
                                <td>
                                    <div className={styles.badgeContainer}>
                                        {user.is_friend && <span className={styles.friendBadge}>Friend</span>}
                                        {user.private_account && <span className={styles.privateBadge}>Private</span>}
                                        {user.is_following && <span className={styles.followingBadge}>Following</span>}
                                    </div>
                                </td>
                                <td>
                                    <button
                                        className={styles.banButton}
                                        onClick={() => handleBanUser(user.id)}
                                    >
                                        Ban User
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
                {!loading && results.length === 0 && query && (
                    <div className={styles.noResults}>No matching signatures found.</div>
                )}
            </div>
        </div>
    );
};

export default Admin;