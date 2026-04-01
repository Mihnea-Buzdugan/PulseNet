import React, {useState, useRef, useEffect} from 'react';
import Navbar from "../../components/Navbar";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "../../styles/Requests/CreateRequest.module.css";

import {
    Truck, Wrench, Sparkles, Monitor, Package,
    Dog, Hammer, Leaf, Zap, MoreHorizontal, ArrowRight, X, Plus
} from 'lucide-react';
import {useNavigate} from "react-router-dom";
import Footer from "@/components/Footer";

const CATEGORIES = [
    { id: 'transport', label: 'Transport', icon: Truck },
    { id: 'labor', label: 'Help / Labor', icon: Wrench },
    { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
    { id: 'tech', label: 'IT Support', icon: Monitor },
    { id: 'delivery', label: 'Delivery', icon: Package },
    { id: 'pet_care', label: 'Pet Care', icon: Dog },
    { id: 'repair', label: 'Home Repair', icon: Hammer },
    { id: 'landscaping', label: 'Landscaping', icon: Leaf },
    { id: 'electrical', label: 'Electrical', icon: Zap },
    { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export default function CreateRequest() {
    const [loading, setLoading] = useState(false);

    // Image Upload State
    const [imagesPreview, setImagesPreview] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const fileInputRef = useRef(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: "",
        description: "",
        category: "",
        expires_at: new Date().toLocaleDateString('en-CA'),
        pulse_type: "",
        max_price: "",
        lat: null,
        lng: null,
    });

    useEffect(() => {
        fetch("http://localhost:8000/accounts/profile/", { credentials: "include" })
            .then((res) => res.json())
            .then((data) => {
                const coords = data?.user?.location?.coordinates;
                if (coords) {
                    setForm((prev) => ({ ...prev, lng: coords[0], lat: coords[1] }));
                }
            })
            .catch((err) => console.error("Failed to fetch user location:", err))
            .finally(() => setLocationLoading(false));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCategorySelect = (categoryId) => {
        setForm(prev => ({
            ...prev,
            category: prev.category === categoryId ? '' : categoryId
        }));
    };

    // --- Image Handlers ---
    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (selectedFiles.length + files.length > 4) {
            alert("You can upload a maximum of 4 images.");
            e.target.value = null;
            return;
        }

        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setImagesPreview((prev) => [...prev, ...newPreviews]);
        setSelectedFiles((prev) => [...prev, ...files]);

        e.target.value = null;
    };

    const removeImageAt = (index) => {
        setImagesPreview((prev) => {
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

    const getCookie = (name) => {
        if (!document.cookie) return null;
        for (const cookie of document.cookie.split(";")) {
            const c = cookie.trim();
            if (c.startsWith(name + "=")) return decodeURIComponent(c.substring(name.length + 1));
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!form.lat || !form.lng) {
            alert("Location not available yet!");
            return;
        }

        const formDataToSend = new FormData();
        formDataToSend.append("title", form.title);
        formDataToSend.append("description", form.description);
        formDataToSend.append("category", form.category);
        formDataToSend.append("expires_at", form.expires_at);
        formDataToSend.append("max_price", form.max_price);
        formDataToSend.append("lat", form.lat);
        formDataToSend.append("lng", form.lng);
        selectedFiles.forEach((file) => formDataToSend.append("images", file));

        try {
            const response = await fetch("http://localhost:8000/accounts/urgent-requests/create/", {
                method: "POST",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                credentials: "include",
                body: formDataToSend,
            });

            if (response.ok) {
                alert("Request created successfully!");
                setForm({ title: '', description: '', category: '', expires_at: new Date().toLocaleDateString('en-CA'), max_price: '' });
                imagesPreview.forEach((url) => { try { URL.revokeObjectURL(url); } catch {} });
                setImagesPreview([]);
                setSelectedFiles([]);
                navigate("/");

            } else {
                const err = await response.json().catch(() => null);
                console.error("Server error:", err || response.statusText);
                alert(err?.error || "An error occurred. See console for details.");
            }
        } catch (err) {
            console.error("Request failed:", err);
            alert("An error occurred. See console for details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
        <div className={styles.pageWrapper}>

            <div className={styles.mainContainer}>
                <div className={styles.formCard}>
                    <h2 className={styles.title}>Please enter the following information</h2>

                    <form onSubmit={handleSubmit} className={styles.form}>

                        {/* 1. Title (Now Full Width) */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Request Title</label>
                            <input
                                name="title"
                                placeholder="e.g. Need help moving furniture"
                                value={form.title}
                                onChange={handleChange}
                                required
                                className={styles.inputField}
                            />
                        </div>

                        {/* 2. Description */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Description</label>
                            <textarea
                                name="description"
                                placeholder="Describe your urgent need..."
                                value={form.description}
                                onChange={handleChange}
                                required
                                rows={3}
                                className={styles.textArea}
                            />
                        </div>

                        {/* 3. Image Upload Section */}
                        <div className={styles.imageUploadSection}>
                            <label className={styles.label}>Images (Max 4)</label>
                            <div className={styles.imageGrid}>
                                {/* Preview Boxes */}
                                {imagesPreview.map((img, idx) => (
                                    <div key={idx} className={styles.imagePreviewBox} style={{ backgroundImage: `url(${img})` }}>
                                        <button type="button" onClick={() => removeImageAt(idx)} className={styles.removeImgBtn}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}

                                {/* Add Button Box */}
                                {imagesPreview.length < 4 && (
                                    <label className={styles.uploadBtnBox}>
                                        <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageChange} hidden />
                                        <Plus size={24} />
                                        <span>Add</span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* 4. Date and Price (Same Row) */}
                        <div className={styles.gridRow}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Expiration Date</label>

                                <DatePicker
                                    selected={form.expires_at ? new Date(form.expires_at) : null}
                                    onChange={(date) => {
                                        const val = date
                                            ? date.toISOString().slice(0, 16) // ✅ keeps YYYY-MM-DDTHH:mm
                                            : "";

                                        setForm({ ...form, expires_at: val });
                                    }}
                                    showTimeSelect // ✅ enables time selection
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    dateFormat="dd/MM/yyyy HH:mm"
                                    className={styles.inputField}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Maximum Price ($)</label>
                                <input
                                    type="number"
                                    name="max_price"
                                    placeholder="0.00"
                                    value={form.max_price}
                                    onChange={handleChange}
                                    className={styles.inputField}
                                />
                            </div>
                        </div>

                        {/* 5. Categories */}
                        <div>
                            <label className={styles.categoryLabel}>Select your functional category</label>
                            <div className={styles.categoryGrid}>
                                {CATEGORIES.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = form.category === cat.id;
                                    const hasSelection = form.category !== '';

                                    let stateClass = styles.catDefault;
                                    if (isSelected) stateClass = styles.catSelected;
                                    else if (hasSelection) stateClass = styles.catInactive;

                                    return (
                                        <button
                                            type="button"
                                            key={cat.id}
                                            onClick={() => handleCategorySelect(cat.id)}
                                            className={`${styles.categoryBtnBase} ${stateClass}`}
                                        >
                                            <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className={styles.submitWrapper}>
                            <button
                                type="submit"
                                disabled={loading || !form.category}
                                className={styles.submitBtn}
                            >
                                {loading ? "Creating..." : "Continue"}
                                {!loading && <ArrowRight size={18} />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
            <Footer />
        </div>
    );
}