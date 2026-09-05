import React, { useState, useEffect, useMemo } from 'react';
import {
    MapPin, Star, Share2, Heart, ChevronRight,
    Wifi, Coffee, Car, Utensils, Check, User, Info,
    X, Camera, ChevronLeft, ArrowLeft,
    Tag
} from 'lucide-react';
import { fetchHotelDetails, searchHotels, fetchBasicHotelInfo } from '../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorAlert from '../components/ErrorAlert';
import { setInternalNavigation } from '../components/DirectAccessGuard';

const HotelDetailsPage = () => {
    const { hotelId } = useParams();
    const navigate = useNavigate();
    const [hotel, setHotel] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [isSticky, setIsSticky] = useState(false);
    const [expandedRoom, setExpandedRoom] = useState(null);
    const [dataSource, setDataSource] = useState(null); // Track where data came from
    const [showGallery, setShowGallery] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [roomImageIndices, setRoomImageIndices] = useState({});
    const [showAllRooms, setShowAllRooms] = useState(false);
    const [showSignInModal, setShowSignInModal] = useState(false);

    // Format number as Indian Rupee string (e.g. 1,23,456)
    const formatINR = (amount) =>
        new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount));

    const location = useLocation();

    // Initialize params from location state if available, otherwise defaults
    const searchParams = useMemo(() => {
        const state = location.state || {};
        const guests = state.guests || {};

        // Use local date to avoid UTC timezone shift (toISOString uses UTC which shifts dates back in IST)
        const formatLocalDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return {
            checkIn: state.checkIn || formatLocalDate(today),
            checkOut: state.checkOut || formatLocalDate(tomorrow),
            rooms: guests.rooms || 0,
            adults: guests.adults || 2,
            children: guests.children || 0,
            childrenAges: guests.childrenAges || []
        };
    }, [location.state]);

    useEffect(() => {
        const handleScroll = () => {
            setIsSticky(window.scrollY > 400);
            const sections = ['overview', 'rooms', 'facilities', 'location'];
            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    if (rect.top >= 0 && rect.top <= 300) {
                        setActiveTab(section);
                        break;
                    }
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            let hotelData = null;
            let roomData = [];

            // Step 1: Try to fetch full hotel details from TBO API
            try {
                const detailsResponse = await fetchHotelDetails(hotelId);
                // console.log('Hotel details response:', detailsResponse);
                if (detailsResponse && detailsResponse.HotelDetails && detailsResponse.HotelDetails.length > 0) {
                    hotelData = detailsResponse.HotelDetails[0];
                    setDataSource('tbo_details');
                    // console.log('Using TBO hotel details API data');
                }
            } catch (err) {
                console.warn("Could not fetch hotel details from TBO API:", err.message);
            }

            // Step 2: If no TBO details, try to get basic info from cached hotel lists
            if (!hotelData) {
                try {
                    const basicInfoResponse = await fetchBasicHotelInfo(hotelId);
                    // console.log('Basic hotel info response:', basicInfoResponse);
                    if (basicInfoResponse && basicInfoResponse.HotelInfo) {
                        const info = basicInfoResponse.HotelInfo;
                        hotelData = {
                            HotelCode: info.HotelCode,
                            HotelName: info.HotelName || `Hotel ${hotelId}`,
                            HotelRating: info.HotelRating || '3',
                            Address: info.HotelAddress || 'Address not available',
                            CityName: info.CityName || '',
                            CountryName: info.CountryName || '',
                            HotelPicture: info.HotelPicture || '',
                            Description: 'Full hotel details are currently unavailable. Please check back later for complete information.',
                            HotelFacilities: [],
                            Images: info.HotelPicture ? [info.HotelPicture] : [],
                            Map: info.Latitude && info.Longitude
                                ? `${info.Latitude}|${info.Longitude}`
                                : null,
                            RoomDetails: []
                        };
                        setDataSource('firebase_cache');
                        // console.log('Using Firebase cached hotel list data as fallback');
                    }
                } catch (err) {
                    console.warn("Could not fetch basic hotel info from cache:", err.message);
                }
            }

            // Step 3: Fetch room availability and pricing (always needed)
            try {
                const expectedRooms = Math.max(1, searchParams.rooms || 1);
                const totalAdults = Math.max(expectedRooms, searchParams.adults || 2);
                const totalChildren = searchParams.children || 0;
                
                const paxRooms = Array.from({ length: expectedRooms }).map((_, index) => {
                    const baseAdults = Math.floor(totalAdults / expectedRooms);
                    const extraAdults = totalAdults % expectedRooms;
                    const adultsCount = baseAdults + (index < extraAdults ? 1 : 0);

                    const baseChildren = Math.floor(totalChildren / expectedRooms);
                    const extraChildren = totalChildren % expectedRooms;
                    const childrenCount = baseChildren + (index < extraChildren ? 1 : 0);
                    
                    let ages = searchParams.childrenAges || [];
                    if (ages.length < totalChildren) {
                        ages = [...ages, ...Array(totalChildren - ages.length).fill(5)];
                    }
                    
                    const childAgesStart = index * baseChildren + Math.min(index, extraChildren);
                    const childAgesEnd = childAgesStart + childrenCount;
                    
                    const assignedAges = ages.slice(childAgesStart, childAgesEnd).map(age => parseInt(age) || 5);

                    return {
                        Adults: Math.max(1, adultsCount),
                        Children: childrenCount,
                        ChildrenAges: assignedAges
                    };
                });
                
                // Attach paxRooms directly to searchParams so it carries over to GuestDetailsPage
                searchParams.paxRooms = paxRooms;
                searchParams.adults = totalAdults;
                searchParams.rooms = expectedRooms;

                const payload = {
                    checkIn: searchParams.checkIn,
                    checkOut: searchParams.checkOut,
                    hotelCodes: hotelId,
                    guestNationality: "IN",
                    noOfRooms: expectedRooms,
                    paxRooms: paxRooms
                };

                // console.log('Fetching room availability with payload:', payload);

                const availability = await searchHotels(payload);
                // console.log('Search availability response:', availability);

                if (availability && availability.HotelResult && availability.HotelResult.length > 0) {
                    const searchResult = availability.HotelResult[0];
                    roomData = searchResult.Rooms || [];
                    // console.log('Available rooms:', roomData.length);

                    // Step 3a: If still no hotel data, use search result as last resort fallback
                    if (!hotelData) {
                        hotelData = {
                            HotelCode: searchResult.HotelCode,
                            HotelName: searchResult.HotelName || `Hotel ${hotelId}`,
                            HotelRating: searchResult.StarRating || searchResult.HotelRating || '3',
                            Address: searchResult.HotelAddress || 'Address not available',
                            CityName: searchResult.CityName || '',
                            CountryName: searchResult.CountryName || '',
                            HotelPicture: searchResult.HotelPicture || '',
                            Description: 'Hotel details are currently being updated. Please check back later for full details.',
                            HotelFacilities: searchResult.HotelFacilities || [],
                            Images: searchResult.HotelPicture ? [searchResult.HotelPicture] : [],
                            Map: searchResult.Latitude && searchResult.Longitude
                                ? `${searchResult.Latitude}|${searchResult.Longitude}`
                                : null,
                            RoomDetails: []
                        };
                        setDataSource('search_result');
                        // console.log('Using search result as hotel data fallback');
                    }
                }
            } catch (err) {
                console.error("Failed to fetch room availability:", err);
            }

            // Update state
            if (hotelData) {
                setHotel(hotelData);
                setRooms(roomData);
            } else {
                setError("Unable to fetch hotel information. The hotel may not be available at this time.");
            }

            setLoading(false);
        };

        loadData();
    }, [hotelId]);

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            const offset = 150;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            setActiveTab(id);
        }
    };

    const { currentUser } = useAuth();

    // Handle room reservation - navigate to checkout
    const handleReserve = (room) => {
        if (!room || !room.pricing) return;

        // Check if user is signed in
        if (!currentUser) {
            // Store booking intent in localStorage
            const bookingIntent = {
                hotel: hotel,
                room: room.pricing,
                searchParams: searchParams,
                bookingCode: room.pricing.BookingCode,
                redirectTo: '/checkout'
            };
            localStorage.setItem('pendingBooking', JSON.stringify(bookingIntent));

            // Show beautiful sign-in modal instead of browser alert
            setShowSignInModal(true);
            return;
        }

        // Navigate to checkout page with all necessary data
        setInternalNavigation();
        navigate('/checkout', {
            state: {
                hotel: hotel,
                room: room.pricing,
                searchParams: searchParams,
                bookingCode: room.pricing.BookingCode
            }
        });
    };

    // Lock / unlock body scroll whenever the gallery opens or closes,
    // and always restore on component unmount (e.g. navigating away).
    useEffect(() => {
        if (showGallery) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            // Cleanup: always restore scroll when this effect re-runs or component unmounts
            document.body.style.overflow = '';
        };
    }, [showGallery]);

    // Gallery functions
    const openGallery = (index = 0) => {
        setCurrentImageIndex(index);
        setShowGallery(true);
    };

    const closeGallery = () => {
        setShowGallery(false);
    };

    const nextImage = (images) => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (images) => {
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Handle keyboard navigation for gallery
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!showGallery) return;
            if (e.key === 'Escape') closeGallery();
            if (e.key === 'ArrowRight') nextImage(getImages(hotel));
            if (e.key === 'ArrowLeft') prevImage(getImages(hotel));
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showGallery, hotel]);

    const getImages = (hotelData) => {
        if (!hotelData) return [];
        if (Array.isArray(hotelData.Images)) return hotelData.Images.filter(img => img);
        if (typeof hotelData.Images === 'string') {
            if (hotelData.Images.includes(',')) return hotelData.Images.split(',').map(s => s.trim()).filter(s => s);
            return [hotelData.Images];
        }
        return [];
    };

    const getFacilities = (hotelData) => {
        if (!hotelData) return [];
        if (Array.isArray(hotelData.HotelFacilities)) return hotelData.HotelFacilities;
        if (typeof hotelData.HotelFacilities === 'string') {
            if (hotelData.HotelFacilities.includes(',')) return hotelData.HotelFacilities.split(',').map(s => s.trim());
            return [hotelData.HotelFacilities];
        }
        return [];
    };

    const stripHtml = (html) => {
        if (!html) return '';
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    const getAttractions = (hotelData) => {
        if (!hotelData || !hotelData.Attractions) return [];
        return Object.values(hotelData.Attractions).filter(a => a);
    };

    const getFacilityIcon = (facility) => {
        const lower = facility.toLowerCase();
        if (lower.includes('wifi') || lower.includes('internet')) return <Wifi size={16} className="text-blue-500" />;
        if (lower.includes('restaurant') || lower.includes('dining')) return <Utensils size={16} className="text-blue-500" />;
        if (lower.includes('parking') || lower.includes('car')) return <Car size={16} className="text-blue-500" />;
        if (lower.includes('breakfast') || lower.includes('coffee')) return <Coffee size={16} className="text-blue-500" />;
        if (lower.includes('pool') || lower.includes('swim')) return <span className="text-blue-500">🏊</span>;
        if (lower.includes('gym') || lower.includes('fitness')) return <span className="text-blue-500">💪</span>;
        if (lower.includes('spa')) return <span className="text-blue-500">💆</span>;
        if (lower.includes('bar') || lower.includes('lounge')) return <span className="text-blue-500">🍸</span>;
        return <Check size={16} className="text-blue-500" />;
    };

    const normalize = (str = "") =>
        str.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Compute merged rooms with useMemo
    const mergedRooms = useMemo(() => {
        const roomDetails = hotel?.RoomDetails || [];

        // console.log('Room Details from hotel:', roomDetails.map(r => r.RoomName));
        // console.log('Available rooms from search:', rooms.length, rooms.map(r => r.Name?.[0]));

        // If we have available rooms but no room details, show available rooms directly
        if (rooms.length > 0 && roomDetails.length === 0) {
            // console.log('No room details, showing available rooms directly');
            return rooms.map(r => ({
                RoomName: r.Name?.[0] || 'Room',
                RoomDescription: r.Inclusion || '',
                available: true,
                pricing: r,
                MealType: r.MealType
            }));
        }

        // If no room details AND no available rooms, return empty
        if (roomDetails.length === 0 && rooms.length === 0) return [];

        // Build availability map with multiple matching strategies
        const availabilityMap = {};
        const availabilityByPartialMatch = {};
        const matchedRoomIds = new Set(); // Track which available rooms have been matched

        rooms.forEach((r, idx) => {
            if (r?.Name?.[0]) {
                const fullKey = normalize(r.Name[0]);
                availabilityMap[fullKey] = { ...r, _idx: idx };

                // Also store by partial key (first 20 chars) for fuzzy matching
                const partialKey = fullKey.substring(0, 20);
                if (!availabilityByPartialMatch[partialKey]) {
                    availabilityByPartialMatch[partialKey] = [];
                }
                availabilityByPartialMatch[partialKey].push({ ...r, _idx: idx });
            }
        });

        // console.log('Availability map keys:', Object.keys(availabilityMap));

        // Merge rooms with better matching
        const merged = roomDetails
            .map(room => {
                const key = normalize(room.RoomName);
                let matchedRoom = availabilityMap[key];

                // If no exact match, try partial match
                if (!matchedRoom) {
                    const partialKey = key.substring(0, 20);
                    const partialMatches = availabilityByPartialMatch[partialKey];
                    if (partialMatches && partialMatches.length > 0) {
                        matchedRoom = partialMatches[0];
                        // console.log(`Partial match for ${room.RoomName}:`, matchedRoom.Name?.[0]);
                    }
                }

                // Track which rooms have been matched
                if (matchedRoom) {
                    matchedRoomIds.add(matchedRoom._idx);
                }

                // console.log(`Room "${room.RoomName}" - Available: ${!!matchedRoom}`);

                return {
                    ...room,
                    available: !!matchedRoom,
                    pricing: matchedRoom || null
                };
            })
            .sort((a, b) => b.available - a.available);

        // Add any unmatched available rooms at the end (rooms from search that didn't match any room details)
        const unmatchedAvailableRooms = rooms
            .filter((_, idx) => !matchedRoomIds.has(idx))
            .map(r => ({
                RoomName: r.Name?.[0] || 'Room',
                RoomDescription: r.Inclusion || '',
                available: true,
                pricing: r,
                MealType: r.MealType
            }));

        if (unmatchedAvailableRooms.length > 0) {
            // console.log('Adding unmatched available rooms:', unmatchedAvailableRooms.length);
            // Insert unmatched available rooms at the beginning (they are available)
            merged.unshift(...unmatchedAvailableRooms);
        }

        // console.log('Final merged rooms:', merged.length, 'available:', merged.filter(r => r.available).length);
        return merged;
    }, [hotel, rooms]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <ErrorAlert
                    message={error}
                    type="error"
                    title="Unable to Load Hotel"
                    dismissible={false}
                    onRetry={() => window.location.reload()}
                />
            </div>
        </div>
    );
    if (!hotel) return <div className="text-center py-10">Hotel not found</div>;

    const images = getImages(hotel);
    const facilities = getFacilities(hotel);
    const attractions = getAttractions(hotel);
    const mainImage = images.length > 0 ? images[0] : "https://via.placeholder.com/800x600?text=Hotel+Image";
    const description = stripHtml(hotel.Description);

    return (
        <div className="bg-gray-50 min-h-screen pb-24 md:pb-10">
            {/* Back Button & Breadcrumb */}
            <div className="container mx-auto px-4 py-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm mb-3 transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Back to results
                </button>
                <div className="flex items-center text-sm text-gray-500 mb-4 overflow-x-auto whitespace-nowrap">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/')}>Home</span>
                    <ChevronRight size={16} className="mx-2 flex-shrink-0" />
                    <span className="cursor-pointer hover:text-blue-600">{hotel.CountryName || 'India'}</span>
                    <ChevronRight size={16} className="mx-2 flex-shrink-0" />
                    <span className="cursor-pointer hover:text-blue-600">{hotel.CityName || 'City'}</span>
                    <ChevronRight size={16} className="mx-2 flex-shrink-0" />
                    <span className="text-gray-800 font-medium">{hotel.HotelName}</span>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">Preferred</span>
                            <div className="flex text-yellow-400">
                                {[...Array(parseInt(hotel.HotelRating) || 0)].map((_, i) => (
                                    <Star key={i} size={16} fill="currentColor" />
                                ))}
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{hotel.HotelName}</h1>
                        <div className="flex items-center text-blue-600 text-sm cursor-pointer hover:underline">
                            <MapPin size={16} className="mr-1" />
                            {hotel.Address} - <span className="ml-1 font-medium">Show on map</span>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button className="flex-1 md:flex-none justify-center flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                            <Share2 size={20} /> <span className="md:hidden">Share</span>
                        </button>
                        <button className="flex-1 md:flex-none justify-center flex items-center gap-2 p-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                            <Heart size={20} /> <span className="md:hidden">Save</span>
                        </button>
                        <button onClick={() => scrollToSection('rooms')} className="hidden md:block bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow-md">
                            Reserve
                        </button>
                    </div>
                </div>
            </div>

            {/* Image Gallery - Agoda/Booking.com Style */}
            <div className="container mx-auto px-4 mb-6">
                <div className="grid grid-cols-4 gap-1.5 rounded-xl overflow-hidden shadow-lg" style={{ height: 'auto' }}>
                    {/* Main Image - Takes 2 columns and full height */}
                    <div
                        className="col-span-4 md:col-span-2 md:row-span-2 relative overflow-hidden cursor-pointer group"
                        onClick={() => openGallery(0)}
                        style={{ minHeight: '300px', height: 'clamp(300px, 40vh, 420px)' }}
                    >
                        <img
                            src={mainImage}
                            alt={hotel.HotelName}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    {/* Secondary Images Grid - 4 images in a 2x2 grid */}
                    {[1, 2, 3, 4].map((idx) => (
                        <div
                            key={idx}
                            className={`relative overflow-hidden cursor-pointer group ${idx <= 2 ? 'hidden md:block' : 'hidden lg:block'}`}
                            onClick={() => openGallery(idx)}
                            style={{ height: 'clamp(145px, 19vh, 205px)' }}
                        >
                            <img
                                src={images[idx] || `https://via.placeholder.com/400x300?text=Photo+${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                alt={`Hotel photo ${idx + 1}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {/* Show +more overlay on last image */}
                            {idx === 4 && images.length > 5 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-semibold transition-all group-hover:bg-black/70">
                                    <div className="text-center">
                                        <Camera size={24} className="mx-auto mb-1" />
                                        <span className="text-lg">+{images.length - 5}</span>
                                        <p className="text-xs mt-0.5">photos</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Floating "See all photos" button */}
                <button
                    onClick={() => openGallery(0)}
                    className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors md:hidden"
                >
                    <Camera size={16} />
                    See all {images.length} photos
                </button>

                {/* Desktop "See all photos" button positioned at bottom-right */}
                {images.length > 5 && (
                    <div className="hidden md:flex justify-end mt-2">
                        <button
                            onClick={() => openGallery(0)}
                            className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 font-medium text-sm px-4 py-2 rounded-lg shadow-md border border-gray-200 transition-all hover:shadow-lg"
                        >
                            <Camera size={16} />
                            See all {images.length} photos
                        </button>
                    </div>
                )}
            </div>

            {/* ─── Sign-In Required Modal ─── */}
            {showSignInModal && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                    style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.55)' }}
                    onClick={() => setShowSignInModal(false)}
                >
                    <div
                        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        style={{
                            animation: 'signInModalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Gradient header strip */}
                        <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }} className="h-2 w-full" />

                        {/* Close button */}
                        <button
                            onClick={() => setShowSignInModal(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                        >
                            <X size={16} />
                        </button>

                        <div className="px-8 pt-8 pb-8 text-center">
                            {/* Icon */}
                            <div
                                className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)', border: '2px solid #e0e7ff' }}
                            >
                                <User size={28} style={{ color: '#2563eb' }} />
                            </div>

                            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to continue</h2>
                            <p className="text-sm text-gray-500 leading-relaxed mb-7">
                                You need to be signed in to complete your booking.
                                Your selected room has been saved — just sign in and you'll be ready to go!
                            </p>

                            {/* CTA buttons */}
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => { setShowSignInModal(false); navigate('/signin'); }}
                                    className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', boxShadow: '0 4px 15px rgba(37,99,235,0.35)' }}
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => { setShowSignInModal(false); navigate('/signup'); }}
                                    className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-all active:scale-[0.98]"
                                >
                                    Create an account
                                </button>
                                <button
                                    onClick={() => setShowSignInModal(false)}
                                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Keyframe style injected inline */}
                    <style>{`
                        @keyframes signInModalIn {
                            from { opacity: 0; transform: scale(0.85) translateY(20px); }
                            to   { opacity: 1; transform: scale(1)   translateY(0);    }
                        }
                    `}</style>
                </div>
            )}

            {/* Full Screen Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 text-white">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={closeGallery}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <span className="text-lg font-medium">{hotel.HotelName}</span>
                        </div>
                        <div className="text-sm text-gray-300">
                            {currentImageIndex + 1} / {images.length}
                        </div>
                    </div>

                    {/* Main Image Container */}
                    <div className="flex-1 flex items-center justify-center relative px-4">
                        {/* Previous Button */}
                        <button
                            onClick={() => prevImage(images)}
                            className="absolute left-4 p-3 bg-white/10 hover:bg-white/30 rounded-full transition-colors z-10"
                        >
                            <ChevronLeft size={32} className="text-white" />
                        </button>

                        {/* Current Image */}
                        <div className="max-w-5xl w-full h-full flex items-center justify-center">
                            <img
                                src={images[currentImageIndex]}
                                alt={`Photo ${currentImageIndex + 1}`}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                            />
                        </div>

                        {/* Next Button */}
                        <button
                            onClick={() => nextImage(images)}
                            className="absolute right-4 p-3 bg-white/10 hover:bg-white/30 rounded-full transition-colors z-10"
                        >
                            <ChevronRight size={32} className="text-white" />
                        </button>
                    </div>

                    {/* Thumbnail Strip */}
                    <div className="p-4 overflow-x-auto">
                        <div className="flex gap-2 justify-center">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`flex-shrink-0 w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden border-2 transition-all ${idx === currentImageIndex
                                        ? 'border-blue-500 ring-2 ring-blue-500/50 scale-105'
                                        : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <img
                                        src={img}
                                        alt={`Thumbnail ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Navigation */}
            <div className={`sticky top-0 z-40 bg-white shadow-md transition-transform duration-300 ${isSticky ? 'translate-y-0' : '-translate-y-full absolute opacity-0'} hidden md:block`} style={{ top: '70px' }}>
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between py-3">
                        <div className="flex gap-6 text-sm font-medium text-gray-600">
                            {['Overview', 'Rooms', 'Facilities', 'Location'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => scrollToSection(tab.toLowerCase())}
                                    className={`hover:text-blue-600 ${activeTab === tab.toLowerCase() ? 'text-blue-600 border-b-2 border-blue-600' : ''}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4">
                            <div>
                                <span className="text-xs text-gray-500 block">Starting from</span>
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold text-red-600 leading-none mt-1">
                                        ₹ {rooms[0]?.TotalFare ? formatINR(rooms[0].RSP || rooms[0].TotalFare) : 'N/A'}
                                    </span>
                                    <span className="text-[10px] text-gray-500 mt-0.5">Includes taxes & fees</span>
                                </div>
                            </div>
                            <button onClick={() => scrollToSection('rooms')} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">
                                Select Room
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Overview */}
                    <section id="overview" className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-4">Overview</h2>
                        <p className="text-gray-700 leading-relaxed mb-4 text-sm md:text-base">
                            {description || "Experience world-class service at this property."}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            {facilities.slice(0, 8).map((facility, idx) => (
                                <div key={idx} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg text-center">
                                    {getFacilityIcon(facility)}
                                    <span className="text-xs font-medium text-gray-600 mt-2 line-clamp-2">{facility}</span>
                                </div>
                            ))}
                        </div>

                        {(hotel.CheckInTime || hotel.CheckOutTime) && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {hotel.CheckInTime && (
                                        <div>
                                            <span className="font-bold text-gray-700">Check-in:</span>
                                            <div className="text-blue-600 font-medium">{hotel.CheckInTime}</div>
                                        </div>
                                    )}
                                    {hotel.CheckOutTime && (
                                        <div>
                                            <span className="font-bold text-gray-700">Check-out:</span>
                                            <div className="text-blue-600 font-medium">{hotel.CheckOutTime}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(hotel.PhoneNumber || hotel.Email) && (
                            <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                                <h3 className="font-bold text-sm mb-3 text-gray-800">Contact Information</h3>
                                <div className="space-y-2 text-sm text-gray-600">
                                    {hotel.PhoneNumber && (
                                        <div><span className="font-medium">Phone:</span> {hotel.PhoneNumber}</div>
                                    )}
                                    {hotel.Email && (
                                        <div><span className="font-medium">Email:</span> {hotel.Email}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Rooms */}
                    <section id="rooms" className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-6">Available Rooms</h2>

                        <div className="space-y-6">
                            {(() => {
                                if (mergedRooms.length === 0) {
                                    return (
                                        <div className="text-center text-gray-500 py-8">
                                            Select dates to see available rooms
                                        </div>
                                    );
                                }

                                const availableRooms = mergedRooms.filter(r => r.available);
                                const unavailableRooms = mergedRooms.filter(r => !r.available);

                                let visibleRooms;
                                let hiddenCount;

                                if (showAllRooms) {
                                    // Show everything
                                    visibleRooms = mergedRooms;
                                    hiddenCount = 0;
                                } else if (availableRooms.length > 0) {
                                    // Show only available rooms, hide unavailable
                                    visibleRooms = availableRooms;
                                    hiddenCount = unavailableRooms.length;
                                } else {
                                    // No available rooms — show first 2 as preview
                                    visibleRooms = mergedRooms.slice(0, 2);
                                    hiddenCount = mergedRooms.length - visibleRooms.length;
                                }

                                return (
                                    <>
                                        {availableRooms.length === 0 && !showAllRooms && (
                                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
                                                <Info size={16} className="flex-shrink-0" />
                                                No rooms are available for the selected dates. Here are some rooms this hotel offers:
                                            </div>
                                        )}

                                        {visibleRooms.map((room) => {
                                            const originalIdx = mergedRooms.indexOf(room);
                                            const unavailable = !room.available;
                                            const isExpanded = expandedRoom === originalIdx;

                                            return (
                                                <div
                                                    key={originalIdx}
                                                    className={`border rounded-lg overflow-hidden transition ${unavailable
                                                        ? "bg-gray-100 border-gray-300 opacity-70"
                                                        : "bg-white hover:shadow-md"
                                                        }`}
                                                >
                                                    <div className="flex flex-col md:flex-row">
                                                        {/* IMAGE */}
                                                        <div className="md:w-1/3 bg-gray-100 relative min-h-[200px]">
                                                            {(() => {
                                                                const roomImages = room.imageURL && room.imageURL.length > 0
                                                                    ? room.imageURL
                                                                    : (images[originalIdx + 1] ? [images[originalIdx + 1]] : ["https://via.placeholder.com/300x200?text=Room"]);
                                                                const currentIdx = roomImageIndices[originalIdx] || 0;
                                                                const hasMultiple = roomImages.length > 1;

                                                                return (
                                                                    <>
                                                                        <img
                                                                            src={roomImages[currentIdx] || roomImages[0]}
                                                                            alt={`${room.RoomName} - Photo ${currentIdx + 1}`}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                        {hasMultiple && (
                                                                            <>
                                                                                {/* Previous Button */}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setRoomImageIndices(prev => ({
                                                                                            ...prev,
                                                                                            [originalIdx]: (currentIdx - 1 + roomImages.length) % roomImages.length
                                                                                        }));
                                                                                    }}
                                                                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 z-10"
                                                                                    style={{ opacity: 1 }}
                                                                                >
                                                                                    <ChevronLeft size={18} className="text-gray-700" />
                                                                                </button>

                                                                                {/* Next Button */}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setRoomImageIndices(prev => ({
                                                                                            ...prev,
                                                                                            [originalIdx]: (currentIdx + 1) % roomImages.length
                                                                                        }));
                                                                                    }}
                                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 z-10"
                                                                                    style={{ opacity: 1 }}
                                                                                >
                                                                                    <ChevronRight size={18} className="text-gray-700" />
                                                                                </button>

                                                                                {/* Image Counter Badge */}
                                                                                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10">
                                                                                    <Camera size={12} />
                                                                                    {currentIdx + 1} / {roomImages.length}
                                                                                </div>

                                                                                {/* Dot Indicators */}
                                                                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                                                                    {roomImages.length <= 10
                                                                                        ? roomImages.map((_, dotIdx) => (
                                                                                            <button
                                                                                                key={dotIdx}
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setRoomImageIndices(prev => ({ ...prev, [originalIdx]: dotIdx }));
                                                                                                }}
                                                                                                className={`w-2 h-2 rounded-full transition-all ${
                                                                                                    dotIdx === currentIdx
                                                                                                        ? 'bg-white scale-125 shadow-md'
                                                                                                        : 'bg-white/50 hover:bg-white/80'
                                                                                                }`}
                                                                                            />
                                                                                        ))
                                                                                        : /* For many images, show simplified indicator */
                                                                                        null
                                                                                    }
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* CONTENT */}
                                                        <div className="md:w-2/3 p-4">
                                                            <h3 className="text-lg font-bold text-gray-800 mb-1">
                                                                {room.RoomName}
                                                            </h3>

                                                            {/* NOT AVAILABLE BADGE */}
                                                            {unavailable && (
                                                                <div className="inline-block mb-2 text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded">
                                                                    Not available for selected dates
                                                                </div>
                                                            )}

                                                            {/* DESCRIPTION */}
                                                            {room.RoomDescription && (
                                                                <p
                                                                    className="text-sm text-gray-800 mb-2 cursor-pointer"
                                                                    onClick={() =>
                                                                        setExpandedRoom(isExpanded ? null : originalIdx)
                                                                    }
                                                                >
                                                                    {isExpanded ||
                                                                        room.RoomDescription.length <= 175
                                                                        ? room.RoomDescription
                                                                        : `${room.RoomDescription.slice(0, 175)}...`}
                                                                    {room.RoomDescription.length > 175 && (
                                                                        <span className="ml-1 text-blue-600 font-medium">
                                                                            {isExpanded ? " Show less" : " Read more"}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            )}

                                                            {room.RoomSize && (
                                                                <div className="text-sm text-gray-600 mb-3">
                                                                    <span className="font-medium">Size:</span>{" "}
                                                                    {room.RoomSize}
                                                                </div>
                                                            )}

                                                            {/* INFO GRID */}
                                                            <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-600">
                                                                {/* Meal Type */}
                                                                <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                                                                    <Coffee size={14} className="flex-shrink-0" />
                                                                    <span className="truncate" title={room.pricing?.MealType || room.MealType || "Room Only"}>
                                                                        {(() => {
                                                                            const mt = room.pricing?.MealType || room.MealType || 'Room_Only';
                                                                            const lookup = {
                                                                                'Room_Only': 'Room Only',
                                                                                'BreakFast': 'Breakfast Included',
                                                                                'Breakfast_For_2': 'Breakfast for 2',
                                                                                'Breakfast_For_1': 'Breakfast for 1',
                                                                                'All_Inclusive_All_Meal': 'All Inclusive',
                                                                                'HalfBoard': 'Half Board',
                                                                                'FullBoard': 'Full Board'
                                                                            };
                                                                            return lookup[mt] || mt;
                                                                        })()}
                                                                    </span>
                                                                </div>

                                                                {/* Amenities Extract */}
                                                                {(room.pricing?.Amenities || []).slice(0, 3).map((amenity, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 col-span-2 sm:col-span-1">
                                                                        {(amenity.toLowerCase().includes('wifi') || amenity.toLowerCase().includes('internet')) ? <Wifi size={14} className="flex-shrink-0" /> : <Check size={14} className="flex-shrink-0" />}
                                                                        <span className="truncate" title={amenity}>{amenity}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* TAGS & PROMOTIONS */}
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                {room.pricing?.IsRefundable && (
                                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                                                        <Check size={12} /> Free Cancellation
                                                                    </span>
                                                                )}
                                                                {room.pricing?.Inclusion && (
                                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
                                                                        <Info size={12} /> {room.pricing.Inclusion}
                                                                    </span>
                                                                )}
                                                                {room.pricing?.RoomPromotion && room.pricing.RoomPromotion.length > 0 && (
                                                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded flex items-center gap-1 font-medium">
                                                                        <Tag size={12} /> {room.pricing.RoomPromotion.map(p => p.replace(/\|/g, '')).join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* PRICE + CTA */}
                                                            <div className="flex flex-col md:flex-row justify-between items-end mt-4 pt-4 border-t border-gray-100">
                                                                {room.available && room.pricing && (
                                                                    <div className="mb-2 md:mb-0">
                                                                        <div className="text-2xl font-bold text-red-600">
                                                                            ₹ {formatINR(room.pricing.RSP || room.pricing.TotalFare)}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            Includes taxes & fees
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <button
                                                                    disabled={unavailable}
                                                                    onClick={() => !unavailable && handleReserve(room)}
                                                                    className={`w-full md:w-auto px-8 py-3 rounded font-bold transition ${unavailable
                                                                        ? "bg-gray-400 cursor-not-allowed text-white"
                                                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                                                        }`}
                                                                >
                                                                    {unavailable ? "Unavailable" : "Reserve"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Show More / Show Less Button */}
                                        {!showAllRooms && hiddenCount > 0 && (
                                            <button
                                                onClick={() => setShowAllRooms(true)}
                                                className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                <ChevronRight size={18} className="rotate-90" />
                                                Show {hiddenCount} More Room{hiddenCount > 1 ? 's' : ''}
                                            </button>
                                        )}
                                        {showAllRooms && mergedRooms.length > availableRooms.length && (
                                            <button
                                                onClick={() => setShowAllRooms(false)}
                                                className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 font-semibold rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                <ChevronRight size={18} className="-rotate-90" />
                                                Show Less
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </section>

                    {/* Facilities */}
                    <section id="facilities" className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-6">Facilities & Services</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4">
                            {facilities.map((facility, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                    <Check size={14} className="text-green-500 flex-shrink-0" />
                                    <span className="truncate">{facility}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Location */}
                    <section id="location" className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-6">Location & Nearby</h2>

                        {hotel.Map && (
                            <div className="mb-6 h-64 bg-gray-100 rounded-lg overflow-hidden">
                                <iframe
                                    src={`https://www.google.com/maps?q=${hotel.Map.replace('|', ',')}&output=embed`}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                ></iframe>
                            </div>
                        )}

                        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                            <div className="flex items-start gap-3">
                                <MapPin className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <div className="font-bold text-gray-800 mb-1">{hotel.HotelName}</div>
                                    <div className="text-sm text-gray-600">{hotel.Address}</div>
                                    {hotel.PinCode && <div className="text-sm text-gray-600 mt-1">PIN: {hotel.PinCode}</div>}
                                </div>
                            </div>
                        </div>

                        {attractions.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 mb-4">Popular Nearby Attractions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {attractions.map((attraction, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                                                {idx + 1}
                                            </div>
                                            <span className="text-sm text-gray-700">{attraction}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                {/* Sidebar */}
                <div className="hidden lg:block">
                    <div className="sticky top-24 bg-white rounded-lg shadow-lg border border-gray-200 p-4" style={{ top: '10rem' }}>
                        <h3 className="font-bold text-gray-800 mb-4">Your Stay</h3>
                        <div className="space-y-3 mb-4">
                            <div className="flex gap-2">
                                <div className="flex-1 bg-gray-50 p-2 rounded border border-gray-200">
                                    <div className="text-xs text-gray-500">Check-in</div>
                                    <div className="font-medium text-sm">{searchParams.checkIn}</div>
                                </div>
                                <div className="flex-1 bg-gray-50 p-2 rounded border border-gray-200">
                                    <div className="text-xs text-gray-500">Check-out</div>
                                    <div className="font-medium text-sm">{searchParams.checkOut}</div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => scrollToSection('rooms')}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                        >
                            Reserve Now
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 md:hidden z-50">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-xs text-gray-500">Starting from</div>
                        <div className="flex flex-col">
                            <div className="text-xl font-bold text-red-600 leading-none mt-1">
                                ₹ {rooms[0]?.TotalFare ? formatINR(rooms[0].RSP || rooms[0].TotalFare) : 'N/A'}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">Includes taxes & fees</div>
                        </div>
                    </div>
                    <button
                        onClick={() => scrollToSection('rooms')}
                        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold"
                    >
                        Reserve
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HotelDetailsPage;