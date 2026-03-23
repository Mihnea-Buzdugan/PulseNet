import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';
import Loading from './components/Loading';
import FavoritePulses from "./pages/User_pages/FavoritePulses";
import './App.css';

// Lazy loaded pages
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


const NotificationHandler = ({ currentUser }) => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser?.id) return;

        const wsUrl = `ws://localhost:8000/ws/notifications/`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            // --- CHAT NOTIFICATIONS ---
            if (data.type === "new_message") {
                const currentChatPath = `/direct-chat/${data.sender_id}`;
                if (location.pathname !== currentChatPath) {
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

            // --- RENTAL PROPOSAL NOTIFICATIONS ---
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
                            borderLeft: '6px solid #10b981', // green for rental
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
            }
            else if (data.type === "pet_match") {
                window.dispatchEvent(new CustomEvent("pet_match_notification", { detail: data }));
            }
            else if (data.type === "hero_alert") {
                window.dispatchEvent(new CustomEvent("hero_alert", { detail: data }));
                toast.custom((t) => (
                    <div
                        onClick={() => { navigate(`/urgent-requests`); toast.dismiss(t.id); }}
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
            }
        };

        return () => socket.close();
    }, [currentUser, location.pathname, navigate]);

    return null;
};


function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const fetchUser = () => {
        fetch('http://localhost:8000/accounts/user/', { credentials: 'include' })
            .then(response => {
                if (!response.ok) throw new Error("Unauthorized");
                return response.json();
            })
            .then(data => {
                const userData = data.user || data;
                if (userData && userData.id) {
                    setUser(userData);
                }
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUser();
    }, []);

    if (loading) return <Loading />;


    const ProtectedRoute = ({ children }) => {
        if (loading) return <Loading />;
        return user ? children : <Navigate to="/please-login" />;
    };


    const AdminRoute = ({ children }) => {
        if (loading) return <Loading />;
        return user?.is_superuser ? children : <Navigate to="/" />;
    };

    // --- NEW: Check if user is banned ---
    if (user && user.is_banned) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full border-t-4 border-red-500">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">Account Suspended</h1>
                    <p className="text-gray-600 mb-4">
                        Your access to this application has been temporarily restricted due to a violation of our terms.
                    </p>

                    {/* If your backend sends the date, format and display it */}
                    {user.banned_until && (() => {
                        const date = new Date(user.banned_until);
                        const day = String(date.getDate()).padStart(2, "0");
                        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
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
                            setUser(null);        // Clear user first
                            navigate('/login');   // Then navigate
                        }}
                        className="text-blue-600 hover:underline"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }
    // ------------------------------------

    return (
        <div className="min-h-screen bg-white">
            <Toaster
                position="top-right"
                containerStyle={{ top: 24, right: 24, zIndex: 999999 }}
                toastOptions={{ custom: { duration: 5000 } }}
            />

            {user && <NotificationHandler currentUser={user} />}

            <Suspense fallback={<Loading />}>
                <Routes>
                    <Route path="/" element={<Index user={user} />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/login" element={<Login onLoginSuccess={fetchUser} />} />

                    {/* Protected Routes */}
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/search-users" element={<ProtectedRoute><SearchUsers /></ProtectedRoute>} />
                    <Route path="/follow-requests" element={<ProtectedRoute><FollowRequests /></ProtectedRoute>} />
                    <Route path="/user-profile/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                    <Route path="/direct-chat/:id" element={<ProtectedRoute><DirectChat /></ProtectedRoute>} />

                    {/* I noticed some routes below aren't protected. You might want to wrap them in `user ? ... : <Navigate to="/login" />` if they require auth! */}
                    <Route path="/add-pulse" element={<ProtectedRoute><AddPulses/></ProtectedRoute>} />
                    <Route path="pulse/:type/:id" element={<PulseDetails />} />
                    <Route path="/transaction/:pulseId" element={<ProtectedRoute><PulseTransaction /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/favorites" element={<ProtectedRoute><FavoritePulses /></ProtectedRoute>} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/add-alerts" element={<ProtectedRoute><AddAlerts /></ProtectedRoute>} />
                    <Route path="/alert/:id" element={<AlertPage />} />
                    <Route path="/admin-page" element={<AdminRoute><Admin /></AdminRoute>} />
                    <Route path="/urgent-requests" element={<UrgentRequests />} />
                    <Route path="/create-request" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;
