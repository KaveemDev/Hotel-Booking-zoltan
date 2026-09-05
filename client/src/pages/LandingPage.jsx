import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, MapPin, Star, Shield, Clock, Headphones, ChevronDown, ArrowRight, Quote, Plane, Heart, Award, LogOut, User, Building, X, Sparkles, Minus, Plus } from 'lucide-react';
import GlobeAnimation from '../components/GlobeAnimation';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../context/AuthContext';
import { fetchCities, fetchCountries, searchHotelNames } from '../services/api';
import logo from '../assets/logo.png';
import mumbaiImg from '../assets/mumbai.png';
import goaImg from '../assets/goa.png';
import jaipurImg from '../assets/jaipur.png';
import keralaImg from '../assets/kerala.png';
import '../styles/LandingPage.css';

// ─── Typewriter Hook ─────────────────────────────────────────
const useTypewriter = (words, typingSpeed = 100, deletingSpeed = 60, pauseDuration = 2000) => {
    const [text, setText] = useState('');
    const [wordIndex, setWordIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const currentWord = words[wordIndex];
        let timeout;
        if (!isDeleting && text === currentWord) {
            timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
        } else if (isDeleting && text === '') {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % words.length);
        } else {
            timeout = setTimeout(() => {
                setText(isDeleting
                    ? currentWord.substring(0, text.length - 1)
                    : currentWord.substring(0, text.length + 1)
                );
            }, isDeleting ? deletingSpeed : typingSpeed);
        }
        return () => clearTimeout(timeout);
    }, [text, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

    return text;
};

// ─── Scroll Reveal Hook ──────────────────────────────────────
const useScrollReveal = () => {
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('revealed');
            }),
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );
        const elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);
};

