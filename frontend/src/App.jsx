import React, { Suspense, useEffect, useState } from 'react';
import {Routes, Route, useLocation, useNavigate, Navigate, Outlet} from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';
import Loading from './components/Loading';
import FavoritePulses from "./pages/User_pages/FavoritePulses";
import './App.css';
import ScrollToTop from "@/components/ScrollToTop";


const Index = React.lazy(() => import('./pages/Pulses_pages/Index'));
const SignUp = React.lazy(() => import('./pages/Authentification/SignUp.jsx'));
const Login = React.lazy(() => import('./pages/Authentification/Login.jsx'));
const Profile = React.lazy(() => import('./pages/User_pages/Profile.jsx'));
const SearchUsers = React.lazy(() => import('./pages/SearchUsers.jsx'));
const FollowRequests = React.lazy(() => import('./pages/User_pages/FollowRequests.jsx'));
const PulseDetails = React.lazy(() => import('./pages/Pulses_pages/PulseDetails.jsx'));
const AddPulses = React.lazy(() => import('./pages/Pulses_pages/AddPulses.jsx'));
const UserProfile = React.lazy(() => import('./pages/UserProfile.jsx'));
const DirectChat = React.lazy(() => import('./pages/User_pages/DirectChat.jsx'));
const Messages = React.lazy(() => import('./pages/User_pages/Messages.jsx'));
const PulseTransaction = React.lazy(() => import('./pages/Pulses_pages/PulseTransaction.jsx'));
const Alerts = React.lazy(() => import('./pages/Alerts/Alerts.jsx'));
const AddAlerts = React.lazy(() => import('./pages/Alerts/AddAlerts.jsx'));
const AlertPage = React.lazy(() => import('./pages/Alerts/AlertPage.jsx'));
const UrgentRequests = React.lazy(() => import('./pages/Requests/UrgentRequests.jsx'));
const CreateRequest = React.lazy(() => import('./pages/Requests/CreateRequest.jsx'));
const Admin = React.lazy(()=> import('./pages/Admin.jsx'));
const RequestDetails = React.lazy(()=> import('./pages/Requests/RequestDetails.jsx'));
const Pulses = React.lazy(()=> import('./pages/Pulses_pages/Pulses.jsx'));
const RequestOffer = React.lazy(() => import('./pages/Requests/RequestOffer'));
const Contact = React.lazy(() => import('./pages/User_pages/Contact.jsx'));
const DocumentUpload = React.lazy( () => import('./pages/DocumentUpload'));
const DocumentsPage = React.lazy(() => import('./pages/DocumentsPage.jsx'));
const AddIncidents = React.lazy(() => import('./pages/Incidents/AddIncidents.jsx'));
const SpecialIncidents = React.lazy(() => import('./pages/Incidents/SpecialIncidents.jsx'));
const SpecialIncidentsDetails = React.lazy(() => import('./pages/Incidents/SpecialIncidentsDetails.jsx'));
const CrisisPage = React.lazy( () => import('./pages/CrisisPage.jsx'));
const CreateCrisisEvents = React.lazy(() => import('./pages/CreateCrisisEvents.jsx'));

