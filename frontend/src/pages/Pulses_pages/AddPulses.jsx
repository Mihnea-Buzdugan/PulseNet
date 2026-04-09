import React, { useState, useRef } from "react";
import Select from 'react-select';
import * as Flags from 'country-flag-icons/react/3x2';
import { AsYouType, isValidPhoneNumber, getCountries, getCountryCallingCode, parsePhoneNumberWithError, getExampleNumber } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import styles from '../../styles/Pulses_pages/addpulses.module.css';
import Navbar from "../../components/Navbar";
import {Link} from "react-router-dom";
import Footer from "@/components/Footer";
import {X} from "lucide-react";

const FlagIcon = ({ countryCode, size }) => {
    const Flag = Flags[countryCode];
    if (!Flag) return <span style={{ fontSize: size }}>{countryCode}</span>;
    return <Flag style={{ width: size, height: 'auto', display: 'block' }} />;
};

const COUNTRY_OPTIONS = getCountries().map(code => {
    try {
        const dialCode = getCountryCallingCode(code);
        return { value: code, label: `${code} (+${dialCode})`, dialCode: `+${dialCode}` };
    } catch { return null; }
}).filter(Boolean);

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
    const [selectedCountry, setSelectedCountry] = useState(
        COUNTRY_OPTIONS.find(c => c.value === 'RO') || COUNTRY_OPTIONS[0]
    );
    const [phoneError, setPhoneError] = useState("");
    const [imagesPreview, setImagesPreview] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef(null);

    const getPhonePlaceholder = (countryCode) => {
        try {
            const example = getExampleNumber(countryCode, examples);
            if (!example) return '';
            const intl = example.formatInternational();
            const dialCode = `+${example.countryCallingCode}`;
            return intl.replace(dialCode, '').trim();
        } catch {
            return '';
        }
    };

    const handlePhoneChange = (e) => {
        const formatted = new AsYouType(selectedCountry.value).input(e.target.value);
        setPhone(formatted);
        if (formatted && !isValidPhoneNumber(formatted, selectedCountry.value)) {
            setPhoneError(`Invalid number for ${selectedCountry.value}`);
        } else {
            setPhoneError('');
        }
    };

    const handleCountryChange = (option) => {
        setSelectedCountry(option);
        setPhone('');
        setPhoneError('');
    };

    const customSelectStyles = {
        control: (provided) => ({
            ...provided,
            border: 'none',
            boxShadow: 'none',
            backgroundColor: '#f2f4f5',
            minHeight: '100%',
            cursor: 'pointer',
            borderRight: '2px solid #e0e2e3',
            borderRadius: '4px 0 0 4px',
            width: '110px',
        }),
        valueContainer: (provided) => ({ ...provided, padding: '0 8px', justifyContent: 'center' }),
        dropdownIndicator: (provided) => ({ ...provided, padding: '4px' }),
        indicatorSeparator: () => ({ display: 'none' }),
        menu: (provided) => ({ ...provided, width: '250px' }),
        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#f2f4f7' : 'white',
            color: '#002f34',
            cursor: 'pointer',
        }),
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (selectedFiles.length + files.length > 7) {
            alert("Poți adăuga maxim 7 imagini.");

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

    const getAutomaticLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator || !navigator.geolocation) {
                reject(new Error("Your browser does not support Geolocation."));
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

                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    };

    const addPulse = async () => {

        if (!title.trim() || !description.trim() || !phone.trim()) {
            alert("Please fill in all required fields (*)");
            return;
        }

        if (!isValidPhoneNumber(phone, selectedCountry.value)) {
            alert(`The phone number entered is not valid for ${selectedCountry.value}.`);
            return;
        }

        setIsGettingLocation(true);
        let location;
        try {
            location = await getAutomaticLocation();
        } catch (err) {
            console.error("Error getting location:", err);
            alert("Could not get your location. You must allow location access to publish the listing.");
            setIsGettingLocation(false);
            return;
        } finally {
            setIsGettingLocation(false);
        }


        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("description", description.trim());
            formData.append("pulse_type", pulseType);
            formData.append("price", price || 0);
            formData.append("currencyType", currencyType);
            const e164Phone = parsePhoneNumberWithError(phone, selectedCountry.value).format('E.164');
            formData.append("phone_number", e164Phone);
            formData.append("is_available", "true");

            formData.append("lat", location.lat);
            formData.append("lng", location.lng);


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

                setTitle("");
                setPrice("");
                setDescription("");
                setPhone("");

                imagesPreview.forEach((url) => {
                    try {
                        URL.revokeObjectURL(url);
                    } catch (e) {}
                });
                setImagesPreview([]);
                setSelectedFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = null;

                alert("Listing published successfully!");
            } else {

                let errorData = null;
                try {
                    errorData = await response.json();
                } catch (e) {
                    console.error("Could not parse error response as JSON.", e);
                }
                console.error("Server error:", errorData || response.statusText);
                alert(errorData?.error || "A server error occurred. Check the console for details.");
            }
        } catch (error) {
            console.error("Error adding pulse:", error);
            alert("An error occurred. Check the console for details.");
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
                <h1 className={styles["anunt-header"]}>Post a listing</h1>
                <Link to="/create-request" className="mb-5 text-[#3B82A6] underline hover:text-[#2F6B87]  cursor-pointer ">Have an urgent request?</Link>
                </div>


                <section className={styles["form-section"]}>
                    <h3 className={styles["section-title"]}>Add as many details as possible!</h3>

                    <div className={styles["form-group"]}>
                        <label className={styles["label-text"]}>Title *</label>
                        <input
                            type="text"
                            placeholder="e.g. Samsung S26"
                            className={styles["input-field"]}
                            maxLength={70}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <p className={styles["counter-text"]}>{title.length}/70</p>
                    </div>

                    <div className={styles["row-group"]}>
                        <div className={styles["form-group-half"]}>
                            <label className={styles["label-text"]}>Category *</label>
                            <select
                                className={styles["select-field"]}
                                value={pulseType}
                                onChange={(e) => setPulseType(e.target.value)}
                            >
                                <option value="servicii">Services / Events</option>
                                <option value="obiecte">Objects / Products</option>
                            </select>
                        </div>

                        <div className={styles["price-row-wrapper"]}>
                            <label className={styles["label-text"]}>Price *</label>
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

                <section className={styles["form-section"]}>
                    <h3 className={styles["section-title"]}>Images</h3>
                    <p className={styles["helper-text"]}>
                        The first image will be the main one. You can add up to 7 images.
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
                            <span>Add images</span>
                        </label>


                        {imagesPreview.map((img, idx) => (
                            <div
                                key={idx}
                                className={styles.imagePreviewBox}
                                style={{
                                    backgroundImage: `url(${img})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
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


                        {[...Array(Math.max(0, 7 - imagesPreview.length))].map((_, i) => (
                            <div key={i} className={styles["image-slot"]}>
                <span role="img" aria-label="camera">
                  📷
                </span>
                            </div>
                        ))}
                    </div>
                </section>


                <section className={styles["form-section"]}>
                    <div className={styles["form-group"]}>
                        <label className={styles["label-text"]}>Description *</label>
                        <textarea
                            placeholder="Try to write what you would want to know if you were looking at this listing"
                            className={styles["textarea-field"]}
                            rows={6}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <p className={styles["helper-text"]}>Enter at least 40 characters</p>
                            <p className={styles["counter-text"]}>{description.length}/9000</p>
                        </div>
                    </div>
                </section>


                <section className={styles["form-section"]}>
                    <h3 className={styles["section-title"]}>Contact details</h3>
                    <div className={styles["contact-submit-row"]}>
                        <div className={styles["form-group"]} style={{ flex: 1, marginBottom: 0, position: 'relative' }}>
                            <label className={styles["label-text"]}>Phone number *</label>
                            <div className={`${styles["phoneInput"]} ${phoneError ? styles["phoneInputError"] : ''}`}>
                                <Select
                                    options={COUNTRY_OPTIONS}
                                    value={selectedCountry}
                                    onChange={handleCountryChange}
                                    styles={customSelectStyles}
                                    isSearchable={true}
                                    placeholder="🌐"
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    formatOptionLabel={(option, { context }) =>
                                        context === 'menu' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <FlagIcon countryCode={option.value} size={20} />
                                                <span>{option.value} ({option.dialCode})</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <FlagIcon countryCode={option.value} size={22} />
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{option.value}</span>
                                            </div>
                                        )
                                    }
                                />
                                <span className={styles["dialCodePreview"]}>{selectedCountry.dialCode}</span>
                                <input
                                    type="tel"
                                    placeholder={getPhonePlaceholder(selectedCountry.value)}
                                    value={phone}
                                    onChange={handlePhoneChange}
                                />
                            </div>
                            {phoneError && <span className={styles["phoneError"]}>{phoneError}</span>}
                        </div>

                        <button
                            type="button"
                            className={styles["submit-button"]}
                            onClick={addPulse}
                            disabled={isGettingLocation || isSubmitting}
                            style={{
                                backgroundColor: isGettingLocation || isSubmitting ? "#4CAF6A" : "#3E8F57",
                                cursor: isGettingLocation || isSubmitting ? "not-allowed" : "pointer",
                            }}
                        >
                            {isGettingLocation ? "Processing..." : isSubmitting ? "Submitting..." : "Publish listing"}
                        </button>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    );
}

export default AddPulses;