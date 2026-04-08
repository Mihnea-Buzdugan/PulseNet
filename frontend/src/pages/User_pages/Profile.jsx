import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "../../components/Navbar";
import styles from "../../styles/User_pages/profile.module.css";
import Loading from "../../components/Loading";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {AnimatePresence, motion} from "framer-motion";
import {
    X,
    Plus,
    SquarePen,
    Shield,
    Phone,
    Pencil,
    CalendarDays,
    DollarSign,
    Boxes,
    BriefcaseBusiness,
    Handshake,
    Repeat, Undo, Save,
    Star, AlertCircle, MapPin, Truck, Wrench, Sparkles, Monitor, Package, Dog, Hammer, Leaf, Zap, MoreHorizontal
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


function ChangeView({ center, radiusKm }) {
    const map = useMap();
    useEffect(() => {
        const radiusM = (radiusKm || 1) * 1000;
        const lat = center[0];
        const lng = center[1];
        const latDelta = radiusM / 111320;
        const lngDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
        map.fitBounds(
            [
                [lat - latDelta, lng - lngDelta],
                [lat + latDelta, lng + lngDelta],
            ],
            { padding: [30, 30] }
        );
    }, [center, radiusKm]);
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
const btnMotion = {
    whileHover: {scale: 1.05},
    whileTap: {scale: 0.95},
    transition: {duration: 0.15}
}

const formatTimeForInput = (timeString) => {
    if (!timeString) return "";
    return timeString.length >= 5 ? timeString.substring(0, 5) : timeString;
};

const formatDate = (dateString) => {
    try {
        const d = new Date(dateString);
        return d.toLocaleString("ro-RO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return dateString;
    }
};

const formatCurrency = (value, currency = "lei") => {
    if (value == null) return "";
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${currency}`;
};

export default function Profile() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const navigate = useNavigate();

    const [pulseFilter, setPulseFilter] = useState("obiecte");
    const [reqIndex, setReqIndex] = useState(0);

    const [imagesPreview, setImagesPreview] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const pulseFileInputRef = useRef(null);
    const requestFileInputRef = useRef(null);
    const [removedImages, setRemovedImages] = useState([]);

    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const lastObjectUrlRef = useRef(null);
    const previousProfileUrlRef = useRef(null);
    const [editForm, setEditForm] = useState({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        biography: "",
        online_status: "offline",
        quiet_hours_start: "",
        quiet_hours_end: "",
        visibility_radius: 1,
        lat: null,
        lng: null,
        skills: [],
        is_private: true,
    });

    const [deletePulseModal, setDeletePulseModal] = useState({
        show: false,
        id: null,
    });

    const [deleteRequestModal, setDeleteRequestModal] = useState({
        show: false,
        id: null,
    });

    const [activeTab, setActiveTab] = useState("pulses");
    const [editingPulse, setEditingPulse] = useState(null);
    const [editingRequest, setEditingRequest] = useState(null);

    const [pulseEditForm, setPulseEditForm] = useState({
        title: "",
        category: "",
        price: "",
        currencyType: "RON",
        description: "",
        phone_number: "",
    });

    const [requestEditForm, setRequestEditForm] = useState({
        title: "",
        category: "",
        price: "",
        currencyType: "RON",
        description: "",
    });

    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);


    const [rentalOffers, setRentalOffers] = useState([]);
    const [offersLoading, setOffersLoading] = useState(true);

    const [rentalProposals, setRentalProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(true);

    const [signalModalOpen, setSignalModalOpen] = useState(false);
    const [selectedRental, setSelectedRental] = useState(null);
    const [signalMessage, setSignalMessage] = useState("");

    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
    const [feedbackItem, setFeedbackItem] = useState(null);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackHover, setFeedbackHover] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState("");


    const [receivedRequestOffers, setReceivedRequestOffers] = useState([]);
    const [receivedOffersLoading, setReceivedOffersLoading] = useState(true);


    const [sentRequestOffers, setSentRequestOffers] = useState([]);
    const [sentOffersLoading, setSentOffersLoading] = useState(true);

    const [counterModal, setCounterModal] = useState({
        show: false,
        id: null,
        price: "",
    });

    const [deleteProposalModal, setDeleteProposalModal] = useState({
        show: false,
        id: null,
    });



    const [acceptModal, setAcceptModal] = useState({ show: false, id: null });
    const [declineModal, setDeclineModal] = useState({ show: false, id: null });

    const [counterOfferModal, setCounterOfferModal] = useState({
        show: false,
        id: null,
        price: "",
    });

    const [deleteOfferModal, setDeleteOfferModal] = useState({
        show: false,
        id: null,
    });




    const [acceptOfferModal, setAcceptOfferModal] = useState({ show: false, id: null });
    const [declineOfferModal, setDeclineOfferModal] = useState({ show: false, id: null });

    const [verifiedModal, setVerifiedModal] = useState(false);

    const openDeleteModal = (proposal) => {
        setDeleteProposalModal({ show: true, id: proposal.id });
    };

    const closeDeleteModal = () => {
        setDeleteProposalModal({ show: false, id: null });
    };

    function openSignalProblemModal(rental) {
        setSelectedRental(rental);
        setSignalMessage("");
        setSignalModalOpen(true);
    }

    const openFeedbackModal = (item) => {
        setFeedbackItem(item);
        setFeedbackRating(0);
        setFeedbackHover(0);
        setFeedbackComment("");
        setFeedbackModalOpen(true);
    };

    const closeFeedbackModal = () => {
        setFeedbackItem(null);
        setFeedbackRating(0);
        setFeedbackHover(0);
        setFeedbackComment("");
        setFeedbackModalOpen(false);
    };

    const submitFeedback = async () => {
        if (!feedbackItem) return;

        const payload = {
            rating: parseInt(feedbackRating, 10),
            comment: feedbackComment,
        };

        try {
            let endpoint = "";

            if (feedbackItem.pulse_title) {

                endpoint = `http://localhost:8000/accounts/pulse_rental_feedback/${feedbackItem.id}/`;
            } else if (feedbackItem.request_title) {

                endpoint = `http://localhost:8000/accounts/request_rental_feedback/${feedbackItem.id}/`;
            } else {
                console.warn("Unknown feedback item type:", feedbackItem);
                return;
            }
            const csrfToken = getCookie("csrftoken");
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Feedback submission failed:", errorData);
                alert("Failed to submit feedback.");
                return;
            }

            const data = await response.json();
            console.log("Feedback submitted:", data);

            closeFeedbackModal();
        } catch (err) {
            console.error("Error submitting feedback:", err);
            alert("An error occurred while submitting feedback.");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = e.target.value.trim();

            if (!value) return;
            if (value.length > 20) {
                alert("20 characters at most");
                return;
            }

            const exists = editForm.skills?.some(s => s.toLowerCase() === value.toLowerCase());

            if (!exists) {
                setEditForm(prev => ({
                    ...prev,
                    skills: [...(prev.skills || []), value]
                }));
                e.target.value = '';
            } else {
                alert("You have added this skill already!");
            }
        }
    };

    const removeSkill = (skillToRemove) => {
        setEditForm(prev => ({
            ...prev,
            skills: prev.skills.filter(skill => skill !== skillToRemove)
        }));
    };

    useEffect(() => {
        const csrfToken = getCookie("csrftoken");
        fetch("http://localhost:8000/accounts/profile/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            credentials: "include",
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.user) {
                    setUser(data.user);
                    setPreview(data.user.profilePicture || null);
                    setEditForm((prev) => ({
                        ...prev,
                        skills: data.user.skills || [],
                        ...(data.user.location?.coordinates && {
                            lng: data.user.location.coordinates[0],
                            lat: data.user.location.coordinates[1],
                        }),
                    }));
                }
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching profile:", error);
                setLoading(false);
            });
    }, []);


    useEffect(() => {
        const fetchData = async () => {
            setOffersLoading(true);
            setProposalsLoading(true);

            try {

                const offersRes = await fetch("http://localhost:8000/accounts/pulse_rentals/", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                });

                if (offersRes.ok) {
                    const offersData = await offersRes.json();
                    setRentalOffers(Array.isArray(offersData) ? offersData : offersData.rentals || []);
                } else {
                    console.warn("Failed to fetch rental offers:", offersRes.status);
                }


                const proposalsRes = await fetch("http://localhost:8000/accounts/pulse_own_proposals/", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                });

                if (proposalsRes.ok) {
                    const proposalsData = await proposalsRes.json();
                    setRentalProposals(proposalsData);
                } else {
                    console.warn("Failed to fetch rental proposals:", proposalsRes.status);
                }
            } catch (err) {
                console.error("Network error fetching rental data:", err);
            } finally {
                setOffersLoading(false);
                setProposalsLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const fetchOffers = async () => {
            try {

                const resReceived = await fetch("http://localhost:8000/accounts/request-offers/received/", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },});
                const dataReceived = await resReceived.json();
                setReceivedRequestOffers(dataReceived);


                const resSent = await fetch("http://localhost:8000/accounts/own-request-offers/", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },});
                const dataSent = await resSent.json();
                setSentRequestOffers(dataSent);
            } catch (err) {
                console.error("Error fetching request offers:", err);
            } finally {
                setReceivedOffersLoading(false);
                setSentOffersLoading(false);
            }
        };
        fetchOffers();
    }, []);

    const isUserSleeping = () => {
        if (!user?.quiet_hours_start || !user?.quiet_hours_end) return false;
        const now = new Date();
        const [startHour, startMinute] = user.quiet_hours_start.split(":").map(Number);
        const [endHour, endMinute] = user.quiet_hours_end.split(":").map(Number);
        const start = new Date();
        start.setHours(startHour, startMinute, 0);
        const end = new Date();
        end.setHours(endHour, endMinute, 0);
        if (end < start) {
            if (now >= start) return true;
            if (now <= end || now >= start) return true;
        }
        return now >= start && now <= end;
    };

    useEffect(() => {
        return () => {
            if (lastObjectUrlRef.current) {
                URL.revokeObjectURL(lastObjectUrlRef.current);
                lastObjectUrlRef.current = null;
            }
        };
    }, []);

    const filteredPulses = useMemo(() => {
        if (!user || !user.pulses) return [];
        return user.pulses.filter((p) => p.pulseType === pulseFilter);
    }, [user, pulseFilter]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const csrfToken = getCookie("csrftoken");
        try {
            const response = await fetch("http://localhost:8000/accounts/update_profile/", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify({
                    ...editForm,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                setEditForm((prev) => ({ ...prev, skills: data.user.skills || [] }));
                setEditMode(false);
            } else {
                const errorData = await response.json();
                console.error("Failed to update profile:", errorData);
                alert("Error updating profile. Please try again.");
            }
        } catch (error) {
            console.error("Network error while saving profile:", error);
        }
    };

    const openFilePicker = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            e.target.value = "";
            return;
        }
        const maxMB = 20;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`Please choose an image smaller than ${maxMB} MB.`);
            e.target.value = "";
            return;
        }
        if (lastObjectUrlRef.current) {
            URL.revokeObjectURL(lastObjectUrlRef.current);
            lastObjectUrlRef.current = null;
        }
        const objectUrl = URL.createObjectURL(file);
        lastObjectUrlRef.current = objectUrl;
        previousProfileUrlRef.current = user?.profilePicture || preview || null;
        setPreview(objectUrl);
        setUser((prev) => (prev ? { ...prev, profilePicture: objectUrl } : prev));

        const uploadUrl = "http://localhost:8000/accounts/upload_profile_picture/";
        const csrfToken = getCookie("csrftoken");
        const form = new FormData();
        form.append("profile_picture", file);
        setUploading(true);
        try {
            const res = await fetch(uploadUrl, {
                method: "POST",
                body: form,
                credentials: "include",
                headers: { "X-CSRFToken": csrfToken },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    setUser(data.user);
                    setPreview(data.user.profilePicture || null);
                } else if (data.url) {
                    setUser((prev) => (prev ? { ...prev, profilePicture: data.url } : prev));
                    setPreview(data.url);
                } else {
                    console.warn("Upload response did not include user or url:", data);
                }
            } else {
                alert("Failed to upload image. Please try again.");
                const prevUrl = previousProfileUrlRef.current;
                setPreview(prevUrl);
                setUser((prev) => (prev ? { ...prev, profilePicture: prevUrl } : prev));
            }
        } catch (uploadError) {
            console.error("Network error during upload:", uploadError);
            alert("Network error while uploading. Please try again.");
            const prevUrl = previousProfileUrlRef.current;
            setPreview(prevUrl);
            setUser((prev) => (prev ? { ...prev, profilePicture: prevUrl } : prev));
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleDeleteProfilePicture = async () => {
        try {
            const response = await fetch("http://localhost:8000/accounts/delete_profile_picture/", {
                method: "POST",
                credentials: "include",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            });
            if (!response.ok) throw new Error("Failed to delete profile picture");
            setUser((prev) => ({ ...prev, profilePicture: null }));
            setPreview(null);
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting profile picture:", error);
            alert("Failed to delete profile picture.");
        }
    };

    function handlePulseImageChange(e) {
        const files = Array.from(e.target.files);
        setNewImages((prev) => [...prev, ...files]);


        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setImagesPreview((prev) => [...prev, ...newPreviews]);
    }


    function removePulseImageAt(idx) {
        const removed = imagesPreview[idx];


        if (typeof removed === "string") {
            setRemovedImages((prev) => [...prev, removed]);
        }

        setImagesPreview((prev) => prev.filter((_, i) => i !== idx));
    }

    function handleRequestImageChange(e) {
        const files = Array.from(e.target.files);
        setNewImages((prev) => [...prev, ...files]);


        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setImagesPreview((prev) => [...prev, ...newPreviews]);
    }


    function removeRequestImageAt(idx) {
        const removed = imagesPreview[idx];


        if (typeof removed === "string") {
            setRemovedImages((prev) => [...prev, removed]);
        }

        setImagesPreview((prev) => prev.filter((_, i) => i !== idx));
    }

    function handleEditChange(e) {
        const { name, value } = e.target;
        setPulseEditForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleEditPulse(pulse) {
        setEditingPulse(pulse);
        setPulseEditForm({
            title: pulse.title || "",
            category: pulse.category || "",
            price: pulse.price ?? "",
            currencyType: pulse.currencyType || "RON",
            description: pulse.description || "",
            phone_number: pulse.phone_number || "",
        });
        setImagesPreview(pulse.images || []);
        setNewImages([]);
        setEditLoading(false);
        setEditError(null);
    }

    function handleEditRequest(request) {
        setEditingRequest(request);
        setRequestEditForm({
            title: request.title || "",
            category: request.category || "",
            price: request.price ?? "",
            currencyType: request.currencyType || "RON",
            description: request.description || "",
        });
        setImagesPreview(request.images || []);
        setNewImages([]);
        setEditLoading(false);
        setEditError(null);
    }

    async function handleSaveEdit(e) {
        e.preventDefault();
        setEditLoading(true);
        setEditError(null);

        try {
            const formData = new FormData();
            Object.entries(pulseEditForm).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value);
                }
            });

            removedImages.forEach((img) => formData.append("removed_images", img));

            newImages.forEach((file) => formData.append("images", file));

            const res = await fetch(
                `http://localhost:8000/accounts/update_pulse/${editingPulse.id}/`,
                {
                    method: "POST",
                    headers: { "X-CSRFToken": getCookie("csrftoken") },
                    credentials: "include",
                    body: formData,
                }
            );

            const data = await res.json();
            if (!res.ok) {
                setEditError(data.error || "Eroare la salvare");
                setEditLoading(false);
                return;
            }

            setUser((prev) => ({
                ...prev,
                pulses: prev.pulses.map((p) =>
                    p.id === data.pulse.id ? data.pulse : p
                ),
            }));

            setEditingPulse(null);
            setImagesPreview([]);
            setNewImages([]);
            setEditLoading(false);
        } catch (err) {
            setEditError(err.message || "Eroare de rețea");
            setEditLoading(false);
        }
    }

    async function handleSaveRequestEdit(e) {
        e.preventDefault();
        setEditLoading(true);
        setEditError(null);

        try {
            const formData = new FormData();
            Object.entries(requestEditForm).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, value);
                }
            });

            removedImages.forEach((img) => formData.append("removed_images", img));
            // Only append new images
            newImages.forEach((file) => formData.append("images", file));

            const res = await fetch(
                `http://localhost:8000/accounts/update_request/${editingRequest.id}/`,
                {
                    method: "POST",
                    headers: { "X-CSRFToken": getCookie("csrftoken") },
                    credentials: "include",
                    body: formData,
                }
            );

            const data = await res.json();
            if (!res.ok) {
                setEditError(data.error || "Eroare la salvare");
                setEditLoading(false);
                return;
            }

            setUser((prev) => ({
                ...prev,
                requests: prev.requests.map((p) =>
                    p.id === data.request.id ? data.request : p
                ),
            }));

            setEditingRequest(null);
            setImagesPreview([]);
            setNewImages([]);
            setEditLoading(false);
        } catch (err) {
            setEditError(err.message || "Eroare de rețea");
            setEditLoading(false);
        }
    }

    const becomeVerified = async (id) => {
        const res = await fetch(
            `http://localhost:8000/accounts/become_verified/`,
            {
                method: "PUT",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                credentials: "include",
            }
        );

        if (!res.ok) {
            alert("An error occurred. Please try again");
            return;
        }

        setVerifiedModal(true);
        setUser((prev) => ({ ...prev,  isVerified: true }));
    }

    const openDeletePulseModal = (id) => {
        setDeletePulseModal({ show: true, id });
    };

    const closeDeletePulseModal = () => {
        setDeletePulseModal({ show: false, id: null });
    };

    const handleDeletePulse = async () => {
        if (!deletePulseModal.id) return;

        try {
            const response = await fetch(
                `http://localhost:8000/accounts/remove_pulse/${deletePulseModal.id}/`,
                {
                    method: "DELETE",
                    headers: { "X-CSRFToken": getCookie("csrftoken") },
                    credentials: "include",
                }
            );

            if (response.ok) {
                setUser((prev) => ({
                    ...prev,
                    pulses: prev.pulses.filter((p) => p.id !== deletePulseModal.id),
                }));
                closeDeletePulseModal();
            } else {
                console.error("Failed to delete pulse");
            }
        } catch (error) {
            console.error("Error removing pulse:", error);
        }
    };

    // --- Rental Offers actions ---
    const updateOfferInState = (id, newValues) => {
        setRentalOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...newValues } : o)));
    };

    const updateProposalInState = (id, updatedFields) => {
        setRentalProposals((prevProposals) =>
            prevProposals.map((proposal) =>
                proposal.id === id ? { ...proposal, ...updatedFields } : proposal
            )
        );
    };

    const handleAcceptOffer = async (id) => {
        // decide which endpoint to call based on whether id is in rentalProposals
        const isProposal = rentalProposals.some((p) => p.id === id);
        const url = `http://localhost:8000/accounts/pulse_rentals/${id}/`;

        try {
            const res = await fetch(url, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ status: "confirmed" }),
            });
            if (res.ok) {
                const updated = await res.json();

                if (isProposal) {
                    updateProposalInState(id, { status: updated.status || "confirmed" });
                } else {
                    updateOfferInState(id, { status: updated.status || "confirmed" });
                }
            } else {
                alert("Eroare la acceptarea ofertei.");
            }
        } catch (err) {
            console.error("Network error while accepting offer:", err);
            alert("Eroare de rețea. Încearcă din nou.");
        } finally {
            setAcceptModal({ show: false, id: null });
        }
    };

    const handleDeclineOffer = async (id) => {
        
        const isProposal = rentalProposals.some((p) => p.id === id);
        const url = `http://localhost:8000/accounts/pulse_rentals/${id}/`;

        try {
            const res = await fetch(url, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ status: "declined" }),
            });
            if (res.ok) {
                const updated = await res.json();

                if (isProposal) {
                    updateProposalInState(id, { status: updated.status || "declined" });
                } else {
                    updateOfferInState(id, { status: updated.status || "declined" });
                }
            } else {
                alert("Error rejecting the offer.");
            }
        } catch (err) {
            alert("Network error while declining offer:");
        } finally {
            setDeclineModal({ show: false, id: null });
        }
    };

    async function submitSignalProblem() {
        if (!signalMessage.trim() || !selectedRental) return;

        try {
            const response = await fetch(
                "http://localhost:8000/accounts/signal_pulse_rental/", // your backend endpoint
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                    body: JSON.stringify({
                        rental_id: selectedRental.id,
                        message: signalMessage

                    }),
                }
            );

            const data = await response.json();

            if (data.success) {
                alert("Signal submitted successfully!");
                setSignalModalOpen(false);
            } else {
                alert("Error submitting signal: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Error submitting signal.");
        }
    }

    const handleDeleteProposal = async () => {
        const id = deleteProposalModal.id;
        if (!id) return;

        try {
            const response = await fetch(`http://localhost:8000/accounts/pulse_rentals/${id}/`, {
                method: "DELETE",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                credentials: "include",
            });

            if (response.ok) {
                setRentalProposals((prev) => prev.filter((p) => p.id !== id));
                closeDeleteModal();
            } else {
                alert("The proposal could not be canceled.");
            }
        } catch (err) {
            alert("Network error deleting proposal:");
        }
    };

    const openCounterModal = (offer) => {
        setCounterModal({
            show: true,
            id: offer.id,
            price: offer.total_price != null ? String(offer.total_price) : "",
        });
    };

    const closeCounterModal = () => {
        setCounterModal({ show: false, id: null, price: "" });
    };

    const handleCounterPriceChange = (e) => {
        setCounterModal((prev) => ({ ...prev, price: e.target.value }));
    };

    const handleSubmitCounter = async () => {
        const id = counterModal.id;
        const parsed = parseFloat(counterModal.price);
        if (Number.isNaN(parsed) || parsed < 0) {
            alert("Introduceți un preț valid.");
            return;
        }


        const isProposal = rentalProposals.some((p) => p.id === id);
        try {
            const res = await fetch(`http://localhost:8000/accounts/pulse_rentals/${id}/`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ total_price: parsed }),
            });
            if (res.ok) {
                const updated = await res.json();

                if (isProposal) {
                    updateProposalInState(id, {
                        total_price: updated.total_price != null ? updated.total_price : parsed,
                        status: updated.status || "pending",
                        last_offer_by: updated.last_offer_by
                    });
                } else {
                    updateOfferInState(id, {
                        total_price: updated.total_price != null ? updated.total_price : parsed,
                        status: updated.status || "pending",
                        last_offer_by: updated.last_offer_by
                    });
                }

                closeCounterModal();
            } else {
                alert("Error sending counteroffer.");
            }
        } catch (err) {
            alert("Network error sending counteroffer:");
        }
    };



    const openAcceptModal = (offer) => setAcceptModal({ show: true, id: offer.id });
    const closeAcceptModal = () => setAcceptModal({ show: false, id: null });
    const openAcceptOfferModal = (offer) => setAcceptOfferModal({ show: true, id: offer.id });
    const closeAcceptOfferModal = () => setAcceptOfferModal({ show: false, id: null });
    const openDeclineModal = (offer) => setDeclineModal({ show: true, id: offer.id });
    const closeDeclineModal = () => setDeclineModal({ show: false, id: null });
    const openDeclineOfferModal = (offer) => setDeclineOfferModal({ show: true, id: offer.id });
    const closeDeclineOfferModal = () => setDeclineOfferModal({ show: false, id: null });

    const openDeleteOfferModal = (proposal) => {
        setDeleteOfferModal({ show: true, id: proposal.id });
    };

    const closeDeleteOfferModal = () => {
        setDeleteOfferModal({ show: false, id: null });
    };


    const openCounterOfferModal = (offer) => {
        setCounterOfferModal({
            show: true,
            id: offer.id,
            price: offer.total_price != null ? String(offer.total_price) : "",
        });
    };

    const closeCounterOfferModal = () => {
        setCounterOfferModal({ show: false, id: null, price: "" });
    }

    const handleCounterOfferPriceChange = (e) => {
        setCounterOfferModal((prev) => ({ ...prev, price: e.target.value }));
    };

    const updateReceivedRequestOfferInState = (id, updatedFields) => {
        setReceivedRequestOffers(prev => prev.map(o => o.id === id ? { ...o, ...updatedFields } : o));
    };

    const updateSentRequestOfferInState = (id, updatedFields) => {
        setSentRequestOffers(prev => prev.map(o => o.id === id ? { ...o, ...updatedFields } : o));
    };

    const handleAcceptRequestOffer = async (id) => {
        const isSentByMe = sentRequestOffers.some((o) => o.id === id);

        const url = `http://localhost:8000/accounts/request-offers/${id}/`;

        try {
            const res = await fetch(url, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ status: "confirmed" }),
            });
            if (res.ok) {
                const updated = await res.json();
                if (isSentByMe) {
                    updateSentRequestOfferInState(id, { status: updated.status });
                } else {
                    updateReceivedRequestOfferInState(id, { status: updated.status });
                }
            } else {
                alert("Error accepting offer.");
            }
        } catch (err) {
            console.error("Network error:", err);
        } finally {
            setAcceptOfferModal({ show: false, id: null });
        }
    };


    const handleDeclineRequestOffer = async (id) => {
        const isSentByMe = sentRequestOffers.some((o) => o.id === id);
        const url = `http://localhost:8000/accounts/request-offers/${id}/`;

        try {
            const res = await fetch(url, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ status: "declined" }),
            });
            if (res.ok) {
                const updated = await res.json();
                if (isSentByMe) {
                    updateSentRequestOfferInState(id, { status: updated.status });
                } else {
                    updateReceivedRequestOfferInState(id, { status: updated.status });
                }
            }
        } catch (err) {
            console.error("Network error:", err);
        } finally {
            setDeclineOfferModal({ show: false, id: null });
        }
    };


    const handleSubmitRequestCounter = async () => {
        const { id, price } = counterOfferModal; // Reuses your existing counterModal state
        const parsed = parseFloat(price);

        if (Number.isNaN(parsed) || parsed <= 0) {
            alert("Enter a valid price.");
            return;
        }

        const isSentByMe = sentRequestOffers.some((o) => o.id === id);
        try {
            const res = await fetch(`http://localhost:8000/accounts/request-offers/${id}/`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ total_price: parsed }),
            });

            const data = await res.json();
            if (res.ok) {
                const updatePayload = {
                    total_price: data.total_price,
                    status: data.status,
                    last_offer_by: data.last_offer_by
                };

                if (isSentByMe) {
                    updateSentRequestOfferInState(id, updatePayload);
                } else {
                    updateReceivedRequestOfferInState(id, updatePayload);
                }
                closeCounterOfferModal();
            } else {

                alert(data.error || "Error sending counteroffer.");
            }
        } catch (err) {
            console.error("Network error:", err);
        }
    };


    const handleDeleteRequestOffer = async (id) => {
        try {
            const response = await fetch(`http://localhost:8000/accounts/request-offers/${id}/`, {
                method: "DELETE",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                credentials: "include",
            });

            if (response.ok) {
                setSentRequestOffers((prev) => prev.filter((o) => o.id !== id));
            } else {
                alert("Could not delete offer.");
            }
        } catch (err) {
            console.error("Network error:", err);
        } finally {
            setDeleteOfferModal({ show: false, id: null });
        }
    };

    const [currentIndex, setCurrentIndex] = useState(0);

    const itemsPerPage = 3;

    const handleFilterChange = (type) => {
        setPulseFilter(type);
        setCurrentIndex(0);
    };


    const filteredRequests = useMemo(() => {
        return user?.requests || [];
    }, [user]);


    const currentRequests = useMemo(() => {
        return filteredRequests.slice(reqIndex, reqIndex + itemsPerPage);
    }, [filteredRequests, reqIndex]);


    const handleReqNext = () => {
        if (reqIndex + itemsPerPage < filteredRequests.length) {
            setReqIndex(prev => prev + itemsPerPage);
        }
    };

    const handleReqPrev = () => {
        if (reqIndex - itemsPerPage >= 0) {
            setReqIndex(prev => prev - itemsPerPage);
        }
    };

    const currentPulses = filteredPulses.slice(currentIndex, currentIndex + itemsPerPage);


    const openDeleteRequestModal = (id) => {
        setDeleteRequestModal({ show: true, id });
    };

    const closeDeleteRequestModal = () => {
        setDeleteRequestModal({ show: false, id: null });
    };

    const handleDeleteRequest = async () => {
        if (!deleteRequestModal.id) return;

        try {
            const response = await fetch(
                `http://localhost:8000/accounts/remove_request/${deleteRequestModal.id}/`,
                {
                    method: "DELETE",
                    headers: { "X-CSRFToken": getCookie("csrftoken") },
                    credentials: "include",
                }
            );

            if (response.ok) {
                setUser((prev) => ({
                    ...prev,
                    requests: prev.requests.filter((p) => p.id !== deleteRequestModal.id),
                }));
                closeDeleteRequestModal();
            } else {
                console.error("Failed to delete request");
            }
        } catch (error) {
            console.error("Error removing request:", error);
        }
    };

    const handleNext = () => {
        if (currentIndex + itemsPerPage < filteredRequests.length) {
            setCurrentIndex(prev => prev + itemsPerPage);
        }
    };

    const handlePrev = () => {
        if (currentIndex - itemsPerPage >= 0) {
            setCurrentIndex(prev => prev - itemsPerPage);
        }
    };

    const [activeRentalTab, setActiveRentalTab] = useState('offers');

    const [rentalCurrentIndex, setRentalCurrentIndex] = useState(0);
    const rentalItemsPerPage = 2;

    const handleRentalFilterChange = (tab) => {
        setActiveRentalTab(tab);
        setRentalCurrentIndex(0);
    };

    const currentRentalData = activeRentalTab === 'offers' ? rentalOffers : rentalProposals;
    const currentRentalLoading = activeRentalTab === 'offers' ? offersLoading : proposalsLoading;
    const visibleRentals = currentRentalData.slice(rentalCurrentIndex, rentalCurrentIndex + rentalItemsPerPage);

    const handleRentalNext = () => {
        if (rentalCurrentIndex + rentalItemsPerPage < currentRentalData.length) {
            setRentalCurrentIndex(prev => prev + rentalItemsPerPage);
        }
    };

    const handleRentalPrev = () => {
        if (rentalCurrentIndex - rentalItemsPerPage >= 0) {
            setRentalCurrentIndex(prev => prev - rentalItemsPerPage);
        }
    };

    const [activeRequestTab, setActiveRequestTab] = useState('received');

    const [requestCurrentIndex, setRequestCurrentIndex] = useState(0);
    const requestItemsPerPage = 2;

    const handleRequestFilterChange = (tab) => {
        setActiveRequestTab(tab);
        setRequestCurrentIndex(0);
    };

    const currentRequestData = activeRequestTab === 'received' ? receivedRequestOffers : sentRequestOffers;
    const currentRequestLoading = activeRequestTab === 'received' ? receivedOffersLoading : sentOffersLoading;
    const visibleRequests = currentRequestData.slice(requestCurrentIndex, requestCurrentIndex + requestItemsPerPage);

    const handleRequestNext = () => {
        if (requestCurrentIndex + requestItemsPerPage < currentRequestData.length) {
            setRequestCurrentIndex(prev => prev + requestItemsPerPage);
        }
    };

    const handleRequestPrev = () => {
        if (requestCurrentIndex - requestItemsPerPage >= 0) {
            setRequestCurrentIndex(prev => prev - requestItemsPerPage);
        }
    };
    if (loading) return <Loading />;
    if (!user) return <div className={styles.error}>Could not load user data.</div>;

    return (
        <div className={styles.body}>
            <div className={styles.topGreenBar}></div>

            <div className={styles.mainContainer}>
                <div className={styles.navWrapper}>
                    <Navbar />
                </div>
                <div className={styles.container}>

                    <motion.div
                                className={styles.headerCard}
                                whileHover={{scale: 1.02}}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}>

                        <div className={styles.headerLayout}>
                            <div className={styles.avatarSection}>
                                <div className={styles.avatarWrapper}>
                                    <div
                                        className={styles.avatar}
                                        style={{
                                            backgroundImage: preview
                                                ? `url(${preview})`
                                                : user.profilePicture
                                                    ? `url(${user.profilePicture})`
                                                    : "url(/defaultImage.png)",
                                        }}
                                    />

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={handleFileChange}
                                    />

                                    <motion.button {...btnMotion}
                                        className={styles.editButton}
                                        title="Change Profile Picture"
                                        type="button"
                                        onClick={openFilePicker}
                                    >
                                        <Pencil color="green"/>
                                    </motion.button>

                                    {user.profilePicture && (
                                        <motion.button {...btnMotion}
                                            onClick={() => setShowDeleteModal(true)}
                                            className={styles.deleteButton}
                                            type="button"
                                            title="Delete Profile Picture"
                                        >
                                            <X/>
                                        </motion.button>
                                    )}
                                </div>

                                <div className={styles.resWrapperForButtonAndTag}>
                                    <div className={`${styles.trustBadge} ${styles["comments" + user.trustLevel]}`}>
                                        <span className={styles.trustIcon}><Shield size={16}/></span>
                                        <span className={styles.trustValue}>{user.trustLevel} • {user.trustScore} </span>
                                    </div>

                                    {!editMode && (
                                        <motion.button {...btnMotion}
                                            onClick={() => {
                                                setEditForm((prev) => ({
                                                    firstName: user.firstName || "",
                                                    lastName: user.lastName || "",
                                                    username: user.username || "",
                                                    email: user.email || "",
                                                    biography: user.biography || "",
                                                    online_status: user.online_status ?? user.onlineStatus ?? "offline",
                                                    quiet_hours_start: formatTimeForInput(user.quiet_hours_start ?? user.quietHoursStart),
                                                    quiet_hours_end: formatTimeForInput(user.quiet_hours_end ?? user.quietHoursEnd),
                                                    visibility_radius: user.visibility_radius || 1,
                                                    lat: user.location?.coordinates?.[1] ?? prev.lat,
                                                    lng: user.location?.coordinates?.[0] ?? prev.lng,
                                                    skills: user.skills || [],
                                                    is_private: user.is_private ?? true,
                                                }));
                                                setEditMode(true);
                                                navigator.geolocation?.getCurrentPosition((position) => {
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        lat: position.coords.latitude,
                                                        lng: position.coords.longitude,
                                                    }));
                                                });
                                            }}
                                            className={styles.editProfileBtn}
                                        >
                                            <SquarePen/>
                                            Edit Profile
                                        </motion.button>
                                    )}
                                </div>
                            </div>


                            <div className={styles.profileInfo}>
                                {editMode ? (
                                    <div className={styles.editForm}>

                                        <div className={styles.editGrid}>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>First Name</label>
                                                <input
                                                    name="firstName"
                                                    className={styles.editInput}
                                                    value={editForm.firstName}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Last Name</label>
                                                <input
                                                    name="lastName"
                                                    className={styles.editInput}
                                                    value={editForm.lastName}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Username</label>
                                                <input
                                                    name="username"
                                                    className={styles.editInput}
                                                    value={editForm.username}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Email</label>
                                                <input
                                                    name="email"
                                                    className={styles.editInput}
                                                    value={editForm.email}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Quiet Hours Start</label>
                                                <input
                                                    type="time"
                                                    name="quiet_hours_start"
                                                    className={styles.editInput}
                                                    value={editForm.quiet_hours_start}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Quiet Hours End</label>
                                                <input
                                                    type="time"
                                                    name="quiet_hours_end"
                                                    className={styles.editInput}
                                                    value={editForm.quiet_hours_end}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Biography</label>
                                            <textarea
                                                name="biography"
                                                className={styles.editTextarea}
                                                value={editForm.biography}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Online Status</label>
                                            <select
                                                name="online_status"
                                                className={styles.editInput}
                                                value={editForm.online_status}
                                                onChange={handleChange}
                                            >
                                                <option value="online">Online</option>
                                                <option value="away">Away</option>
                                                <option value="do_not_disturb">Do Not Disturb</option>
                                            </select>
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label className={styles.inputLabel}>Skills & Expertise</label>
                                            <input
                                                type="text"
                                                className={styles.editInput}
                                                placeholder="Adaugă un skill (ex: Lifting) și apasă Enter"
                                                onKeyDown={handleKeyDown}
                                                maxLength={20}
                                            />
                                            <div className={styles.tagsContainer}>
                                                {editForm.skills?.map((skill, index) => (
                                                    <span key={index} className={styles.tagWithDelete}>
                                                         {skill}
                                                        <motion.button {...btnMotion}
                                                            type="button"
                                                            onClick={() => removeSkill(skill)}
                                                        > <X color='red'/> </motion.button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <div className={styles.controlsRow}>


                                                <div className={styles.rangeSection}>
                                                    <div className={styles.labelWrapper}>
                                                        <label htmlFor="visibility-range" className={styles.inputLabel}>
                                                            Visibility Range
                                                        </label>
                                                        <span className={styles.rangeValue}>{editForm.visibility_radius} km</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        id="visibility-range"
                                                        min="1"
                                                        max="10"
                                                        step="1"
                                                        value={editForm.visibility_radius}
                                                        className={styles.rangeInput}
                                                        onChange={(e) =>
                                                            setEditForm((prev) => ({
                                                                ...prev,
                                                                visibility_radius: Number(e.target.value),
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div className={styles.checkboxSection}>
                                                    <input
                                                        type="checkbox"
                                                        id="private-profile"
                                                        className={styles.checkboxInput}
                                                        checked={editForm.is_private}
                                                        onChange={(e) =>
                                                            setEditForm((prev) => ({
                                                                ...prev,
                                                                is_private: e.target.checked,
                                                            }))
                                                        }
                                                    />
                                                    <label htmlFor="private-profile" className={styles.checkboxLabel}>
                                                        Private Profile
                                                    </label>
                                                </div>

                                            </div>
                                            <div className={styles.mapContainer}>
                                                <MapContainer
                                                    center={editForm.lat && editForm.lng ? [editForm.lat, editForm.lng] : [44.4268, 26.1025]}
                                                    zoom={13}
                                                    style={{ height: "100%", width: "100%" }}
                                                >
                                                    <TileLayer
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                    />

                                                    {editForm.lat && editForm.lng && (
                                                        <ChangeView center={[editForm.lat, editForm.lng]} radiusKm={editForm.visibility_radius} />
                                                    )}

                                                    {editForm.lat && editForm.lng && (
                                                        <>
                                                            <Marker position={[editForm.lat, editForm.lng]} />
                                                            <Circle
                                                                center={[editForm.lat, editForm.lng]}
                                                                radius={editForm.visibility_radius * 1000}
                                                                pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }}
                                                            />
                                                        </>
                                                    )}
                                                </MapContainer>
                                            </div>
                                        </div>
                                        <div className={styles.editActions}>

                                            <motion.button {...btnMotion} onClick={() => setEditMode(false)} className={styles.cancelButton}>
                                                Cancel
                                            </motion.button>

                                            <motion.button {...btnMotion} onClick={handleSave} className={styles.saveButton}>
                                                <Save className='mr-1 mb-1'/> Save
                                            </motion.button>

                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.infoContent}>
                                        <div className={styles.titleRow}>
                                            <h1 className={styles.title}>
                                                {user.firstName} {user.lastName}
                                            </h1>
                                            {user.isVerified && <span className={styles.verified}>✓ Verified neighbour</span>}
                                            {!user.isVerified && user.totalPosts > 15 &&
                                                user.trustScore > 200 &&
                                                ((new Date() - new Date(user.date_joined)) / (1000 * 60 * 60 * 24 * 30) >= 3) && (
                                                    <motion.button {...btnMotion} className={styles.askVerified} onClick={() => becomeVerified(user.id)}>Become a verified neighbour</motion.button>
                                                )}
                                        </div>

                                        <p className={styles.username}>
                                            @{user.username} • {user.email}
                                        </p>

                                        <p className={styles.biography}>{user.biography}</p>

                                        <div className={styles.publicTagsContainer}>
                                            {user?.skills?.map((skill, index) => (
                                                <span key={index} className={styles.publicTag}>
                                                    {skill}
                                                 </span>
                                            ))}
                                        </div>


                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>


                    <motion.div className={styles.contentArea}>
                        <motion.div
                            className={styles.card}
                            whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className={styles.pulsesContainer}>
                                <div className={styles.categoryFilterButtonsRow}>
                                    <motion.button
                                        {...btnMotion}
                                        className={`${styles.filterBtn} ${activeTab === "pulses" ? styles.activeFilter : ""}`}
                                        onClick={() => setActiveTab("pulses")}
                                    >
                                        Pulses
                                    </motion.button>

                                    <motion.button
                                        {...btnMotion}
                                        className={`${styles.filterBtn} ${activeTab === "requests" ? styles.activeFilter : ""}`}
                                        onClick={() => setActiveTab("requests")}
                                    >
                                        Requests
                                    </motion.button>
                                </div>

                                {activeTab === "pulses" && (
                                    <>
                                        <div className={styles.pulsesHeader}>
                                            <h2 className={styles.sectionTitle}>My listings</h2>

                                            <div className={styles.filterButtonsRow}>
                                                <motion.button
                                                    {...btnMotion}
                                                    className={`${styles.filterBtn} ${pulseFilter === "obiecte" ? styles.activeFilter : ""}`}
                                                    onClick={() => handleFilterChange("obiecte")}
                                                >
                                                    Objects
                                                </motion.button>

                                                <motion.button
                                                    {...btnMotion}
                                                    className={`${styles.filterBtn} ${pulseFilter === "servicii" ? styles.activeFilter : ""}`}
                                                    onClick={() => handleFilterChange("servicii")}
                                                >
                                                    Services
                                                </motion.button>
                                            </div>
                                        </div>

                                        <div className={styles.objectGrid}>
                                            {filteredPulses.length === 0 && (
                                                <p className={styles.emptyState}>
                                                    No posts of type „
                                                    {pulseFilter === "obiecte"
                                                        ? "objects"
                                                        : pulseFilter === "servicii"
                                                            ? "services"
                                                            : pulseFilter}
                                                    ” yet.
                                                </p>
                                            )}

                                            {currentPulses.map((pulse) => (
                                                <motion.div
                                                    key={pulse.id}
                                                    className={styles.objectCard}
                                                    onClick={() => navigate(`/pulse/${pulse.pulseType}/${pulse.id}`)}
                                                    initial={{ opacity: 0, y: 16 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
                                                >
                                                    <div className={styles.objectImage}>
                                                        {pulse.images && pulse.images.length > 0 ? (
                                                            <img
                                                                src={pulse.images[0]}
                                                                alt={pulse.title}
                                                                className={styles.pulseImage}
                                                            />
                                                        ) : (
                                                            <span className={styles.imagePlaceholder}>
                      {pulseFilter === "obiecte" ? (
                          <Boxes size={80} color={"black"} />
                      ) : (
                          <BriefcaseBusiness size={80} color={"black"} />
                      )}
                    </span>
                                                        )}
                                                    </div>

                                                    <div className={styles.objectInfo}>
                                                        <h3 className={styles.objectName}>{pulse.title}</h3>

                                                        {pulse.phone_number && (
                                                            <p className={styles.pulsePhone}>
                                                                <Phone size={16} color={"black"} style={{ marginTop: "2px", marginRight: "5px" }} />
                                                                {pulse.phone_number}
                                                            </p>
                                                        )}

                                                        <div className="flex">
                                                            <CalendarDays color={"#475064"} />
                                                            <p className={styles.pulseDate}>
                                                                Posted:{" "}
                                                                {pulse.timestamp
                                                                    ? new Date(pulse.timestamp.replace(" ", "T") + "Z").toLocaleString("ro-RO", {
                                                                        day: "2-digit",
                                                                        month: "2-digit",
                                                                        year: "numeric",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })
                                                                    : "—"}
                                                            </p>
                                                        </div>

                                                        <div className="flex">
                                                            <DollarSign color={"#99cb91"} />
                                                            {pulse.price != null && (
                                                                <span className="font-bold">
                        {pulse.price} {pulse.currencyType || "lei"}
                      </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className={styles.objectActions}>
                                                        <motion.button
                                                            {...btnMotion}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditPulse(pulse);
                                                            }}
                                                            className={styles.editBtn}
                                                        >
                                                            <SquarePen className="mr-1" />
                                                            Edit Post
                                                        </motion.button>

                                                        <motion.button
                                                            {...btnMotion}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDeletePulseModal(pulse.id);
                                                            }}
                                                            className={styles.removeBtn}
                                                        >
                                                            <X />
                                                            Delete
                                                        </motion.button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {filteredPulses.length > itemsPerPage && (
                                            <div className={styles.carouselControls}>
                                                <motion.button
                                                    {...btnMotion}
                                                    onClick={handlePrev}
                                                    disabled={currentIndex === 0}
                                                    className={styles.carouselBtn}
                                                >
                                                    &larr; Prev
                                                </motion.button>

                                                <span className={styles.carouselIndicator}>
                {Math.floor(currentIndex / itemsPerPage) + 1} /{" "}
                                                    {Math.ceil(filteredPulses.length / itemsPerPage)}
              </span>

                                                <motion.button
                                                    {...btnMotion}
                                                    onClick={handleNext}
                                                    disabled={currentIndex + itemsPerPage >= filteredPulses.length}
                                                    className={styles.carouselBtn}
                                                >
                                                    Next &rarr;
                                                </motion.button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeTab === "requests" && (
                                    <>
                                        <div className={styles.pulsesHeader}>
                                            <h2 className={styles.sectionTitle}>My Urgent Requests</h2>
                                        </div>

                                        <div className={styles.objectGrid}>
                                            {filteredRequests.length === 0 && (
                                                <p className={styles.emptyState}>
                                                    No requests found.
                                                </p>
                                            )}

                                            {currentRequests.map((request) => (
                                                <motion.div
                                                    key={request.id}
                                                    className={styles.objectCard}
                                                    onClick={() => navigate(`/requests/${request.id}`)}
                                                    initial={{ opacity: 0, y: 16 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
                                                >
                                                    <div className={styles.objectImage}>
                                                        {request.images && request.images.length > 0 ? (
                                                            <img
                                                                src={request.images[0]}
                                                                alt={request.title}
                                                                className={styles.pulseImage}
                                                            />
                                                        ) : (
                                                            <span className={styles.imagePlaceholder}>
                    <AlertCircle size={80} color={"black"} />
                </span>
                                                        )}
                                                    </div>

                                                    <div className={styles.objectInfo}>
                                                        <h3 className={styles.objectName}>{request.title}</h3>

                                                        {request.category && (
                                                            <span className={styles.categoryBadge}>{request.category}</span>
                                                        )}

                                                        {request.address && (
                                                            <p className={styles.pulsePhone}>
                                                                <MapPin size={16} color={"black"} style={{ marginTop: "2px", marginRight: "5px" }} />
                                                                {request.address}
                                                            </p>
                                                        )}

                                                        <div className="flex">
                                                            <CalendarDays color={"#475064"} />
                                                            <p className={styles.pulseDate}>
                                                                Requested at:{" "}
                                                                {request.timestamp
                                                                    ? new Date(request.timestamp.replace(" ", "T") + "Z").toLocaleString("ro-RO", {
                                                                        day: "2-digit",
                                                                        month: "2-digit",
                                                                        year: "numeric",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })
                                                                    : "—"}
                                                            </p>
                                                        </div>

                                                        <div className="flex">
                                                            <DollarSign color={"#99cb91"} />
                                                            {request.price != null && (
                                                                <span className="font-bold">
                        Max Price: {request.price} {request.currencyType || "lei"}
                    </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className={styles.objectActions}>
                                                        <motion.button
                                                            {...btnMotion}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditRequest(request);
                                                            }}
                                                            className={styles.editBtn}
                                                        >
                                                            <SquarePen className="mr-1" />
                                                            Edit Request
                                                        </motion.button>

                                                        <motion.button
                                                            {...btnMotion}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDeleteRequestModal(request.id);
                                                            }}
                                                            className={styles.removeBtn}
                                                        >
                                                            <X />
                                                            Delete
                                                        </motion.button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>


                                        {filteredRequests.length > itemsPerPage && (
                                            <div className={styles.carouselControls}>
                                                <motion.button
                                                    {...btnMotion}
                                                    onClick={handleReqPrev}
                                                    disabled={reqIndex === 0}
                                                    className={styles.carouselBtn}
                                                >
                                                    &larr; Prev
                                                </motion.button>

                                                <span className={styles.carouselIndicator}>
                                                    {Math.floor(reqIndex / itemsPerPage) + 1} /{" "}
                                                    {Math.ceil(filteredRequests.length / itemsPerPage)}
                                                </span>

                                                <motion.button
                                                    {...btnMotion}
                                                    onClick={handleReqNext}
                                                    disabled={reqIndex + itemsPerPage >= filteredRequests.length}
                                                    className={styles.carouselBtn}
                                                >
                                                    Next &rarr;
                                                </motion.button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>


                        {editingPulse && (
                            <motion.div
                                        className={styles.modalOverlay}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}>

                                <motion.div
                                            className={styles.modal}
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}>
                                    <form onSubmit={handleSaveEdit} className={styles.alertForm}>
                                        <h2 className={styles.formTitle}>Edit listing</h2>


                                        <div className={styles.inputGroup}>
                                            <label>Title *</label>
                                            <input
                                                name="title"
                                                value={pulseEditForm.title}
                                                onChange={(e) => setPulseEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                placeholder="Ex: Bicicletă de vânzare..."
                                            />
                                        </div>


                                        <div className={styles.inputGroup}>
                                            <label>Category</label>
                                            <select
                                                name="category"
                                                value={pulseEditForm.category}
                                                onChange={(e) => setPulseEditForm(prev => ({ ...prev, category: e.target.value }))}
                                            >
                                                <option value="">Select</option>
                                                <option value="obiecte">Objects</option>
                                                <option value="servicii">Services</option>
                                            </select>
                                        </div>


                                        <div className={styles.imageUploadSection}>
                                            <label className={styles.labelHeader}>Images</label>
                                            <div className={styles.imageGrid}>

                                                {imagesPreview.map((img, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={styles.imagePreviewBox}
                                                        style={{ backgroundImage: `url(${img})` }}
                                                    >
                                                        <motion.button {...btnMotion}
                                                            type="button"
                                                            onClick={() => removePulseImageAt(idx)}
                                                            className={styles.removeImgBtn}
                                                        >
                                                            <X size={16} />
                                                        </motion.button>
                                                    </div>
                                                ))}


                                                {imagesPreview.length < 4 && (
                                                    <label className={styles.uploadBtnBox}>
                                                        <input
                                                            ref={pulseFileInputRef}
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            onChange={handlePulseImageChange}
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
                                                value={pulseEditForm.description}
                                                onChange={(e) => setPulseEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                rows="4"
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label>Phone Number</label>
                                            <input
                                                name="phone_number"
                                                value={pulseEditForm.phone_number}
                                                onChange={(e) => setPulseEditForm(prev => ({ ...prev, phone_number: e.target.value }))}
                                                placeholder="Ex: 07XXXXXXXX"
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label>Price</label>
                                            <input
                                                name="price"
                                                type="number"
                                                step="0.01"
                                                value={pulseEditForm.price}
                                                onChange={(e) => setPulseEditForm(prev => ({ ...prev, price: e.target.value }))}
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label>Currency</label>
                                            <input
                                                name="currencyType"
                                                value={pulseEditForm.currencyType}
                                                onChange={(e) => setPulseEditForm(prev => ({ ...prev, currencyType: e.target.value }))}
                                            />
                                        </div>

                                        {editError && (
                                            <p className={styles.error}>
                                                {Array.isArray(editError) ? JSON.stringify(editError) : editError}
                                            </p>
                                        )}

                                        <div className={styles.modalActions}>
                                            <motion.button {...btnMotion}
                                                type="button"
                                                onClick={() => {
                                                    setEditingPulse(null);
                                                    setEditLoading(false);
                                                    setEditError(null);
                                                    setImagesPreview([]);
                                                    setNewImages([]);
                                                }}
                                                disabled={editLoading}
                                            >
                                                Cancel
                                            </motion.button>
                                            <motion.button {...btnMotion} type="submit" disabled={editLoading}>
                                                {editLoading ? "Saving..." : "Save"}
                                            </motion.button>
                                        </div>
                                    </form>
                                </motion.div>
                            </motion.div>
                        )}

                        {editingRequest && (
                            <motion.div
                                className={styles.modalOverlay}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}>

                                <motion.div
                                    className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                                    <form onSubmit={handleSaveRequestEdit} className={styles.alertForm}>
                                        <h2 className={styles.formTitle}>Edit listing</h2>

                                        <div className={styles.inputGroup}>
                                            <label>Title *</label>
                                            <input
                                                name="title"
                                                value={requestEditForm.title}
                                                onChange={(e) => setRequestEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                placeholder="Ex: Bicicletă de vânzare..."
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label>Category</label>
                                            <select
                                                name="category"
                                                value={requestEditForm.category}
                                                onChange={(e) =>
                                                    setRequestEditForm(prev => ({
                                                        ...prev,
                                                        category: e.target.value
                                                    }))
                                                }
                                            >
                                                <option value="">Select</option>

                                                {CATEGORIES.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>


                                        <div className={styles.imageUploadSection}>
                                            <label className={styles.labelHeader}>Images</label>
                                            <div className={styles.imageGrid}>

                                                {imagesPreview.map((img, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={styles.imagePreviewBox}
                                                        style={{ backgroundImage: `url(${img})` }}
                                                    >
                                                        <motion.button {...btnMotion}
                                                                       type="button"
                                                                       onClick={() => removeRequestImageAt(idx)}
                                                                       className={styles.removeImgBtn}
                                                        >
                                                            <X size={16} />
                                                        </motion.button>
                                                    </div>
                                                ))}

                                                {imagesPreview.length < 4 && (
                                                    <label className={styles.uploadBtnBox}>
                                                        <input
                                                            ref={requestFileInputRef}
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            onChange={handleRequestImageChange}
                                                            hidden
                                                        />
                                                        <Plus size={24} />
                                                        <span>Add</span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label>Description *</label>
                                            <textarea
                                                name="description"
                                                value={requestEditForm.description}
                                                onChange={(e) => setRequestEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                rows="4"
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label>Max Price</label>
                                            <input
                                                name="price"
                                                type="number"
                                                step="0.01"
                                                value={requestEditForm.price}
                                                onChange={(e) => setRequestEditForm(prev => ({ ...prev, price: e.target.value }))}
                                            />
                                        </div>


                                        <div className={styles.inputGroup}>
                                            <label>Currency</label>
                                            <input
                                                name="currencyType"
                                                value={requestEditForm.currencyType}
                                                onChange={(e) => setRequestEditForm(prev => ({ ...prev, currencyType: e.target.value }))}
                                            />
                                        </div>


                                        {editError && (
                                            <p className={styles.error}>
                                                {Array.isArray(editError) ? JSON.stringify(editError) : editError}
                                            </p>
                                        )}


                                        <div className={styles.modalActions}>
                                            <motion.button {...btnMotion}
                                                           type="button"
                                                           onClick={() => {
                                                               setEditingRequest(null);
                                                               setEditLoading(false);
                                                               setEditError(null);
                                                               setImagesPreview([]);
                                                               setNewImages([]);
                                                           }}
                                                           disabled={editLoading}
                                            >
                                                Cancel
                                            </motion.button>
                                            <motion.button {...btnMotion} type="submit" disabled={editLoading}>
                                                {editLoading ? "Saving..." : "Save"}
                                            </motion.button>
                                        </div>
                                    </form>
                                </motion.div>
                            </motion.div>
                        )}
                    </motion.div>

                    <motion.div className={styles.contentArea}>
                        <motion.div
                            className={styles.card}
                            whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className={styles.pulsesHeader}>
                                <div className="flex flex-col">
                                    <h2 className={styles.sectionTitle}>Rentals</h2>
                                    <p className={styles.sectionSubtitle} style={{ marginTop: '4px' }}>
                                        Manage your received rental offers and the proposals you've sent.
                                    </p>
                                </div>

                                <div className={styles.filterButtonsRow}>
                                    <button
                                        className={`${styles.filterBtn} ${activeRentalTab === "offers" ? styles.activeFilter : ""}`}
                                        onClick={() => handleRentalFilterChange("offers")}
                                    >
                                        Rental offers
                                    </button>
                                    <button
                                        className={`${styles.filterBtn} ${activeRentalTab === "proposals" ? styles.activeFilter : ""}`}
                                        onClick={() => handleRentalFilterChange("proposals")}
                                    >
                                        Rental proposals
                                    </button>
                                </div>
                            </div>

                            <div className={styles.offersList}>
                                {currentRentalLoading && <p>Loading...</p>}

                                {!currentRentalLoading && currentRentalData.length === 0 && (
                                    <p className={styles.emptyState}>
                                        {activeRentalTab === 'offers'
                                            ? "There are currently no offers for your listings."
                                            : "You haven’t sent any rental proposals yet."}
                                    </p>
                                )}

                                {visibleRentals.map((item) => {
                                    const isOfferTab = activeRentalTab === "offers";

                                    const now = new Date();
                                    const start = new Date(item.start_date);
                                    const end = new Date(item.end_date);
                                    end.setDate(end.getDate() + 1);

                                    const isInProgress =
                                        item.status === "confirmed" &&
                                        now >= start &&
                                        now <= end;

                                    return (
                                        <motion.div
                                            key={item.id}
                                            className={styles.offerCard}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.25 }}
                                            whileHover={{ scale: 1.02, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
                                        >
                                            <div className={styles.offerLeft}>
                                                <div className={styles.offerPulseTitle}>
                                                    {isOfferTab ? (item.pulse?.title || "—") : item.pulse_title}
                                                </div>

                                                <div className={styles.offerMeta}>
                                                    {isOfferTab ? (
                                                        <div>From: <strong>{item.renter?.username || item.renter}</strong></div>
                                                    ) : null}

                                                    <div>
                                                        {isOfferTab ? (
                                                            item.pulse_type === "servicii"
                                                                ? <span>Service: <strong>{item.pulse_title}</strong></span>
                                                                : <span>Product: <strong>{item.pulse_title}</strong></span>
                                                        ) : (
                                                            <>Type: <strong>{item.pulse_type === "servicii" ? "Serviciu" : "Produs"}</strong></>
                                                        )}
                                                    </div>

                                                    <div>Period: {formatDate(item.start_date)} — {formatDate(item.end_date)}</div>
                                                    <div>Proposed price: <strong>{formatCurrency(item.total_price, item.currencyType || "lei")}</strong></div>

                                                    {item.total_price !== item.initial_price && (
                                                        <div>Initial price: <strong>{formatCurrency(item.initial_price, item.currencyType || "lei")}</strong></div>
                                                    )}

                                                    <div>Status: <strong>{isInProgress ? "In progress" : item.status}</strong></div>
                                                </div>
                                            </div>

                                            <div className={styles.offerActions}>
                                                {isInProgress && (
                                                    <motion.button
                                                        {...btnMotion}
                                                        onClick={() => openSignalProblemModal(item)}
                                                        className={styles.signalBtn}
                                                    >
                                                        Signal a problem
                                                    </motion.button>
                                                )}

                                                {item.status === "pending" && (isOfferTab ? item.last_offer_by !== user.id : true) && (
                                                    <>
                                                        {!isOfferTab && (
                                                            <motion.button {...btnMotion} onClick={() => openDeleteModal(item)} className={styles.rejectBtn}>
                                                                <X />Decline
                                                            </motion.button>
                                                        )}

                                                        {(isOfferTab || (item.total_price !== item.initial_price && item.last_offer_by !== user.id)) && (
                                                            <>
                                                                <motion.button {...btnMotion} onClick={() => openAcceptModal(item)} className={styles.acceptBtn}>
                                                                    <Handshake className="mr-1" />
                                                                    {isOfferTab ? "Accept" : "Accept the offer"}
                                                                </motion.button>

                                                                {isOfferTab && (
                                                                    <motion.button {...btnMotion} onClick={() => openDeclineModal(item)} className={styles.rejectBtn}>
                                                                        <X />Decline
                                                                    </motion.button>
                                                                )}

                                                                {!isOfferTab && (
                                                                    <motion.button {...btnMotion} onClick={() => openDeclineModal(item)} className={styles.rejectBtn}>
                                                                        <X />Refuse the offer
                                                                    </motion.button>
                                                                )}

                                                                <motion.button
                                                                    {...btnMotion}
                                                                    onClick={() => openCounterModal(item)}
                                                                    className={styles.counterBtn}
                                                                    style={!isOfferTab ? { marginLeft: "8px" } : {}}
                                                                >
                                                                    <Repeat className="mr-1" />
                                                                    Counteroffer
                                                                </motion.button>
                                                            </>
                                                        )}
                                                    </>
                                                )}

                                                {(item.status === "confirmed" || item.status === "declined" || item.status === "completed") && (
                                                    item.status === "confirmed" && !isInProgress ? (
                                                        <div className={styles.confirmedActions}>

                                                            <div className={styles.rightActions}>
                                                                <motion.button
                                                                    {...btnMotion}
                                                                    onClick={() => openFeedbackModal(item)}
                                                                    className={styles.feedbackBtn}
                                                                >
                                                                    Give feedback
                                                                </motion.button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className={styles.smallNote}>
                                                            {item.status === "declined" && (isOfferTab ? "Offer rejected" : "The offer has been declined.")}
                                                            {item.status === "completed" && "Rental finished"}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {currentRentalData.length > rentalItemsPerPage && (
                                <div className={styles.carouselControls}>
                                    <motion.button
                                        {...btnMotion}
                                        onClick={handleRentalPrev}
                                        disabled={rentalCurrentIndex === 0}
                                        className={styles.carouselBtn}
                                    >
                                        &larr; Prev
                                    </motion.button>

                                    <span className={styles.carouselIndicator}>
                    {Math.floor(rentalCurrentIndex / rentalItemsPerPage) + 1} / {Math.ceil(currentRentalData.length / rentalItemsPerPage)}
                </span>

                                    <motion.button
                                        {...btnMotion}
                                        onClick={handleRentalNext}
                                        disabled={rentalCurrentIndex + rentalItemsPerPage >= currentRentalData.length}
                                        className={styles.carouselBtn}
                                    >
                                        Next &rarr;
                                    </motion.button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>

                    <motion.div className={styles.contentArea}>
                        <motion.div
                            className={styles.card}
                            whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className={styles.pulsesHeader}>
                                <div className="flex flex-col">
                                    <h2 className={styles.sectionTitle}>Requests & Help</h2>
                                    <p className={styles.sectionSubtitle} style={{ marginTop: '4px' }}>
                                        Manage offers for your requests and the help you've offered to others.
                                    </p>
                                </div>

                                <div className={styles.filterButtonsRow}>
                                    <motion.button {...btnMotion}
                                                   className={`${styles.filterBtn} ${activeRequestTab === "received" ? styles.activeFilter : ""}`}
                                                   onClick={() => handleRequestFilterChange("received")}
                                    >
                                        Offers for requests
                                    </motion.button>
                                    <motion.button {...btnMotion}
                                                   className={`${styles.filterBtn} ${activeRequestTab === "sent" ? styles.activeFilter : ""}`}
                                                   onClick={() => handleRequestFilterChange("sent")}
                                    >
                                        My offers to help
                                    </motion.button>
                                </div>
                            </div>


                            <div className={styles.offersList}>
                                {currentRequestLoading && <p>Loading...</p>}

                                {!currentRequestLoading && currentRequestData.length === 0 && (
                                    <p className={styles.emptyState}>
                                        {activeRequestTab === 'received'
                                            ? "You haven’t received any offers for your urgent requests yet."
                                            : "You haven’t sent any help offers yet."}
                                    </p>
                                )}

                                {visibleRequests.map((item) => {
                                    const isReceivedTab = activeRequestTab === 'received';

                                    return (
                                        <motion.div
                                            key={item.id}
                                            className={styles.offerCard}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.25 }}
                                            whileHover={{ scale: 1.02, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
                                        >
                                            <div className={styles.offerLeft}>
                                                <div className={styles.offerPulseTitle}>{item.request_title || "Untitled request"}</div>

                                                <div className={styles.offerMeta}>
                                                    {isReceivedTab && (
                                                        <>
                                                            <div>De la: <strong>@{item.proposer}</strong></div>
                                                            <div>Trimisă la: <strong>{new Date(item.created_at).toLocaleDateString('ro-RO')}</strong></div>
                                                        </>
                                                    )}

                                                    <div>
                                                        {isReceivedTab ? "Preț solicitat:" : "Proposed price:"} <strong>{formatCurrency(item.total_price, "lei")}</strong>
                                                    </div>

                                                    {item.initial_price && item.initial_price !== item.total_price && (
                                                        <div>
                                                            Initial price: <strong>{formatCurrency(item.initial_price, "lei")}</strong>
                                                        </div>
                                                    )}
                                                    <div>Status: <strong>{item.status}</strong></div>
                                                </div>
                                            </div>

                                            <div className={styles.offerActions}>
                                                {item.status === "confirmed" ? (
                                                    <div className={styles.confirmedActions}>

                                                        <div className={styles.rightActions}>
                                                            <motion.button
                                                                {...btnMotion}
                                                                onClick={() => openFeedbackModal(item)}
                                                                className={styles.feedbackBtn}
                                                            >
                                                                Give Feedback
                                                            </motion.button>
                                                        </div>
                                                    </div>
                                                ) : isReceivedTab ? (
                                                    item.status === "pending" && item.last_offer_by !== user.id ? (
                                                        <>
                                                            <motion.button {...btnMotion} onClick={() => openAcceptOfferModal(item)} className={styles.acceptBtn}>
                                                                <Handshake className='mr-1' />Accept
                                                            </motion.button>
                                                            <motion.button {...btnMotion} onClick={() => openDeclineOfferModal(item)} className={styles.rejectBtn}>
                                                                <X />Decline
                                                            </motion.button>
                                                            <motion.button {...btnMotion} onClick={() => openCounterOfferModal(item)} className={styles.counterBtn}>
                                                                <Repeat className='mr-1' />Counteroffer
                                                            </motion.button>
                                                        </>
                                                    ) : (
                                                        <div className={styles.smallNote}>
                                                            {item.status === "declined" && "Offer refused"}
                                                            {item.status === "pending" && item.last_offer_by === user.id && "Waiting for counteroffer"}
                                                        </div>
                                                    )
                                                ) : (
                                                    <>
                                                        {item.status === "pending" && (
                                                            <motion.button {...btnMotion} onClick={() => openDeleteOfferModal(item)} className={styles.rejectBtn}>
                                                                <Undo className='mr-1' />Withdraw offer
                                                            </motion.button>
                                                        )}

                                                        {item.status === "pending" && item.total_price !== item.initial_price && item.last_offer_by !== user.id && (
                                                            <>
                                                                <motion.button {...btnMotion} onClick={() => openAcceptOfferModal(item)} className={styles.acceptBtn} style={{ marginLeft: "8px" }}>
                                                                    <Handshake className='mr-1' />Accept new price
                                                                </motion.button>
                                                                <motion.button {...btnMotion} onClick={() => openCounterOfferModal(item)} className={styles.counterBtn} style={{ marginLeft: "8px" }}>
                                                                    <Repeat className='mr-1' />Negotiate
                                                                </motion.button>
                                                            </>
                                                        )}

                                                        {item.status === "declined" && <div className={styles.smallNote}>The offer has been declined</div>}
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>


                            {currentRequestData.length > requestItemsPerPage && (
                                <div className={styles.carouselControls}>
                                    <motion.button {...btnMotion}
                                                   onClick={handleRequestPrev}
                                                   disabled={requestCurrentIndex === 0}
                                                   className={styles.carouselBtn}
                                    >
                                        &larr; Prev
                                    </motion.button>

                                    <span className={styles.carouselIndicator}>
                    {Math.floor(requestCurrentIndex / requestItemsPerPage) + 1} / {Math.ceil(currentRequestData.length / requestItemsPerPage)}
                </span>

                                    <motion.button {...btnMotion}
                                                   onClick={handleRequestNext}
                                                   disabled={requestCurrentIndex + requestItemsPerPage >= currentRequestData.length}
                                                   className={styles.carouselBtn}
                                    >
                                        Next &rarr;
                                    </motion.button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                </div>


                <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h3 className={styles.modalTitle}>Delete profile picture?</h3>
                            <p className={styles.modalText}>
                                This action cannot be undone. Are you sure you want to delete your profile picture?
                            </p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={() => setShowDeleteModal(false)} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion} onClick={handleDeleteProfilePicture} className={styles.modalDelete}>
                                    Yes, delete
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>


                <AnimatePresence>
                {counterModal.show && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h3 className={styles.modalTitle}>Send counteroffer</h3>
                            <p className={styles.modalText}>Enter the new total price (numeric value, e.g. 150.00):</p>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Total price</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={counterModal.price}
                                    onChange={handleCounterPriceChange}
                                    className={styles.editInput}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeCounterModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion} onClick={handleSubmitCounter} className={styles.saveButton}>
                                    Send counteroffer
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>


                <AnimatePresence>
                {counterOfferModal.show && (
                    <motion.div
                                className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div
                                    className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Send counteroffer</h3>
                            <p className={styles.modalText}>Enter the new total price (numeric value, e.g. 150.00):</p>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Total price</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={counterOfferModal.price}
                                    onChange={handleCounterOfferPriceChange}
                                    className={styles.editInput}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeCounterOfferModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion} onClick={handleSubmitRequestCounter} className={styles.saveButton}>
                                    Send counteroffer
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>


                <AnimatePresence>
                {acceptModal.show && (
                    <motion.div className={styles.modalOverlay}>
                        <motion.div className={styles.modal}>
                            <h3 className={styles.modalTitle}>Accept offer?</h3>
                            <p className={styles.modalText}>Are you sure you want to accept this offer?</p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeAcceptModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion}
                                    onClick={() => handleAcceptOffer(acceptModal.id)}
                                    className={styles.saveButton}
                                >
                                    Accept
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>
                {acceptOfferModal.show && (
                    <motion.div className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Accept offer?</h3>
                            <p className={styles.modalText}>Are you sure you want to accept this offer?</p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeAcceptOfferModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion}
                                    onClick={() => handleAcceptRequestOffer(acceptOfferModal.id)}
                                    className={styles.saveButton}
                                >
                                    Accept
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>
                {deletePulseModal.show && (
                    <motion.div className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Delete the listing?</h3>
                            <p className={styles.modalText}>
                                This action cannot be undone. Are you sure you want to delete this listing?
                            </p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeDeletePulseModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion} onClick={handleDeletePulse} className={styles.modalDelete}>
                                    Yes, delete
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>
                    {deleteRequestModal.show && (
                        <motion.div className={styles.modalOverlay}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <motion.div className={styles.modal}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}>
                                <h3 className={styles.modalTitle}>Delete the request?</h3>
                                <p className={styles.modalText}>
                                    This action cannot be undone. Are you sure you want to delete this request?
                                </p>
                                <div className={styles.modalActions}>
                                    <motion.button {...btnMotion} onClick={closeDeleteRequestModal} className={styles.modalCancel}>
                                        Cancel
                                    </motion.button>
                                    <motion.button {...btnMotion} onClick={handleDeleteRequest} className={styles.modalDelete}>
                                        Yes, delete
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>

                {deleteProposalModal.show && (
                    <motion.div className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Cancel propose?</h3>
                            <p className={styles.modalText}>
                                This can’t be undone. Cancel this proposal?
                            </p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeDeleteModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion} onClick={handleDeleteProposal} className={styles.modalDelete}>
                                   Yes, cancel
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>
                {deleteOfferModal.show && (
                    <motion.div className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Cancel proposal?</h3>
                            <p className={styles.modalText}>
                                This action cannot be undone. Are you sure you want to withdraw the proposal?
                            </p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeDeleteOfferModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion}
                                    onClick={() => handleDeleteRequestOffer(deleteOfferModal.id)}
                                    className={styles.modalDelete}
                                >
                                    Yes,
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>

                {declineModal.show && (
                    <motion.div className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Refuse the offer?</h3>
                            <p className={styles.modalText}>Are you sure you want to decline this offer?</p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeDeclineModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion}
                                    onClick={() => handleDeclineOffer(declineModal.id)}
                                    className={styles.modalDelete}
                                >
                                    Decline
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>
                {declineOfferModal.show && (
                    <motion.div className={styles.modalOverlay}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className={styles.modal}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}>
                            <h3 className={styles.modalTitle}>Decline the offer?</h3>
                            <p className={styles.modalText}>Are you sure you want to decline this offer?</p>
                            <div className={styles.modalActions}>
                                <motion.button {...btnMotion} onClick={closeDeclineOfferModal} className={styles.modalCancel}>
                                    Cancel
                                </motion.button>
                                <motion.button {...btnMotion}
                                    onClick={() => handleDeclineRequestOffer(declineOfferModal.id)}
                                    className={styles.modalDelete}
                                >
                                    Decline
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>
                {verifiedModal && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                        <div className="bg-white rounded-xl shadow-lg p-6 w-80 max-w-sm relative">

                            <motion.button {...btnMotion}
                                onClick={() => setVerifiedModal(false)}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </motion.button>


                            <div className="flex flex-col items-center text-center">
                                <span className="text-4xl mb-4">🎉</span>
                                <h2 className="text-xl font-bold mb-2">Congratulations!</h2>
                                <p className="text-gray-600 mb-4">
                                    You are now a verified neighbour. Enjoy your perks!
                                </p>
                                <motion.button {...btnMotion}
                                    onClick={() => setVerifiedModal(false)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition-colors"
                                >
                                    Close
                                </motion.button>
                            </div>
                        </div>
                    </div>
                )}

                {signalModalOpen && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h3 className={styles.modalTitle}>
                                Signal a problem for {selectedRental?.pulse_title || "this rental"}
                            </h3>
                            <p className={styles.modalText}>
                                Describe the problem you encountered:
                            </p>

                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Message</label>
                                <textarea
                                    value={signalMessage}
                                    onChange={(e) => setSignalMessage(e.target.value)}
                                    placeholder="Enter the issue..."
                                    className={styles.editInput}
                                    rows={4}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <motion.button
                                    {...btnMotion}
                                    onClick={() => setSignalModalOpen(false)}
                                    className={styles.modalCancel}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    {...btnMotion}
                                    onClick={submitSignalProblem}
                                    className={styles.saveButton}
                                >
                                    Submit
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {feedbackModalOpen && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h3 className={styles.modalTitle}>
                                Feedback for {feedbackItem?.pulse_title || feedbackItem?.request_title || "this rental"}
                            </h3>
                            <p className={styles.modalText}>
                                Rate your experience and leave a comment:
                            </p>

                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Rating</label>

                                <div className={styles.starRow}>
                                    {Array.from({ length: 10 }, (_, index) => {
                                        const starValue = index + 1;
                                        const filled = starValue <= (feedbackHover || feedbackRating);

                                        return (
                                            <button
                                                key={starValue}
                                                type="button"
                                                className={styles.starBtn}
                                                onMouseEnter={() => setFeedbackHover(starValue)}
                                                onMouseLeave={() => setFeedbackHover(0)}
                                                onClick={() => setFeedbackRating(starValue)}
                                                aria-label={`Rate ${starValue} out of 10`}
                                            >
                                                <Star
                                                    className={filled ? styles.starFilled : styles.starEmpty}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className={styles.starText}>
                                    {feedbackRating > 0 ? `${feedbackRating}/10` : "Select a rating"}
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Comment</label>
                                <textarea
                                    value={feedbackComment}
                                    onChange={(e) => setFeedbackComment(e.target.value)}
                                    className={styles.editInput}
                                    placeholder="Write your comment..."
                                    rows={4}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <motion.button
                                    {...btnMotion}
                                    onClick={closeFeedbackModal}
                                    className={styles.modalCancel}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    {...btnMotion}
                                    onClick={submitFeedback}
                                    className={styles.saveButton}
                                    disabled={feedbackRating === 0}
                                >
                                    Submit
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </div>
            <Footer />
        </div>
    );
}