import React, { useState, useRef } from "react";
import styles from '../../styles/Pulses_pages/addpulses.module.css';
import Navbar from "../../components/Navbar";
import {Link} from "react-router-dom";
import Footer from "@/components/Footer";

function getCookie(name) {
    let cookieValue = null;
    if (typeof document === "undefined") return null;
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

function AddPulses() {
    const [title, setTitle] = useState("");
    const [pulseType, setPulseType] = useState("servicii");
    const [price, setPrice] = useState("");
    const [currencyType, setCurrencyType] = useState("RON");
    const [description, setDescription] = useState("");
    const [phone, setPhone] = useState("");
    const [imagesPreview, setImagesPreview] = useState([]); // array of object URLs for preview
    const [selectedFiles, setSelectedFiles] = useState([]); // array of File objects
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef(null);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (selectedFiles.length + files.length > 7) {
            alert("Poți adăuga maxim 7 imagini.");
            // reset input so user can reselect
            e.target.value = null;
            return;
        }

        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setImagesPreview((prev) => [...prev, ...newPreviews]);
        setSelectedFiles((prev) => [...prev, ...files]);

        // clear file input value so the same file can be selected again if needed
        e.target.value = null;
    };

    const removeImageAt = (index) => {
        setImagesPreview((prev) => {
            // revoke object URL to free memory
            try {
                URL.revokeObjectURL(prev[index]);
            } catch (e) {}
            const copy = [...prev];
            copy.splice(index, 1);
            return copy;
        });
        setSelectedFiles((prev) => {
            const copy = [...prev];
            copy.splice(index, 1);
            return copy;
        });
    };

    const getAutomaticLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator || !navigator.geolocation) {
                reject(new Error("Browserul nu suportă Geolocation."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    // forward the error to the caller so they can decide what to do
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000 } // 10s timeout
            );
        });
    };

    const addPulse = async () => {
        // validate required fields
        if (!title.trim() || !description.trim() || !phone.trim()) {
            alert("Te rugăm să completezi câmpurile obligatorii (*)");
            return;
        }

        setIsGettingLocation(true);
        let location;
        try {
            location = await getAutomaticLocation();
        } catch (err) {
            console.error("Eroare la obținerea locației:", err);
            alert("Nu am putut obține locația. Trebuie să permiți accesul la locație pentru a publica anunțul.");
            setIsGettingLocation(false);
            return; // IMPORTANT: do not proceed with the API call if coords not fetched
        } finally {
            setIsGettingLocation(false);
        }

        // If we have reached here, coordinates were fetched successfully
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            formData.append("pulse_type", pulseType);
            formData.append("price", price || 0);
            formData.append("currencyType", currencyType);
            formData.append("phone_number", phone.trim());
            formData.append("is_available", "true");

            formData.append("lat", location.lat);
            formData.append("lng", location.lng);

            // append files from selectedFiles state
            selectedFiles.forEach((file) => {
                formData.append("images", file);
            });

            const response = await fetch("http://localhost:8000/accounts/add_pulse/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: formData,
            });

            if (response.ok) {
                // success: reset form and previews
                setTitle("");
                setPrice("");
                setDescription("");
                setPhone("");
                // revoke object URLs to avoid memory leak
                imagesPreview.forEach((url) => {
                    try {
                        URL.revokeObjectURL(url);
                    } catch (e) {}
                });
                setImagesPreview([]);
                setSelectedFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = null;

                alert("Anunțul a fost adăugat cu succes!");
            } else {
                // try to parse error response
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch (e) {
                    console.error("Nu s-a putut converti eroarea la JSON.", e);
                }
                console.error("Eroare de la server:", errorData || response.statusText);
                alert(errorData?.error || "A apărut o eroare la server. Vezi consola pentru detalii.");
            }
        } catch (error) {
            console.error("Error adding pulse:", error);
            alert("A apărut o eroare. Vezi consola pentru detalii.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
            <div className={styles["anunt-container"]}>
                <div className="flex justify-between items-center">
                <h1 className={styles["anunt-header"]}>Publică un anunț</h1>
                <Link to="/create-request" className="mb-5 text-blue-600 underline hover:text-blue-800  cursor-pointer ">Have a more urgent request?</Link>
                </div>

                {/* --- Secțiunea Detalii --- */}
                <section className={styles["form-section"]}>
                    <h3 className={styles["section-title"]}>Dă cât mai multe detalii!</h3>

                    <div className={styles["form-group"]}>
                        <label className={styles["label-text"]}>Adaugă titlul *</label>
                        <input
                            type="text"
                            placeholder="Ex.. Samsung S26"
                            className={styles["input-field"]}
                            maxLength={70}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <p className={styles["counter-text"]}>{title.length}/70</p>
                    </div>

                    <div className={styles["row-group"]}>
                        <div className={styles["form-group-half"]}>
                            <label className={styles["label-text"]}>Categoria*</label>
                            <select
                                className={styles["select-field"]}
                                value={pulseType}
                                onChange={(e) => setPulseType(e.target.value)}
                            >
                                <option value="servicii">Servicii / Evenimente</option>
                                <option value="obiecte">Obiecte / Produse</option>
                            </select>
                        </div>

                        <div className={styles["price-row-wrapper"]}>
                            <label className={styles["label-text"]}>Preț *</label>
                            <div className={styles["price-input-container"]}>
                                <input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    className={styles["input-field"]}
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                />
                                <select
                                    className={styles["currency-select"]}
                                    value={currencyType}
                                    onChange={(e) => setCurrencyType(e.target.value)}
                                >
                                    <option value="RON">RON</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- Secțiunea Imagini --- */}
                <section className={styles["form-section"]}>
                    <h3 className={styles["section-title"]}>Imagini</h3>
                    <p className={styles["helper-text"]}>
                        Prima imagine va fi cea principala. Poți adauga pana la 7 imagini.
                    </p>

                    <div className={styles["image-upload-grid"]}>
                        <label
                            className={`${styles["image-slot"]} ${styles["main-slot"]}`}
                            style={{ cursor: "pointer" }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleImageChange}
                                hidden
                            />
                            <span>Adaugă imagini</span>
                        </label>

                        {/* Imagini încărcate */}
                        {imagesPreview.map((img, idx) => (
                            <div
                                key={idx}
                                className={styles["image-slot"]}
                                style={{
                                    backgroundImage: `url(${img})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => removeImageAt(idx)}
                                    className={styles["delete-btn"]}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* Sloturi goale placeholder */}
                        {[...Array(Math.max(0, 7 - imagesPreview.length))].map((_, i) => (
                            <div key={i} className={styles["image-slot"]}>
                <span role="img" aria-label="camera">
                  📷
                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- Secțiunea Descriere --- */}
                <section className={styles["form-section"]}>
                    <div className={styles["form-group"]}>
                        <label className={styles["label-text"]}>Descriere *</label>
                        <textarea
                            placeholder="Încearcă să scrii ce ai vrea tu să afli dacă te-ai uita la acest anunț"
                            className={styles["textarea-field"]}
                            rows={6}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <p className={styles["helper-text"]}>Introdu cel puțin 40 caractere</p>
                            <p className={styles["counter-text"]}>{description.length}/9000</p>
                        </div>
                    </div>
                </section>

                {/* --- Secțiunea Contact + Submit --- */}
                <section className={styles["form-section"]}>
                    <h3 className={styles["section-title"]}>Contact</h3>
                    <div
                        className={styles["contact-submit-row"]}
                        style={{ display: "flex", alignItems: "flex-end", gap: "20px" }}
                    >
                        <div className={styles["form-group"]} style={{ flex: 1, marginBottom: 0 }}>
                            <label className={styles["label-text"]}>Număr de telefon *</label>
                            <input
                                type="tel"
                                maxLength={10}
                                placeholder="07xx xxx xxx"
                                className={styles["input-field"]}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>

                        <button
                            type="button"
                            className={styles["submit-button"]}
                            onClick={addPulse}
                            disabled={isGettingLocation || isSubmitting}
                            style={{
                                padding: "12px 30px",
                                backgroundColor: isGettingLocation || isSubmitting ? "rgba(0,0,0,0.3)" : "rgba(33,31,31,0.67)",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: "bold",
                                cursor: isGettingLocation || isSubmitting ? "not-allowed" : "pointer",
                                height: "46px",
                            }}
                        >
                            {isGettingLocation ? "Obțin locația..." : isSubmitting ? "Se trimite..." : "Publică anunțul"}
                        </button>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    );
}

export default AddPulses;