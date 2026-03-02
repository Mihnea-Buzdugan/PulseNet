import { useState } from "react";

export default function SearchUsers() {
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState([]);

    const searchUsers = async () => {
        const res = await fetch(
            `http://localhost:8000/accounts/search-users/?q=${query}`,
            { credentials: "include" }
        );

        const data = await res.json();
        setUsers(data.users);
    };

    const followUser = async (userId) => {
        await fetch(
            `http://localhost:8000/accounts/follow/${userId}/`,
            { method: "POST", credentials: "include" }
        );

        searchUsers();
    };

    const unfollowUser = async (userId) => {
        await fetch(
            `http://localhost:8000/accounts/unfollow/${userId}/`,
            { method: "POST", credentials: "include" }
        );

        searchUsers();
    };

    return (
        <div style={{ padding: 40 }}>
            <h2>Search Users</h2>

            <input
                placeholder="Search by username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            <button onClick={searchUsers}>
                Search
            </button>

            <div>
                {users.map(user => (
                    <div key={user.id}
                         style={{
                             border: "1px solid #ddd",
                             padding: 10,
                             marginTop: 10
                         }}
                    >
                        <p>
                            {user.username}
                        </p>

                        {user.is_following ? (
                            <button onClick={() => unfollowUser(user.id)}>
                                Unfollow
                            </button>
                        ) : (
                            <button onClick={() => followUser(user.id)}>
                                Follow
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}