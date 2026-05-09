import React, { useState } from "react";
import styles from "../styles/AIChat.module.css";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export default function AIChat() {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);

    const sendQuestion = async () => {
        if (!question.trim() || loading) return;

        setLoading(true);
        setAnswer("");

        const csrfToken = getCookie("csrftoken");

        try {
            const res = await fetch("https://pulsenet-45is.onrender.com/accounts/ai_chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                },
                body: JSON.stringify({ question }),
            });

            const text = await res.text();
            const words = text.split(/\s+/);
            let i = 0;

            const interval = setInterval(() => {
                if (i < words.length) {
                    // FIX: Capture the current word BEFORE incrementing i
                    const nextWord = words[i];
                    setAnswer((prev) => (prev ? prev + " " : "") + nextWord);
                    i++;
                } else {
                    clearInterval(interval);
                    setLoading(false);
                }
            }, 80);
        } catch (err) {
            setAnswer("Server error: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.pageContent}>
                <div className={styles.navbarAdjust}>
                    <Navbar />
                </div>

                <div className={styles.chatContainer}>
                    <h2>AI Chat</h2>

                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask something..."
                        className={styles.chatInput}
                    />

                    <button
                        onClick={sendQuestion}
                        disabled={loading}
                        className={styles.chatButton}
                    >
                        {loading ? "Thinking..." : "Send"}
                    </button>

                    {answer && (
                        <div className={styles.answerBox}>
                            <strong>Answer:</strong>
                            <p>{answer}</p>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
}