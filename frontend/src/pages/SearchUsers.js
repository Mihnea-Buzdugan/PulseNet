import React, { useEffect, useState } from "react";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie) {
        document.cookie.split(";").forEach((cookie) => {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
            }
        });
    }
    return cookieValue;
}

export default function SearchUsers() {
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchUsers = async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(
                `http://localhost:8000/accounts/search-users/?q=${encodeURIComponent(query)}`,
                { credentials: "include" }
            );

            const data = await res.json();
            setUsers(data.users || []);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setLoading(false);
        }
    };

    // 🔎 Search automatically when typing
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchUsers();
        }, 300);

        return () => clearTimeout(timeout);
    }, [query]);

    const followUser = async (userId) => {
        const csrf = getCookie("csrftoken");

        await fetch(`http://localhost:8000/accounts/follow/${userId}/`, {
            method: "POST",
            credentials: "include",
            headers: { "X-CSRFToken": csrf },
        });

        // Update UI optimistically
        setUsers((prev) =>
            prev.map((u) =>
                u.id === userId
                    ? {
                        ...u,
                        is_following: !u.private_account,
                        pending_follow: u.private_account,
                    }
                    : u
            )
        );
    };

    const unfollowUser = async (userId) => {
        const csrf = getCookie("csrftoken");

        await fetch(`http://localhost:8000/accounts/unfollow/${userId}/`, {
            method: "POST",
            credentials: "include",
            headers: { "X-CSRFToken": csrf },
        });

        setUsers((prev) =>
            prev.map((u) =>
                u.id === userId
                    ? {
                        ...u,
                        is_following: false,
                        is_friend: false,
                        pending_follow: false,
                    }
                    : u
            )
        );
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Search Users</h2>

            <div style={{ display: "flex", gap: 10 }}>
                <input
                    placeholder="Search users..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        flex: 1,
                    }}
                />
                <button onClick={fetchUsers}>Search</button>
            </div>

            {loading && <p>Loading...</p>}

            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                {users.map((user) => (
                    <div
                        key={user.id}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: 12,
                            border: "1px solid #eee",
                            borderRadius: 8,
                        }}
                    >
                        {/* USER INFO */}
                        <div>
                            <strong>
                                {user.first_name} {user.last_name}
                            </strong>
                            <p style={{ color: "#666" }}>
                                @{user.username}
                            </p>

                            {/* Status Labels */}
                            {user.is_friend && (
                                <span
                                    style={{
                                        background: "#4ade80",
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        marginRight: 6,
                                    }}
                                >
                                    🤝 Friend
                                </span>
                            )}

                            {user.pending_follow && (
                                <span
                                    style={{
                                        background: "#facc15",
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        fontSize: 12,
                                    }}
                                >
                                    ⏳ Requested
                                </span>
                            )}
                        </div>

                        {/* ACTION BUTTONS */}
                        <div>
                            {user.is_friend ? (
                                <button
                                    onClick={() => unfollowUser(user.id)}
                                    style={{
                                        background: "red",
                                        color: "white",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                    }}
                                >
                                    Remove Friend
                                </button>
                            ) : user.is_following ? (
                                <button
                                    onClick={() => unfollowUser(user.id)}
                                    style={{
                                        background: "#ddd",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                    }}
                                >
                                    Following
                                </button>
                            ) : user.pending_follow ? (
                                <button
                                    onClick={() => unfollowUser(user.id)}
                                    style={{
                                        background: "#eee",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                    }}
                                >
                                    Requested
                                </button>
                            ) : (
                                <button
                                    onClick={() => followUser(user.id)}
                                    style={{
                                        background: "#3b82f6",
                                        color: "white",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                    }}
                                >
                                    {user.private_account
                                        ? "Request"
                                        : "Follow"}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}