// ─── Counter Animation Hook ─────────────────────────────────
const useCountUp = (end, duration = 2000, startOnView = true) => {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const started = useRef(false);
    useEffect(() => {
        if (!startOnView) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                let startTime = null;
                const animate = (timestamp) => {
                    if (!startTime) startTime = timestamp;
                    const progress = Math.min((timestamp - startTime) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    setCount(Math.floor(eased * end));
                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }, { threshold: 0.5 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [end, duration, startOnView]);
    return [count, ref];
};

// ─── Stars Generator ─────────────────────────────────────────
const StarField = () => {
    const stars = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${1 + Math.random() * 3}px`,
        delay: `${Math.random() * 5}s`,
        duration: `${2 + Math.random() * 4}s`,
    }));
    return (
        <div className="stars-container">
            {stars.map((s) => (
                <div key={s.id} className="star" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.duration }} />
            ))}
        </div>
    );
};

// ─── Format Date Helper ──────────────────────────────────────
const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
};

// ─── Main Component ──────────────────────────────────────────
const LandingPage = () => {
    const navigate = useNavigate();
    const { currentUser, userData, logout } = useAuth();
    const [isNavScrolled, setIsNavScrolled] = useState(false);
    const [destination, setDestination] = useState('');
    const [selectedCityCode, setSelectedCityCode] = useState(null);
    const [selectedCountryCode, setSelectedCountryCode] = useState(null);
    const [selectedHotelCode, setSelectedHotelCode] = useState(null);
    const [selectedHotelInfo, setSelectedHotelInfo] = useState(null);
    const [checkIn, setCheckIn] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });
    const [checkOut, setCheckOut] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
    });
    const [guests, setGuests] = useState({ rooms: 1, adults: 2, children: 0, childrenAges: [] });
    const [showGuestDropdown, setShowGuestDropdown] = useState(false);
    const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
    const [isCalendarOverlayOpen, setIsCalendarOverlayOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const overlayInputRef = useRef(null);
    const countriesRef = useRef([]);
    const citiesCacheRef = useRef({});

    const TOP_COUNTRIES = ['IN', 'AE', 'US', 'GB', 'SG', 'TH', 'MY', 'FR', 'DE', 'AU', 'SA', 'LK', 'JP'];
    const QUICK_CITIES = ['Mumbai', 'Dubai', 'London', 'Singapore', 'Bangkok', 'Goa', 'Paris', 'Jaipur'];

    const POPULAR_DESTINATION_MAP = {
        'goa': 'Goa,   Goa',
        'rajasthan': 'Ajmer,   Rajasthan'
    };

    useScrollReveal();

    useEffect(() => {
        const handleScroll = () => setIsNavScrolled(window.scrollY > 80);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (isSearchOverlayOpen && overlayInputRef.current) {
            setTimeout(() => overlayInputRef.current.focus(), 150);
        }
    }, [isSearchOverlayOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setIsSearchOverlayOpen(false);
                setIsCalendarOverlayOpen(false);
                setShowDropdown(false);
                setShowGuestDropdown(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    // Lock body scroll when ANY overlay is open
    useEffect(() => {
        const isOpen = isSearchOverlayOpen || isCalendarOverlayOpen || showGuestDropdown;
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isSearchOverlayOpen, isCalendarOverlayOpen, showGuestDropdown]);

    useEffect(() => {
        const init = async () => {
            try {
                const data = await fetchCountries();
                if (data?.CountryList) countriesRef.current = data.CountryList;
                TOP_COUNTRIES.forEach(async (code) => {
                    try {
                        const cityData = await fetchCities(code);
                        if (cityData?.CityList) citiesCacheRef.current[code] = cityData.CityList;
                    } catch (e) { }
                });
            } catch (e) { console.error('Failed to init countries:', e); }
        };
        init();
    }, []);

    const getCountryName = useCallback((code) => {
        const country = countriesRef.current.find(c => c.Code === code);
        return country?.Name || code;
    }, []);

    const resolveTopSuggestion = useCallback(async (queryStr) => {
        if (!queryStr || queryStr.trim().length === 0) return null;
        const searchLower = queryStr.trim().toLowerCase();
        const mappedSearchLower = POPULAR_DESTINATION_MAP[searchLower]?.toLowerCase() || searchLower;

        let citySuggestions = [];
        const matchedCountryCodes = countriesRef.current
            .filter(c => c.Name.toLowerCase().includes(mappedSearchLower))
            .slice(0, 3)
            .map(c => c.Code);

        const countriesToSearch = Array.from(new Set([
            ...Object.keys(citiesCacheRef.current),
            ...TOP_COUNTRIES,
            ...matchedCountryCodes
        ]));

        const fetchPromises = [];
        for (const code of countriesToSearch) {
            const countryNameLower = getCountryName(code).toLowerCase();
            const isCountryMatch = countryNameLower.includes(mappedSearchLower);

            if (citiesCacheRef.current[code]) {
                const filtered = citiesCacheRef.current[code]
                    .filter(c => c.Name.toLowerCase().includes(mappedSearchLower) || isCountryMatch)
                    .slice(0, 3)
                    .map(c => ({ ...c, type: 'City', countryCode: code, countryName: getCountryName(code) }));
                citySuggestions = [...citySuggestions, ...filtered];
            } else if (isCountryMatch || TOP_COUNTRIES.includes(code)) {
                const promise = fetchCities(code).then(cityData => {
                    if (cityData?.CityList) {
                        citiesCacheRef.current[code] = cityData.CityList;
                        const filtered = cityData.CityList
                            .filter(c => c.Name.toLowerCase().includes(mappedSearchLower) || isCountryMatch)
                            .slice(0, 3)
                            .map(c => ({ ...c, type: 'City', countryCode: code, countryName: getCountryName(code) }));
                        citySuggestions = [...citySuggestions, ...filtered];
                    }
                }).catch(() => {});
                fetchPromises.push(promise);
            }
        }
        if (fetchPromises.length > 0) {
            await Promise.all(fetchPromises);
        }

        const seenCodes = new Set();
        citySuggestions = citySuggestions.filter(c => {
            if (seenCodes.has(c.Code)) return false;
            seenCodes.add(c.Code);
            return true;
        });
        citySuggestions.sort((a, b) => {
            const aName = a.Name.toLowerCase(), bName = b.Name.toLowerCase();
            if (aName === searchLower && bName !== searchLower) return -1;
            if (bName === searchLower && aName !== searchLower) return 1;
            if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
            if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;
            return 0;
        });
        citySuggestions = citySuggestions.slice(0, 8);

        let hotelSuggestions = [];
        try {
            const hotelData = await searchHotelNames(queryStr.trim());
            if (hotelData?.suggestions) {
                hotelSuggestions = hotelData.suggestions.map(h => ({
                    Code: h.hotelCode,
                    Name: h.hotelName,
                    Address: h.address,
                    CityName: h.cityName || '',
                    StarRating: h.StarRating || '',
                    Latitude: h.Latitude || '',
                    Longitude: h.Longitude || '',
                    type: 'Hotel'
                }));
            }
        } catch (e) { }

        const combined = [...citySuggestions, ...hotelSuggestions];
        return combined.length > 0 ? combined[0] : null;
    }, [getCountryName]);


    useEffect(() => {
        const getSuggestions = async () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            if (destination.length > 1) {
                setIsSearching(true);
                try {
                    const searchLower = destination.toLowerCase();
                    const mappedSearchLower = POPULAR_DESTINATION_MAP[searchLower]?.toLowerCase() || searchLower;
                    
                    const matchedCountryCodes = countriesRef.current
                        .filter(c => c.Name.toLowerCase().includes(mappedSearchLower))
                        .slice(0, 3)
                        .map(c => c.Code);

                    const countriesToSearch = Array.from(new Set([
                        ...Object.keys(citiesCacheRef.current),
                        ...TOP_COUNTRIES,
                        ...matchedCountryCodes
                    ]));

                    let citySuggestions = [];
                    const fetchPromises = [];

                    for (const code of countriesToSearch) {
                        const countryNameLower = getCountryName(code).toLowerCase();
                        const isCountryMatch = countryNameLower.includes(mappedSearchLower);

                        if (citiesCacheRef.current[code]) {
                            const filtered = citiesCacheRef.current[code]
                                .filter(c => c.Name.toLowerCase().includes(mappedSearchLower) || isCountryMatch)
                                .slice(0, 3)
                                .map(c => ({ ...c, type: 'City', countryCode: code, countryName: getCountryName(code) }));
                            citySuggestions = [...citySuggestions, ...filtered];
                        } else if (isCountryMatch || TOP_COUNTRIES.includes(code)) {
                            const promise = fetchCities(code).then(cityData => {
                                if (cityData?.CityList) {
                                    citiesCacheRef.current[code] = cityData.CityList;
                                    const filtered = cityData.CityList
                                        .filter(c => c.Name.toLowerCase().includes(mappedSearchLower) || isCountryMatch)
                                        .slice(0, 3)
                                        .map(c => ({ ...c, type: 'City', countryCode: code, countryName: getCountryName(code) }));
                                    citySuggestions = [...citySuggestions, ...filtered];
                                }
                            }).catch(() => {});
                            fetchPromises.push(promise);
                        }
                    }

                    if (fetchPromises.length > 0) {
                        await Promise.all(fetchPromises);
                    }

                    const seenCodes = new Set();
                    citySuggestions = citySuggestions.filter(c => {
                        if (seenCodes.has(c.Code)) return false;
                        seenCodes.add(c.Code);
                        return true;
                    });
                    citySuggestions.sort((a, b) => {
                        const aName = a.Name.toLowerCase(), bName = b.Name.toLowerCase();
                        if (aName === searchLower && bName !== searchLower) return -1;
                        if (bName === searchLower && aName !== searchLower) return 1;
                        if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
                        if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;
                        return 0;
                    });
                    citySuggestions = citySuggestions.slice(0, 8);

                    let hotelSuggestions = [];
                    try {
                        const hotelData = await searchHotelNames(destination);
                        if (hotelData?.suggestions) {
                            hotelSuggestions = hotelData.suggestions.map(h => ({
                                Code: h.hotelCode,
                                Name: h.hotelName,
                                Address: h.address,
                                CityName: h.cityName || '',
                                type: 'Hotel'
                            }));
                        }
                    } catch (e) { }

                    const combined = [...citySuggestions, ...hotelSuggestions];
                    setSuggestions(combined);
                    setShowDropdown(true);

                    if (combined.length === 0) {
                        searchTimeoutRef.current = setTimeout(() => {
                            setIsSearching(false);
                        }, 5000);
                    } else {
                        setIsSearching(false);
                    }
                } catch (error) { 
                    console.error("Failed to fetch suggestions", error);
                    setIsSearching(false);
                }
            } else {
                setSuggestions([]);
                setShowDropdown(false);
                setIsSearching(false);
            }
        };
        const timeoutId = setTimeout(getSuggestions, 300);
        return () => clearTimeout(timeoutId);
    }, [destination, getCountryName]);

    const typewriterText = useTypewriter(
        ['Your Dream Stay', 'Best Hotel Deals', 'Luxury Resorts', 'Beach Getaways', 'City Adventures'],
        90, 50, 1800
    );

    const [hotelCount, hotelRef] = useCountUp(200000, 2500);
    const [countryCount, countryRef] = useCountUp(50, 2000);
    const [guestCount, guestRef] = useCountUp(5, 2000);
    const [ratingCount, ratingRef] = useCountUp(49, 2000);

    const handleSuggestionSelect = useCallback((item) => {
        setDestination(item.countryName ? `${item.Name}, ${item.countryName}` : item.Name);
        setShowDropdown(false);
        setIsSearchOverlayOpen(false);
        if (item.type === 'City') {
            setSelectedCityCode(item.Code);
            setSelectedCountryCode(item.countryCode || 'IN');
            setSelectedHotelCode(null);
            setSelectedHotelInfo(null);
        } else {
            setSelectedHotelCode(item.Code);
            setSelectedCityCode(null);
            setSelectedCountryCode(null);
            setSelectedHotelInfo({
                HotelCode: item.Code, HotelName: item.Name,
                HotelAddress: item.Address || item.CityName || '',
                CityName: item.CityName || '', StarRating: item.StarRating || '',
                Latitude: item.Latitude || '', Longitude: item.Longitude || ''
            });
        }
    }, []);

    const handleGuestChange = useCallback((type, operation) => {
        setGuests(prev => {
            const ng = { ...prev };
            if (type === 'rooms') ng.rooms = operation === 'inc' ? Math.min(prev.rooms + 1, 4) : Math.max(prev.rooms - 1, 1);
            else if (type === 'adults') ng.adults = operation === 'inc' ? Math.min(prev.adults + 1, 8) : Math.max(prev.adults - 1, 1);
            else if (type === 'children') {
                const newCount = operation === 'inc' ? Math.min(prev.children + 1, 4) : Math.max(prev.children - 1, 0);
                ng.children = newCount;
                ng.childrenAges = newCount > prev.childrenAges.length
                    ? [...prev.childrenAges, 5]
                    : prev.childrenAges.slice(0, newCount);
            }
            return ng;
        });
    }, []);

    const handleQuickCitySelect = useCallback(async (cityName) => {
        setDestination(cityName);
        try {
            const mappedCityName = POPULAR_DESTINATION_MAP[cityName.toLowerCase()] || cityName;
            for (const code of TOP_COUNTRIES) {
                const cityData = citiesCacheRef.current[code]
                    ? { CityList: citiesCacheRef.current[code] }
                    : await fetchCities(code);
                if (cityData?.CityList) {
                    citiesCacheRef.current[code] = cityData.CityList;
                    const match = cityData.CityList.find(c => c.Name.toLowerCase() === mappedCityName.toLowerCase()) || 
                                  cityData.CityList.find(c => c.Name.toLowerCase().includes(mappedCityName.toLowerCase()) || mappedCityName.toLowerCase().includes(c.Name.toLowerCase()));
                    if (match) {
                        setSelectedCityCode(match.Code);
                        setSelectedCountryCode(code);
                        setSelectedHotelCode(null);
                        setSelectedHotelInfo(null);
                        setDestination(`${match.Name}, ${getCountryName(code)}`);
                        return;
                    }
                }
            }
        } catch (err) { console.error('Failed to look up city:', err); }
    }, [getCountryName]);

    const handleExplore = useCallback(async () => {
        let cityCodeToSearch = selectedCityCode;
        let countryCodeToSearch = selectedCountryCode;
        let hotelCodeToSearch = selectedHotelCode;
        let hotelInfoToSearch = selectedHotelInfo;
        let destText = destination;

        if (!cityCodeToSearch && !hotelCodeToSearch && destination.trim()) {
            let topSuggestion = suggestions.length > 0 ? suggestions[0] : null;
            if (!topSuggestion) {
                topSuggestion = await resolveTopSuggestion(destination.trim());
            }

            if (topSuggestion) {
                if (topSuggestion.type === 'City') {
                    cityCodeToSearch = topSuggestion.Code;
                    countryCodeToSearch = topSuggestion.countryCode || topSuggestion.CountryCode || 'IN';
                    destText = topSuggestion.countryName ? `${topSuggestion.Name}, ${topSuggestion.countryName}` : topSuggestion.Name;
                } else {
                    hotelCodeToSearch = topSuggestion.Code;
                    hotelInfoToSearch = {
                        HotelCode: topSuggestion.Code,
                        HotelName: topSuggestion.Name,
                        HotelAddress: topSuggestion.Address || topSuggestion.CityName || '',
                        CityName: topSuggestion.CityName || '',
                        StarRating: topSuggestion.StarRating || '',
                        Latitude: topSuggestion.Latitude || '',
                        Longitude: topSuggestion.Longitude || ''
                    };
                    destText = topSuggestion.Name;
                }
            }
        }

        navigate('/search', {
            state: { destination: destText, cityCode: cityCodeToSearch, countryCode: countryCodeToSearch, hotelCode: hotelCodeToSearch, hotelInfo: hotelInfoToSearch, checkIn, checkOut, guests }
        });
    }, [navigate, destination, selectedCityCode, selectedCountryCode, selectedHotelCode, selectedHotelInfo, checkIn, checkOut, guests, suggestions, resolveTopSuggestion]);

    const features = [
        { icon: <Shield className="w-6 h-6 text-indigo-400" />, bg: 'feature-icon-indigo', title: 'Best Price Guarantee', desc: 'Find a lower price? We\'ll match it and give you an extra 10% off.' },
        { icon: <Headphones className="w-6 h-6 text-pink-400" />, bg: 'feature-icon-pink', title: '24/7 Customer Support', desc: 'Our travel experts are available around the clock to assist you.' },
        { icon: <Award className="w-6 h-6 text-cyan-400" />, bg: 'feature-icon-cyan', title: 'Verified Properties', desc: 'Every hotel is personally verified for quality and authenticity.' },
        { icon: <Heart className="w-6 h-6 text-rose-400" />, bg: 'feature-icon-rose', title: 'Loyalty Rewards', desc: 'Earn points on every booking and unlock exclusive member-only deals.' },
    ];

    const destinations = [
        { img: mumbaiImg, city: 'Mumbai', tag: 'City of Dreams', hotels: '12,000+' },
        { img: goaImg, city: 'Goa', tag: 'Beach Paradise', hotels: '8,500+' },
        { img: jaipurImg, city: 'Jaipur', tag: 'Pink City', hotels: '6,200+' },
        { img: keralaImg, city: 'Kerala', tag: 'God\'s Own Country', hotels: '9,800+' },
    ];

    const testimonials = [
        { name: 'Priya Sharma', role: 'Business Traveller', text: 'Zovotel made finding a hotel in Mumbai incredibly easy. The prices were unbeatable and the booking was seamless!', rating: 5 },
        { name: 'Rahul Mehra', role: 'Family Vacation', text: 'We booked our Goa vacation through Zovotel and it was the best decision. The hotel exceeded our expectations.', rating: 5 },
        { name: 'Anita Desai', role: 'Solo Explorer', text: 'The variety of options and real-time pricing helped me find perfect stays across India. Highly recommended!', rating: 5 },
    ];

    // Guest summary text
    const guestSummary = `${guests.adults} Adult${guests.adults > 1 ? 's' : ''}${guests.children > 0 ? `, ${guests.children} Child${guests.children !== 1 ? 'ren' : ''}` : ''}`;

    return (
        <div className="landing-page bg-[#0f0c29] text-white min-h-screen">

            {/* ══════════════ NAVBAR ══════════════ */}
            <nav className={`landing-nav ${isNavScrolled ? 'scrolled' : ''}`}>
                <Link to="/" className="flex items-center gap-2">
                    <img src={logo} alt="Zovotel" className="h-10" />
                </Link>
                <div className="flex items-center gap-4 sm:gap-6">
                    <Link to="/search" className="nav-link hidden sm:block">Hotels</Link>
                    <Link to="/help" onClick={() => window.scrollTo(0, 0)} className="nav-link hidden sm:block">Help</Link>
                    {currentUser ? (
                        <>
                            <Link to="/profile" className="nav-avatar-link">
                                <div className="nav-avatar">
                                    {(userData?.username || currentUser?.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <span className="hidden sm:inline text-sm font-medium text-white/80">
                                    {userData?.username || currentUser?.email?.split('@')[0]}
                                </span>
                            </Link>
                            <button onClick={async () => { try { await logout(); } catch (e) { console.error(e); } }} className="nav-btn">
                                <LogOut size={14} />
                                <span>Logout</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/signin" className="nav-link">Sign In</Link>
                            <Link to="/signup" className="nav-btn">Sign Up</Link>
                        </>
                    )}
                </div>
            </nav>

            {/* ══════════════ HERO SECTION ══════════════ */}
            <section className="landing-hero">
                <GlobeAnimation />
                <div className="hero-overlay" />

                <div className="relative z-10 w-full max-w-5xl px-4 pt-24 pb-32 text-center">
                    {/* Badge */}
                    <div className="hero-badge" style={{ animationDelay: '0.2s' }}>
                        <Plane className="w-4 h-4 text-indigo-400" />
                        <span>Over 2 million properties worldwide</span>
                    </div>

                    {/* Heading */}
                    <h1 className="hero-heading" style={{ animationDelay: '0.1s' }}>
                        <span className="block text-white/90 mb-2">Discover</span>
                        <span className="typewriter-container">
                            <span className="hero-gradient-text">{typewriterText}</span>
                            <span className="typewriter-cursor" />
                        </span>
                    </h1>

                    <p className="hero-subtext" style={{ animationDelay: '0.3s' }}>
                        Search from over 2,000,000 hotels, resorts, and hostels. Get the best prices guaranteed.
                    </p>

                    {/* ─── Search Bar ─── */}
                    <div className="hero-search-card" style={{ animationDelay: '0.4s' }}>
                        <div className="hero-search-inner">

                            {/* Destination */}
                            <button className="search-field search-field-destination" onClick={() => setIsSearchOverlayOpen(true)}>
                                <div className="search-field-icon">
                                    <MapPin className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="search-field-content">
                                    <span className="search-field-label">Where</span>
                                    <span className={`search-field-value ${!destination ? 'placeholder' : ''}`}>
                                        {destination || 'Search destinations'}
                                    </span>
                                </div>
                            </button>

                            <div className="search-divider" />

                            {/* Dates */}
                            <button className="search-field search-field-dates" onClick={() => setIsCalendarOverlayOpen(true)}>
                                <div className="search-field-icon">
                                    <Clock className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="search-field-content">
                                    <span className="search-field-label">When</span>
                                    <span className="search-field-value">
                                        {checkIn && checkOut
                                            ? `${formatDisplayDate(checkIn)} → ${formatDisplayDate(checkOut)}`
                                            : 'Select dates'}
                                    </span>
                                </div>
                            </button>

                            <div className="search-divider" />

                            {/* Guests */}
                            <button
                                className="search-field search-field-guests"
                                onClick={() => setShowGuestDropdown(true)}
                            >
                                <div className="search-field-icon">
                                    <Users className="w-4 h-4 text-pink-400" />
                                </div>
                                <div className="search-field-content">
                                    <span className="search-field-label">Guests</span>
                                    <span className="search-field-value">{guestSummary}</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-white/30 ml-1 flex-shrink-0" />
                            </button>

                            {/* Search Button */}
                            <button onClick={handleExplore} className="search-cta-btn">
                                <Search className="w-5 h-5" />
                                <span>Search</span>
                            </button>
                        </div>
                    </div>

                    {/* Quick Destination Tags */}
                    <div className="hero-quick-tags" style={{ animationDelay: '0.6s' }}>
                        <span className="quick-tags-label">Popular:</span>
                        {QUICK_CITIES.map((city) => (
                            <button key={city} onClick={() => handleQuickCitySelect(city)} className="quick-tag-btn">
                                {city}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="scroll-indicator">
                    <ChevronDown className="w-5 h-5 text-white/40" />
                </div>
            </section>

            {/* ══════════════ STATS SECTION ══════════════ */}
            <section className="py-20 bg-[#0d0a24] border-y border-white/5">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { ref: hotelRef, value: `${hotelCount.toLocaleString()}+`, label: 'Hotels Worldwide' },
                            { ref: countryRef, value: `${countryCount}+`, label: 'Countries' },
                            { ref: guestRef, value: `${guestCount}M+`, label: 'Happy Guests' },
                            { ref: ratingRef, value: (ratingCount / 10).toFixed(1), label: 'Average Rating' },
                        ].map((stat, i) => (
                            <div style={{ width: 'fit-content' }} key={i} className={`stat-item reveal delay-${i * 100}`} ref={stat.ref}>
                                <div className="stat-number">{stat.value}</div>
                                <p className="text-white/50 mt-1 text-sm font-medium">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ FEATURES SECTION ══════════════ */}
            <section className="py-24 bg-[#0f0c29]">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="section-header">
                        <h2 className="section-title reveal">Why Choose <span className="hero-gradient-text">Zovotel</span></h2>
                        <div className="section-separator reveal delay-100" />
                        <p className="section-desc reveal delay-200">We're committed to making your travel experience exceptional from booking to checkout.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, i) => (
                            <div key={i} className={`feature-card reveal delay-${(i + 1) * 100}`}>
                                <div className={`feature-icon-wrap ${feature.bg}`}>{feature.icon}</div>
                                <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                                <p className="text-white/50 text-sm leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ POPULAR DESTINATIONS ══════════════ */}
            <section className="py-24 bg-[#0d0a24]">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="section-header">
                        <h2 className="section-title reveal">Popular <span className="hero-gradient-text">Destinations</span></h2>
                        <div className="section-separator reveal delay-100" />
                        <p className="section-desc reveal delay-200">Explore the most sought-after destinations across India.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {destinations.map((dest, i) => (
                            <div key={dest.city} className={`destination-card h-80 reveal-scale delay-${(i + 1) * 100}`}
                                onClick={() => navigate('/search', { state: { destination: dest.city, checkIn, checkOut, guests } })}>
                                <img src={dest.img} alt={dest.city} loading="lazy" />
                                <div className="destination-overlay">
                                    <div className="flex items-center gap-1 mb-1">
                                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                                        <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">{dest.tag}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{dest.city}</h3>
                                    <p className="text-white/60 text-sm mt-0.5">{dest.hotels} properties</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ TESTIMONIALS ══════════════ */}
            <section className="py-24 bg-[#0f0c29]">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="section-header">
                        <h2 className="section-title reveal">What Our <span className="hero-gradient-text">Guests Say</span></h2>
                        <div className="section-separator reveal delay-100" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {testimonials.map((t, i) => (
                            <div key={i} className={`testimonial-card reveal delay-${(i + 1) * 100}`}>
                                <Quote className="w-7 h-7 text-indigo-500/30 mb-4" />
                                <p className="text-white/65 text-sm leading-relaxed mb-6">"{t.text}"</p>
                                <div className="flex items-center gap-3">
                                    <div className="testimonial-avatar">
                                        {t.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold text-sm">{t.name}</p>
                                        <p className="text-white/40 text-xs">{t.role}</p>
                                    </div>
                                    <div className="ml-auto flex gap-0.5">
                                        {Array.from({ length: t.rating }, (_, j) => (
                                            <Star key={j} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ CTA SECTION ══════════════ */}
            <section className="cta-section py-24">
                <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5 reveal">Ready to Start Your Journey?</h2>
                    <p className="text-white/70 text-lg max-w-xl mx-auto mb-10 reveal delay-100">
                        Join millions of happy travellers and find your perfect stay today.
                    </p>
                    <button onClick={() => navigate('/search')} className="cta-button reveal delay-200">
                        <Search className="w-5 h-5" />
                        <span>Explore Hotels</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {/* ══════════════ FOOTER ══════════════ */}
            <footer className="landing-footer py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
                        <div>
                            <Link to="/" className="inline-block">
                                <img src={logo} alt="Zovotel" className="h-10 mb-4" />
                            </Link>
                            <p className="text-white/40 text-sm leading-relaxed">Your trusted companion for finding the perfect hotel stay, anywhere in the world.</p>
                        </div>
                        <div>
                            <h4 className="footer-col-title">Company</h4>
                            <ul className="space-y-2">
                                {[{ label: 'About Us', path: '/about' }, { label: 'Careers', path: '#' }, { label: 'Press', path: '#' }, { label: 'Blog', path: '#' }].map(item => (
                                    <li key={item.label}><Link to={item.path} onClick={() => window.scrollTo(0, 0)} className="footer-link">{item.label}</Link></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="footer-col-title">Support</h4>
                            <ul className="space-y-2">
                                {[{ label: 'Help Center', path: '/help' }, { label: 'Safety', path: '/safety' }, { label: 'Cancellation', path: '/cancellation' }, { label: 'Contact Us', path: '/contact' }].map(item => (
                                    <li key={item.label}><Link to={item.path} onClick={() => window.scrollTo(0, 0)} className="footer-link">{item.label}</Link></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="footer-col-title">Discover</h4>
                            <ul className="space-y-2">
                                {['Mumbai Hotels', 'Goa Hotels', 'Delhi Hotels', 'Jaipur Hotels'].map(item => (
                                    <li key={item}><span className="footer-link">{item}</span></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-white/30 text-sm">© 2026 Zovotel. All rights reserved.</p>
                        <div className="flex gap-6">
                            {['Privacy', 'Terms', 'Cookies'].map(item => (
                                <span key={item} className="footer-link text-sm">{item}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>

            {/* ══════════════ SEARCH OVERLAY ══════════════ */}
            {isSearchOverlayOpen && (
                <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Search destinations">
                    <div className="lp-overlay-backdrop" onClick={() => { setIsSearchOverlayOpen(false); setShowDropdown(false); }} />
                    <div className="lp-overlay-panel lp-search-panel">
                        <div className="lp-overlay-header">
                            <div>
                                <h2 className="lp-overlay-title">Where to?</h2>
                                <p className="lp-overlay-subtitle">Search cities, hotels, or destinations</p>
                            </div>
                            <button onClick={() => { setIsSearchOverlayOpen(false); setShowDropdown(false); }} className="lp-close-btn" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="lp-search-input-wrap">
                            <Search className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                            <input
                                ref={overlayInputRef}
                                type="text"
                                value={destination}
                                onChange={(e) => {
                                    setDestination(e.target.value);
                                    if (e.target.value.length <= 1) {
                                        setIsSearching(false);
                                    }
                                    setSelectedCityCode(null); setSelectedCountryCode(null);
                                    setSelectedHotelCode(null); setSelectedHotelInfo(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleExplore();
                                    }
                                }}
                                placeholder="Search cities, hotels, destinations..."
                                className="lp-search-input"
                                autoFocus
                            />
                            {destination && (
                                <button onClick={() => { setDestination(''); setSelectedCityCode(null); setSelectedCountryCode(null); setSelectedHotelCode(null); setSelectedHotelInfo(null); }} className="lp-input-clear" aria-label="Clear">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Suggestions list */}
                        {showDropdown && suggestions.length > 0 && (
                            <div className="lp-suggestions-list">
                                <p className="lp-suggestions-label">Results</p>
                                {suggestions.map((item, index) => (
                                    <button key={`${item.type}-${item.Code}`} className="lp-suggestion-item"
                                        style={{ animationDelay: `${index * 35}ms` }}
                                        onClick={() => handleSuggestionSelect(item)}>
                                        <div className={`lp-suggestion-icon ${item.type === 'City' ? 'city' : 'hotel'}`}>
                                            {item.type === 'City' ? <MapPin className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                                        </div>
                                        <div className="lp-suggestion-text">
                                            <span className="lp-suggestion-name">{item.Name}</span>
                                            <span className="lp-suggestion-sub">
                                                {item.type === 'City' ? (item.countryName || 'City') : (item.CityName || item.Address || 'Hotel')}
                                            </span>
                                        </div>
                                        <span className="lp-suggestion-badge">{item.type}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {(!showDropdown || suggestions.length === 0) && (
                            <div className="lp-empty-state">
                                {destination.length === 0 ? (
                                    <>
                                        <p className="lp-suggestions-label">Popular destinations</p>
                                        <div className="lp-quick-grid">
                                            {QUICK_CITIES.map(city => (
                                                <button key={city} onClick={() => { setDestination(city); handleQuickCitySelect(city); setIsSearchOverlayOpen(false); }} className="lp-quick-city-btn">
                                                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                                                    {city}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : destination.length === 1 ? (
                                    <p className="lp-hint-text">Keep typing to see suggestions…</p>
                                ) : isSearching ? (
                                    <div className="lp-loading">
                                        <div className="lp-spinner" />
                                        <p>Searching…</p>
                                    </div>
                                ) : (
                                    <div className="lp-empty-results">
                                        <div className="lp-empty-icon">
                                            <Search className="w-6 h-6 text-indigo-400/50" />
                                        </div>
                                        <p className="text-white/80 font-medium mb-1">No results found for "{destination}"</p>
                                        <p className="text-white/50 text-sm">Try checking for typos or searching for a different destination</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="lp-esc-hint">Press <kbd>ESC</kbd> to close</p>
                    </div>
                </div>
            )}

            {/* ══════════════ CALENDAR OVERLAY ══════════════ */}
            {isCalendarOverlayOpen && (
                <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Select dates">
                    <div className="lp-overlay-backdrop" onClick={() => setIsCalendarOverlayOpen(false)} />
                    <div className="lp-overlay-panel lp-calendar-panel">
                        <div className="lp-overlay-header">
                            <div>
                                <h2 className="lp-overlay-title">When are you going?</h2>
                                <p className="lp-overlay-subtitle">Select check-in and check-out dates</p>
                            </div>
                            <button onClick={() => setIsCalendarOverlayOpen(false)} className="lp-close-btn" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="lp-calendar-body">
                            <DateRangePicker
                                checkInDate={checkIn}
                                checkOutDate={checkOut}
                                onCheckInChange={setCheckIn}
                                onCheckOutChange={setCheckOut}
                                variant="dark"
                                inline={true}
                            />
                        </div>

                        <div className="lp-calendar-footer">
                            <div className="lp-date-summary">
                                <div className="lp-date-chip">
                                    <span className="lp-date-chip-label">Check-in</span>
                                    <span className="lp-date-chip-value">{formatDisplayDate(checkIn)}</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-white/30" />
                                <div className="lp-date-chip">
                                    <span className="lp-date-chip-label">Check-out</span>
                                    <span className="lp-date-chip-value">{formatDisplayDate(checkOut)}</span>
                                </div>
                            </div>
                            <button onClick={() => setIsCalendarOverlayOpen(false)} className="lp-confirm-btn">
                                Confirm Dates
                            </button>
                        </div>

                        <p className="lp-esc-hint">Press <kbd>ESC</kbd> to close</p>
                    </div>
                </div>
            )}

            {/* ══════════════ GUEST MODAL ══════════════ */}
            {showGuestDropdown && (
                <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Select guests">
                    <div className="lp-overlay-backdrop" onClick={() => setShowGuestDropdown(false)} />
                    <div className="lp-overlay-panel lp-guest-panel">
                        <div className="lp-overlay-header">
                            <div>
                                <h2 className="lp-overlay-title">Guests & Rooms</h2>
                                <p className="lp-overlay-subtitle">Who's coming along?</p>
                            </div>
                            <button onClick={() => setShowGuestDropdown(false)} className="lp-close-btn" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="lp-guest-rows">
                            {[
                                { type: 'rooms', label: 'Rooms', sub: 'Max 4 rooms', value: guests.rooms, min: 1, max: 4 },
                                { type: 'adults', label: 'Adults', sub: 'Ages 18 and above', value: guests.adults, min: 1, max: 8 },
                                { type: 'children', label: 'Children', sub: 'Ages 0 – 17', value: guests.children, min: 0, max: 4 },
                            ].map(row => (
                                <div key={row.type} className="lp-guest-row">
                                    <div className="lp-guest-row-info">
                                        <span className="lp-guest-row-label">{row.label}</span>
                                        <span className="lp-guest-row-sub">{row.sub}</span>
                                    </div>
                                    <div className="lp-guest-counter">
                                        <button onClick={() => handleGuestChange(row.type, 'dec')} disabled={row.value <= row.min} className="lp-counter-btn" aria-label={`Decrease ${row.label}`}>
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="lp-counter-value">{row.value}</span>
                                        <button onClick={() => handleGuestChange(row.type, 'inc')} disabled={row.value >= row.max} className="lp-counter-btn" aria-label={`Increase ${row.label}`}>
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Child ages */}
                        {guests.children > 0 && (
                            <div className="lp-child-ages">
                                <p className="lp-child-ages-title">Child ages at time of travel</p>
                                <div className="lp-child-ages-grid">
                                    {guests.childrenAges.map((age, i) => (
                                        <div key={i} className="lp-child-age-item">
                                            <label className="lp-child-age-label">Child {i + 1}</label>
                                            <select value={age}
                                                onChange={(e) => {
                                                    const newAges = [...guests.childrenAges];
                                                    newAges[i] = parseInt(e.target.value);
                                                    setGuests(prev => ({ ...prev, childrenAges: newAges }));
                                                }}
                                                className="lp-child-age-select">
                                                <option value={0}>Under 1</option>
                                                {[...Array(17)].map((_, idx) => (
                                                    <option key={idx + 1} value={idx + 1}>{idx + 1} yr{idx + 1 !== 1 ? 's' : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={() => setShowGuestDropdown(false)} className="lp-confirm-btn lp-guest-done-btn">
                            Done — {guestSummary}, {guests.rooms} Room{guests.rooms > 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
