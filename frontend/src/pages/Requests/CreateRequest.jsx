import { useState, useEffect } from "react";
import styles from "../../styles/Requests/CreateRequest.module.css";


function getCookie(name) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}


export default function CreateRequest() {
    const [form, setForm] = useState({
        title: "",
        description: "",
        category: "",
        expires_at: "",
        pulse_type: "",
        max_price: "",
        lat: null,
        lng: null,
    });

    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(true);

    // ✅ AUTO GET LOCATION ON LOAD
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm((prev) => ({
                    ...prev,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                }));
                setLocationLoading(false);
            },
            (err) => {
                console.error("Location error:", err);
                setLocationLoading(false);
            }
        );
    }, []);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.lat || !form.lng) {
            alert("Location not available yet!");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/accounts/urgent-requests/create/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                credentials: "include",
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (data.success) {
                alert("Request created!");
                setForm((prev) => ({
                    ...prev,
                    title: "",
                    description: "",
                    category: "",
                    expires_at: "",
                    pulse_type: "",
                    max_price: "",
                }));
            }
        } catch (err) {
            console.error(err);
            alert("Error creating request");
        }

        setLoading(false);
    };

    return (
        <div className={styles.container}>
            <h2>Create Urgent Request</h2>

            {/* ✅ Location status */}
            <p className={styles.locationStatus}>
                {locationLoading
                    ? "Getting your location..."
                    : form.lat
                        ? "Location detected ✅"
                        : "Location unavailable ❌"}
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
                <input
                    name="title"
                    placeholder="Title"
                    value={form.title}
                    onChange={handleChange}
                    required
                />

                <textarea
                    name="description"
                    placeholder="Describe your urgent need..."
                    value={form.description}
                    onChange={handleChange}
                    required
                />

                <input
                    name="category"
                    placeholder="Category (e.g. transport, help)"
                    value={form.category}
                    onChange={handleChange}
                />

                <input
                    type="datetime-local"
                    name="expires_at"
                    value={form.expires_at}
                    onChange={handleChange}
                />

                <input
                    name="pulse_type"
                    placeholder="Pulse type"
                    value={form.pulse_type}
                    onChange={handleChange}
                />

                <input
                    type="number"
                    name="max_price"
                    placeholder="Max price"
                    value={form.max_price}
                    onChange={handleChange}
                />

                <button type="submit" disabled={loading || locationLoading}>
                    {loading ? "Creating..." : "Create Request"}
                </button>
            </form>
        </div>
    );
}