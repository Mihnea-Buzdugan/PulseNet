import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loading from "../../components/Loading";
import styles from '../../styles/User_pages/directchat.module.css';
import Navbar from "../../components/Navbar"; // 1. Import the styles

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const DirectChat = ({ currentUser }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const socketRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        const initializeChat = async () => {
            try {
                const response = await fetch(`http://localhost:8000/accounts/direct_conversations/create/${id}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    credentials: 'include',
                });
                const data = await response.json();
                if (response.ok) setConversationId(data.conversation_id);
                else {
                    setError(data.error || "Initialization failed");
                    setLoading(false);
                }
            } catch (err) {
                setError("Network error.");
                setLoading(false);
            }
        };
        if (id) initializeChat();
    }, [id]);

    useEffect(() => {
        if (!conversationId) return;
        const fetchHistory = async () => {
            try {
                const response = await fetch(`http://localhost:8000/accounts/messages/history/direct/${conversationId}/`, {
                    credentials: 'include'
                });
                const data = await response.json();
                if (response.ok) setMessages(data.history);
            } catch (err) {
                console.error("History load error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [conversationId]);

    useEffect(() => {
        if (!conversationId) return;
        const wsUrl = `ws://localhost:8000/ws/chat/direct/${conversationId}/`;
        socketRef.current = new WebSocket(wsUrl);
        socketRef.current.onmessage = (e) => {
            const data = JSON.parse(e.data);
            setMessages((prev) => [...prev, data]);
        };
        return () => socketRef.current?.close();
    }, [conversationId]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socketRef.current) return;
        socketRef.current.send(JSON.stringify({ 'message': newMessage }));
        setNewMessage("");
    };

    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;
    if (loading) return <Loading />;

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={() => navigate(-1)} className={styles.backButton}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <h2 className={styles.chatTitle}>Message</h2>
            </div>

            <div className={styles.messageWindow}>
                {messages.map((msg, idx) => {
                    // 1. Extract the Sender ID from all possible fields (DirectMessage vs GroupMessage)
                    // Checks msg.sender_id (from your sync view) or msg.sender (common in WS)
                    const rawSenderId = msg.sender_id || (msg.sender && (msg.sender.id || msg.sender));

                    // 2. Extract the Current User ID
                    const rawCurrentUserId = currentUser?.id || currentUser?.pk;

                    // 3. Stringify and compare
                    const msgSenderId = String(rawSenderId || "");
                    const currentUserId = String(rawCurrentUserId || "");

                    // 4. Determine if it's "Me"
                    // If IDs match OR (as a backup) usernames match
                    const isMe = (currentUserId !== "" && msgSenderId === currentUserId) ||
                        (msg.sender === currentUser?.username && currentUser?.username !== undefined);

                    return (
                        <div
                            key={idx}
                            className={`${styles.messageRow} ${isMe ? styles.justifyEnd : styles.justifyStart}`}
                        >
                            <div className={`${styles.bubble} ${isMe ? styles.myBubble : styles.theirBubble}`}>
                                <p className={styles.messageText}>{msg.content}</p>
                                <span className={`${styles.timestamp} ${isMe ? styles.myTimestamp : styles.theirTimestamp}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSend} className={styles.inputArea}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="iMessage"
                    className={styles.inputField}
                />
                <button type="submit" className={styles.sendButton}>
                    <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </form>
        </div>
            </div>
        </div>
    );
};

export default DirectChat;