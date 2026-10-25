import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MapPin, Star, Calendar, Users, User, Mail, Globe,
    CreditCard, Shield, AlertCircle, Check, ChevronRight, Clock,
    X, Info, ArrowLeft, Coffee, Wifi, Car, Utensils, Tv, Wind,
    Bath, Sparkles, Tag, FileText, AlertTriangle
} from 'lucide-react';
import { preBookHotel } from '../services/api';
import ErrorAlert from '../components/ErrorAlert';

// Country codes for nationality dropdown
const COUNTRY_CODES = [
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SG', name: 'Singapore' },
    { code: 'AU', name: 'Australia' },
    { code: 'CA', name: 'Canada' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' }
];

const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms'];

const GuestDetailsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Data passed from HotelDetailsPage
    const {
        hotel,
        room,
        searchParams,
        bookingCode: initialBookingCode
    } = location.state || {};

    // State
    const [loading, setLoading] = useState(true);
    const [preBookLoading, setPreBookLoading] = useState(true);
    const [preBookData, setPreBookData] = useState(null);
    const [bookingCode, setBookingCode] = useState(initialBookingCode);
    const [error, setError] = useState(null);
    const [priceNotice, setPriceNotice] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [bookingSuccess] = useState(false);
    const [, setValidationInfo] = useState(null);
    const [showAllAmenities, setShowAllAmenities] = useState(false);
    const [showRateConditions, setShowRateConditions] = useState(false);
    const [isVoucherBooking] = useState(true); // Default to voucher booking

    // Form state
    const [contactDetails, setContactDetails] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        nationality: 'IN'
    });

    const [billingDetails, setBillingDetails] = useState({
        address: '',
        city: '',
        state: '',
        pincode: '',
        country: 'IN'
    });

    const [guestDetails, setGuestDetails] = useState([]);
    const [specialRequests, setSpecialRequests] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);

    // Validation state
    const [errors, setErrors] = useState({});

    // Calculate number of guests needed
    const numRooms = searchParams?.rooms || 1;
    const adultsCount = Math.max(numRooms, searchParams?.adults || 2);
    const childrenCount = searchParams?.children || 0;
    const totalGuests = adultsCount + childrenCount;
    const paxRooms = searchParams?.paxRooms;

    // Check if international booking - only true when hotel data is loaded AND country is not India
    const isInternational = !!hotel && hotel.CountryCode !== 'IN';

    // Format number as Indian Rupee string (e.g. 1,23,456)
    const formatINR = (amount) =>
        new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount));

    // Initialize guest details
    useEffect(() => {
        const guests = [];
        let globalLeadAssigned = false;
        
        if (paxRooms && paxRooms.length > 0) {
            paxRooms.forEach((room, rIdx) => {
                let roomLeadAssigned = false;
                for (let i = 0; i < room.Adults; i++) {
                    guests.push({
                        type: 'adult',
                        title: 'Mr',
                        firstName: '',
                        middleName: '',
                        lastName: '',
                        age: '',
                        isLead: !globalLeadAssigned,
                        isRoomLead: !roomLeadAssigned,
                        roomIndex: rIdx + 1
                    });
                    globalLeadAssigned = true;
                    roomLeadAssigned = true;
                }
                for (let i = 0; i < room.Children; i++) {
                    guests.push({
                        type: 'child',
                        title: 'Mr',
                        firstName: '',
                        middleName: '',
                        lastName: '',
                        age: room.ChildrenAges[i] || 5,
                        isLead: false,
                        isRoomLead: false,
                        roomIndex: rIdx + 1
                    });
                }
            });
        } else {
            // Fallback mathematically
            for (let r = 0; r < numRooms; r++) {
                const baseAdults = Math.floor(adultsCount / numRooms);
                const extraAdults = adultsCount % numRooms;
                const adultsForThisRoom = baseAdults + (r < extraAdults ? 1 : 0);

                const baseChildren = Math.floor(childrenCount / numRooms);
                const extraChildren = childrenCount % numRooms;
                const childrenForThisRoom = baseChildren + (r < extraChildren ? 1 : 0);
                
                let roomLeadAssigned = false;
                for(let a=0; a < adultsForThisRoom; a++) {
                    guests.push({
                        type: 'adult',
                        title: 'Mr',
                        firstName: '',
                        middleName: '',
                        lastName: '',
                        age: '',
                        isLead: !globalLeadAssigned,
                        isRoomLead: !roomLeadAssigned,
                        roomIndex: r + 1
                    });
                    globalLeadAssigned = true;
                    roomLeadAssigned = true;
                }
                for(let c=0; c < childrenForThisRoom; c++) {
                    guests.push({
                        type: 'child',
                        title: 'Mr',
                        firstName: '',
                        middleName: '',
                        lastName: '',
                        age: 5,
                        isLead: false,
                        isRoomLead: false,
                        roomIndex: r + 1
                    });
                }
            }
        }
        setGuestDetails(guests);
    }, [adultsCount, childrenCount, numRooms, paxRooms]);

    // Call PreBook API on mount
    useEffect(() => {
        const fetchPreBookData = async () => {
            if (!initialBookingCode) {
                setError('No booking code provided. Please go back and select a room.');
                setPreBookLoading(false);
                setLoading(false);
                return;
            }

            try {
                setPreBookLoading(true);
                const response = await preBookHotel(initialBookingCode);

                if (response && response.HotelResult && response.HotelResult.length > 0) {
                    const hotelResult = response.HotelResult[0];
                    const prebookRoom = hotelResult.Rooms?.[0];
                    if (prebookRoom && room && prebookRoom.TotalFare !== room.TotalFare) {
                        setPriceNotice(`The price has been updated by the hotel from ₹${formatINR(room.TotalFare)} to ₹${formatINR(prebookRoom.TotalFare)}.`);
                    }
                    setPreBookData(hotelResult);

                    // Update booking code if changed
                    if (hotelResult.Rooms && hotelResult.Rooms[0]?.BookingCode) {
                        setBookingCode(hotelResult.Rooms[0].BookingCode);
                    }

                    // Store validation info for form validation
                    if (response.ValidationInfo) {
                        setValidationInfo(response.ValidationInfo);
                    }
                } else {
                    setError('Invalid prebook response. Please try again.');
                }
            } catch (err) {
                // Check for specific room unavailable error
                const errorMessage = err.response?.data?.message || '';
                const isRoomUnavailable = errorMessage.toLowerCase().includes('no available rooms') || 
                                          errorMessage.toLowerCase().includes('not available');
                
                if (isRoomUnavailable) {
                    setError('This room is no longer available. The booking session may have expired or the room has been booked by another user. Please go back and select a different room.');
                } else {
                    setError(errorMessage || 'Failed to validate room availability. Please try again.');
                }
            } finally {
                setPreBookLoading(false);
                setLoading(false);
            }
        };

        fetchPreBookData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- existing, tested behaviour; changing deps could re-trigger effects
    }, [initialBookingCode]);

    // Get validation limits from API response
    const getNameMinLength = () => 2; // Fixed to 2 for cert
    const getNameMaxLength = () => 25; // Fixed to 25 for cert
    const isSpecialCharAllowed = () => false; // Fixed to false for cert

    // Validate form
    const validateForm = () => {
        const newErrors = {};
        const minLen = getNameMinLength();
        const maxLen = getNameMaxLength();

        // Contact details validation
        if (!contactDetails.firstName.trim()) {
            newErrors.contactFirstName = 'First name is required';
        } else if (contactDetails.firstName.length < minLen) {
            newErrors.contactFirstName = `First name must be at least ${minLen} characters`;
        } else if (contactDetails.firstName.length > maxLen) {
            newErrors.contactFirstName = `First name must be at most ${maxLen} characters`;
        } else if (!isSpecialCharAllowed() && /[^a-zA-Z\s]/.test(contactDetails.firstName)) {
            newErrors.contactFirstName = 'Special characters are not allowed';
        }

        if (!contactDetails.lastName.trim()) {
            newErrors.contactLastName = 'Last name is required';
        } else if (contactDetails.lastName.length < minLen) {
            newErrors.contactLastName = `Last name must be at least ${minLen} characters`;
        } else if (contactDetails.lastName.length > maxLen) {
            newErrors.contactLastName = `Last name must be at most ${maxLen} characters`;
        } else if (!isSpecialCharAllowed() && /[^a-zA-Z\s]/.test(contactDetails.lastName)) {
            newErrors.contactLastName = 'Special characters are not allowed';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!contactDetails.email.trim()) {
            newErrors.contactEmail = 'Email is required';
        } else if (!emailRegex.test(contactDetails.email)) {
            newErrors.contactEmail = 'Invalid email format';
        }

        const phoneRegex = /^[0-9]{10,15}$/;
        if (!contactDetails.phone.trim()) {
            newErrors.contactPhone = 'Phone number is required';
        } else if (!phoneRegex.test(contactDetails.phone.replace(/\s+/g, ''))) {
            newErrors.contactPhone = 'Invalid phone number (10-15 digits)';
        }

        // Billing details validation
        if (!billingDetails.address.trim()) {
            newErrors.billingAddress = 'Address is required';
        } else if (billingDetails.address.length < 5) {
            newErrors.billingAddress = 'Address must be at least 5 characters';
        }

        if (!billingDetails.city.trim()) {
            newErrors.billingCity = 'City is required';
        }

        if (!billingDetails.state.trim()) {
            newErrors.billingState = 'State is required';
        }

        if (!billingDetails.pincode.trim()) {
            newErrors.billingPincode = 'Pincode is required';
        } else if (!/^[0-9]{5,6}$/.test(billingDetails.pincode.replace(/\s+/g, ''))) {
            newErrors.billingPincode = 'Invalid pincode (5-6 digits)';
        }

        if (!billingDetails.country.trim()) {
            newErrors.billingCountry = 'Country is required';
        }

        // PAN validation logic - only required for international bookings (hotel country is NOT India)
        guestDetails.forEach((guest, index) => {
            if (isInternational) {
                const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                // PAN is required for ALL adults in international bookings
                // Children will automatically use their room's lead passenger PAN as guardian PAN
                if (guest.type === 'adult') {
                    if (!guest.panNumber?.trim()) {
                        newErrors[`guest${index}Pan`] = 'PAN is required for international bookings';
                    } else if (!panRegex.test(guest.panNumber.trim().toUpperCase())) {
                        newErrors[`guest${index}Pan`] = 'Invalid PAN format';
                    }
                }
            }
        });

        // Guest details validation
        guestDetails.forEach((guest, index) => {
            if (!guest.firstName.trim()) {
                newErrors[`guest${index}FirstName`] = 'First name is required';
            } else if (guest.firstName.length < minLen) {
                newErrors[`guest${index}FirstName`] = `First name must be at least ${minLen} characters`;
            } else if (guest.firstName.length > maxLen) {
                newErrors[`guest${index}FirstName`] = `First name must be at most ${maxLen} characters`;
            } else if (!isSpecialCharAllowed() && /[^a-zA-Z\s]/.test(guest.firstName)) {
                newErrors[`guest${index}FirstName`] = 'Special characters are not allowed';
            }

            if (!guest.lastName.trim()) {
                newErrors[`guest${index}LastName`] = 'Last name is required';
            } else if (guest.lastName.length < minLen) {
                newErrors[`guest${index}LastName`] = `Last name must be at least ${minLen} characters`;
            } else if (guest.lastName.length > maxLen) {
                newErrors[`guest${index}LastName`] = `Last name must be at most ${maxLen} characters`;
            } else if (!isSpecialCharAllowed() && /[^a-zA-Z\s]/.test(guest.lastName)) {
                newErrors[`guest${index}LastName`] = 'Special characters are not allowed';
            }

            if (guest.type === 'child' && (!guest.age || guest.age < 0 || guest.age > 18)) {
                newErrors[`guest${index}Age`] = 'Valid child age (0-18) is required';
            }

            if (guest.type === 'adult' && (!guest.age || guest.age < 18)) {
                newErrors[`guest${index}Age`] = 'Valid adult age (18+) is required';
            }
        });

        // Terms acceptance
        if (!acceptTerms) {
            newErrors.terms = 'You must accept the terms and conditions';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission - Navigate to payment page
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);

        try {
            // Calculate payable amount (Published Price / TotalFare)
            const prebookRoom = preBookData?.Rooms?.[0];
            const payableAmount = prebookRoom?.TotalFare || room?.TotalFare || 0;

            // Navigate to payment page with all collected data
            navigate('/payment', {
                state: {
                    hotel,
                    room,
                    searchParams,
                    bookingCode,
                    preBookData,
                    guestDetails,
                    contactDetails,
                    billingDetails,
                    isInternational,
                    specialRequests,
                    netAmount: payableAmount, // Continuing to pass it as 'netAmount' prop to avoid refactoring PaymentPage prop everywhere, but its value is TotalFare
                    isVoucherBooking
                }
            });
        } catch (err) {
            console.error('Navigation error:', err);
            setError('Failed to proceed to payment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Update guest detail
    const updateGuest = (index, field, value) => {
        const updated = [...guestDetails];
        updated[index] = { ...updated[index], [field]: value };
        setGuestDetails(updated);

        // Clear error
        setErrors(prev => ({ ...prev, [`guest${index}${field.charAt(0).toUpperCase() + field.slice(1)}`]: null }));
    };

    // Copy contact details to lead guest
    const copyContactToLead = () => {
        if (guestDetails.length > 0) {
            const updated = [...guestDetails];
            updated[0] = {
                ...updated[0],
                firstName: contactDetails.firstName,
                lastName: contactDetails.lastName
            };
            setGuestDetails(updated);
        }
    };

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Calculate nights
    const calculateNights = () => {
        if (!searchParams?.checkIn || !searchParams?.checkOut) return 1;
        const checkIn = new Date(searchParams.checkIn);
        const checkOut = new Date(searchParams.checkOut);
        return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    };

    // Get pricing details with full breakdown
    const getPricing = () => {
        const roomData = preBookData?.Rooms?.[0] || room;
        const priceBreakUp = roomData?.PriceBreakUp?.[0] || {};
        const dayRates = roomData?.DayRates?.[0] || [];
        const taxBreakup = priceBreakUp?.TaxBreakup || [];

        // Extract TDS from TaxBreakup if present
        const tdsTax = taxBreakup.find(tax => tax.TaxType === 'Tax_TDS');
        const tdsAmount = tdsTax ? tdsTax.TaxAmount : 0;
        const tdsPercentage = tdsTax ? tdsTax.TaxPercentage : 0;

        // Calculate base price from TotalFare (room rate + taxes, excluding TDS)
        const totalFare = roomData?.TotalFare || 0;
        const totalTax = roomData?.TotalTax || priceBreakUp?.RoomTax || 0;

        // We want to display and charge the Published Price (TotalFare)
        const payableAmount = totalFare;

        return {
            basePrice: dayRates[0]?.BasePrice || priceBreakUp?.RoomRate || (totalFare - totalTax) || 0,
            totalTax: totalTax,
            totalFare: totalFare, 
            payableAmount: payableAmount,
            netTax: roomData?.NetTax || 0,
            currency: preBookData?.Currency || 'INR',
            isRefundable: roomData?.IsRefundable ?? true,
            agentCommission: priceBreakUp?.AgentCommission || 0,
            roomRate: priceBreakUp?.RoomRate || 0,
            roomTax: priceBreakUp?.RoomTax || 0,
            taxBreakup: taxBreakup,
            dayRates: dayRates,
            tdsAmount: tdsAmount,
            tdsPercentage: tdsPercentage,
            hasTDS: !!tdsTax
        };
    };

    // Get room details
    const getRoomDetails = () => {
        const roomData = preBookData?.Rooms?.[0] || room || {};
        return {
            name: roomData?.Name?.[0] || room?.Name?.[0] || 'Selected Room',
            inclusion: roomData?.Inclusion || room?.Inclusion || '',
            mealType: roomData?.MealType || room?.MealType || 'Room_Only',
            amenities: roomData?.Amenities || [],
            beddingGroup: roomData?.BeddingGroup || '',
            roomPromotion: roomData?.RoomPromotion || [],
            lastCancellationDeadline: roomData?.LastCancellationDeadline || '',
            withTransfers: roomData?.WithTransfers || false
        };
    };

    // Parse rate conditions
    const getRateConditions = () => {
        const conditions = preBookData?.RateConditions || [];
        const parsed = {
            checkInTimeBegin: '',
            checkInTimeEnd: '',
            checkOutTime: '',
            checkInInstructions: '',
            specialInstructions: '',
            minimumCheckInAge: '',
            optionalFees: '',
            cardsAccepted: '',
            otherPolicies: []
        };

        conditions.forEach(condition => {
            const trimmed = condition.trim();
            if (trimmed.startsWith('CheckIn Time-Begin:')) {
                parsed.checkInTimeBegin = trimmed.replace('CheckIn Time-Begin:', '').trim();
            } else if (trimmed.startsWith('CheckIn Time-End:')) {
                parsed.checkInTimeEnd = trimmed.replace('CheckIn Time-End:', '').trim();
            } else if (trimmed.startsWith('CheckOut Time:')) {
                parsed.checkOutTime = trimmed.replace('CheckOut Time:', '').trim();
            } else if (trimmed.startsWith('CheckIn Instructions:')) {
                parsed.checkInInstructions = trimmed.replace('CheckIn Instructions:', '').trim();
            } else if (trimmed.startsWith('Special Instructions')) {
                parsed.specialInstructions = trimmed.replace(/Special Instructions\s*:?/, '').trim();
            } else if (trimmed.startsWith('Minimum CheckIn Age')) {
                parsed.minimumCheckInAge = trimmed.replace(/Minimum CheckIn Age\s*:?/, '').trim();
            } else if (trimmed.startsWith('Optional Fees:')) {
                parsed.optionalFees = trimmed.replace('Optional Fees:', '').trim();
            } else if (trimmed.startsWith('Cards Accepted:')) {
                parsed.cardsAccepted = trimmed.replace('Cards Accepted:', '').trim();
            } else {
                parsed.otherPolicies.push(trimmed);
            }
        });

        return parsed;
    };

    // Strip HTML entities and tags
    const stripHtml = (html) => {
        if (!html) return '';
        const decoded = html
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');
        const tmp = document.createElement('DIV');
        tmp.innerHTML = decoded;
        return tmp.textContent || tmp.innerText || '';
    };

    // Get amenity icon
    const getAmenityIcon = (amenity) => {
        const lower = amenity.toLowerCase();
        if (lower.includes('wifi')) return <Wifi size={14} className="text-blue-500" />;
        if (lower.includes('parking')) return <Car size={14} className="text-blue-500" />;
        if (lower.includes('tv') || lower.includes('television')) return <Tv size={14} className="text-blue-500" />;
        if (lower.includes('air') || lower.includes('conditioning')) return <Wind size={14} className="text-blue-500" />;
        if (lower.includes('bath') || lower.includes('shower')) return <Bath size={14} className="text-blue-500" />;
        if (lower.includes('breakfast') || lower.includes('dining')) return <Utensils size={14} className="text-blue-500" />;
        if (lower.includes('room service')) return <Coffee size={14} className="text-blue-500" />;
        if (lower.includes('housekeeping') || lower.includes('clean')) return <Sparkles size={14} className="text-blue-500" />;
        return <Check size={14} className="text-blue-500" />;
    };

    // Get cancellation policies
    const getCancelPolicies = () => {
        const roomData = preBookData?.Rooms?.[0] || {};
        return roomData.CancelPolicies || [];
    };

    // Redirect if no data
    if (!hotel && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">No Booking Data</h2>
                    <p className="text-gray-600 mb-4">Please select a room from the hotel details page.</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading || preBookLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Validating room availability...</p>
                </div>
            </div>
        );
    }

    // Success state
    if (bookingSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check size={40} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
                    <p className="text-gray-600 mb-6">Your reservation has been successfully completed.</p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                        <h3 className="font-semibold text-gray-800 mb-2">{hotel?.HotelName}</h3>
                        <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">Check-in:</span> {formatDate(searchParams?.checkIn)}</p>
                            <p><span className="font-medium">Check-out:</span> {formatDate(searchParams?.checkOut)}</p>
                            <p><span className="font-medium">Guests:</span> {totalGuests} guest(s)</p>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    const pricing = getPricing();
    const cancelPolicies = getCancelPolicies();
    const nights = calculateNights();
    const roomDetails = getRoomDetails();
    const rateConditions = getRateConditions();

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-6">
                <div className="container mx-auto px-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center text-white/80 hover:text-white mb-4 transition"
                    >
                        <ArrowLeft size={20} className="mr-2" />
                        Back to Hotel
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold">{hotel?.HotelName}</h1>
                        <div className="flex text-yellow-400">
                            {[...Array(parseInt(hotel?.HotelRating) || 0)].map((_, i) => (
                                <Star key={i} size={16} fill="currentColor" />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center text-white/80 text-sm">
                        <MapPin size={14} className="mr-1" />
                        {hotel?.Address || hotel?.CityName}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                {/* Error Alert */}
                {error && (
                    <div className="mb-6">
                        <ErrorAlert
                            message={error}
                            type="error"
                            title="Booking Error"
                            dismissible={true}
                            onDismiss={() => setError(null)}
                            className="mb-4"
                        />
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                            Go Back to Search Results
                        </button>
                    </div>
                )}
                
                {/* Price Notice Alert */}
                {priceNotice && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm flex items-start justify-between animate-fade-in">
                        <div className="flex gap-3">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-amber-800">Price Updated</h3>
                                <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">{priceNotice}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setPriceNotice(null)}
                            className="text-amber-500 hover:text-amber-700 hover:bg-amber-100/50 p-1.5 rounded-full focus:outline-none transition-all"
                            aria-label="Dismiss price notice"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Forms */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Booking Summary */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Calendar size={20} className="mr-2 text-blue-600" />
                                Your Booking
                            </h2>

                            {/* Check-in/out with actual times from API */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 mb-1">Check-in</div>
                                    <div className="font-semibold text-gray-800">{formatDate(searchParams?.checkIn)}</div>
                                    <div className="text-xs text-gray-500">
                                        {rateConditions.checkInTimeBegin ? `From ${rateConditions.checkInTimeBegin}` : 'From 14:00'}
                                        {rateConditions.checkInTimeEnd && ` - ${rateConditions.checkInTimeEnd}`}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 mb-1">Check-out</div>
                                    <div className="font-semibold text-gray-800">{formatDate(searchParams?.checkOut)}</div>
                                    <div className="text-xs text-gray-500">
                                        {rateConditions.checkOutTime ? `Until ${rateConditions.checkOutTime}` : 'Until 12:00'}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 mb-1">Duration & Rooms</div>
                                    <div className="font-semibold text-gray-800">{nights} night{nights > 1 ? 's' : ''} • {numRooms} room{numRooms > 1 ? 's' : ''}</div>
                                    <div className="text-xs text-gray-500">{totalGuests} guest{totalGuests > 1 ? 's' : ''} total</div>
                                </div>
                            </div>

                            {/* Room Details Section */}
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex items-start gap-3 mb-3">
                                    <Coffee size={18} className="text-blue-600 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-800">{roomDetails.name}</div>
                                        <div className="text-sm text-gray-600">{roomDetails.mealType.replace(/_/g, ' ')}</div>
                                    </div>
                                </div>

                                {/* Room Promotions */}
                                {roomDetails.roomPromotion.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {roomDetails.roomPromotion.map((promo, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                <Tag size={12} />
                                                {promo}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Inclusion */}
                                {roomDetails.inclusion && (
                                    <div className="text-sm text-gray-700 mb-2">
                                        <span className="font-medium">Includes:</span> {roomDetails.inclusion}
                                    </div>
                                )}

                                {/* Bedding Info */}
                                {roomDetails.beddingGroup && (
                                    <div className="text-xs text-gray-500 italic mb-3">
                                        <Info size={12} className="inline mr-1" />
                                        {roomDetails.beddingGroup}
                                    </div>
                                )}

                                {/* Last Cancellation Deadline */}
                                {roomDetails.lastCancellationDeadline && (
                                    <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-flex items-center gap-1">
                                        <Clock size={12} />
                                        Free cancellation until: {roomDetails.lastCancellationDeadline}
                                    </div>
                                )}
                            </div>

                            {/* Room Amenities */}
                            {roomDetails.amenities.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Room Amenities</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {(showAllAmenities ? roomDetails.amenities : roomDetails.amenities.slice(0, 9)).map((amenity, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded">
                                                {getAmenityIcon(amenity)}
                                                <span className="truncate">{amenity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {roomDetails.amenities.length > 9 && (
                                        <button
                                            onClick={() => setShowAllAmenities(!showAllAmenities)}
                                            className="text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium"
                                        >
                                            {showAllAmenities ? 'Show less' : `+${roomDetails.amenities.length - 9} more amenities`}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Rate Conditions Toggle */}
                            {(rateConditions.checkInInstructions || rateConditions.optionalFees || rateConditions.otherPolicies.length > 0) && (
                                <div className="mt-4 border-t pt-4">
                                    <button
                                        onClick={() => setShowRateConditions(!showRateConditions)}
                                        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600"
                                    >
                                        <FileText size={16} />
                                        Important Information
                                        <ChevronRight size={16} className={`transform transition ${showRateConditions ? 'rotate-90' : ''}`} />
                                    </button>

                                    {showRateConditions && (
                                        <div className="mt-3 space-y-3 text-sm text-gray-600">
                                            {/* Minimum Age */}
                                            {rateConditions.minimumCheckInAge && (
                                                <div className="flex items-start gap-2">
                                                    <User size={14} className="mt-0.5 text-gray-400" />
                                                    <span>Minimum check-in age: <strong>{rateConditions.minimumCheckInAge} years</strong></span>
                                                </div>
                                            )}

                                            {/* Cards Accepted */}
                                            {rateConditions.cardsAccepted && (
                                                <div className="flex items-start gap-2">
                                                    <CreditCard size={14} className="mt-0.5 text-gray-400" />
                                                    <span>Accepted payment: {rateConditions.cardsAccepted}</span>
                                                </div>
                                            )}

                                            {/* Check-in Instructions */}
                                            {rateConditions.checkInInstructions && (
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <div className="font-medium text-gray-700 mb-1">Check-in Instructions</div>
                                                    <div className="text-xs text-gray-600">
                                                        {stripHtml(rateConditions.checkInInstructions)}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Special Instructions */}
                                            {rateConditions.specialInstructions && (
                                                <div className="bg-blue-50 p-3 rounded-lg">
                                                    <div className="font-medium text-blue-700 mb-1">Special Instructions</div>
                                                    <div className="text-xs text-gray-600">
                                                        {stripHtml(rateConditions.specialInstructions)}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Optional Fees */}
                                            {rateConditions.optionalFees && (
                                                <div className="bg-amber-50 p-3 rounded-lg">
                                                    <div className="font-medium text-amber-700 mb-1 flex items-center gap-1">
                                                        <AlertTriangle size={14} />
                                                        Optional Fees (Not Included)
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {stripHtml(rateConditions.optionalFees)}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Other Policies */}
                                            {rateConditions.otherPolicies.length > 0 && (
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <div className="font-medium text-gray-700 mb-1">Other Policies</div>
                                                    <ul className="text-xs text-gray-600 space-y-1">
                                                        {rateConditions.otherPolicies.slice(0, 5).map((policy, idx) => (
                                                            <li key={idx} className="flex items-start gap-2">
                                                                <Check size={12} className="mt-0.5 text-green-500 flex-shrink-0" />
                                                                <span>{stripHtml(policy)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Contact Details */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Mail size={20} className="mr-2 text-blue-600" />
                                Contact Details
                            </h2>
                            <p className="text-sm text-gray-600 mb-4">
                                Booking confirmation will be sent to this email address.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={contactDetails.firstName}
                                        onChange={(e) => {
                                            setContactDetails(prev => ({ ...prev, firstName: e.target.value }));
                                            setErrors(prev => ({ ...prev, contactFirstName: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.contactFirstName ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter first name"
                                    />
                                    {errors.contactFirstName && (
                                        <p className="text-red-500 text-xs mt-1">{errors.contactFirstName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={contactDetails.lastName}
                                        onChange={(e) => {
                                            setContactDetails(prev => ({ ...prev, lastName: e.target.value }));
                                            setErrors(prev => ({ ...prev, contactLastName: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.contactLastName ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter last name"
                                    />
                                    {errors.contactLastName && (
                                        <p className="text-red-500 text-xs mt-1">{errors.contactLastName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={contactDetails.email}
                                        onChange={(e) => {
                                            setContactDetails(prev => ({ ...prev, email: e.target.value }));
                                            setErrors(prev => ({ ...prev, contactEmail: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.contactEmail ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="email@example.com"
                                    />
                                    {errors.contactEmail && (
                                        <p className="text-red-500 text-xs mt-1">{errors.contactEmail}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        value={contactDetails.phone}
                                        onChange={(e) => {
                                            setContactDetails(prev => ({ ...prev, phone: e.target.value }));
                                            setErrors(prev => ({ ...prev, contactPhone: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.contactPhone ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter phone number"
                                    />
                                    {errors.contactPhone && (
                                        <p className="text-red-500 text-xs mt-1">{errors.contactPhone}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nationality <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Globe size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <select
                                            value={contactDetails.nationality}
                                            onChange={(e) => setContactDetails(prev => ({ ...prev, nationality: e.target.value }))}
                                            disabled={true}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none bg-gray-100 cursor-not-allowed"
                                        >
                                            <option value="IN">India (IN)</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Only Indian nationals can book</p>
                                </div>
                                {/* Passport fields removed as they are optional for bookings */}
                            </div>
                        </div>

                        {/* Billing Details */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <MapPin size={20} className="mr-2 text-blue-600" />
                                Billing Details
                            </h2>
                            <p className="text-sm text-gray-600 mb-4">
                                These details will be used for invoicing and payment processing.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Street Address <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={billingDetails.address}
                                        onChange={(e) => {
                                            setBillingDetails(prev => ({ ...prev, address: e.target.value }));
                                            setErrors(prev => ({ ...prev, billingAddress: null }));
                                        }}
                                        rows={2}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none ${errors.billingAddress ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter your street address"
                                    />
                                    {errors.billingAddress && (
                                        <p className="text-red-500 text-xs mt-1">{errors.billingAddress}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        City <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={billingDetails.city}
                                        onChange={(e) => {
                                            setBillingDetails(prev => ({ ...prev, city: e.target.value }));
                                            setErrors(prev => ({ ...prev, billingCity: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.billingCity ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter city"
                                    />
                                    {errors.billingCity && (
                                        <p className="text-red-500 text-xs mt-1">{errors.billingCity}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        State / Province <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={billingDetails.state}
                                        onChange={(e) => {
                                            setBillingDetails(prev => ({ ...prev, state: e.target.value }));
                                            setErrors(prev => ({ ...prev, billingState: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.billingState ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter state"
                                    />
                                    {errors.billingState && (
                                        <p className="text-red-500 text-xs mt-1">{errors.billingState}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Pincode / ZIP Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={billingDetails.pincode}
                                        onChange={(e) => {
                                            setBillingDetails(prev => ({ ...prev, pincode: e.target.value }));
                                            setErrors(prev => ({ ...prev, billingPincode: null }));
                                        }}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${errors.billingPincode ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Enter pincode"
                                    />
                                    {errors.billingPincode && (
                                        <p className="text-red-500 text-xs mt-1">{errors.billingPincode}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Country <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Globe size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <select
                                            value={billingDetails.country}
                                            onChange={(e) => {
                                                setBillingDetails(prev => ({ ...prev, country: e.target.value }));
                                                setErrors(prev => ({ ...prev, billingCountry: null }));
                                            }}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none bg-white"
                                        >
                                            {COUNTRY_CODES.map(country => (
                                                <option key={country.code} value={country.code}>
                                                    {country.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.billingCountry && (
                                        <p className="text-red-500 text-xs mt-1">{errors.billingCountry}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Guest Details */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center">
                                    <Users size={20} className="mr-2 text-blue-600" />
                                    Guest Details
                                </h2>
                                <button
                                    type="button"
                                    onClick={copyContactToLead}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Copy from contact
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Enter names exactly as they appear on government-issued ID.
                            </p>

                            <div className="space-y-8">
                                {Array.from({length: searchParams?.rooms || 1}).map((_, rIdx) => {
                                    const roomGuests = guestDetails
                                        .map((g, i) => ({ ...g, originalIndex: i }))
                                        .filter(g => g.roomIndex === rIdx + 1);
                                    
                                    if (roomGuests.length === 0) return null;

                                    return (
                                        <div key={`room-group-${rIdx}`} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                                                <h3 className="font-bold text-gray-800">Room {rIdx + 1} Passengers</h3>
                                            </div>
                                            <div className="p-4 space-y-6">
                                                {roomGuests.map((guest, idx) => {
                                                    const index = guest.originalIndex;
                                                    const isAdult = guest.type === 'adult';
                                                    const localAdultIdx = roomGuests.slice(0, idx).filter(g => g.type === 'adult').length + 1;
                                                    const localChildIdx = roomGuests.slice(0, idx).filter(g => g.type === 'child').length + 1;

                                                    return (
                                                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100 shadow-sm relative overflow-hidden">
                                                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                                                                <User size={16} className="text-blue-600" />
                                                                <span className="font-semibold text-gray-800">
                                                                    {isAdult ? `Adult ${localAdultIdx}` : `Child ${localChildIdx}`}
                                                                </span>
                                                                {guest.isLead && (
                                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
                                                                        Lead Guest
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                                                                    <select
                                                                        value={guest.title}
                                                                        onChange={(e) => updateGuest(index, 'title', e.target.value)}
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                                    >
                                                                        {TITLES.map(title => (
                                                                            <option key={title} value={title}>{title}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        First Name <span className="text-red-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={guest.firstName}
                                                                        onChange={(e) => updateGuest(index, 'firstName', e.target.value)}
                                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${errors[`guest${index}FirstName`] ? 'border-red-500' : 'border-gray-300'}`}
                                                                        placeholder="First name"
                                                                    />
                                                                    {errors[`guest${index}FirstName`] && (
                                                                        <p className="text-red-500 text-xs mt-1">{errors[`guest${index}FirstName`]}</p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Middle Name</label>
                                                                    <input
                                                                        type="text"
                                                                        value={guest.middleName}
                                                                        onChange={(e) => updateGuest(index, 'middleName', e.target.value)}
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                                        placeholder="Middle name"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        Last Name <span className="text-red-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={guest.lastName}
                                                                        onChange={(e) => updateGuest(index, 'lastName', e.target.value)}
                                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${errors[`guest${index}LastName`] ? 'border-red-500' : 'border-gray-300'}`}
                                                                        placeholder="Last name"
                                                                    />
                                                                    {errors[`guest${index}LastName`] && (
                                                                        <p className="text-red-500 text-xs mt-1">{errors[`guest${index}LastName`]}</p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        Age <span className="text-red-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={guest.age || ''}
                                                                        onChange={(e) => !(!isAdult) && updateGuest(index, 'age', e.target.value)}
                                                                        readOnly={!isAdult}
                                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${errors[`guest${index}Age`] ? 'border-red-500' : 'border-gray-300'} ${!isAdult ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                                        placeholder="Age"
                                                                        title={!isAdult ? "Child age is fixed based on your search criteria" : ""}
                                                                    />
                                                                    {errors[`guest${index}Age`] && (
                                                                        <p className="text-red-500 text-xs mt-1">{errors[`guest${index}Age`]}</p>
                                                                    )}
                                                                </div>
                                                                {/* PAN field - shown for all adult passengers in international bookings */}
                                                                {isInternational && guest.type === 'adult' && (
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                            PAN <span className="text-red-500">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={guest.panNumber || ''}
                                                                            onChange={(e) => updateGuest(index, 'panNumber', e.target.value.toUpperCase())}
                                                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${errors[`guest${index}Pan`] ? 'border-red-500' : 'border-gray-300'}`}
                                                                            placeholder="ABCDE1234F"
                                                                        />
                                                                        {errors[`guest${index}Pan`] && (
                                                                            <p className="text-red-500 text-xs mt-1">{errors[`guest${index}Pan`]}</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Hold Booking Option */}
           
                        {/* Special Requests */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Info size={20} className="mr-2 text-blue-600" />
                                Special Requests
                            </h2>
                            <p className="text-sm text-gray-600 mb-4">
                                Special requests are subject to availability and cannot be guaranteed.
                            </p>
                            <textarea
                                value={specialRequests}
                                onChange={(e) => setSpecialRequests(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
                                placeholder="E.g., early check-in, high floor, quiet room..."
                            />
                        </div>

                        {/* Terms & Conditions */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => {
                                        setAcceptTerms(e.target.checked);
                                        setErrors(prev => ({ ...prev, terms: null }));
                                    }}
                                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">
                                    I have read and agree to the <span className="font-medium">Terms and Conditions</span>,{' '}
                                    <span className="font-medium">Privacy Policy</span>, and{' '}
                                    <a href="/cancellation" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Cancellation Policy</a>.
                                </span>
                            </label>
                            {errors.terms && (
                                <p className="text-red-500 text-xs mt-2">{errors.terms}</p>
                            )}
                        </div>

                        {/* Mobile Submit Button */}
                        <div className="lg:hidden">
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {submitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Confirm Booking
                                        <ChevronRight size={20} className="ml-2" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Right Column - Price Summary (Sticky) */}
                    <div className="hidden lg:block">
                        <div className="sticky top-24 space-y-4">
                            {/* Price Summary Card */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                                    <h3 className="font-bold">Price Summary</h3>
                                    <div className="text-xs text-white/80">{pricing.currency}</div>
                                </div>
                                <div className="p-4 space-y-3">
                                    {/* Day Rates Breakdown */}
                                    {pricing.dayRates.length > 0 && (
                                        <div className="space-y-1">
                                            {pricing.dayRates.map((day, idx) => (
                                                <div key={idx} className="flex justify-between text-xs text-gray-500">
                                                    <span>Night {idx + 1}</span>
                                                    <span>₹ {formatINR(day.BasePrice)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Room Rate ({nights} night{nights > 1 ? 's' : ''})</span>
                                        <span className="font-medium">₹ {formatINR(pricing.basePrice)}</span>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Taxes & Fees</span>
                                        <span className="font-medium">₹ {formatINR(pricing.totalTax - pricing.tdsAmount)}</span>
                                    </div>

                                    {/* Tax Breakdown if available (excluding TDS as it's not a customer charge) */}
                                    {pricing.taxBreakup.length > 0 && (
                                        <div className="pl-4 space-y-1 border-l-2 border-gray-200">
                                            {pricing.taxBreakup
                                                .filter(tax => tax.TaxType !== 'Tax_TDS')
                                                .map((tax, idx) => (
                                                <div key={idx} className="flex justify-between text-xs text-gray-500">
                                                    <span>{tax.TaxType.replace(/_/g, ' ')} ({tax.TaxPercentage}%)</span>
                                                    <span>₹ {formatINR(tax.TaxAmount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="border-t pt-3 flex justify-between">
                                        <span className="font-bold text-gray-800">Total Amount</span>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-blue-600">
                                                ₹ {formatINR(pricing.payableAmount)}
                                            </div>
                                            <div className="text-xs text-gray-500">Inclusive of all taxes</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Refund Status */}
                            <div className={`p-4 rounded-xl border ${pricing.isRefundable ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex items-center gap-2">
                                    <Shield size={18} className={pricing.isRefundable ? 'text-green-600' : 'text-amber-600'} />
                                    <span className={`font-semibold ${pricing.isRefundable ? 'text-green-700' : 'text-amber-700'}`}>
                                        {pricing.isRefundable ? 'Free Cancellation Available' : 'Non-Refundable Rate'}
                                    </span>
                                </div>
                                {cancelPolicies.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {cancelPolicies.map((policy, idx) => (
                                            <div key={idx} className="bg-white/60 p-2 rounded text-xs">
                                                <div className="flex items-center gap-1 text-gray-700">
                                                    <Clock size={12} />
                                                    <span>From: {policy.FromDate}</span>
                                                </div>
                                                <div className="mt-1 text-gray-600">
                                                    Cancellation Charge: {' '}
                                                    <span className="font-semibold text-red-600">
                                                        {policy.ChargeType === 'Percentage'
                                                            ? `${policy.CancellationCharge}% of total`
                                                            : `₹ ${policy.CancellationCharge}`
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Secure Booking Badge */}
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                <Shield size={16} className="text-green-600" />
                                <span className="text-xs text-gray-600">Your payment information is secure</span>
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {submitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Confirm Booking
                                        <ChevronRight size={20} className="ml-2" />
                                    </>
                                )}
                            </button>

                            {/* Support Info */}
                            <div className="text-center text-xs text-gray-500">
                                <p>Need help? Call us at <span className="font-medium">1800-XXX-XXXX</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Footer */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-500">Total Amount</div>
                        <div className="text-xl font-bold text-blue-600">₹ {formatINR(pricing.payableAmount)}</div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-70"
                    >
                        {submitting ? 'Processing...' : 'Proceed to Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuestDetailsPage;
