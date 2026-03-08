import { useState } from "react";
import styles from '../../styles/Pulses_pages/addpulses.module.css';
import Navbar from "../../components/Navbar";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
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
    const [images, setImages] = useState([]);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (images.length + files.length > 7) {
            alert("Poți adăuga maxim 7 imagini.");
            return;
        }
        const newImages = files.map(file => URL.createObjectURL(file));
        setImages(prev => [...prev, ...newImages]);
    };

    const addPulse = async () => {
        if (!title.trim() || !description.trim() || !phone.trim()) {
            alert("Te rugăm să completezi câmpurile obligatorii (*)");
            return;
        }

        const getAutomaticLocation = () => {
            return new Promise((resolve) => {
                if (!navigator.geolocation) {
                    console.warn("Browserul nu suportă Geolocation.");
                    resolve(null);
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    },
                    (error) => {
                        console.error("Eroare la obținerea locației:", error.message);
                        resolve(null);
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            });
        };

        try {
            const location = await getAutomaticLocation();

            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            formData.append("pulse_type", pulseType);
            formData.append("price", price || 0);
            formData.append("currencyType", currencyType);
            formData.append("phone_number", phone.trim());
            formData.append("is_available", "true");

            if (location) {
                formData.append("lat", location.lat);
                formData.append("lng", location.lng);
            }

            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput.files.length > 0) {
                Array.from(fileInput.files).forEach((file) => {
                    formData.append("images", file);
                });
            }
            const response = await fetch("http://localhost:8000/accounts/add_pulse/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: formData
            });

            if (response.ok) {
                const data = await response.json();

                setTitle("");
                setPrice("");
                setDescription("");
                setPhone("");
                setImages([]);

                alert("Anunțul a fost adăugat cu succes!");
            } else {
                const errorData = await response.json();
                console.error("Eroare de la server:", errorData);
            }
        } catch (error) {
            console.error("Error adding pulse:", error);
        }
    };

    return (
        <div>
            <Navbar />
            <div className={styles['anunt-container']}>
                <h1 className={styles['anunt-header']}>Publică un anunț</h1>

                {/* --- Secțiunea Detalii --- */}
                <section className={styles['form-section']}>
                    <h3 className={styles['section-title']}>Dă cât mai multe detalii!</h3>

                    <div className={styles['form-group']}>
                        <label className={styles['label-text']}>Adaugă titlul *</label>
                        <input
                            type="text"
                            placeholder="Ex.. Samsung S26"
                            className={styles['input-field']}
                            maxLength={70}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <p className={styles['counter-text']}>{title.length}/70</p>
                    </div>

                    <div className={styles['row-group']}>
                        <div className={styles['form-group-half']}>
                            <label className={styles['label-text']}>Categoria*</label>
                            <select
                                className={styles['select-field']}
                                value={pulseType}
                                onChange={(e) => setPulseType(e.target.value)}
                            >
                                <option value="servicii">Servicii / Evenimente</option>
                                <option value="obiecte">Obiecte / Produse</option>
                            </select>
                        </div>

                        <div className={styles['price-row-wrapper']}>
                            <label className={styles['label-text']}>Preț *</label>
                            <div className={styles['price-input-container']}>
                                <input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    className={styles['input-field']}
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                />
                                <select
                                    className={styles['currency-select']}
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
                <section className={styles['form-section']}>
                    <h3 className={styles['section-title']}>Imagini</h3>
                    <p className={styles['helper-text']}>
                        Prima imagine va fi cea principala. Poți adauga pana la 7 imagini.
                    </p>

                    <div className={styles['image-upload-grid']}>
                        <label className={`${styles['image-slot']} ${styles['main-slot']}`} style={{ cursor: 'pointer' }}>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleImageChange}
                                hidden
                            />
                            <span>Adaugă imagini</span>
                        </label>

                        {/* Imagini încărcate */}
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                className={styles['image-slot']}
                                style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                            >
                                <button
                                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                                    className={styles['delete-btn']}
                                >✕</button>
                            </div>
                        ))}

                        {/* Sloturi goale placeholder */}
                        {[...Array(Math.max(0, 7 - images.length))].map((_, i) => (
                            <div key={i} className={styles['image-slot']}>
                                <span role="img" aria-label="camera">📷</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- Secțiunea Descriere --- */}
                <section className={styles['form-section']}>
                    <div className={styles['form-group']}>
                        <label className={styles['label-text']}>Descriere *</label>
                        <textarea
                            placeholder="Încearcă să scrii ce ai vrea tu să afli dacă te-ai uita la acest anunț"
                            className={styles['textarea-field']}
                            rows={6}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <p className={styles['helper-text']}>Introdu cel puțin 40 caractere</p>
                            <p className={styles['counter-text']}>{description.length}/9000</p>
                        </div>
                    </div>
                </section>

                {/* --- Secțiunea Contact + Submit --- */}
                <section className={styles['form-section']}>
                    <h3 className={styles['section-title']}>Contact</h3>
                    <div className={styles['contact-submit-row']} style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
                        <div className={styles['form-group']} style={{ flex: 1, marginBottom: 0 }}>
                            <label className={styles['label-text']}>Număr de telefon *</label>
                            <input
                                type="tel"
                                max={10}
                                placeholder="07xx xxx xxx"
                                className={styles['input-field']}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            className={styles['submit-button']}
                            onClick={addPulse}
                            style={{
                                padding: '12px 30px',
                                backgroundColor: 'rgba(33,31,31,0.67)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                height: '46px'
                            }}
                        >
                            Publică anunțul
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default AddPulses;