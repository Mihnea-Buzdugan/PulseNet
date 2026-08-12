import React, { useState, useRef, useEffect } from "react";
import styles from "../styles/AIChat.module.css";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie) {
        document.cookie.split(";").forEach((cookie) => {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
            }
        });
    }
    return cookieValue;
}

export default function AIChat() {
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]); // { role: "user" | "assistant", content: string }[]
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    // Auto-scroll to the latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendQuestion = async () => {
        if (!question.trim() || loading) return;

        const userMessage = { role: "user", content: question.trim() };
        const updatedHistory = [...messages, userMessage];

        setMessages(updatedHistory);
        setQuestion("");
        setLoading(true);

        // Add a placeholder for the assistant's streaming reply
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        const csrfToken = getCookie("csrftoken");

        try {
            const res = await fetch("/accounts/ai_chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify({
                    question: userMessage.content,
                    // Send only role + content — keep payload lean
                    history: updatedHistory.map(({ role, content }) => ({ role, content })),
                }),
            });

            const text = await res.text();
            const words = text.split(/\s+/);
            let i = 0;

            const interval = setInterval(() => {
                if (i < words.length) {
                    const nextWord = words[i];
                    // Stream words into the last (assistant) message
                    setMessages((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = {
                            ...last,
                            content: last.content ? last.content + " " + nextWord : nextWord,
                        };
                        return updated;
                    });
                    i++;
                } else {
                    clearInterval(interval);
                    setLoading(false);
                }
            }, 80);
        } catch (err) {
            setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "assistant",
                    content: "Server error: " + err.message,
                };
                return updated;
            });
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendQuestion();
        }
    };

    const clearHistory = () => {
        setMessages([]);
    };

    return (<div className={styles.mainContainer}>
        <div className={styles.navbarAdjust}>
            <Navbar />
        </div>

        <div className={styles.bodyContainer}>
            <div className={styles.pageContent}>

                <div className={styles.chatContainer}>
                    <div className={styles.chatHeader}>
                        <h2>AI Chat</h2>
                        {messages.length > 0 && (
                            <button
                                onClick={clearHistory}
                                className={styles.clearButton}
                                disabled={loading}
                            >
                                Clear chat
                            </button>
                        )}
                    </div>

                    {/* Message history */}
                    <div className={styles.messageList}>
                        {messages.length === 0 && (
                            <p className={styles.emptyState}>Ask me anything about the platform!</p>
                        )}
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={
                                    msg.role === "user"
                                        ? styles.userMessage
                                        : styles.assistantMessage
                                }
                            >
                                <span className={styles.roleLabel}>
                                    {msg.role === "user" ? "You" : "AI"}
                                </span>
                                <p>{msg.content}{msg.role === "assistant" && loading && idx === messages.length - 1 ? "▌" : ""}</p>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input row */}
                    <div className={styles.inputRow}>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask something..."
                            className={styles.chatInput}
                            disabled={loading}
                        />
                        <button
                            onClick={sendQuestion}
                            disabled={loading || !question.trim()}
                            className={styles.chatButton}
                        >
                            {loading ? "Thinking..." : "Send"}
                        </button>
                    </div>
                </div>
            </div>


        </div>
            <Footer />
        </div>
    );
}
