import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "../../styles/User_pages/messages.module.css";
import Navbar from "../../components/Navbar";
import Loading from "../../components/Loading";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { encryptMessage, decryptMessage } from "@/utils/cryptoUtils";

const Messages = ({ currentUser }) => {
    const [conversations, setConversations] = useState([]);

    const [selectedConvo, setSelectedConvo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [conversationKeys, setConversationKeys] = useState({});
    const [keysLoading, setKeysLoading] = useState(false);

    const socketRef = useRef(null);
    const scrollRef = useRef(null);

    const processMessagesE2EE = useCallback(async (rawMessages) => {
        const processed = [];
        for (let msg of rawMessages) {
            let decryptedText = "[Mesaj criptat]";
            try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj.for_sender && contentObj.for_receiver) {
                    const isMine = String(msg.sender_id) === String(currentUser?.id);
                    decryptedText = await decryptMessage(
                        isMine ? contentObj.for_sender : contentObj.for_receiver
                    );
                } else {
                    decryptedText = msg.content;
                }
            } catch {
                decryptedText = msg.content;
            }
            processed.push({ ...msg, content: decryptedText });
        }
        return processed;
    }, [currentUser?.id]);

    useEffect(() => {
        if (!currentUser?.id) return;

        fetch("http://localhost:8000/accounts/my-conversations/", {
            credentials: "include",
        })
            .then((res) => res.json())
            .then(async (data) => {
                const processed = await Promise.all(
                    data.map(async (convo) => {
                        if (convo.type !== "direct" || !convo.last_message) {
                            return convo;
                        }
                        try {
                            const contentObj = JSON.parse(convo.last_message);
                            if (contentObj.for_sender && contentObj.for_receiver) {
                                const [myRes, receiverRes] = await Promise.all([
                                    fetch(`http://localhost:8000/accounts/message_keys/get/${currentUser.id}/`, { credentials: "include" }),
                                    fetch(`http://localhost:8000/accounts/message_keys/get/${convo.other_user_id}/`, { credentials: "include" }),
                                ]);

                                if (contentObj.for_sender && contentObj.for_receiver) {
                                    let decrypted = "🔒 Mesaj criptat";
                                    try {
                                        const isMine = String(convo.last_message_sender_id) === String(currentUser.id);
                                        decrypted = await decryptMessage(
                                            isMine ? contentObj.for_sender : contentObj.for_receiver
                                        );
                                    } catch {
                                        decrypted = "New message";
                                    }
                                    return { ...convo, last_message: decrypted };
                                }
                            }
                        } catch {
                            return convo;
                        }
                        return convo;
                    })
                );

                setConversations(processed);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Inbox fetch error:", err);
                setLoading(false);
            });
    }, [currentUser?.id]);

    useEffect(() => {
        if (!selectedConvo) return;
        setMessages([]);

        const loadKeysAndHistory = async () => {
            if (selectedConvo.type === "direct") {
                const cacheKey = `direct-${selectedConvo.id}`;

                if (!conversationKeys[cacheKey]) {
                    setKeysLoading(true);
                    try {
                        const [receiverRes, myRes] = await Promise.all([
                            fetch(`http://localhost:8000/accounts/message_keys/get/${selectedConvo.other_user_id}/`,
                                { credentials: "include" }),
                            fetch(`http://localhost:8000/accounts/message_keys/get/${currentUser?.id}/`,
                                { credentials: "include" })
                        ]);

                        if (receiverRes.ok && myRes.ok) {
                            const receiverData = await receiverRes.json();
                            const myData = await myRes.json();


                            if (!receiverData.public_key) {
                                return;
                            }
                            if (!myData.public_key) {
                                await initializeE2EE();
                                return;
                            }

                            setConversationKeys(prev => ({
                                ...prev,
                                [cacheKey]: {
                                    receiverKey: receiverData.public_key,
                                    myKey: myData.public_key,
                                }
                            }));
                        } else {
                            console.error("Key fetch failed:", receiverRes.status, myRes.status);
                        }
                    } catch (e) {
                        console.error("Failed to load keys:", e);
                    } finally {
                        setKeysLoading(false);
                    }
                }
            }

            try {
                const res = await fetch(
                    `http://localhost:8000/accounts/messages/history/${selectedConvo.type}/${selectedConvo.id}/`,
                    { credentials: "include" }
                );
                const data = await res.json();
                const history = data.history || [];

                if (selectedConvo.type === "direct") {
                    const decrypted = await processMessagesE2EE(history);
                    setMessages(decrypted);
                } else {
                    setMessages(history);
                }
            } catch (err) {
                console.error("History fetch error:", err);
            }
        };

        loadKeysAndHistory();

        if (socketRef.current) {
            socketRef.current.close();
        }

        const wsUrl = `ws://localhost:8000/ws/chat/${selectedConvo.type}/${selectedConvo.id}/`;
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onmessage = async (e) => {
            const data = JSON.parse(e.data);

            if (selectedConvo.type === "direct") {
                const [decrypted] = await processMessagesE2EE([data]);
                setMessages((prev) => [...prev, decrypted]);

                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === selectedConvo.id && c.type === selectedConvo.type
                            ? { ...c, last_message: decrypted.content }
                            : c
                    )
                );
            } else {
                setMessages((prev) => [...prev, data]);
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === selectedConvo.id && c.type === selectedConvo.type
                            ? { ...c, last_message: data.content }
                            : c
                    )
                );
            }
        };

        socketRef.current.onerror = (err) => console.error("WebSocket error:", err);

        return () => socketRef.current?.close();
    }, [selectedConvo, processMessagesE2EE]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [sidebarOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socketRef.current) return;

        if (selectedConvo.type === "direct") {
            const cacheKey = `direct-${selectedConvo.id}`;
            const keys = conversationKeys[cacheKey];

            if (!keys?.receiverKey || !keys?.myKey) {
                return;
            }

            const rawText = newMessage;
            setNewMessage("");

            try {
                const [encryptedForReceiver, encryptedForSender] = await Promise.all([
                    encryptMessage(rawText, keys.receiverKey),
                    encryptMessage(rawText, keys.myKey),
                ]);

                socketRef.current.send(JSON.stringify({
                    message: JSON.stringify({
                        for_sender: encryptedForSender,
                        for_receiver: encryptedForReceiver,
                    })
                }));
            } catch (err) {
                setNewMessage(rawText);
            }
        } else {
            socketRef.current.send(JSON.stringify({ message: newMessage }));
            setNewMessage("");
        }
    };

    if (loading) return <Loading />;

    return (
        <div className={styles.body}>
            <div className={styles.mainContainer}>
                <Navbar />

                <div
                    className={`${styles.mobileOverlay} ${
                        sidebarOpen ? styles.mobileOverlayOpen : ""
                    }`}
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden={!sidebarOpen}
                />

                <div className={styles.pageWrapper}>
                    <div className={styles.inboxContainer}>
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

                        <main className={styles.chatArea}>
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

                                {!selectedConvo && (
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{currentUser?.username || "Messages"}</div>
                                )}
                            </div>

                            {selectedConvo ? (
                                <div className={styles.activeChat}>
                                    <div className={styles.chatHeader}>
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
            <Footer />
        </div>
    );
};

export default Messages;