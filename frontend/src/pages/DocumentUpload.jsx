import { useState } from "react";
import styles from "../styles/DocumentUpload.module.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function DocumentUpload() {
    const [file, setFile] = useState(null);
    const [originalPreview, setOriginalPreview] = useState("");
    const [docType, setDocType] = useState("");
    const [status, setStatus] = useState("found");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleStatusChange = (newStatus) => {
        if (status === newStatus) return;
        setStatus(newStatus);
        // Clear everything when switching categories for a clean slate
        setFile(null);
        setOriginalPreview("");
        setDocType("");
        setError("");
        setSuccess(false);
    };

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setFile(selected);
        setError("");
        setDocType("");
        setSuccess(false);

        const reader = new FileReader();
        reader.onload = () => setOriginalPreview(reader.result);
        reader.readAsDataURL(selected);
    };

    const handleProcess = async () => {
        if (!file) return;

        setLoading(true);
        setError("");
        setSuccess(false);

        try {
            const formData = new FormData();
            formData.append("image", file);
            formData.append("status", status); // This is sent as 'found' or 'lost'

            const token = localStorage.getItem("access_token");

            const response = await fetch("https://pulsenet-45is.onrender.com/accounts/redact-document/", {
                method: "POST",
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    // Note: Don't set 'Content-Type': 'multipart/form-data' manually,
                    // fetch does it automatically with the boundary
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Request failed");
            }

            setDocType(data.document_type || "Unknown Document");
            setSuccess(true);
        } catch (err) {
            setError(err.message || "Something went wrong processing your document.");
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
                <div className={styles.card}>
                    <div className={styles.header}>
                        <h2>Document Portal</h2>
                        <p>Securely upload documents to the registry.</p>
                    </div>

                    <div className={styles.toggleContainer}>
                        <button
                            className={`${styles.toggleBtn} ${status === "found" ? styles.active : ""}`}
                            onClick={() => handleStatusChange("found")}
                        >
                            Found a Document
                        </button>
                        <button
                            className={`${styles.toggleBtn} ${status === "lost" ? styles.active : ""}`}
                            onClick={() => handleStatusChange("lost")}
                        >
                            Report Lost Document
                        </button>
                    </div>

                    <div className={styles.uploadSection}>
                        <label className={styles.uploadArea}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className={styles.hiddenInput}
                            />
                            {originalPreview ? (
                                <img src={originalPreview} alt="Preview" className={styles.imagePreview} />
                            ) : (
                                <div className={styles.uploadPlaceholder}>
                                    <span className={styles.icon}>📄</span>
                                    <span>Click to upload {status} document</span>
                                </div>
                            )}
                        </label>
                    </div>

                    {error && <div className={styles.errorMessage}>{error}</div>}

                    {success && (
                        <div className={styles.successMessage}>
                            <strong>Success!</strong> The {status} document has been recorded.
                            {docType && <span> Type: {docType}</span>}
                        </div>
                    )}

                    <button
                        className={styles.submitBtn}
                        onClick={handleProcess}
                        disabled={!file || loading}
                    >
                        {loading ? "Processing..." : `Submit ${status === 'lost' ? 'Lost' : 'Found'} Report`}
                    </button>
                </div>
            </div>

            <Footer />
        </div>
    );
}