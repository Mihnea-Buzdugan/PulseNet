import React, { useEffect, useState } from "react";

export default function FollowRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const getCookie = (name) => {
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
    };

    // ✅ Fetch pending requests
    useEffect(() => {
        fetch("http://localhost:8000/accounts/follow-requests/", {
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                setRequests(data.requests || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // ✅ Accept request
    const acceptRequest = async (id) => {
        await fetch(
            `http://localhost:8000/accounts/follow-requests/accept/${id}/`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
            }
        );

        // Remove from UI
        setRequests((prev) => prev.filter((req) => req.id !== id));
    };

    // ❌ Reject request
    const rejectRequest = async (id) => {
        await fetch(
            `http://localhost:8000/accounts/follow-requests/reject/${id}/`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
            }
        );

        // Remove from UI
        setRequests((prev) => prev.filter((req) => req.id !== id));
    };

    if (loading) return <p>Loading requests...</p>;

    return (
        <div>
            <h2>Follow Requests</h2>

            {requests.length === 0 && (
                <p>No pending follow requests</p>
            )}

            {requests.map((req) => (
                <div
                    key={req.id}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                    }}
                >
                    <div>
                        <strong>
                            {req.requester.first_name}{" "}
                            {req.requester.last_name}
                        </strong>
                        <p>@{req.requester.username}</p>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={() => acceptRequest(req.id)}
                            style={{
                                background: "green",
                                color: "white",
                                padding: "6px 10px",
                                borderRadius: "6px",
                            }}
                        >
                            Accept
                        </button>

                        <button
                            onClick={() => rejectRequest(req.id)}
                            style={{
                                background: "red",
                                color: "white",
                                padding: "6px 10px",
                                borderRadius: "6px",
                            }}
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}