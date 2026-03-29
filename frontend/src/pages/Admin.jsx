import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Admin.module.css';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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

function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function toLocalDatetimeInputValue(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const year = local.getFullYear();
    const month = pad(local.getMonth() + 1);
    const day = pad(local.getDate());
    const hours = pad(local.getHours());
    const minutes = pad(local.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const Admin = () => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('users');

    // User Search State
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Reports & Flagged State
    const [reports, setReports] = useState([]);
    const [flaggedData, setFlaggedData] = useState({ pulses: [], alerts: [], urgent_requests: [] });
    const [loadingData, setLoadingData] = useState(false);

    // Selected report for modal
    const [selectedReport, setSelectedReport] = useState(null);

    // Ban modal state
    const [selectedUserToBan, setSelectedUserToBan] = useState(null);
    const [banUntil, setBanUntil] = useState('');
    const [banSubmitting, setBanSubmitting] = useState(false);
    const [banError, setBanError] = useState('');

    const [selectedUserToUnban, setSelectedUserToUnban] = useState(null);
    const [unbanSubmitting, setUnbanSubmitting] = useState(false);
    const [unbanError, setUnbanError] = useState('');

    const [deletingItemId, setDeletingItemId] = useState(null);

    const handleDeleteFlaggedItem = async (item, itemType) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to delete this ${itemType}? This action cannot be undone.`
        );

        if (!confirmDelete) return;

        setDeletingItemId(item.id);

        try {
            let url = '';

            // Adjust these endpoints to match your backend
            if (itemType === 'pulse') {
                url = `http://localhost:8000/accounts/delete-pulse/${item.id}/`;
            } else if (itemType === 'alert') {
                url = `http://localhost:8000/accounts/delete-alert/${item.id}/`;
            } else if (itemType === 'urgent_request') {
                url = `http://localhost:8000/accounts/delete-urgent-request/${item.id}/`;
            }

            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Delete failed');
            }

            // remove from UI immediately
            setFlaggedData((prev) => ({
                ...prev,
                pulses:
                    itemType === 'pulse'
                        ? prev.pulses.filter((x) => x.id !== item.id)
                        : prev.pulses,
                alerts:
                    itemType === 'alert'
                        ? prev.alerts.filter((x) => x.id !== item.id)
                        : prev.alerts,
                urgent_requests:
                    itemType === 'urgent_request'
                        ? prev.urgent_requests.filter((x) => x.id !== item.id)
                        : prev.urgent_requests,
            }));
        } catch (error) {
            console.error(error);
            alert('Could not delete this item.');
        } finally {
            setDeletingItemId(null);
        }
    };

    useEffect(() => {
        const fetchSystemData = async () => {
            if (activeTab === 'users') return;

            setLoadingData(true);
            try {
                if (activeTab === 'reports' && reports.length === 0) {
                    const res = await fetch(`http://localhost:8000/accounts/admin_alert_reports/`, {
                        credentials: "include"
                    });
                    const data = await res.json();
                    if (data.reports) setReports(data.reports);
                } else if (activeTab === 'flagged' && flaggedData.pulses.length === 0) {
                    const res = await fetch(`http://localhost:8000/accounts/flagged_posts/`, {
                        credentials: "include"
                    });
                    const data = await res.json();
                    if (data.success) setFlaggedData(data.flagged);
                }
            } catch (err) {
                console.error("Data retrieval failed:", err);
            } finally {
                setLoadingData(false);
            }
        };

        fetchSystemData();
    }, [activeTab, reports.length, flaggedData.pulses.length]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setLoadingUsers(false);
            return;
        }

        setLoadingUsers(true);
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(
                    `http://localhost:8000/accounts/search-users/?q=${encodeURIComponent(query)}`,
                    { credentials: "include" }
                );
                const data = await res.json();
                setResults(data.users || []);
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoadingUsers(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [query]);

    const handleDeleteReport = async (reportId) => {

        try {
            const response = await fetch(`http://localhost:8000/accounts/delete_report/${reportId}/`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "X-CSRFToken": getCookie('csrftoken')
                },
            });

            if (!response.ok) {
                throw new Error("Failed to delete report");
            }

            setReports((prevReports) => prevReports.filter(report => report.id !== reportId));

            // Close the modal
            setSelectedReport(null);
        } catch (error) {
            console.error(error);
            alert("Could not delete the report.");
        }
    };

    const openBanModal = (user) => {
        setSelectedUserToBan(user);
        setBanError('');
        setBanUntil(toLocalDatetimeInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    };

    const closeBanModal = () => {
        setSelectedUserToBan(null);
        setBanUntil('');
        setBanError('');
        setBanSubmitting(false);
    };

    const confirmBanUser = async () => {
        if (!selectedUserToBan) return;

        if (!banUntil) {
            setBanError("Please select when the ban should end.");
            return;
        }

        setBanSubmitting(true);
        setBanError('');

        try {
            const response = await fetch(`http://localhost:8000/accounts/ban-user/${selectedUserToBan.id}/`, {
                method: 'POST',
                credentials: "include",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie('csrftoken')
                },
                body: JSON.stringify({
                    ban_until: new Date(banUntil).toISOString()
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Success: ${data.message}`);
                setResults(prev => prev.filter(user => user.id !== selectedUserToBan.id));
                closeBanModal();
            } else {
                setBanError(data.error || "Ban action failed.");
            }
        } catch (error) {
            console.error("Ban failed:", error);
            setBanError("Ban action failed. Please try again.");
        } finally {
            setBanSubmitting(false);
        }
    };

    const confirmUnbanUser = async () => {
        if (!selectedUserToUnban) return;

        setUnbanSubmitting(true);
        setUnbanError('');

        try {
            const response = await fetch(
                `http://localhost:8000/accounts/unban-user/${selectedUserToUnban.id}/`,
                {
                    method: 'POST',
                    credentials: "include",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie('csrftoken')
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {
                alert(`Success: ${data.message}`);

                // ✅ Update UI instantly
                setResults(prev =>
                    prev.map(user =>
                        user.id === selectedUserToUnban.id
                            ? { ...user, is_banned: false }
                            : user
                    )
                );

                setSelectedUserToUnban(null);
            } else {
                setUnbanError(data.error || "Unban failed.");
            }
        } catch (err) {
            console.error(err);
            setUnbanError("Unban failed. Try again.");
        } finally {
            setUnbanSubmitting(false);
        }
    };

    const goToAlert = (alertId) => {
        navigate(`/alert/${alertId}`);
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    System <span className={styles.accent}>Administration</span>
                </h1>
                <p className={styles.subtitle}>User Management & Content Moderation</p>

                <div className={styles.navTabs}>
                    <button
                        className={activeTab === 'users' ? styles.activeTab : styles.tab}
                        onClick={() => setActiveTab('users')}
                    >
                        User Management
                    </button>
                    <button
                        className={activeTab === 'reports' ? styles.activeTab : styles.tab}
                        onClick={() => setActiveTab('reports')}
                    >
                        Alert Reports
                    </button>
                    <button
                        className={activeTab === 'flagged' ? styles.activeTab : styles.tab}
                        onClick={() => setActiveTab('flagged')}
                    >
                        Flagged Content
                    </button>
                </div>
            </header>

            <main className={styles.mainContent}>
                {activeTab === 'users' && (
                    <div className={styles.panel}>
                        <div className={styles.searchContainer}>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Start typing to search users..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>

                        <div className={styles.tableWrapper}>
                            {loadingUsers ? (
                                <div className={styles.loader}>Searching Database...</div>
                            ) : (
                                <table className={styles.table}>
                                    <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Username</th>
                                        <th>Full Name</th>
                                        <th>Account Status</th>
                                        <th>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {results.map((user) => (
                                        <tr key={user.id} className={styles.row}>
                                            <td>
                                                <div className={styles.userBio}>
                                                    <img
                                                        src={user.profile_picture || "/defaultImage.png"}
                                                        alt="avatar"
                                                        className={styles.avatar}
                                                    />
                                                    <span className={styles.idCell}>#{user.id}</span>
                                                </div>
                                            </td>
                                            <td>
                                            <button
                                                type="button"
                                                className={styles.alertLink}
                                                onClick={() => navigate(`/user-profile/${user.id}`)}
                                                title="Go to this user page"
                                            >
                                                @{user.username}
                                            </button>
                                            </td>
                                            <td>{user.first_name} {user.last_name}</td>
                                            <td>
                                                <div className={styles.badgeContainer}>
                                                    {user.is_banned ? (
                                                        <span className={styles.badgeDanger}>Banned</span>
                                                    ) : user.private_account ? (
                                                        <span className={styles.badgeWarn}>Private</span>
                                                    ) : (
                                                        <span className={styles.badgeInfo}>Public</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {user.is_banned ? (
                                                    <button
                                                        className={styles.unbanButton}
                                                        onClick={() => setSelectedUserToUnban(user)}
                                                    >
                                                        Unban User
                                                    </button>
                                                ) : (
                                                    <button
                                                        className={styles.banButton}
                                                        onClick={() => openBanModal(user)}
                                                    >
                                                        Ban User
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )}
                            {!loadingUsers && results.length === 0 && query && (
                                <div className={styles.noResults}>No users matched your search.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className={styles.panel}>
                        <h2 className={styles.panelTitle}>Active Alert Reports</h2>

                        {loadingData ? (
                            <div className={styles.loader}>Loading Reports...</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Targeted Alert</th>
                                        <th>Reported By</th>
                                        <th>Reason & Details</th>
                                        <th>Date Submitted</th>
                                        <th>Action</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {reports.map((r) => (
                                        <tr key={r.id} className={styles.row}>
                                            <td className={styles.idCell}>#{r.id}</td>

                                            <td className={styles.highlightCell}>
                                                <button
                                                    type="button"
                                                    className={styles.alertLink}
                                                    onClick={() => goToAlert(r.alert_id)}
                                                    title="Go to this alert"
                                                >
                                                    {r.alert_title}
                                                </button>
                                                <br />
                                                <span className={styles.dimText}>(ID: {r.alert_id})</span>
                                            </td>

                                            <td>{r.user_email}</td>

                                            <td>
                                                <strong className={styles.dangerText}>{r.reason}</strong>
                                                <p className={styles.subText}>{r.description}</p>
                                            </td>

                                            <td className={styles.dimText}>
                                                {formatDateTime(r.created_at)}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className={styles.viewButton}
                                                    onClick={() => setSelectedReport(r)}
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {selectedReport && (
                            <div
                                className={styles.modalOverlay}
                                onClick={() => setSelectedReport(null)}
                            >
                                <div
                                    className={styles.modal}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className={styles.modalHeader}>
                                        <div>
                                            <h2 className={styles.modalTitle}>Report #{selectedReport.id}</h2>
                                            <p className={styles.modalSubtitle}>Full report details</p>
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.closeIconButton}
                                            onClick={() => setSelectedReport(null)}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className={styles.modalGrid}>
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Alert</span>
                                            <span className={styles.modalValue}>{selectedReport.alert_title}</span>
                                        </div>

                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Alert ID</span>
                                            <span className={styles.modalValue}>#{selectedReport.alert_id}</span>
                                        </div>

                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Reported By</span>
                                            <span className={styles.modalValue}>{selectedReport.user_email}</span>
                                        </div>

                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Reason</span>
                                            <span className={styles.modalValue}>{selectedReport.reason}</span>
                                        </div>

                                        <div className={styles.modalFieldFull}>
                                            <span className={styles.modalLabel}>Description</span>
                                            <p className={styles.modalText}>
                                                {selectedReport.description || "No additional details provided."}
                                            </p>
                                        </div>

                                        <div className={styles.modalFieldFull}>
                                            <span className={styles.modalLabel}>Submitted At</span>
                                            <p className={styles.modalText}>
                                                {formatDateTime(selectedReport.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={styles.modalActions}>
                                        <button
                                            type="button"
                                            className={styles.primaryButton}
                                            onClick={() => goToAlert(selectedReport.alert_id)}
                                        >
                                            Go to Alert
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.deleteButton}
                                            onClick={() => handleDeleteReport(selectedReport.id)}
                                        >
                                            Delete Report
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => setSelectedReport(null)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'flagged' && (
                    <div className={styles.panel}>
                        <div className={styles.flaggedHeader}>
                            <div>
                                <h2 className={styles.panelTitle}>Flagged Content Review</h2>
                                <p className={styles.flaggedSubtitle}>
                                    Review reported content and remove items that violate platform rules.
                                </p>
                            </div>
                            <div className={styles.flaggedSummary}>
                                <div className={styles.summaryChip}>
                                    Pulses <span>{flaggedData.pulses.length}</span>
                                </div>
                                <div className={styles.summaryChip}>
                                    Alerts <span>{flaggedData.alerts.length}</span>
                                </div>
                                <div className={styles.summaryChip}>
                                    Urgent <span>{flaggedData.urgent_requests.length}</span>
                                </div>
                            </div>
                        </div>

                        {loadingData ? (
                            <div className={styles.loader}>Loading Flagged Data...</div>
                        ) : (
                            <div className={styles.gridContainer}>
                                <div className={styles.flaggedCard}>
                                    <div className={styles.cardHeader}>
                                        <span>Flagged Pulses</span>
                                        <span className={styles.countBadge}>{flaggedData.pulses.length}</span>
                                    </div>

                                    <div className={styles.cardBody}>
                                        {flaggedData.pulses.length === 0 ? (
                                            <div className={styles.emptyState}>No flagged pulses.</div>
                                        ) : (
                                            flaggedData.pulses.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={styles.flaggedItem}
                                                    onClick={() => navigate(`/pulse/${item.pulse_type}/${item.id}`)}
                                                    title="Open pulse"
                                                >
                                                    <div className={styles.itemTopRow}>
                                                        <h4 className={styles.itemTitle}>{item.title}</h4>
                                                        <span className={styles.toxScore}>Tox {item.toxicity_score}</span>
                                                    </div>

                                                    <p className={styles.metaData}>
                                                        User: <strong>@{item.user__username}</strong>
                                                    </p>
                                                    <p className={styles.subText}>{item.description}</p>

                                                    <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            className={styles.openButton}
                                                            onClick={() => navigate(`/pulse/${item.pulse_type}/${item.id}`)}
                                                        >
                                                            Open
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.deleteMiniButton}
                                                            onClick={() => handleDeleteFlaggedItem(item, 'pulse')}
                                                            disabled={deletingItemId === item.id}
                                                        >
                                                            {deletingItemId === item.id ? 'Deleting...' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className={styles.flaggedCard}>
                                    <div className={styles.cardHeader}>
                                        <span>Flagged Alerts</span>
                                        <span className={styles.countBadge}>{flaggedData.alerts.length}</span>
                                    </div>

                                    <div className={styles.cardBody}>
                                        {flaggedData.alerts.length === 0 ? (
                                            <div className={styles.emptyState}>No flagged alerts.</div>
                                        ) : (
                                            flaggedData.alerts.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={styles.flaggedItem}
                                                    onClick={() => navigate(`/alert/${item.id}`)}
                                                    title="Open alert"
                                                >
                                                    <div className={styles.itemTopRow}>
                                                        <h4 className={styles.itemTitle}>{item.title}</h4>
                                                        <span className={styles.toxScore}>Tox {item.toxicity_score}</span>
                                                    </div>

                                                    <p className={styles.metaData}>
                                                        User: <strong>@{item.user__username}</strong>
                                                    </p>
                                                    <p className={styles.subText}>{item.description}</p>

                                                    <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            className={styles.openButton}
                                                            onClick={() => navigate(`/alert/${item.id}`)}
                                                        >
                                                            Open
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.deleteMiniButton}
                                                            onClick={() => handleDeleteFlaggedItem(item, 'alert')}
                                                            disabled={deletingItemId === item.id}
                                                        >
                                                            {deletingItemId === item.id ? 'Deleting...' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className={styles.flaggedCard}>
                                    <div className={styles.cardHeader}>
                                        <span>Urgent Requests</span>
                                        <span className={styles.countBadge}>{flaggedData.urgent_requests.length}</span>
                                    </div>

                                    <div className={styles.cardBody}>
                                        {flaggedData.urgent_requests.length === 0 ? (
                                            <div className={styles.emptyState}>No urgent requests.</div>
                                        ) : (
                                            flaggedData.urgent_requests.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={styles.flaggedItem}
                                                    onClick={() => navigate(`/request/${item.id}`)}
                                                    title="Open urgent request"
                                                >
                                                    <div className={styles.itemTopRow}>
                                                        <h4 className={styles.itemTitle}>{item.title}</h4>
                                                        <span className={styles.toxScore}>Tox {item.toxicity_score}</span>
                                                    </div>

                                                    <p className={styles.metaData}>
                                                        User: <strong>@{item.user__username}</strong>
                                                    </p>
                                                    <p className={styles.subText}>{item.description}</p>

                                                    <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            className={styles.openButton}
                                                            onClick={() => navigate(`/request/${item.id}`)}
                                                        >
                                                            Open
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.deleteMiniButton}
                                                            onClick={() => handleDeleteFlaggedItem(item, 'urgent_request')}
                                                            disabled={deletingItemId === item.id}
                                                        >
                                                            {deletingItemId === item.id ? 'Deleting...' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {selectedUserToBan && (
                <div className={styles.modalOverlay} onClick={closeBanModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>Ban User</h2>
                                <p className={styles.modalSubtitle}>
                                    Choose until when this account should stay banned
                                </p>
                            </div>
                            <button
                                type="button"
                                className={styles.closeIconButton}
                                onClick={closeBanModal}
                            >
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalGrid}>
                            <div className={styles.modalField}>
                                <span className={styles.modalLabel}>User</span>
                                <span className={styles.modalValue}>
                                    @{selectedUserToBan.username}
                                </span>
                            </div>

                            <div className={styles.modalField}>
                                <span className={styles.modalLabel}>Email</span>
                                <span className={styles.modalValue}>
                                    {selectedUserToBan.email || '-'}
                                </span>
                            </div>

                            <div className={styles.modalFieldFull}>
                                <span className={styles.modalLabel}>Ban Until</span>
                                <input
                                    type="datetime-local"
                                    className={styles.datetimeInput}
                                    value={banUntil}
                                    onChange={(e) => setBanUntil(e.target.value)}
                                />
                            </div>

                            {banError && (
                                <div className={styles.modalFieldFull}>
                                    <p className={styles.errorText}>{banError}</p>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.dangerButton}
                                onClick={confirmBanUser}
                                disabled={banSubmitting}
                            >
                                {banSubmitting ? 'Banning...' : 'Ban User'}
                            </button>

                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={closeBanModal}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedUserToUnban && (
                <div className={styles.modalOverlay} onClick={() => setSelectedUserToUnban(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>Unban User</h2>
                                <p className={styles.modalSubtitle}>
                                    This will restore the user's access
                                </p>
                            </div>
                            <button
                                type="button"
                                className={styles.closeIconButton}
                                onClick={() => setSelectedUserToUnban(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalGrid}>
                            <div className={styles.modalField}>
                                <span className={styles.modalLabel}>User</span>
                                <span className={styles.modalValue}>
                        @{selectedUserToUnban.username}
                    </span>
                            </div>

                            <div className={styles.modalField}>
                                <span className={styles.modalLabel}>Email</span>
                                <span className={styles.modalValue}>
                        {selectedUserToUnban.email || '-'}
                    </span>
                            </div>

                            {unbanError && (
                                <div className={styles.modalFieldFull}>
                                    <p className={styles.errorText}>{unbanError}</p>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                className={styles.primaryButton}
                                onClick={confirmUnbanUser}
                                disabled={unbanSubmitting}
                            >
                                {unbanSubmitting ? "Unbanning..." : "Confirm Unban"}
                            </button>

                            <button
                                className={styles.secondaryButton}
                                onClick={() => setSelectedUserToUnban(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
            <Footer />
        </div>
    );
};

export default Admin;