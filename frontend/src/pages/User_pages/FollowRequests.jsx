import React, { useEffect, useState } from "react";
import styles from "../../styles/User_pages/followRequests.module.css";
import Navbar from "../../components/Navbar";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
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
            const res = await fetch(
                "http://localhost:8000/accounts/follow-requests/",
                {
                    credentials: "include",
                }
            );
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
                // Remove accepted request with small delay for better UX
                setRequests((prev) => prev.filter((r) => r.id !== id));
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
            }
        } catch (err) {
            console.error("Reject error:", err);
        }
    };

    if (loading) {
        return <div className={styles.loader}>Loading follow requests...</div>;
    }

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />
        <div className={styles.page}>
            <div className={styles.container}>
                <h2 className={styles.title}>Follow Requests</h2>

                {requests.length === 0 && (
                    <div className={styles.empty}>
                        No pending follow requests
                    </div>
                )}

                <div className={styles.list}>
                    {requests.map((req) => (
                        <div key={req.id} className={styles.card}>
                            <div className={styles.userInfo}>
                                <div className={styles.username}>
                                    {req.requester.first_name} {req.requester.last_name}
                                </div>
                                <div className={styles.handle}>
                                    @{req.requester.username}
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <button
                                    onClick={() => acceptRequest(req.id)}
                                    className={styles.acceptBtn}
                                >
                                    Accept
                                </button>

                                <button
                                    onClick={() => rejectRequest(req.id)}
                                    className={styles.rejectBtn}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
            </div>
        </div>
    );
}
