import React, { useState } from 'react';
import Select from 'react-select';
import * as Flags from 'country-flag-icons/react/3x2';
import { AsYouType, isValidPhoneNumber, getCountries, getCountryCallingCode, parsePhoneNumberWithError, getExampleNumber } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import styles from "../../styles/User_pages/contact.module.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function getCookie(name) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

const FlagIcon = ({ countryCode, size }) => {
    const Flag = Flags[countryCode];
    if (!Flag) return <span style={{ fontSize: size }}>{countryCode}</span>;
    return <Flag style={{ width: size, height: 'auto', display: 'block' }} />;
};

const COUNTRY_OPTIONS = getCountries().map(code => {
    try {
        const dialCode = getCountryCallingCode(code);
        return {
            value: code,
            label: `${code} (+${dialCode})`,
            dialCode: `+${dialCode}`
        };
    } catch (error) {
        return null;
    }
}).filter(Boolean);

const ContactPage = () => {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        complaint_message: ''
    });

    // Default pe Statele Unite sau România, cum preferi
    const [selectedCountry, setSelectedCountry] = useState(
        COUNTRY_OPTIONS.find(c => c.value === 'RO') || COUNTRY_OPTIONS[0]
    );
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [phoneError, setPhoneError] = useState('');

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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        const formatter = new AsYouType(selectedCountry.value);
        const formatted = formatter.input(e.target.value);
        setFormData((prev) => ({ ...prev, phone_number: formatted }));
        if (formatted && !isValidPhoneNumber(formatted, selectedCountry.value)) {
            setPhoneError(`Invalid number for ${selectedCountry.value}`);
        } else {
            setPhoneError('');
        }
    };

    const handleCountryChange = (selectedOption) => {
        setSelectedCountry(selectedOption);
        setFormData((prev) => ({ ...prev, phone_number: '' }));
        setPhoneError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus({ type: '', message: '' });

        // Validare număr de telefon
        if (formData.phone_number) {
            if (!isValidPhoneNumber(formData.phone_number, selectedCountry.value)) {
                setStatus({ type: 'error', message: `The phone number entered is not valid for ${selectedCountry.value}.` });
                setIsSubmitting(false);
                return;
            }
        }

        if (formData.complaint_message.length > 500) {
            setStatus({ type: 'error', message: 'The message must be at most 500 characters.' });
            setIsSubmitting(false);
            return;
        }

        try {
            let finalPhoneNumber = '';
            if (formData.phone_number) {
                finalPhoneNumber = parsePhoneNumberWithError(formData.phone_number, selectedCountry.value).format('E.164');
            }

            const payload = {
                ...formData,
                phone_number: finalPhoneNumber
            };

            const response = await fetch('http://localhost:8000/accounts/contact/create/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                setStatus({ type: 'error', message: data.error || 'An error occurred.' });
            } else {
                setStatus({ type: 'success', message: 'Your message has been sent successfully!' });
                setFormData({ first_name: '', last_name: '', email: '', phone_number: '', complaint_message: '' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Network error. Please try again later.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Stilizare custom pentru react-select ca să se potrivească cu designul tău
    const customSelectStyles = {
        control: (provided) => ({
            ...provided,
            border: 'none',
            boxShadow: 'none',
            backgroundColor: '#f9fafb',
            minHeight: '100%',
            cursor: 'pointer',
            borderRight: '1px solid #d0d5dd',
            borderRadius: '8px 0 0 8px',
            width: '110px'
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 8px',
            justifyContent: 'center'
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            padding: '4px'
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        menu: (provided) => ({
            ...provided,
            width: '250px',
        }),
        menuPortal: (provided) => ({
            ...provided,
            zIndex: 9999,
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#f2f4f7' : 'white',
            color: '#101828',
            cursor: 'pointer'
        })
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.navbarAdjust}>
                <Navbar />
            </div>
            <div className={styles.pageContainer}>
                <div className={styles.card}>
                    {/* Left Side: Form */}
                    <div className={styles.leftPanel}>
                        <div className={styles.header}>
                            <h1>Chat to our team</h1>
                            <p>Need help with something? Get in touch with our friendly team and we'll get in touch within 2 days.</p>
                        </div>

                        {status.message && (
                            <div className={`${styles.alert} ${status.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
                                {status.message}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label>First name</label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        required
                                        placeholder="Lucian..."
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Last name</label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        required
                                        placeholder="Covaliuc..."
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="luciancovaliuc@gmail.com"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Phone number</label>
                                <div className={`${styles.phoneInput} ${phoneError ? styles.phoneInputError : ''}`}>
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
                                    <span className={styles.dialCodePreview}>{selectedCountry.dialCode}</span>
                                    <input
                                        type="tel"
                                        name="phone_number"
                                        placeholder={getPhonePlaceholder(selectedCountry.value)}
                                        value={formData.phone_number}
                                        onChange={handlePhoneChange}
                                    />
                                </div>
                                {phoneError && <span className={styles.phoneError}>{phoneError}</span>}
                            </div>

                            <div className={styles.inputGroup}>
                                <label>How can we help? (Max 500 chars)</label>
                                <textarea
                                    name="complaint_message"
                                    rows="4"
                                    value={formData.complaint_message}
                                    onChange={handleChange}
                                    required
                                    maxLength={500}
                                    placeholder="Tell us about your issue or complaint..."
                                ></textarea>
                                <span className={styles.charCount}>{formData.complaint_message.length}/500</span>
                            </div>

                            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                {isSubmitting ? 'Sending...' : 'Get in touch'}
                            </button>
                        </form>
                    </div>

                    {/* Right Side: Image Placeholder & Testimonial */}
                    <div className={styles.rightPanel}>
                        <div className={styles.imageOverlay}>
                            <div className={styles.logoTop}>
                                <span>✻ Untitled UI</span>
                            </div>

                            <div className={styles.testimonialWrapper}>
                                <p className={styles.testimonialText}>
                                    Untitled's software helps us manage cash flow, financial reporting and payroll with ease. It's a great solution for startups looking for an efficient way to manage their finances all-in-one.
                                </p>
                                <div className={styles.testimonialAuthor}>
                                    <div>
                                        <strong>Maya Rothwell</strong>
                                        <span>Founder & CEO</span>
                                    </div>
                                    <div className={styles.companyLogo}>
                                        ◯ Open Ventures
                                    </div>
                                </div>
                            </div>
                        </div>
                        <img
                            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop"
                            alt="Team member placeholder"
                            className={styles.backgroundImage}
                        />
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ContactPage;