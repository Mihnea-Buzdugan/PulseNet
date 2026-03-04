import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';
import Loading from './components/Loading';

// Lazy loaded pages
const Index = React.lazy(() => import('./pages/Index.js'));
const SignUp = React.lazy(() => import('./pages/SignUp.js'));
const Login = React.lazy(() => import('./pages/Login.js'));
const Profile = React.lazy(() => import('./pages/Profile.js'));
const SearchUsers = React.lazy(() => import('./pages/SearchUsers.js'));
const FollowRequests = React.lazy(() => import('./pages/FollowRequests.js'));
const PulseDetails = React.lazy(() => import('./pages/PulseDetails.js'));
const AddPulses = React.lazy(() => import('./pages/AddPulses.js'));
const UserProfile = React.lazy(() => import('./pages/UserProfile.js'));
const DirectChat = React.lazy(() => import('./pages/DirectChat.js'));


const NotificationHandler = ({ currentUser }) => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser?.id) return;

        const wsUrl = `ws://localhost:8000/ws/notifications/`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
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
                                {/* Avatar */}
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

                                {/* Text */}
                                <div style={{ marginLeft: '12px', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                            {data.sender_name}
                                        </span>
                                        <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold', background: '#eff6ff', padding: '2px 8px', borderRadius: '10px' }}>
                                            NOW
                                        </span>
                                    </div>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {data.content}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div style={{ borderLeft: '1px solid rgba(0,0,0,0.05)', display: 'flex' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toast.dismiss(t.id);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0 16px',
                                    cursor: 'pointer',
                                    color: '#9ca3af',
                                    fontSize: '18px'
                                }}
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

// --- MAIN APP COMPONENT ---
function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = () => {
        fetch('http://localhost:8000/accounts/user/', { credentials: 'include' })
            .then(response => {
                if (!response.ok) throw new Error("Unauthorized");
                return response.json();
            })
            .then(data => {
                // Correctly extracting the nested user object from your logs
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

    return (
        <div className="min-h-screen bg-white">
            <Toaster
                position="top-right"
                containerStyle={{
                    top: 24,
                    right: 24,
                    zIndex: 999999
                }}
                toastOptions={{
                    custom: {
                        duration: 5000,
                    },
                }}
            />

            {user && <NotificationHandler currentUser={user} />}

            <Suspense fallback={<Loading />}>
                <Routes>
                    <Route path="/" element={<Index user={user} />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/login" element={<Login onLoginSuccess={fetchUser} />} />

                    {/* Protected Routes */}
                    <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
                    <Route path="/search-users" element={user ? <SearchUsers user={user} /> : <Navigate to="/login" />} />
                    <Route path="/follow-requests" element={user ? <FollowRequests user={user} /> : <Navigate to="/login" />} />
                    <Route path="/user-profile/:id" element={user ? <UserProfile user={user} /> : <Navigate to="/login" />} />
                    <Route path="/direct-chat/:id" element={user ? <DirectChat currentUser={user} /> : <Navigate to="/login" />} />
                    <Route path="/add-pulse" element={<AddPulses/>} />
                    <Route path="pulse/:type/:id" element={<PulseDetails />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;