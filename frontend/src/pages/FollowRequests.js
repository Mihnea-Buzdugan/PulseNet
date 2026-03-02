import React, { useEffect, useState } from "react";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export default function FollowRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/accounts/follow-requests/", {
                credentials: "include",
            });
            const data = await res.json();
            setRequests(data.requests || []);
        } catch (err) {
            console.error("Error fetching follow requests:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const acceptRequest = async (id) => {
        const csrfToken = getCookie("csrftoken");
        try {
            const res = await fetch(
                `http://localhost:8000/accounts/follow-requests/accept/${id}/`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: { "X-CSRFToken": csrfToken },
                }
            );
            if (res.ok) {
                setRequests((prev) => prev.filter((r) => r.id !== id));
            } else {
                console.error("Failed to accept follow request");
            }
        } catch (err) {
            console.error("Accept error:", err);
        }
    };

    const rejectRequest = async (id) => {
        const csrfToken = getCookie("csrftoken");
        try {
            const res = await fetch(
                `http://localhost:8000/accounts/follow-requests/reject/${id}/`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: { "X-CSRFToken": csrfToken },
                }
            );
            if (res.ok) {
                setRequests((prev) => prev.filter((r) => r.id !== id));
            } else {
                console.error("Failed to reject follow request");
            }
        } catch (err) {
            console.error("Reject error:", err);
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Loading requests…</div>;

    return (
        <div style={{ padding: 20 }}>
            <h2>Follow Requests</h2>

            {requests.length === 0 && <div>No pending follow requests</div>}

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {requests.map((req) => (
                    <div
                        key={req.id}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: 12,
                            border: "1px solid #eee",
                            borderRadius: 8,
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 600 }}>
                                {req.requester.first_name} {req.requester.last_name}
                            </div>
                            <div style={{ color: "#666" }}>@{req.requester.username}</div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => acceptRequest(req.id)}
                                style={{ background: "green", color: "white", padding: "6px 10px", borderRadius: 6 }}
                            >
                                Accept
                            </button>

                            <button
                                onClick={() => rejectRequest(req.id)}
                                style={{ background: "red", color: "white", padding: "6px 10px", borderRadius: 6 }}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}