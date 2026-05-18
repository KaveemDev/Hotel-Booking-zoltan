import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Search, User, MapPin, Minus, Plus, ChevronDown, Building, X, Sparkles } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { fetchInitialData, fetchHotelSuggestions } from '../redux/slices/suggestionsSlice';

// Top countries to search cities from (pre-cached for fast suggestions)
const TOP_COUNTRIES = ['IN', 'AE', 'US', 'GB', 'SG', 'TH', 'MY', 'FR', 'DE', 'AU', 'SA', 'LK', 'JP'];

const QUICK_CITIES = ['Mumbai', 'Dubai', 'London', 'Singapore', 'Bangkok', 'Goa', 'Paris', 'Jaipur'];

const POPULAR_DESTINATION_MAP = {
  'goa': 'Goa,   Goa',
  'rajasthan': 'Ajmer,   Rajasthan'
};

const HeroSearchBar = ({ onSearch, compact = false, locationState, cachedSearchParams, recentHotels = [] }) => {
  const hasAutoSearched = useRef(false);
  const [destination, setDestination] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState(null);
  const [selectedHotelCode, setSelectedHotelCode] = useState(null);
  const [selectedHotelInfo, setSelectedHotelInfo] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [checkInDate, setCheckInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });

  const [guests, setGuests] = useState({
    rooms: 1,
    adults: 2,
    children: 0,
    childrenAges: []
  });
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const overlayInputRef = useRef(null);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { countries, cities, hotelCache } = useSelector((state) => state.suggestions);

  // Fetch countries and all cities on mount
  useEffect(() => {
    dispatch(fetchInitialData());
  }, [dispatch]);

  // Focus overlay input when opened
  useEffect(() => {
    if (isSearchOverlayOpen && overlayInputRef.current) {
      setTimeout(() => overlayInputRef.current.focus(), 100);
    }
  }, [isSearchOverlayOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowGuestDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key to close overlay
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsSearchOverlayOpen(false);
        setShowDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Pre-fill from landing page state and auto-trigger search
  useEffect(() => {
    if (locationState && !hasAutoSearched.current) {
      const dest = locationState.destination;
      if (dest) {
        setDestination(dest);
      }
      if (locationState.checkIn) {
        setCheckInDate(locationState.checkIn);
      }
      if (locationState.checkOut) {
        setCheckOutDate(locationState.checkOut);
      }
      if (locationState.guests) {
        if (typeof locationState.guests === 'number') {
          setGuests(prev => ({ ...prev, adults: locationState.guests }));
        } else if (typeof locationState.guests === 'object') {
          setGuests(locationState.guests);
        }
      }
      if (locationState.countryCode) {
        setSelectedCountryCode(locationState.countryCode);
      }
      if (locationState.cityCode) {
        setSelectedCityCode(locationState.cityCode);
      }

      // Auto-search: look up city code across countries and trigger search
      if (dest && onSearch) {
        hasAutoSearched.current = true;
        const autoSearch = async () => {
          try {
            // If cityCode was passed from landing page, use it directly
            if (locationState.cityCode) {
              onSearch({
                destination: dest,
                cityCode: locationState.cityCode,
                countryCode: locationState.countryCode || 'IN',
                hotelCode: locationState.hotelCode || null,
                hotelInfo: locationState.hotelInfo || null,
                checkInDate: locationState.checkIn || checkInDate,
                checkOutDate: locationState.checkOut || checkOutDate,
                guests: typeof locationState.guests === 'number'
                  ? { rooms: 1, adults: locationState.guests, children: 0, childrenAges: [] }
                  : typeof locationState.guests === 'object'
                    ? locationState.guests
                    : guests
              });
              return;
            }

            // Otherwise search across countries to find the city
            // Otherwise search across cities to find the city
            if (cities && cities.length > 0) {
              const mappedDest = POPULAR_DESTINATION_MAP[dest.toLowerCase()] || dest;
              const match = cities.find(
                c => c.Name.toLowerCase() === mappedDest.toLowerCase()
              ) || cities.find(
                c => c.Name.toLowerCase().includes(mappedDest.toLowerCase()) || mappedDest.toLowerCase().includes(c.Name.toLowerCase())
              );
              if (match) {
                const fullDestName = match.countryName ? `${match.Name}, ${match.countryName}` : match.Name;
                setDestination(fullDestName);
                setSelectedCityCode(match.Code);
                setSelectedCountryCode(match.CountryCode || 'IN');
                onSearch({
                  destination: fullDestName,
                  cityCode: match.Code,
                  countryCode: match.CountryCode || 'IN',
                  hotelCode: null,
                  hotelInfo: null,
                  checkInDate: locationState.checkIn || checkInDate,
                  checkOutDate: locationState.checkOut || checkOutDate,
                  guests: typeof locationState.guests === 'number'
                    ? { rooms: 1, adults: locationState.guests, children: 0, childrenAges: [] }
                    : typeof locationState.guests === 'object'
                      ? locationState.guests
                      : guests
                });
                return;
              }
            }
          } catch (err) {
            console.error('Auto-search failed:', err);
          }
        };
        autoSearch();
      }
    }
  }, [locationState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore search bar fields from cached search params (back-navigation)
  useEffect(() => {
    if (cachedSearchParams && !locationState && !hasAutoSearched.current) {
      if (cachedSearchParams.destination) {
        setDestination(cachedSearchParams.destination);
      }
      if (cachedSearchParams.cityCode) {
        setSelectedCityCode(cachedSearchParams.cityCode);
        setSelectedHotelCode(null);
        setSelectedHotelInfo(null);
      } else if (cachedSearchParams.hotelCode) {
        setSelectedHotelCode(cachedSearchParams.hotelCode);
        setSelectedCityCode(null);
        if (cachedSearchParams.hotelInfo) {
          setSelectedHotelInfo(cachedSearchParams.hotelInfo);
        }
      }
      if (cachedSearchParams.countryCode) {
        setSelectedCountryCode(cachedSearchParams.countryCode);
      }
      if (cachedSearchParams.checkInDate) {
        setCheckInDate(cachedSearchParams.checkInDate);
      }
      if (cachedSearchParams.checkOutDate) {
        setCheckOutDate(cachedSearchParams.checkOutDate);
      }
      if (cachedSearchParams.guests) {
        setGuests(cachedSearchParams.guests);
      }
    }
  }, [cachedSearchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to get country name from code
  const getCountryName = useCallback((code) => {
    const country = countries.find(c => c.Code === code);
    return country?.Name || code;
  }, [countries]);

  // Fetch suggestions (Cities across countries + Hotels)
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

          // Filter Redux cities locally
          let citySuggestions = cities.filter(c => 
            c.Name.toLowerCase().includes(mappedSearchLower) || 
            (c.countryName && c.countryName.toLowerCase().includes(mappedSearchLower))
          );

          // Deduplicate by city code and limit
          const seenCodes = new Set();
          citySuggestions = citySuggestions.filter(c => {
            if (seenCodes.has(c.Code)) return false;
            seenCodes.add(c.Code);
            return true;
          });

          // Sort: exact match first, then starts-with, then includes
          citySuggestions.sort((a, b) => {
            const aName = a.Name.toLowerCase();
            const bName = b.Name.toLowerCase();
            if (aName === searchLower && bName !== searchLower) return -1;
            if (bName === searchLower && aName !== searchLower) return 1;
            if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
            if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;
            return 0;
          });
          citySuggestions = citySuggestions.slice(0, 8);

          // Hotels from the currently loaded search results should show up immediately,
          // even if the background DB autocomplete save is still catching up.
          const recentHotelSuggestions = Array.from(
            new Map(
              recentHotels
                .filter(hotel => (hotel.HotelName || '').toLowerCase().includes(searchLower))
                .map(hotel => [String(hotel.HotelCode), {
                  Code: hotel.HotelCode,
                  Name: hotel.HotelName,
                  Address: hotel.HotelAddress || hotel.Address || '',
                  CityName: hotel.CityName || '',
                  StarRating: hotel.StarRating || hotel.HotelRating || '',
                  Latitude: hotel.Latitude || '',
                  Longitude: hotel.Longitude || '',
                  type: 'Hotel'
                }])
            ).values()
          ).slice(0, 8);

          // Hotels: fetch to cache via Redux, then filter locally
          const prefix = destination.substring(0, 2).toLowerCase();
          let cachedHotels = hotelCache[prefix];
          
          if (!cachedHotels) {
             const result = await dispatch(fetchHotelSuggestions(prefix)).unwrap();
             cachedHotels = result.suggestions;
          }
          
          let hotelSuggestions = [];
          if (cachedHotels) {
             hotelSuggestions = cachedHotels.filter(h => 
               h.hotelName.toLowerCase().includes(searchLower)
             ).map(h => ({ Code: h.hotelCode, Name: h.hotelName, Address: h.address, type: 'Hotel' })).slice(0, 8);
          }

          const combined = [
            ...citySuggestions,
            ...recentHotelSuggestions,
            ...hotelSuggestions.filter(hotel => !recentHotelSuggestions.some(recent => String(recent.Code) === String(hotel.Code)))
          ];
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
    return () => {
        clearTimeout(timeoutId);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
    }};
  }, [destination, getCountryName, dispatch, hotelCache, cities, recentHotels]);

  const handleGuestChange = (type, operation) => {
    setGuests(prev => {
      const newGuests = { ...prev };
      if (type === 'rooms') {
        newGuests.rooms = operation === 'inc' ? Math.min(prev.rooms + 1, 4) : Math.max(prev.rooms - 1, 1);
        if (newGuests.adults < newGuests.rooms) {
            newGuests.adults = newGuests.rooms;
        }
      } else if (type === 'adults') {
        newGuests.adults = operation === 'inc' ? Math.min(prev.adults + 1, 8) : Math.max(prev.adults - 1, prev.rooms);
      } else if (type === 'children') {
        const newCount = operation === 'inc' ? Math.min(prev.children + 1, 4) : Math.max(prev.children - 1, 0);
        newGuests.children = newCount;
        if (newCount > prev.childrenAges.length) {
          newGuests.childrenAges = [...prev.childrenAges, 5];
        } else if (newCount < prev.childrenAges.length) {
          newGuests.childrenAges = prev.childrenAges.slice(0, newCount);
        }
      }
      return newGuests;
    });
  };

  const handleSearch = useCallback(() => {
    setIsSearchOverlayOpen(false);
    if (onSearch) {
      onSearch({
        destination,
        cityCode: selectedCityCode,
        countryCode: selectedCountryCode,
        hotelCode: selectedHotelCode,
        hotelInfo: selectedHotelInfo,
        checkInDate,
        checkOutDate,
        guests
      });
    }
  }, [onSearch, destination, selectedCityCode, selectedCountryCode, selectedHotelCode, selectedHotelInfo, checkInDate, checkOutDate, guests]);

  const handleSuggestionSelect = (item) => {
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
        HotelCode: item.Code,
        HotelName: item.Name,
        HotelAddress: item.Address || item.CityName || '',
        CityName: item.CityName || '',
        StarRating: item.StarRating || '',
        Latitude: item.Latitude || '',
        Longitude: item.Longitude || ''
      });
    }
  };

  return (
    <>
      {/* Main Hero Section */}
      <div className={`relative w-full flex items-center justify-center bg-cover bg-center transition-all duration-500 ease-out ${
        compact
          ? 'min-h-0 py-4 md:py-5'
          : 'min-h-[420px] md:min-h-[500px] py-16 md:py-0'
      }`} style={{ backgroundImage: 'url("https://cdn6.agoda.net/images/MVC/default/background_image/illustrations/bg-agoda-homepage.png")' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40"></div>

        <div className="relative z-10 w-full max-w-5xl px-4">
          {!compact && (
            <div className="text-center mb-8 animate-fade-in-up">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">
                HOTELS, RESORTS, HOSTELS & MORE
              </h1>
              <p className="text-base sm:text-xl text-white drop-shadow-md">
                Get the best prices on 2,000,000+ properties, worldwide
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 md:p-2 flex flex-col md:flex-row gap-2 items-center theme-transition">

            {/* Destination Search - Click to Open Overlay */}
            <div className="relative flex-1 w-full md:w-auto h-[63px]" ref={searchInputRef}>
              <div
                className="flex items-center px-4 py-3 md:p-[8px] h-[100%] border border-gray-200 dark:border-slate-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all duration-300 cursor-pointer group"
                onClick={() => setIsSearchOverlayOpen(true)}
              >
                <Search className="w-5 h-5 text-gray-400 dark:text-slate-400 mr-3 group-hover:text-blue-500 transition-colors" />
                <div className="flex-1">
                  <span className={`${destination ? 'text-gray-800 dark:text-white font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
                    {destination || 'Enter a destination or property'}
                  </span>
                </div>
                <Sparkles className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Date Range Picker */}
            <div className="w-full md:w-auto md:min-w-[300px]">
              <DateRangePicker
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                onCheckInChange={setCheckInDate}
                onCheckOutChange={setCheckOutDate}
              />
            </div>

            {/* Guest Selector - Enhanced */}
            <div className="relative w-full md:w-auto" ref={dropdownRef}>
              <div
                className={`flex items-center px-4 py-3 border rounded-xl transition-all duration-300 cursor-pointer bg-white dark:bg-slate-700 w-full md:w-64 ${showGuestDropdown
                  ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/30 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/20'
                  }`}
                onClick={() => setShowGuestDropdown(!showGuestDropdown)}
              >
                <User className={`w-5 h-5 mr-3 transition-colors ${showGuestDropdown ? 'text-blue-500' : 'text-gray-400 dark:text-slate-400'}`} />
                <div className="flex flex-col flex-1">
                  <span className="text-gray-800 dark:text-white font-bold text-sm">
                    {guests.adults} Adults, {guests.children} Children
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {guests.rooms} Room{guests.rooms > 1 ? 's' : ''}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform duration-300 ${showGuestDropdown ? 'rotate-180 text-blue-500' : ''}`} />
              </div>

              {/* Animated Guest Dropdown */}
              {showGuestDropdown && (
                <div className="absolute top-full right-0 mt-2 w-full md:w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 p-6 z-50 animate-slide-in-down">
                  {/* Rooms */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-gray-700 dark:text-slate-300 font-medium">Rooms</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleGuestChange('rooms', 'dec')} disabled={guests.rooms <= 1} className="p-2 rounded-full border border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-all duration-200 active:scale-95">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center font-bold text-gray-800 dark:text-white">{guests.rooms}</span>
                      <button onClick={() => handleGuestChange('rooms', 'inc')} disabled={guests.rooms >= 4} className="p-2 rounded-full border border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-all duration-200 active:scale-95">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Adults */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-gray-700 dark:text-slate-300 font-medium">Adults</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleGuestChange('adults', 'dec')} disabled={guests.adults <= guests.rooms} className="p-2 rounded-full border border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-all duration-200 active:scale-95">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center font-bold text-gray-800 dark:text-white">{guests.adults}</span>
                      <button onClick={() => handleGuestChange('adults', 'inc')} disabled={guests.adults >= 8} className="p-2 rounded-full border border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-all duration-200 active:scale-95">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="text-gray-700 dark:text-slate-300 font-medium">Children</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">Ages 0-17</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleGuestChange('children', 'dec')} disabled={guests.children <= 0} className="p-2 rounded-full border border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-all duration-200 active:scale-95">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center font-bold text-gray-800 dark:text-white">{guests.children}</span>
                      <button onClick={() => handleGuestChange('children', 'inc')} disabled={guests.children >= 4} className="p-2 rounded-full border border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-all duration-200 active:scale-95">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Child Ages Conditional UI */}
                  {guests.children > 0 && (
                    <div className="flex flex-col gap-3 mb-4 mt-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Child Ages</span>
                      <div className="grid grid-cols-2 gap-3">
                        {guests.childrenAges.map((age, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 whitespace-nowrap">Child {i + 1}:</span>
                            <select
                              value={age}
                              onChange={(e) => {
                                const newAges = [...guests.childrenAges];
                                newAges[i] = parseInt(e.target.value);
                                setGuests(prev => ({ ...prev, childrenAges: newAges }));
                              }}
                              className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md text-sm outline-none bg-white dark:bg-slate-700 dark:text-white"
                            >
                              {[...Array(17)].map((_, idx) => (
                                <option key={idx + 1} value={idx + 1}>{idx + 1} years</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search Button - Enhanced with shine effect */}
            <button
              onClick={handleSearch}
              className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-100 flex items-center justify-center gap-2 btn-shine"
            >
              <Search className="w-5 h-5" />
              <span className="text-lg">SEARCH</span>
            </button>

          </div>
        </div>
      </div>

      {/* ==================== SEARCH OVERLAY ==================== */}
      {isSearchOverlayOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] md:pt-[10vh]">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => {
              setIsSearchOverlayOpen(false);
              setShowDropdown(false);
            }}
          />

          {/* Overlay Content */}
          <div className="relative z-10 w-full max-w-3xl mx-2 sm:mx-4 animate-scale-in">
            {/* Close Button */}
            <button
              onClick={() => {
                setIsSearchOverlayOpen(false);
                setShowDropdown(false);
              }}
              className="absolute -top-12 right-0 text-white hover:text-gray-200 transition-colors p-2"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Search Header */}
            <div className="text-center mb-6 animate-fade-in-up">
              <h2 className="text-xl sm:text-3xl font-bold text-white drop-shadow-lg flex items-center justify-center gap-3">
                <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                Where would you like to go?
                <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
              </h2>
              <p className="text-white/80 mt-2">Search from millions of hotels worldwide</p>
            </div>

            {/* Large Search Input */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300">
              <div className="flex items-center p-6 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mr-4 shadow-lg animate-pulse-slow">
                  <Search className="w-7 h-7 text-white" />
                </div>
                <input
                  ref={overlayInputRef}
                  type="text"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (e.target.value.length <= 1) {
                        setIsSearching(false);
                    }
                    setSelectedCityCode(null);
                    setSelectedCountryCode(null);
                    setSelectedHotelCode(null);
                    setSelectedHotelInfo(null);
                  }}
                  placeholder="Search cities, hotels, or destinations..."
                  className="flex-1 text-2xl outline-none text-gray-800 dark:text-white font-medium placeholder-gray-400 dark:placeholder-slate-500 bg-transparent"
                  autoFocus
                />
                {destination && (
                  <button
                    onClick={() => setDestination('')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  </button>
                )}
              </div>

              {/* Suggestions List */}
              {showDropdown && suggestions.length > 0 && (
                <div className="max-h-[50vh] overflow-y-auto">
                  {suggestions.map((item, index) => (
                    <div
                      key={`${item.type}-${item.Code}`}
                      className="px-6 py-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 cursor-pointer flex items-center transition-all duration-200 group border-b border-gray-50 last:border-b-0"
                      style={{
                        animation: `slideInLeft 0.3s ease-out forwards`,
                        animationDelay: `${index * 50}ms`,
                        opacity: 1
                      }}
                      onClick={() => handleSuggestionSelect(item)}
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl mr-4 transition-all duration-200 ${item.type === 'City'
                        ? 'bg-green-100 group-hover:bg-green-200'
                        : 'bg-purple-100 group-hover:bg-purple-200'
                        }`}>
                        {item.type === 'City' ? (
                          <MapPin className="w-6 h-6 text-green-600" />
                        ) : (
                          <Building className="w-6 h-6 text-purple-600" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="text-lg text-gray-800 font-semibold group-hover:text-blue-700 transition-colors">
                          {item.Name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {item.type === 'City' ? (item.countryName || 'City') : (item.CityName || item.Address || 'Hotel')}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronDown className="w-5 h-5 text-blue-500 -rotate-90" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State / Typing Hint */}
              {(!showDropdown || suggestions.length === 0) && (
                <div className="p-8 text-center">
                  {destination.length === 0 ? (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                        <span>Start typing to search</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {QUICK_CITIES.map((city) => (
                          <button
                            key={city}
                            onClick={() => setDestination(city)}
                            className="px-4 py-2 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : destination.length <= 1 ? (
                    <p className="text-gray-500 animate-pulse">Keep typing to see suggestions...</p>
                  ) : isSearching ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-gray-500">Searching...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 animate-fade-in">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-2">
                        <Search className="w-6 h-6 text-gray-400 dark:text-slate-500" />
                      </div>
                      <p className="text-gray-600 dark:text-slate-400 text-lg font-medium">No results found for "{destination}"</p>
                      <p className="text-gray-500 dark:text-slate-500 text-sm">Try checking for typos or searching for a different destination</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick tip */}
            <p className="text-center text-white/60 mt-4 text-sm">
              Press <kbd className="px-2 py-1 bg-white/20 rounded text-white">ESC</kbd> to close
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default HeroSearchBar;
