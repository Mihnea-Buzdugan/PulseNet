import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../styles/User_pages/favoritePulses.module.css";
import Navbar from "../../components/Navbar";
import Loading from "../../components/Loading";
import Footer from "@/components/Footer";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export default function FavoritePulses() {
    // Original Data State
    const [pulses, setPulses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);

    // Frontend Filter State (these now trigger backend queries)
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortFilter, setSortFilter] = useState("recent");

    // Carousel state
    const [carouselOpen, setCarouselOpen] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);

    const navigate = useNavigate();
    const PER_PAGE = 15; // keep in sync with backend per_page

    const buildQuery = (params) => {
        const esc = encodeURIComponent;
        const qs = Object.entries(params)
            .filter(([_, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${esc(k)}=${esc(v)}`)
            .join("&");
        return qs ? `?${qs}` : "";
    };

    const fetchFavorites = useCallback(
        async (pageNumber = 1, searchVal = "", typeVal = "all", sortVal = "recent") => {
            try {
                setLoading(true);
                const csrfToken = getCookie("csrftoken");

                // Map frontend sort to backend params if needed — using same names here
                const params = {
                    page: pageNumber,
                    per_page: PER_PAGE,
                };

                if (searchVal && searchVal.trim() !== "") params.search = searchVal.trim();
                if (typeVal && typeVal !== "all") params.type = typeVal;
                if (sortVal) params.sort = sortVal;

                const qs = buildQuery(params);

                const response = await fetch(
                    `http://localhost:8000/accounts/favorites/${qs}`,
                    {
                        method: "GET",
                        credentials: "include",
                        headers: {
                            "X-CSRFToken": csrfToken,
                            "Accept": "application/json",
                        },
                    }
                );

                const data = await response.json();

                if (response.ok && data.success) {
                    setPulses(data.pulses || []);
                    setHasNext(!!data.has_next);
                    setPage(pageNumber);
                    // close carousel (so index doesn't point to stale item)
                    setCarouselOpen(false);
                    setCarouselIndex(0);
                } else {
                    console.error("Failed fetching favorites", data);
                    // optionally clear pulses on failure:
                    // setPulses([]);
                }
            } catch (err) {
                console.error("Error loading favorites", err);
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // initial load
    useEffect(() => {
        fetchFavorites(1, search, typeFilter, sortFilter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    // Debounce filter changes (search/type/sort) and fetch page 1
    useEffect(() => {
        // reset to first page when filters change
        const newPage = 1;
        const timer = setTimeout(() => {
            fetchFavorites(newPage, search, typeFilter, sortFilter);
        }, 400);

        return () => clearTimeout(timer);
    }, [search, typeFilter, sortFilter, fetchFavorites]);

    const handleNextPage = () => {
        if (hasNext && !loading) {
            const next = page + 1;
            fetchFavorites(next, search, typeFilter, sortFilter);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handlePrevPage = () => {
        if (page > 1 && !loading) {
            const prev = page - 1;
            fetchFavorites(prev, search, typeFilter, sortFilter);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // processedPulses now comes directly from backend results (no client-side filtering)
    const processedPulses = pulses;

    // Extract unique types from loaded pulses for the dropdown (may reflect current page)
    const availableTypes = [...new Set(pulses.map((p) => p.type))];

    // Carousel controls (walk within processedPulses — i.e. the currently displayed server results)
    const openCarousel = (index) => {
        setCarouselIndex(index);
        setCarouselOpen(true);
    };

    const closeCarousel = () => {
        setCarouselOpen(false);
    };

    const prevCarousel = () => {
        if (carouselIndex > 0) {
            setCarouselIndex((i) => i - 1);
        }
    };

    const nextCarousel = () => {
        if (carouselIndex < processedPulses.length - 1) {
            setCarouselIndex((i) => i + 1);
        } else if (carouselIndex === processedPulses.length - 1 && hasNext) {
            // optional: fetch next page and jump — simple approach: fetch next page and open first item
            const nextPage = page + 1;
            // fetch next page, append? for simplicity replace pulses with next page and open first item
            fetchFavorites(nextPage, search, typeFilter, sortFilter).then(() => {
                setCarouselIndex(0);
            });
        }
    };

    // keyboard navigation for the carousel
    useEffect(() => {
        const onKey = (e) => {
            if (!carouselOpen) return;
            if (e.key === "ArrowLeft") prevCarousel();
            if (e.key === "ArrowRight") nextCarousel();
            if (e.key === "Escape") closeCarousel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carouselOpen, carouselIndex, processedPulses.length, hasNext, page]);

    return (
        <div className={styles.body}>
            <div className={styles.firstContainer}>
            <Navbar />
            <div className={styles.mainContainer}>
                {/* Hero Header */}
                <div className={styles.heroSection}>
                    <h1 className={styles.title}>
                        <span className={styles.gradientText}>Your Collection</span> 💖
                    </h1>
                    <p className={styles.subtitle}>
                        Filter and explore your loaded favorites. Showing up to {PER_PAGE} per page.
                    </p>
                </div>

                {/* Glassmorphism Filter Bar */}
                <div className={styles.filterContainer}>
                    <div className={styles.searchBox}>
                        <span className={styles.icon}>🔍</span>
                        <input
                            type="text"
                            placeholder="Search server-side favorites..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                // page reset happens in debounce effect
                            }}
                            className={styles.searchInput}
                        />
                    </div>

                    <div className={styles.dropdowns}>
                        <select
                            className={styles.selectBox}
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                // page reset happens in debounce effect
                            }}
                        >
                            <option value="all">All Types</option>
                            {availableTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>

                        <select
                            className={styles.selectBox}
                            value={sortFilter}
                            onChange={(e) => {
                                setSortFilter(e.target.value);
                                // page reset happens in debounce effect
                            }}
                        >
                            <option value="recent">Loaded Order</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                        </select>
                    </div>
                </div>

                {/* Content Grid */}
                {loading && pulses.length === 0 ? (
                    <Loading />
                ) : (
                    <>
                        {processedPulses.length === 0 ? (
                            <div className={styles.emptyState}>
                                <h2>No matches found</h2>
                                <p>Try adjusting your filters or navigate pages.</p>
                            </div>
                        ) : (
                            <div className={styles.grid}>
                                {processedPulses.map((pulse, idx) => (
                                    <div
                                        key={pulse.id}
                                        className={styles.card}
                                        onClick={() => openCarousel(idx)}
                                    >
                                        <div className={styles.imageWrapper}>
                                            {pulse.image ? (
                                                <img src={pulse.image} alt="pulse" className={styles.image} />
                                            ) : (
                                                <div className={styles.noImage}>No Image</div>
                                            )}
                                            <div
                                                className={styles.favoriteBadge}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                }}
                                            >
                                                ❤️
                                            </div>
                                        </div>

                                        <div className={styles.cardBody}>
                                            <span className={styles.typeTag}>{pulse.type}</span>
                                            <h3 className={styles.name}>{pulse.name}</h3>

                                            <div className={styles.cardFooter}>
                                                <div className={styles.priceTag}>
                                                    {pulse.price} <span className={styles.currency}>{pulse.currency}</span>
                                                </div>
                                                <div className={styles.userInfo}>
                                                    {pulse.user_avatar && (
                                                        <img src={pulse.user_avatar} alt="avatar" className={styles.avatar} />
                                                    )}
                                                    <small className={styles.username}>@{pulse.user}</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Page navigation (server-side paging) */}
                        <div className={styles.paginationBar}>
                            <button
                                className={styles.pageBtn}
                                onClick={handlePrevPage}
                                disabled={page <= 1 || loading}
                            >
                                ← Previous Page
                            </button>

                            <div className={styles.pageInfo}>
                                Page {page} {loading ? " (loading...)" : ""}
                            </div>

                            <button
                                className={styles.pageBtn}
                                onClick={handleNextPage}
                                disabled={!hasNext || loading}
                            >
                                Next Page →
                            </button>
                        </div>

                        {/* Load Next Page (optional) */}
                        {hasNext && (
                            <div className={styles.loadMoreWrapper}>
                                <button
                                    onClick={() => fetchFavorites(page + 1, search, typeFilter, sortFilter)}
                                    className={styles.loadMoreBtn}
                                    disabled={loading}
                                >
                                    {loading ? "Loading..." : "Load Next Page"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Carousel Modal */}
            {carouselOpen && (
                <div className={styles.carouselOverlay} onClick={closeCarousel}>
                    <div
                        className={styles.carouselContent}
                        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
                    >
                        <button
                            className={`${styles.carouselNav} ${carouselIndex === 0 ? styles.disabled : ""}`}
                            onClick={prevCarousel}
                            disabled={carouselIndex === 0}
                        >
                            ◀
                        </button>

                        <div className={styles.carouselCard}>
                            {/* display the currently selected pulse from processedPulses */}
                            {processedPulses[carouselIndex] ? (
                                <>
                                    <div className={styles.carouselImageWrapper}>
                                        {processedPulses[carouselIndex].image ? (
                                            <img
                                                src={processedPulses[carouselIndex].image}
                                                alt="pulse"
                                                className={styles.carouselImage}
                                            />
                                        ) : (
                                            <div className={styles.noImage}>No Image</div>
                                        )}
                                    </div>

                                    <div className={styles.carouselBody}>
                                        <h2>{processedPulses[carouselIndex].name}</h2>
                                        <p className={styles.carouselMeta}>
                                            <strong>Type:</strong> {processedPulses[carouselIndex].type} •{" "}
                                            <strong>Price:</strong> {processedPulses[carouselIndex].price}{" "}
                                            {processedPulses[carouselIndex].currency}
                                        </p>
                                        <p className={styles.carouselUser}>
                                            {processedPulses[carouselIndex].user_avatar && (
                                                <img
                                                    src={processedPulses[carouselIndex].user_avatar}
                                                    alt="avatar"
                                                    className={styles.avatar}
                                                />
                                            )}
                                            <small>@{processedPulses[carouselIndex].user}</small>
                                        </p>

                                        <div className={styles.carouselActions}>
                                            <button
                                                className={styles.detailsBtn}
                                                onClick={() =>
                                                    navigate(
                                                        `/pulse/${processedPulses[carouselIndex].type}/${processedPulses[carouselIndex].id}`
                                                    )
                                                }
                                            >
                                                View Details
                                            </button>

                                            <button className={styles.closeBtn} onClick={closeCarousel}>
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div>Item not found</div>
                            )}
                        </div>

                        <button
                            className={`${styles.carouselNav} ${
                                carouselIndex === processedPulses.length - 1 ? styles.disabled : ""
                            }`}
                            onClick={nextCarousel}
                            disabled={carouselIndex === processedPulses.length - 1 && !hasNext}
                        >
                            ▶
                        </button>
                    </div>
                </div>
            )}
            </div>
            <Footer />
        </div>
    );
}