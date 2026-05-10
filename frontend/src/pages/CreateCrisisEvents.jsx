import { useState, useEffect, useCallback } from "react";
import { Zap, MapPin, Globe, AlertTriangle, CircleDot, Map, FileText, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import styles from "../styles/CreateCrisisEvents.module.css";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";
// Fix default marker icon pentru Leaflet + Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});



const CITY_CENTER = [47.1585, 27.6014];
const CITY_RADIUS_KM = 10;

function ChangeView({ center, radiusKm }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            const zoom = radiusKm > 20 ? 10 : radiusKm > 10 ? 11 : radiusKm > 5 ? 12 : 13;
            map.setView(center, zoom);
        }
    }, [center, radiusKm, map]);
    return null;
}

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

function MapClickHandler({ onMapClick, mode }) {
    useMapEvents({
        click(e) {
            if (mode === "local") {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

export default function CreateCrisisEvents() {
    const [mode, setMode] = useState("local"); // "local" | "global"
    const [incidentTypes, setIncidentTypes] = useState([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [form, setForm] = useState({
        lat: null,
        lng: null,
        radius: 5,
        incident_type: "",
        notes: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null); // { success, message }
    const csrfToken = getCookie("csrftoken");
    // Fetch incident types din /accounts/get-incident-types/
    useEffect(() => {
        fetch("http://localhost:8000/accounts/get-incident-types/", {
            credentials: "include",
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
        })
            .then((r) => r.json())
            .then((data) => {
                setIncidentTypes(data);
                if (data.length > 0) setForm((f) => ({ ...f, incident_type: data[0].id }));
            })
            .catch(() => setIncidentTypes([]))
            .finally(() => setLoadingTypes(false));
    }, []);

    const handleMapClick = useCallback((lat, lng) => {
        setForm((f) => ({ ...f, lat, lng }));
    }, []);

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (newMode === "global") {
            setForm((f) => ({ ...f, lat: CITY_CENTER[0], lng: CITY_CENTER[1], radius: CITY_RADIUS_KM }));
        } else {
            setForm((f) => ({ ...f, lat: null, lng: null, radius: 5 }));
        }
    };

    const displayCenter = form.lat && form.lng ? [form.lat, form.lng] : CITY_CENTER;
    const displayRadius = form.radius;

    const handleSubmit = async () => {
        if (mode === "local" && (!form.lat || !form.lng)) {
            setResult({ success: false, message: "Selectează o locație pe hartă apăsând pe ea." });
            return;
        }
        if (!form.incident_type) {
            setResult({ success: false, message: "Selectează tipul de incident." });
            return;
        }

        setSubmitting(true);
        setResult(null);

        try {

            const response = await fetch("http://localhost:8000/accounts/create-crisis-event/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                body: JSON.stringify({
                    lat: form.lat,
                    lng: form.lng,
                    radius: form.radius,
                    incident_type: form.incident_type,
                    notes: form.notes,
                    mode: mode,
                }),
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setResult({ success: true, message: `Eveniment de criză creat cu succes!`});
                setForm({ lat: null, lng: null, radius: 5, incident_type: form.incident_type, notes: "" });
                setMode("local");
            } else {
                setResult({ success: false, message: data.error || "Eroare la creare." });
            }
        } catch {
            setResult({ success: false, message: "Eroare de rețea. Încearcă din nou." });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>

            <div className={styles.container}>
                {/* Header */}
                <header className={styles.header}>

                    <div className={styles.headerTopRow}>
                        <Link className={styles.adminLink} to="/admin-page">
                            <ArrowLeft size={16} /> Înapoi la Dashboard
                        </Link>
                        <div className={styles.headerBadge}>ADMIN</div>
                    </div>
                    <h1 className={styles.title}>
                        Crisis <span className={styles.accent}>Management</span>
                    </h1>
                    <p className={styles.subtitle}>Activează un eveniment de criză și configurează zona de impact</p>
                </header>

                <div className={styles.layout}>
                    {/* Sidebar cu formularul */}
                    <aside className={styles.sidebar}>

                        {/* Mode selector */}
                        <section className={styles.section}>
                            <label className={styles.sectionLabel}>
                                <Zap size={14} /> Mod activare
                            </label>
                            <div className={styles.modeGroup}>
                                <label className={`${styles.modeCard} ${mode === "local" ? styles.modeCardActive : ""}`}>
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="local"
                                        checked={mode === "local"}
                                        onChange={() => handleModeChange("local")}
                                        className={styles.radioHidden}
                                    />
                                    <MapPin size={20} className={styles.modeIcon} />
                                    <span className={styles.modeTitle}>Local</span>
                                    <span className={styles.modeDesc}>Zonă specifică, rază personalizată</span>
                                </label>

                                <label className={`${styles.modeCard} ${mode === "global" ? styles.modeCardActive : ""}`}>
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="global"
                                        checked={mode === "global"}
                                        onChange={() => handleModeChange("global")}
                                        className={styles.radioHidden}
                                    />
                                    <Globe size={20} className={styles.modeIcon} />
                                    <span className={styles.modeTitle}>Global</span>
                                    <span className={styles.modeDesc}>Întregul oraș, urgență generală</span>
                                </label>
                            </div>
                        </section>

                        {/* Incident Type */}
                        <section className={styles.section}>
                            <label className={styles.sectionLabel} htmlFor="incidentType">
                                <AlertTriangle size={14} /> Tipul incidentului
                            </label>
                            {loadingTypes ? (
                                <div className={styles.loadingPill}>Se încarcă tipurile...</div>
                            ) : (
                                <select
                                    id="incidentType"
                                    className={styles.select}
                                    value={form.incident_type}
                                    onChange={(e) => setForm((f) => ({ ...f, incident_type: e.target.value }))}
                                >
                                    {incidentTypes.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </section>

                        {/* Radius — doar în modul Local */}
                        {mode === "local" && (
                            <section className={styles.section}>
                                <label className={styles.sectionLabel} htmlFor="radius">
                                    <CircleDot size={14} /> Raza zonei afectate
                                    <span className={styles.radiusValue}>{form.radius} km</span>
                                </label>
                                <input
                                    id="radius"
                                    type="range"
                                    min={1}
                                    max={CITY_RADIUS_KM}
                                    step={0.5}
                                    value={form.radius}
                                    onChange={(e) => setForm((f) => ({ ...f, radius: parseFloat(e.target.value) }))}
                                    className={styles.rangeSlider}
                                />
                                <div className={styles.rangeLabels}>
                                    <span>1 km</span>
                                    <span>50 km</span>
                                </div>
                            </section>
                        )}

                        {/* Coordonate afișate */}
                        {mode === "local" && (
                            <section className={styles.section}>
                                <label className={styles.sectionLabel}>
                                    <Map size={14} /> Coordonate selectate
                                </label>
                                {form.lat && form.lng ? (
                                    <div className={styles.coordBox}>
                                        <span>Lat: <strong>{form.lat.toFixed(5)}</strong></span>
                                        <span>Lng: <strong>{form.lng.toFixed(5)}</strong></span>
                                    </div>
                                ) : (
                                    <div className={styles.coordHint}>
                                        Apasă pe hartă pentru a selecta locația
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Note */}
                        <section className={styles.section}>
                            <label className={styles.sectionLabel} htmlFor="notes">
                                <FileText size={14} /> Note suplimentare
                            </label>
                            <textarea
                                id="notes"
                                className={styles.textarea}
                                placeholder="Descrie situația de criză, instrucțiuni pentru populație..."
                                rows={4}
                                value={form.notes}
                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            />
                        </section>

                        {/* Feedback */}
                        {result && (
                            <div className={result.success ? styles.alertSuccess : styles.alertError}>
                                <span className={styles.alertIcon}>
                                    {result.success
                                        ? <CheckCircle size={15} />
                                        : <AlertCircle size={15} />}
                                </span>
                                {result.message}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            className={styles.submitButton}
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className={styles.spinnerRow}>
                                    <span className={styles.spinner} /> Se activează...
                                </span>
                            ) : (
                                <span className={styles.submitInner}><AlertTriangle size={16} /> Activează Eveniment de Criză</span>
                            )}
                        </button>
                    </aside>

                    {/* Harta */}
                    <div className={styles.mapWrapper}>
                        <div className={styles.mapLabel}>
                            {mode === "local"
                                ? "Click pe hartă pentru a seta centrul zonei de criză"
                                : "Mod Global — acoperire totală a orașului"}
                        </div>
                        <div className={styles.mapContainer}>
                            <MapContainer
                                center={displayCenter}
                                zoom={mode === "global" ? 10 : 13}
                                style={{ height: "100%", width: "100%" }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />

                                <MapClickHandler onMapClick={handleMapClick} mode={mode} />

                                {form.lat && form.lng && (
                                    <ChangeView center={[form.lat, form.lng]} radiusKm={displayRadius} />
                                )}

                                {form.lat && form.lng && (
                                    <>
                                        <Marker position={[form.lat, form.lng]} />
                                        <Circle
                                            center={[form.lat, form.lng]}
                                            radius={displayRadius * 1000}
                                            pathOptions={{
                                                color: "#e53e3e",
                                                fillColor: "#e53e3e",
                                                fillOpacity: 0.15,
                                                weight: 2,
                                                dashArray: "6 4",
                                            }}
                                        />
                                    </>
                                )}
                            </MapContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}