const NotificationHandler = ({ currentUser }) => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser?.id) return;

        const wsUrl = `wss://pulsenet-45is.onrender.com/ws/notifications/`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);


            if (data.type === "new_message") {
                const currentChatPath = `/direct-chat/${data.sender_id}`;

                const isAlreadyOnChat = location.pathname === currentChatPath;
                const isOnMessagesPage = location.pathname === '/messages';

                if (!isAlreadyOnChat && !isOnMessagesPage) {
                    toast.custom((t) => (
                        <div
                            onClick={() => {
                                navigate(currentChatPath);
                                toast.dismiss(t.id);
                            }}
                            style={{
                                display: 'flex',
                                width: '384px',
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(0, 0, 0, 0.05)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                borderLeft: '6px solid #2563eb',
                                animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                            }}
                        >
                            <div style={{ flex: 1, padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{
                                        height: '48px',
                                        width: '48px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #2563eb 0%, #4338ca 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '18px',
                                        flexShrink: 0,
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}>
                                        {data.sender_name ? data.sender_name[0].toUpperCase() : 'U'}
                                    </div>
                                    <div style={{ marginLeft: '12px', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                                {data.sender_name}
                                            </span>
                                            <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold', background: '#eff6ff', padding: '2px 8px', borderRadius: '10px' }}>
                                                NOW
                                            </span>
                                        </div>
                                        <p style={{
                                            margin: '4px 0 0',
                                            fontSize: '13px',
                                            color: '#4b5563',
                                            lineHeight: '1.4',
                                            display: '-webkit-box',
                                            WebkitLineClamp: '2',
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {data.content}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div style={{ borderLeft: '1px solid rgba(0,0,0,0.05)', display: 'flex' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                                    style={{ background: 'transparent', border: 'none', padding: '0 16px', cursor: 'pointer', color: '#9ca3af', fontSize: '18px' }}
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ), { duration: 10000 });
                }
            }


            else if (data.type === "new_rental_proposal") {
                toast.custom((t) => (
                    <div
                        onClick={() => toast.dismiss(t.id)}
                        style={{
                            display: 'flex',
                            width: '384px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            borderLeft: '6px solid #10b981',
                            animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                        }}
                    >
                        <div style={{ flex: 1, padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    height: '48px',
                                    width: '48px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '18px',
                                    flexShrink: 0,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    {data.renter_username ? data.renter_username[0].toUpperCase() : 'R'}
                                </div>
                                <div style={{ marginLeft: '12px', flex: 1 }}>
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                        {data.renter_username} proposed a rental
                                    </span>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                                        {data.message}
                                    </p>
                                    <p style={{ marginTop: '4px', fontSize: '13px', fontWeight: '600', color: '#047857' }}>
                                        Proposed Total: {data.proposed_total}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button
                                    onClick={() => toast.dismiss(t.id)}
                                    style={{ background: '#10b981', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                ), { duration: 15000 });
            } else if (data.type === "crisis_alert") {
                toast.custom((t) => (
                    <div
                        onClick={() => toast.dismiss(t.id)}
                        style={{
                            display: 'flex',
                            width: '384px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            borderLeft: '6px solid #ef4444', // Red for crisis
                            animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                        }}
                    >
                        <div style={{ flex: 1, padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    height: '48px',
                                    width: '48px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', // Red gradient
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '18px',
                                    flexShrink: 0,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    C
                                </div>
                                <div style={{ marginLeft: '12px', flex: 1 }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                {data.title}
              </span>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                                        {data.message}
                                    </p>
                                    {data.metadata && (
                                        <p style={{ marginTop: '4px', fontSize: '13px', fontWeight: '600', color: '#b91c1c' }}>
                                            Crisis ID: {data.metadata.crisis_id}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button
                                    onClick={() => toast.dismiss(t.id)}
                                    style={{ background: '#ef4444', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                ), { duration: 15000 }); // Show for 15 seconds
            }
            else if (data.type === "pet_match") {
                window.dispatchEvent(new CustomEvent("pet_match_notification", { detail: data }));
            }
            else if (data.type === "document_match") {
                // 1. Dispatch custom event for UI components to listen to (e.g., updating a badge counter)
                window.dispatchEvent(new CustomEvent("document_match_notification", { detail: data }));

                // 2. Trigger the custom toast notification
                toast.custom((t) => (
                    <div
                        // Navigate to the matched document, assuming your route looks something like /document/:id
                        onClick={() => {
                            if (data.metadata?.match_doc_id) {
                                navigate(`/document/${data.metadata.match_doc_id}`);
                            }
                            toast.dismiss(t.id);
                        }}
                        style={{
                            display: 'flex',
                            padding: '16px',
                            width: '384px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            borderLeft: '6px solid #3b82f6', // Blue accent for document alerts
                            animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            {/* Title */}
                            <span style={{ fontWeight: '600', color: '#111827', fontSize: '15px', marginBottom: '4px' }}>
                    {data.title}
                </span>

                            {/* Message */}
                            <span style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.4' }}>
                    {data.message}
                </span>

                            {/* Optional: Show similarity percentage if available */}
                            {data.metadata?.similarity && (
                                <span style={{ marginTop: '8px', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>
                        Match Confidence: {Math.round(data.metadata.similarity * 100)}%
                    </span>
                            )}
                        </div>
                    </div>
                ));
            }
            else if (data.type === "hero_alert") {
                window.dispatchEvent(new CustomEvent("hero_alert", { detail: data }));
                toast.custom((t) => (
                    <div
                        onClick={() => { navigate(`/request/${data.request_id}`); toast.dismiss(t.id); }}
                        style={{
                            display: 'flex',
                            width: '384px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            borderLeft: '6px solid #ef4444',
                            animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                        }}
                    >
                        <div style={{ flex: 1, padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    height: '48px', width: '48px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 'bold', fontSize: '22px',
                                    flexShrink: 0, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>!</div>
                                <div style={{ marginLeft: '12px', flex: 1 }}>
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                        Urgent Request nearby
                                    </span>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                                        {data.title}
                                    </p>
                                    <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>
                                        Match: {data.score}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 15000 });
            } else if (data.type === "signal_resolved") {

                window.dispatchEvent(new CustomEvent("signal_resolved", { detail: data }));

                toast.custom((t) => (
                    <div
                        onClick={() => {

                            if (data.metadata?.rental_id) {
                                navigate(`/pulse/rental/${data.metadata.rental_id}`);
                            }
                            toast.dismiss(t.id);
                        }}
                        style={{
                            display: 'flex',
                            width: '384px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            borderLeft: '6px solid #10b981',
                            animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                        }}
                    >
                        <div style={{ flex: 1, padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    height: '48px', width: '48px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 'bold', fontSize: '22px',
                                    flexShrink: 0, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <div style={{ marginLeft: '12px', flex: 1 }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                            Report Resolved
                        </span>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                                        {data.title}
                                    </p>
                                    {data.metadata?.resolution_note && (
                                        <p style={{
                                            marginTop: '6px',
                                            padding: '6px 8px',
                                            background: '#f0fdf4',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            color: '#166534',
                                            fontStyle: 'italic',
                                            border: '1px solid #dcfce7'
                                        }}>
                                            "{data.metadata.resolution_note}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 8000 });
            }

            else if (data.type === "alert_merged") {
                toast.custom((t) => (
                    <div
                        onClick={() => toast.dismiss(t.id)}
                        style={{
                            display: 'flex',
                            width: '384px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            borderLeft: '6px solid #8b5cf6',
                            animation: t.visible ? 'enter 0.4s ease' : 'leave 0.4s ease',
                        }}
                    >
                        <div style={{ flex: 1, padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    height: '48px',
                                    width: '48px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '22px',
                                    flexShrink: 0,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    💡
                                </div>
                                <div style={{ marginLeft: '12px', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                            Duplicate Detected
                                        </span>
                                        <span style={{ fontSize: '10px', color: '#6d28d9', fontWeight: 'bold', background: '#ede9fe', padding: '2px 8px', borderRadius: '10px' }}>
                                            SYSTEM
                                        </span>
                                    </div>
                                    <p style={{
                                        margin: '4px 0 0',
                                        fontSize: '13px',
                                        color: '#4b5563',
                                        lineHeight: '1.4',
                                    }}>
                                        {data.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div style={{ borderLeft: '1px solid rgba(0,0,0,0.05)', display: 'flex' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                                style={{ background: 'transparent', border: 'none', padding: '0 16px', cursor: 'pointer', color: '#9ca3af', fontSize: '18px' }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ), { duration: 10000 });
            }
        };

        return () => socket.close();
    }, [currentUser, location.pathname, navigate]);

    return null;
};


function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInCrisis, setIsInCrisis] = useState(false);
    const [crisisData, setCrisisData] = useState([]);
    const navigate = useNavigate();
    const fetchUser = () => {
        const token = localStorage.getItem("access_token");

        // If no token, don't even bother the server
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        fetch('https://pulsenet-45is.onrender.com/accounts/user/', {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
        })
            .then(response => {
                if (!response.ok) throw new Error("Unauthorized");
                return response.json();
            })
            .then(data => {
                // Based on the view I suggested earlier, 'data' is the user object
                const userData = data.user || data;
                if (userData && (userData.id || userData.email)) {
                    setUser(userData);
                }
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUser();
    }, []);

    useEffect(() => {
        if (user && user.id) {
            const token = localStorage.getItem("access_token");

            // Adjust this URL to wherever you mapped the Django view
            fetch('https://pulsenet-45is.onrender.com/accounts/check_user_in_crisis/', {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch crisis status");
                    return res.json();
                })
                .then(data => {
                    if (data.is_in_danger_zone) {
                        setIsInCrisis(true);
                        setCrisisData(data.active_crises);
                    } else {
                        setIsInCrisis(false);
                        setCrisisData([]);
                    }
                })
                .catch(err => console.error("Error checking crisis status:", err));
        }
    }, [user]);

    useEffect(() => {
        const root = document.documentElement;

        if (isInCrisis) {
            // Darker gray crisis mode
            root.style.setProperty('--color-bg', '#A9A9A9');           // darker gray background
            root.style.setProperty('--color-surface', '#BFBFBF');      // slightly lighter cards / panels
            root.style.setProperty('--color-surface-alt', '#C8C8C8');  // alternate panels
            root.style.setProperty('--color-text', '#1F1F1F');         // dark text, readable
            root.style.setProperty('--color-text-strong', '#000000');  // headings / strong text
            root.style.setProperty('--color-border', '#888888');       // subtle borders
            root.style.setProperty('--color-primary', '#FF4C4C');      // urgent red accent
            root.style.setProperty('--color-primary-dark', '#B22222'); // deeper red
            root.style.setProperty('--color-bg-bar', '#D63434');       // navbar / header
            root.style.setProperty('--color-secondary', '#3498DB');    // info / accent blue
            root.style.setProperty('--color-secondary-dark', '#2C80B4');
            root.style.setProperty('--color-success', '#52BE80');      // green for success/ok
        } else {
            // Restore default palette
            root.style.setProperty('--color-bg', '#e9e6e6');
            root.style.setProperty('--color-surface', '#ffffff');
            root.style.setProperty('--color-surface-alt', '#F4F6F5');
            root.style.setProperty('--color-text', '#3F4D45');
            root.style.setProperty('--color-text-strong', '#0F172A');
            root.style.setProperty('--color-border', '#DDE5E1');
            root.style.setProperty('--color-primary', '#4CAF6A');
            root.style.setProperty('--color-primary-dark', '#3E8F57');
            root.style.setProperty('--color-bg-bar', '#4CAF6A');
            root.style.setProperty('--color-secondary', '#3B82A6');
            root.style.setProperty('--color-secondary-dark', '#2F6B87');
            root.style.setProperty('--color-success', '#16a34a');
        }
    }, [isInCrisis]);

    if (loading) return <Loading />;


    const ProtectedRoute = ({ children }) => {
        if (loading) return <Loading />;
        return user ? children : <Navigate to="/please-login" />;
    };


    const AdminRoute = ({ children }) => {
        if (loading) return <Loading />;
        return user?.is_superuser ? children : <Navigate to="/" />;
    };


    if (user && user.is_banned) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full border-t-4 border-red-500">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">Account Suspended</h1>
                    <p className="text-gray-600 mb-4">
                        Your access to this application has been temporarily restricted due to a violation of our terms.
                    </p>

                    {user.banned_until && (() => {
                        const date = new Date(user.banned_until);
                        const day = String(date.getDate()).padStart(2, "0");
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const year = date.getFullYear();
                        const hours = String(date.getHours()).padStart(2, "0");
                        const minutes = String(date.getMinutes()).padStart(2, "0");

                        return (
                            <div className="bg-red-50 p-3 rounded text-red-700 font-medium mb-6">
                                Ban lifts on: {`${day}.${month}.${year} ${hours}:${minutes}`}
                            </div>
                        );
                    })()}

                    <button
                        type="button"
                        onClick={() => {
                            setUser(null);
                            navigate('/login');
                        }}
                        className="text-blue-600 hover:underline"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-white">
            <Toaster
                position="top-right"
                containerStyle={{ top: 24, right: 24, zIndex: 999999 }}
                toastOptions={{ custom: { duration: 5000 } }}
            />

            {user && <NotificationHandler currentUser={user} />}

            <Suspense fallback={<Loading />}>
                <ScrollToTop />
                <Routes>
                    <Route path="/login" element={<Login onLoginSuccess={fetchUser} />} />
                    <Route path="/signup" element={<SignUp />} />

                    <Route element={user ? <Outlet /> : <Navigate to="/login" replace />}>
                        <Route
                            path="/"
                            element={isInCrisis ? (
                                <CrisisPage user={user} activeCrises={crisisData} />
                            ) : (
                                <Index user={user} />
                            )}
                        />

                        {/* Backup route */}
                        <Route
                            path="/backup"
                            element={<Index user={user} />}
                        />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/search-users" element={<SearchUsers />} />
                        <Route path="/follow-requests" element={<FollowRequests />} />
                        <Route path="/user-profile/:id" element={<UserProfile />} />
                        <Route path="/direct-chat/:id" element={<DirectChat currentUser={user} />} />
                        <Route path="/add-pulse" element={<AddPulses />} />
                        <Route path="/pulses" element={<Pulses />} />
                        <Route path="pulse/:type/:id" element={<PulseDetails />} />
                        <Route path="/transaction/:pulseId" element={<PulseTransaction />} />
                        <Route path="/messages" element={<Messages currentUser={user} />} />
                        <Route path="/favorites" element={<FavoritePulses />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/add-alerts" element={<AddAlerts />} />
                        <Route path="/alert/:id" element={<AlertPage />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/urgent-requests" element={<UrgentRequests />} />
                        <Route path="/create-request" element={<CreateRequest />} />
                        <Route path="/request/:id" element={<RequestDetails />} />
                        <Route path="/offer/:requestId" element={<RequestOffer />} />
                        <Route path="/document-upload" element={<DocumentUpload />} />
                        <Route path="/documents-feed" element={<DocumentsPage />} />
                        <Route path="/add-incidents" element={<AddIncidents />} />
                        <Route path="/special-incidents" element={<SpecialIncidents />} />
                        <Route path="/special-incident/:id" element={<SpecialIncidentsDetails />} />
                        <Route path="crisis-events" element={<AdminRoute><CreateCrisisEvents /></AdminRoute>} />
                        <Route path="/admin-page" element={<AdminRoute><Admin /></AdminRoute>} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;
