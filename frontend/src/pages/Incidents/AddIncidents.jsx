import React, { useState, useRef, useEffect } from 'react';
import styles from "../../styles/Alerts/addAlerts.module.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
    X,
    Plus,
    ChevronDown,
    Settings,
    Trash2,
    ShieldPlus,

} from 'lucide-react';
function getCookie(name) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

export default function AddIncidents() {

    const [incidentTypes, setIncidentTypes] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        incident_type: '',
    });

    const [newIncidentType, setNewIncidentType] = useState("");

    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [imagesPreview, setImagesPreview] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const [isCategoryOpen, setIsCategoryOpen] = useState(false);

    const [showManagePopup, setShowManagePopup] = useState(false);

    const [showCreateConfirm, setShowCreateConfirm] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [incidentToDelete, setIncidentToDelete] = useState(null);

    const fileInputRef = useRef(null);
    const categoryRef = useRef(null);

    useEffect(() => {
        fetch("https://pulsenet-45is.onrender.com/accounts/user/",{
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                setIsAdmin(data.user.is_superuser);
            })
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target)) {
                setIsCategoryOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        fetch("https://pulsenet-45is.onrender.com/accounts/get-incident-types/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
        })
            .then(res => res.json())
            .then(data => {
                setIncidentTypes(data);
                setFormData(prev => ({ ...prev, incident_type: data[0]?.value || '' }));
            })
            .catch(console.error);
    }, []);
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleCategorySelect = (value) => {
        setFormData({
            ...formData,
            incident_type: value
        });

        setIsCategoryOpen(false);
    };



    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);

        if (files.length === 0) return;

        if (selectedFiles.length + files.length > 4) {
            alert("You can upload maximum 4 images.");
            e.target.value = null;
            return;
        }

        const previews = files.map(file => URL.createObjectURL(file));

        setImagesPreview(prev => [...prev, ...previews]);
        setSelectedFiles(prev => [...prev, ...files]);

        e.target.value = null;
    };

    const removeImageAt = (index) => {

        setImagesPreview(prev => {
            try {
                URL.revokeObjectURL(prev[index]);
            } catch (e) {}

            const copy = [...prev];
            copy.splice(index, 1);

            return copy;
        });

        setSelectedFiles(prev => {
            const copy = [...prev];
            copy.splice(index, 1);

            return copy;
        });
    };

    const getRealLocation = () => {
        return new Promise((resolve, reject) => {

            if (!navigator.geolocation) {
                reject(new Error("Geolocation unsupported."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                }),
                (err) => reject(err),
                {
                    enableHighAccuracy: true,
                    timeout: 10000
                }
            );
        });
    };

    const handleDeleteIncidentType = async () => {

        if (!incidentToDelete) return;

        try {

            const response = await fetch(
                `https://pulsenet-45is.onrender.com/accounts/incident-types/delete/${incidentToDelete.id}/`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    },
                }
            );

            if (response.ok) {

                setIncidentTypes(prev =>
                    prev.filter(
                        i => i.id !== incidentToDelete.id
                    )
                );

                setShowDeleteConfirm(false);

                setIncidentToDelete(null);

            }

        } catch (err) {

            console.error(err);

        }
    };

    const handleCreateIncidentType = async () => {

        if (!newIncidentType.trim()) {
            return;
        }

        const formatted = {
            value: newIncidentType.toLowerCase().replace(/\s+/g, "_"),
            label: newIncidentType
        };

        // local update
        setIncidentTypes(prev => [...prev, formatted]);

        try {

            await fetch(
                "https://pulsenet-45is.onrender.com/accounts/incident-types/create/",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    },
                    body: JSON.stringify(formatted)
                }
            );

        } catch (err) {
            console.error(err);
        }
        setNewIncidentType("");
        setShowCreateConfirm(false);
        setShowManagePopup(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.description) {
            alert("Please complete all required fields.");
            return;
        }

        setIsGettingLocation(true);

        let coords;

        try {
            coords = await getRealLocation();
        } catch (err) {
            alert("Location access is required.");
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
            data.append("incident_type", formData.incident_type);

            const geoJsonPoint = JSON.stringify({
                type: "Point",
                coordinates: [coords.lng, coords.lat]
            });

            data.append("location", geoJsonPoint);

            selectedFiles.forEach((file) => {
                data.append("images", file);
            });

            const response = await fetch(
                "https://pulsenet-45is.onrender.com/accounts/special-incidents/create/",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    },
                    body: data,
                }
            );

            if (response.ok) {
                alert("Incident reported successfully!");

                setFormData({
                    title: '',
                    description: '',
                    incident_type: incidentTypes[0]?.value || '',
                });

                setImagesPreview([]);
                setSelectedFiles([]);
            } else {

                const err = await response.json().catch(() => null);

                alert(err?.error || "Saving error.");
            }

        } catch (error) {

            console.error(error);

        } finally {

            setIsSubmitting(false);
        }
    };



    // ADMIN create incident type


    const selectedLabel =
        incidentTypes.find(c => c.value === formData.incident_type)?.label;

    return (
        <div className={styles.bodyContainer}>

            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            <div className={styles.container}>

                <form
                    onSubmit={handleSubmit}
                    className={styles.alertForm}
                >

                    <h2 className={styles.formTitle}>
                        Special Emergency Incident
                    </h2>


                    <div className={styles.inputGroup}>
                        <label>Title *</label>

                        <input
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Ex: Major blackout in city center..."
                        />
                    </div>

                    <div className={styles.inputGroup}>

                        <label>Incident Type</label>

                        <div className={styles.incidentTypeRow}>

                            <div
                                className={styles.customSelectWrapper}
                                ref={categoryRef}
                            >

                                <button
                                    type="button"
                                    className={styles.customSelectBtn}
                                    onClick={() =>
                                        setIsCategoryOpen(prev => !prev)
                                    }
                                >

                                    <span>{selectedLabel}</span>

                                    <ChevronDown
                                        size={18}
                                        className={`${styles.chevron} ${
                                            isCategoryOpen
                                                ? styles.chevronOpen
                                                : ''
                                        }`}
                                    />

                                </button>

                                {isCategoryOpen && (

                                    <ul className={styles.customSelectList}>

                                        {incidentTypes.map(type => (

                                            <li
                                                key={type.id || type.value}
                                                className={`${styles.customSelectItem} ${
                                                    type.value === formData.incident_type
                                                        ? styles.customSelectItemActive
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    handleCategorySelect(type.value)
                                                }
                                            >
                                                {type.label}
                                            </li>

                                        ))}

                                    </ul>

                                )}

                            </div>

                            {isAdmin && (

                                <button
                                    type="button"
                                    className={styles.manageIncidentBtn}
                                    onClick={() =>
                                        setShowManagePopup(true)
                                    }
                                >
                                    <Settings size={18} />
                                </button>

                            )}

                        </div>

                    </div>

                    {showManagePopup && (

                        <div className={styles.modalOverlay}>

                            <div className={styles.modalBox}>

                                <div className={styles.modalHeader}>

                                    <h3>Manage Incident Types</h3>

                                    <button
                                        type="button"
                                        className={styles.closeModalBtn}
                                        onClick={() =>
                                            setShowManagePopup(false)
                                        }
                                    >
                                        <X size={18} />
                                    </button>

                                </div>

                                <div className={styles.incidentList}>

                                    {incidentTypes.map(type => (

                                        <div
                                            key={type.id || type.value}
                                            className={styles.incidentItem}
                                        >

                                            <span>{type.label}</span>

                                            <button
                                                type="button"
                                                className={styles.deleteIncidentBtn}
                                                onClick={() => {
                                                    setIncidentToDelete(type);
                                                    setShowDeleteConfirm(true);
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>

                                        </div>

                                    ))}

                                </div>

                                <div className={styles.createIncidentSection}>

                                    <input
                                        type="text"
                                        placeholder="New incident type..."
                                        value={newIncidentType}
                                        onChange={(e) =>
                                            setNewIncidentType(e.target.value)
                                        }
                                        className={styles.modalInput}
                                    />

                                    <div className={styles.modalActions}>

                                        <button
                                            type="button"
                                            className={styles.submitBtn}
                                            onClick={() =>
                                                setShowCreateConfirm(true)
                                            }
                                        >
                                            Create
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.cancelBtn}
                                            onClick={() =>
                                                setShowManagePopup(false)
                                            }
                                        >
                                            Cancel
                                        </button>

                                    </div>

                                </div>

                            </div>

                        </div>

                    )}
                    {showCreateConfirm && (

                        <div className={styles.modalOverlay}>

                            <div className={styles.modalBox}>

                                <h3>Are you sure?</h3>

                                <p>
                                    Create this incident type?
                                </p>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        marginTop: "20px"
                                    }}
                                >

                                    <button
                                        type="button"
                                        className={styles.submitBtn}
                                        onClick={handleCreateIncidentType}
                                    >
                                        Yes
                                    </button>

                                    <button
                                        type="button"
                                        className={styles.submitBtn}
                                        onClick={() =>
                                            setShowCreateConfirm(false)
                                        }
                                    >
                                        Cancel
                                    </button>

                                </div>

                            </div>

                        </div>

                    )}
                    {showDeleteConfirm && (

                        <div className={styles.modalOverlay}>

                            <div className={styles.modalBox}>

                                <h3>Are you sure?</h3>

                                <p>
                                    Delete this incident type?
                                </p>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        marginTop: "20px"
                                    }}
                                >

                                    <button
                                        type="button"
                                        className={styles.submitBtn}
                                        onClick={handleDeleteIncidentType}
                                    >
                                        Delete
                                    </button>

                                    <button
                                        type="button"
                                        className={styles.submitBtn}
                                        onClick={() =>
                                            setShowDeleteConfirm(false)
                                        }
                                    >
                                        Cancel
                                    </button>

                                </div>

                            </div>

                        </div>

                    )}
                    {/* IMAGES */}
                    <div className={styles.imageUploadSection}>

                        <label className={styles.labelHeader}>
                            Images
                        </label>

                        <div className={styles.imageGrid}>

                            {imagesPreview.map((img, idx) => (

                                <div
                                    key={idx}
                                    className={styles.imagePreviewBox}
                                    style={{
                                        backgroundImage: `url(${img})`
                                    }}
                                >

                                    <button
                                        type="button"
                                        onClick={() => removeImageAt(idx)}
                                        className={styles.removeImgBtn}
                                    >
                                        <X size={16} />
                                    </button>

                                </div>

                            ))}

                            {imagesPreview.length < 4 && (

                                <label className={styles.uploadBtnBox}>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        hidden
                                    />

                                    <Plus size={24} />

                                    <span>Add</span>

                                </label>

                            )}

                        </div>

                    </div>

                    {/* DESCRIPTION */}
                    <div className={styles.inputGroup}>

                        <label>Description *</label>

                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows="4"
                            placeholder="Describe the emergency situation..."
                        />

                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isGettingLocation || isSubmitting}
                    >

                        {isGettingLocation
                            ? "Getting Location..."
                            : isSubmitting
                                ? "Posting..."
                                : "Report Incident"}

                    </button>

                </form>

            </div>

            <Footer />

        </div>
    );
}