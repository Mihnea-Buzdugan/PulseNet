import React, { useState, useEffect, useRef } from "react";
import styles from "../../styles/User_pages/messages.module.css";
import Navbar from "../../components/Navbar";
import Loading from "../../components/Loading";
import {useNavigate} from "react-router-dom";

const Messages = ({ currentUser }) => {
    const [conversations, setConversations] = useState([]);
    const [selectedConvo, setSelectedConvo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const socketRef = useRef(null);
    const scrollRef = useRef(null);

    /* ================= FETCH CONVERSATIONS ================= */
    useEffect(() => {
        fetch("http://localhost:8000/accounts/my-conversations/", {
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                setConversations(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Inbox fetch error:", err);
                setLoading(false);
            });
    }, []);

    /* ================= LOAD HISTORY + WS ================= */
    useEffect(() => {
        if (!selectedConvo) return;

        fetch(
            `http://localhost:8000/accounts/messages/history/${selectedConvo.type}/${selectedConvo.id}/`,
            { credentials: "include" }
        )
            .then((res) => res.json())
            .then((data) => {
                setMessages(data.history || []);
            })
            .catch((err) => console.error("History fetch error:", err));

        if (socketRef.current) {
            socketRef.current.close();
        }

        const wsUrl = `ws://localhost:8000/ws/chat/${selectedConvo.type}/${selectedConvo.id}/`;
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onmessage = (e) => {
            const data = JSON.parse(e.data);
            setMessages((prev) => [...prev, data]);

            setConversations((prev) =>
                prev.map((c) =>
                    c.id === selectedConvo.id && c.type === selectedConvo.type
                        ? { ...c, last_message: data.content }
                        : c
                )
            );
        };

        socketRef.current.onerror = (err) => {
            console.error("WebSocket error:", err);
        };

        socketRef.current.onclose = () => {
            // console.log("WebSocket closed");
        };

        return () => socketRef.current?.close();
    }, [selectedConvo]);

    /* ================= AUTO SCROLL ================= */
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* ================= ESCAPE TO CLOSE SIDEBAR (MOBILE) ================= */
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [sidebarOpen]);

    /* ================= SEND MESSAGE ================= */
    const handleSend = (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !socketRef.current) return;

        socketRef.current.send(JSON.stringify({ message: newMessage }));
        setNewMessage("");
    };

    if (loading) {
        return <Loading />;
    }

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />

                {/* Overlay (click to close) */}
                <div
                    className={`${styles.mobileOverlay} ${
                        sidebarOpen ? styles.mobileOverlayOpen : ""
                    }`}
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden={!sidebarOpen}
                />

                <div className={styles.pageWrapper}>
                    <div className={styles.inboxContainer}>
                        {/* ================= SIDEBAR ================= */}
                        <aside
                            className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
                            style={{ transform: sidebarOpen ? "translateX(0)" : undefined }}
                            aria-hidden={!sidebarOpen && window.innerWidth <= 768}
                            aria-label="Conversations"
                        >
                            <div className={styles.sidebarCloseWrapper}>
                                <button
                                    className={styles.sidebarCloseBtn}
                                    onClick={() => setSidebarOpen(false)}
                                    aria-label="Close conversations"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className={styles.sidebarHeader}>
                                <h2>Messages</h2>

                                <button
                                    className={styles.followRequestsBtn}
                                    onClick={() => navigate("/follow-requests")}
                                >
                                    Follow Requests
                                </button>
                            </div>

                            <div className={styles.convoList}>
                                {conversations.map((convo) => (
                                    <div
                                        key={`${convo.type}-${convo.id}`}
                                        className={`${styles.convoItem} ${
                                            selectedConvo?.id === convo.id && selectedConvo?.type === convo.type
                                                ? styles.active
                                                : ""
                                        }`}
                                        onClick={() => {
                                            setSelectedConvo(convo);
                                            setSidebarOpen(false);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                setSelectedConvo(convo);
                                                setSidebarOpen(false);
                                            }
                                        }}
                                    >
                                        <div className={styles.avatarPlaceholder}>
                                            {convo.name?.charAt(0)?.toUpperCase()}
                                        </div>

                                        <div className={styles.convoDetails}>
                                            <span className={styles.convoName}>{convo.name}</span>
                                            <p className={styles.lastMsg}>{convo.last_message}</p>
                                        </div>

                                        {convo.unread > 0 && <div className={styles.unreadDot} />}
                                    </div>
                                ))}
                            </div>
                        </aside>

                        {/* ================= CHAT AREA ================= */}
                        <main className={styles.chatArea}>
                            {/* Always-visible mobile menu button */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12 }}>
                                <button
                                    className={styles.menuButton}
                                    onClick={() => setSidebarOpen(true)}
                                    aria-controls="conversations"
                                    aria-expanded={sidebarOpen}
                                    aria-label="Open conversations"
                                >
                                    ☰
                                </button>

                                {/* Optional top title when no convo is selected */}
                                {!selectedConvo && (
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{currentUser?.username || "Messages"}</div>
                                )}
                            </div>

                            {selectedConvo ? (
                                <div className={styles.activeChat}>
                                    <div className={styles.chatHeader}>
                                        {/* Back button (visible when a convo is open) */}
                                        <button
                                            className={styles.backButton}
                                            onClick={() => setSelectedConvo(null)}
                                            aria-label="Back to conversations"
                                        >
                                            <span className={styles.backIcon}>❮</span>
                                            <span className={styles.backText}>Chats</span>
                                        </button>

                                        <div className={styles.headerAvatar}>
                                            {selectedConvo.name?.charAt(0)}
                                        </div>

                                        <h3>{selectedConvo.name}</h3>
                                    </div>

                                    <div className={styles.messageWindow}>
                                        {messages.map((msg) => {
                                            // ✅ Compare sender username with selected conversation username
                                            const isMe =
                                                selectedConvo?.username &&
                                                msg.sender_username !== selectedConvo.username;

                                            return (
                                                <div
                                                    key={msg.message_id || msg.timestamp}
                                                    className={`${styles.messageRow} ${
                                                        isMe ? styles.justifyEnd : styles.justifyStart
                                                    }`}
                                                >
                                                    <div
                                                        className={`${styles.bubble} ${
                                                            isMe ? styles.myBubble : styles.theirBubble
                                                        }`}
                                                    >
                                                        {/* Group chat — show sender name */}
                                                        {!isMe && selectedConvo?.type === "group" && (
                                                            <span className={styles.senderName}>
                            {msg.sender_username}
                        </span>
                                                        )}

                                                        <p className={styles.messageText}>{msg.content}</p>

                                                        <span className={styles.timestamp}>
                        {msg.timestamp
                            ? new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                            : ""}
                    </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <div ref={scrollRef} />
                                    </div>

                                    <form onSubmit={handleSend} className={styles.inputArea}>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                placeholder="Message..."
                                                className={styles.inputField}
                                                aria-label="Message"
                                            />

                                            <button type="submit" className={styles.sendButton} disabled={!newMessage.trim()}>
                                                Send
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <div className={styles.emptyState}>
                                    <h2>Your Messages</h2>
                                    <p>Select a conversation to start chatting.</p>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Messages;