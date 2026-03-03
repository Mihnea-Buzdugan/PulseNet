import React, {useEffect, useState} from "react";
import Navbar from "../components/Navbar";
import styles from "../styles/index.module.css";
import {useNavigate} from "react-router-dom";

const quotes = [
    "Success is built one step at a time.",
    "Consistency beats motivation.",
    "Great things take time.",
    "Code. Debug. Improve. Repeat.",
    "Dream big. Start small.",
    "Stay focused and never quit."
];

function Index() {
    const [quote, setQuote] = useState("");
    const [bgColor, setBgColor] = useState("#f4f4f4");

    const [pulses, setPulses] = useState([]);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handlePulseClick = (type, id) => {
        navigate(`/pulse/${type}/${id}`);
    }
    const fetchPulses = async (pageNum) => {
        if (loading) return; // Evităm cereri multiple simultane

        setLoading(true);
        try {

            const response = await fetch(`http://localhost:8000/accounts/get_pulses/?page=${pageNum}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
            const data = await response.json();
            console.log("date de la server pt pulsuri", data);
            if (data.success) {
                // Combinăm postările vechi cu cele noi
                setPulses(prev => pageNum === 1 ? data.pulses : [...prev, ...data.pulses]);

                // Folosim numele exact din JSON-ul trimis de Python: has_next
                setHasNext(data.has_next);

                // Actualizăm numărul paginii curente
                setPage(pageNum);
            }
        } catch (error) {
            console.error("Eroare la încărcarea pulse-urilor:", error);
        } finally {
            setLoading(false); // Oprim loading-ul indiferent dacă a reușit sau a eșuat
        }
    };

    useEffect(() => {
        fetchPulses(1);
    }, []);

    const generateRandom = () => {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const randomColor =
            "#" + Math.floor(Math.random() * 16777215).toString(16);

        setQuote(randomQuote);
        setBgColor(randomColor);
    };

    return (
        <div className={styles.body}>
            <Navbar />
            <div className={styles.MainContainer}>
                <div className={styles.feedContainer}>

                    {/* Sticky header */}
                    <h2 className={styles.feedTitle}>Latest Pulses</h2>

                    {/* Pulse list */}
                    {pulses.length > 0 ? (
                        pulses.map((pulse, index) => (
                            <div
                                key={`${pulse.type}-${pulse.id}-${index}`}
                                className={styles.tweetCard}
                                onClick={() => handlePulseClick(pulse.type, pulse.id)}
                                style={{cursor: "pointer"}}
                            >
                                {/* Left: Avatar */}
                                <div className={styles.leftSide}>
                                    <div className={styles.avatar}>
                                        {pulse.user_avatar ? (
                                            <img
                                                src={pulse.user_avatar}
                                                alt={pulse.user}
                                                className={styles.avatarImage}
                                            />
                                        ) : (
                                            <span className={styles.avatarInitial}>
                                                {pulse.user.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Content */}
                                <div className={styles.rightSide}>
                                    <div className={styles.tweetHeader}>
                                        <span className={styles.userName}>{pulse.user}</span>
                                        <span className={styles.timestamp}>· {pulse.timestamp}</span>
                                    </div>

                                    <div className={styles.tweetContent}>
                                        {pulse.type === 'skill' ? (
                                            <p>
                                                Has a new skill: <strong>{pulse.name}</strong>
                                                <span className={styles.badge}>Level: {pulse.level}</span>
                                            </p>
                                        ) : (
                                            <p>
                                                Listed a new object: <strong>{pulse.name}</strong>
                                                <span className={styles.priceBadge}>{pulse.price} RON/day</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className={styles.tweetTag}>
                                        #{pulse.type}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        !loading && (
                            <p className={styles.loadingText}>No pulses available yet.</p>
                        )
                    )}

                    {/* Loading skeleton rows */}
                    {loading && pulses.length === 0 && (
                        [1, 2, 3].map(i => (
                            <div key={i} className={styles.tweetCard}>
                                <div className={styles.leftSide}>
                                    <div className={styles.avatar} style={{ background: '#2f3336' }} />
                                </div>
                                <div className={styles.rightSide}>
                                    <div style={{
                                        height: '14px', width: '40%',
                                        background: '#2f3336', borderRadius: '4px',
                                        marginBottom: '10px'
                                    }} />
                                    <div style={{
                                        height: '14px', width: '80%',
                                        background: '#2f3336', borderRadius: '4px'
                                    }} />
                                </div>
                            </div>
                        ))
                    )}

                    {/* Load more */}
                    {hasNext && (
                        <button
                            onClick={() => fetchPulses(page + 1)}
                            className={styles.loadMoreButton}
                            disabled={loading}
                        >
                            {loading ? "Loading..." : "Show More"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Index;