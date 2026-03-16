import React, { useState, useRef } from 'react';
import styles from "../../styles/Alerts/addAlerts.module.css";
import Navbar from "@/components/Navbar";
import { X, Plus, ShieldAlert, AlertTriangle } from 'lucide-react';

function getCookie(name) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

export default function AddAlerts() {
    const categories = [
        { value: "weather", label: "Weather Alert" },
        { value: "lost", label: "Lost Item" },
        { value: "found", label: "Found Item" },
        { value: "traffic", label: "Traffic Alert" },
        { value: "safety", label: "Safety Notice" },
        { value: "event", label: "Event" },
        { value: "missing_person", label: "Missing Person" },
        { value: "infrastructure", label: "Road / Utilities" },
        { value: "public_health", label: "Health / Medical" },
        { value: "meetup", label: "Meetup" },
        { value: "volunteer", label: "Volunteer Request" },
        { value: "other", label: "Other" },
    ];

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'other',
    });

    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagesPreview, setImagesPreview] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const fileInputRef = useRef(null);
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (selectedFiles.length + files.length > 4) {
            alert("Poți adăuga maxim 4 imagini.");
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

    const getRealLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Browserul nu suportă localizarea."));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.description) {
            alert("Te rugăm să completezi câmpurile obligatorii.");
            return;
        }

        setIsGettingLocation(true);
        let coords;
        try {
            coords = await getRealLocation();
        } catch (err) {
            alert("Accesul la locație este obligatoriu pentru a posta o alertă comunitară.");
            setIsGettingLocation(false);
            return;
        } finally {
            setIsGettingLocation(false);
        }

        setIsSubmitting(true);
        try {
            const data = new FormData();
            data.append("title", formData.title);
            data.append("description", formData.description);
            data.append("category", formData.category);

            // LOGICA POINT TYPE (GeoJSON pentru PostGIS)
            // PostGIS/GeoJSON folosește formatul [longitude, latitude]
            const geoJsonPoint = JSON.stringify({
                type: "Point",
                coordinates: [coords.lng, coords.lat]
            });
            data.append("location", geoJsonPoint);

            selectedFiles.forEach((file) => {
                data.append("images", file);
            });

            const response = await fetch("http://localhost:8000/accounts/alerts/create/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: data,
            });

            if (response.ok) {
                alert("Alerta a fost postată!");
                setFormData({ title: '', description: '', category: 'other' });
                setImagesPreview([]);
                setSelectedFiles([]);
            } else {
                alert("Eroare la salvare.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <Navbar />
            <div className={styles.container}>
                <form onSubmit={handleSubmit} className={styles.alertForm}>
                    <h2 className={styles.formTitle}>New Community Alert</h2>

                    <div className={styles.inputGroup}>
                        <label>Title *</label>
                        <input name="title" value={formData.title} onChange={handleChange} placeholder="Ex: Water pipe burst..." />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Category</label>
                        <select name="category" value={formData.category} onChange={handleChange}>
                            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>

                    {/* SECTIUNE IMAGINI (Grid similar cu AddPulses) */}
                    <div className={styles.imageUploadSection}>
                        <label className={styles.labelHeader}>Imagini</label>
                        <div className={styles.imageGrid}>
                            {/* Preview Imagini */}
                            {imagesPreview.map((img, idx) => (
                                <div key={idx} className={styles.imagePreviewBox} style={{ backgroundImage: `url(${img})` }}>
                                    <button type="button" onClick={() => removeImageAt(idx)} className={styles.removeImgBtn}>
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}

                            {/* Al 6-lea patrat / Buton adaugare */}
                            {imagesPreview.length < 4 && (
                                <label className={styles.uploadBtnBox}>
                                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageChange} hidden />
                                    <Plus size={24} />
                                    <span>Adaugă</span>
                                </label>
                            )}
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Description *</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows="4" />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={isGettingLocation || isSubmitting}>
                        {isGettingLocation ? "Processing..." : isSubmitting ? "Posting..." : "Post Alert"}
                    </button>
                </form>
            </div>
        </div>
    );
}