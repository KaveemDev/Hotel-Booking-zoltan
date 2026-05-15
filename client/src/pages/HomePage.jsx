import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch as useReduxDispatch, useSelector } from 'react-redux';
import HeroSearchBar from '../components/HeroSearchBar';
import FilterSidebar from '../components/FilterSidebar';
import HotelCard from '../components/HotelCard';
import ErrorAlert from '../components/ErrorAlert';
import { searchHotels } from '../services/api';
import { fetchCityHotelsData, fetchHotelCardInfoData } from '../redux/slices/staticDataSlice';
import { useAppContext } from '../context/AppContext';
import { setInternalNavigation } from '../components/DirectAccessGuard';

const CHUNK_SIZE = 100; // Number of hotel codes per API request

// Helper to parse StarRating from string like "FourStar" to number
const parseStarRating = (rating) => {
    if (!rating) return 0;
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'string') {
        const lower = rating.toLowerCase();
        if (lower.includes('one')) return 1;
        if (lower.includes('two')) return 2;
        if (lower.includes('three')) return 3;
        if (lower.includes('four')) return 4;
        if (lower.includes('five')) return 5;
        const num = parseInt(rating);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

function HomePage() {
    const { state: appState, dispatch } = useAppContext();
    const reduxDispatch = useReduxDispatch();
    const { cityHotels, hotelCardInfo } = useSelector(state => state.staticData);
    const cachedSearch = appState.searchCache;

    const [hotels, setHotels] = useState(cachedSearch?.hotels || []);
    const [staticHotelsMap, setStaticHotelsMap] = useState(cachedSearch?.staticHotelsMap || {});
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    // Pagination state
    const [allHotelCodes, setAllHotelCodes] = useState(cachedSearch?.allHotelCodes || []);
    const [currentPage, setCurrentPage] = useState(cachedSearch?.currentPage || 0);
    const [hasMore, setHasMore] = useState(cachedSearch?.hasMore ?? true);
    const [searchParams, setSearchParams] = useState(cachedSearch?.searchParams || null);
    const [currentStaticMap, setCurrentStaticMap] = useState(cachedSearch?.currentStaticMap || {});

    // Ref to track if the loading spinner has already been dismissed
    const loadingDismissedRef = useRef(false);

    // Ref for infinite scroll sentinel
    const sentinelRef = useRef(null);
    // Ref for auto-scrolling to results after search
    const resultsRef = useRef(null);
    // Track if a search has been performed (for compact mode)
    const [hasSearched, setHasSearched] = useState(cachedSearch?.hasSearched || false);

    const navigate = useNavigate();
    const location = useLocation();

    // Save search state to AppContext whenever hotels or search params change
    useEffect(() => {
        if (hotels.length > 0 && searchParams) {
            dispatch({
                type: 'SAVE_SEARCH_STATE',
                payload: {
                    hotels,
                    staticHotelsMap,
                    allHotelCodes,
                    currentPage,
                    hasMore,
                    searchParams,
                    currentStaticMap,
                    hasSearched,
                    filters,
                    sortBy
                }
            });
        }
    }, [hotels, searchParams, allHotelCodes, currentPage, hasMore, hasSearched]);

    // Compute dynamic filter options from hotels
    const filterOptions = useMemo(() => {
        if (hotels.length === 0) return {};

        const starRatings = {};
        const guestRatings = { '9': 0, '8': 0, '7': 0, '6': 0 };
        const amenities = {};
        const mealPlans = {};
        const cancellation = { 'Free Cancellation': 0, 'Non-refundable': 0 };

        hotels.forEach(hotel => {
            // Count star ratings
            const stars = parseStarRating(hotel.StarRating);
            if (stars >= 1 && stars <= 5) {
                starRatings[stars] = (starRatings[stars] || 0) + 1;
            }

            // Count guest ratings
            const rating = parseFloat(hotel.Rating) || 0;
            if (rating >= 9) guestRatings['9']++;
            if (rating >= 8) guestRatings['8']++;
            if (rating >= 7) guestRatings['7']++;
            if (rating >= 6) guestRatings['6']++;

            // Count amenities
            const hotelAmenities = hotel.Facilities || [];
            hotelAmenities.forEach(amenity => {
                if (typeof amenity === 'string' && amenity.trim()) {
                    amenities[amenity] = (amenities[amenity] || 0) + 1;
                }
            });

            // Count meal plans from first room
            const roomData = hotel.Rooms?.[0];
            if (roomData?.MealType) {
                const mealType = roomData.MealType;
                mealPlans[mealType] = (mealPlans[mealType] || 0) + 1;
            }

            // Count cancellation policies
            if (roomData?.IsRefundable === true) {
                cancellation['Free Cancellation']++;
            } else if (roomData?.IsRefundable === false) {
                cancellation['Non-refundable']++;
            }
        });

        // Remove zero counts from guest ratings
        Object.keys(guestRatings).forEach(key => {
            if (guestRatings[key] === 0) delete guestRatings[key];
        });

        // Remove zero counts from cancellation
        Object.keys(cancellation).forEach(key => {
            if (cancellation[key] === 0) delete cancellation[key];
        });

        return {
            starRatings,
            guestRatings,
            amenities,
            mealPlans,
            cancellation
        };
    }, [hotels]);

    // Compute price bounds from hotels
    const priceBounds = useMemo(() => {
        if (hotels.length === 0) return { min: 0, max: 100000 };

        let minPrice = Infinity;
        let maxPrice = 0;

        hotels.forEach(hotel => {
            const price = hotel.Rooms?.[0]?.RSP || hotel.Rooms?.[0]?.TotalFare || 0;
            if (price > 0) {
                minPrice = Math.min(minPrice, price);
                maxPrice = Math.max(maxPrice, price);
            }
        });

        // Round to nice values
        minPrice = minPrice === Infinity ? 0 : Math.floor(minPrice / 500) * 500;
        maxPrice = maxPrice === 0 ? 100000 : Math.ceil(maxPrice / 500) * 500;

        return { min: minPrice, max: maxPrice };
    }, [hotels]);

    // Initialize filters with dynamic price range
    const [filters, setFilters] = useState(cachedSearch?.filters || {
        priceRange: { min: 0, max: 100000 },
        starRating: [],
        guestRating: [],
        amenities: [],
        mealPlans: [],
        cancellation: [],
    });

    // Sort state
    const [sortBy, setSortBy] = useState(cachedSearch?.sortBy || 'bestMatch');

    // Update price range when bounds change (only on first load)
    useEffect(() => {
        if (hotels.length > 0 && filters.priceRange.max === 100000) {
            setFilters(prev => ({
                ...prev,
                priceRange: { min: priceBounds.min, max: priceBounds.max }
            }));
        }
    }, [priceBounds, hotels.length]);

    // Function to search hotels for a specific chunk of hotel codes
    const searchHotelChunk = useCallback(async (codes, searchData, staticMap, appendResults = false) => {
        if (codes.length === 0) {
            setHasMore(false);
            return [];
        }

        // Use local date to avoid UTC timezone shift
        const formatLocalDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const payload = {
            checkIn: searchData.checkInDate || formatLocalDate(today),
            checkOut: searchData.checkOutDate || formatLocalDate(tomorrow),
            hotelCodes: codes.join(','),
            guestNationality: "IN",
            noOfRooms: searchData.guests?.rooms || 0,
            paxRooms: Array.from({ length: searchData.guests?.rooms || 1 }).map((_, index) => {
                const totalAdults = searchData.guests?.adults || 2;
                const totalChildren = searchData.guests?.children || 0;
                const rooms = searchData.guests?.rooms || 1;
                
                const baseAdults = Math.floor(totalAdults / rooms);
                const extraAdults = totalAdults % rooms;
                const adults = baseAdults + (index < extraAdults ? 1 : 0);

                const baseChildren = Math.floor(totalChildren / rooms);
                const extraChildren = totalChildren % rooms;
                const childrenCount = baseChildren + (index < extraChildren ? 1 : 0);
                
                // For child ages, just distribute them sequentially
                let ages = searchData.guests?.childrenAges || [];
                // Ensure array length matches total children
                if (ages.length < totalChildren) {
                    ages = [...ages, ...Array(totalChildren - ages.length).fill(5)];
                }
                
                const childAgesStart = index * baseChildren + Math.min(index, extraChildren);
                const childAgesEnd = childAgesStart + childrenCount;
                
                // Final safety parse
                const assignedAges = ages.slice(childAgesStart, childAgesEnd).map(age => parseInt(age) || 5);
                
                return {
                    Adults: Math.max(1, adults), // TBO requires at least 1 adult per room
                    Children: childrenCount,
                    ChildrenAges: assignedAges
                };
            })
        };

        const data = await searchHotels(payload);

        if (data.HotelResult && data.HotelResult.length > 0) {
            // Extract hotel codes from search results to fetch card info
            const resultHotelCodes = data.HotelResult
                .filter(result => result.Rooms && result.Rooms.length > 0)
                .map(result => String(result.HotelCode));

            // Step 1: Append the raw search results immediately so the UI can render ASAP.
            // We'll enrich them with card info (images, ratings) in a second pass.
            const partialMerged = data.HotelResult
                .filter(result => result.Rooms && result.Rooms.length > 0)
                .map(result => {
                    const staticData = staticMap[result.HotelCode] || {};
                    return {
                        ...staticData,
                        ...result,
                        HotelName: staticData.HotelName || result.HotelName,
                        StarRating: staticData.HotelRating || staticData.StarRating || result.StarRating,
                        HotelAddress: staticData.Address || result.HotelAddress,
                        HotelPicture: staticData.HotelPicture || result.HotelPicture,
                        HotelDescription: staticData.Description || result.HotelDescription,
                        Facilities: staticData.Facilities || result.Facilities,
                        Rating: staticData.Rating || result.Rating,
                        reviews: staticData.reviews || 0,
                        ratingText: staticData.ratingText,
                        Latitude: staticData.Latitude || result.Latitude,
                        Longitude: staticData.Longitude || result.Longitude
                    };
                });

            if (appendResults) {
                setHotels(prev => [...prev, ...partialMerged]);
            } else {
                setHotels(partialMerged);
            }

            // Dismiss the initial loading spinner as soon as the first chunk lands
            if (!loadingDismissedRef.current) {
                loadingDismissedRef.current = true;
                setLoading(false);
            }

            // Step 2: Fetch card info (images, amenities, ratings) and enrich in the background
            if (resultHotelCodes.length > 0) {
                try {
                    const payload = await reduxDispatch(fetchHotelCardInfoData(resultHotelCodes)).unwrap();
                    // We need to use the combined state from Redux, but since it might not be updated in the component closure yet,
                    // we'll get it directly from the store if possible, or just merge the new payload
                    const newInfo = payload.newInfo || {};
                    // Since we can't easily access the full Redux state from this closure without adding it to dependencies (which causes infinite loops),
                    // we will just enrich with the newInfo we got, or rely on a `useEffect` to do the enrichment.
                    // Let's enrich with `newInfo` and any existing `hotelCardInfo` from the component closure.
                    
                    setHotels(prev => prev.map(hotel => {
                        const cachedInfo = newInfo[String(hotel.HotelCode)] || hotelCardInfo[String(hotel.HotelCode)];
                        if (!cachedInfo) return hotel;
                        return {
                            ...hotel,
                            HotelPicture: cachedInfo.imageUrl || hotel.HotelPicture,
                            HotelDescription: cachedInfo.description || hotel.HotelDescription,
                            Facilities: cachedInfo.amenities?.length > 0 ? cachedInfo.amenities : hotel.Facilities,
                            Rating: cachedInfo.rating || hotel.Rating,
                            reviews: cachedInfo.reviews || hotel.reviews,
                            ratingText: cachedInfo.ratingText || hotel.ratingText,
                        };
                    }));
                } catch (infoError) {
                    console.error('Failed to fetch hotel card info:', infoError);
                }
            }

            return partialMerged;
        }
        return [];
    }, []);

    // Initial search handler
    const handleSearch = async (searchData) => {
        // console.log('Search Data:', searchData);
        setLoading(true);
        loadingDismissedRef.current = false; // Reset the flag for the new search
        setHasSearched(true);
        setError(null);
        setHotels([]);
        setCurrentPage(0);
        setHasMore(true);
        // Reset filters on new search
        setFilters({
            priceRange: { min: 0, max: 100000 },
            starRating: [],
            guestRating: [],
            amenities: [],
            mealPlans: [],
            cancellation: [],
        });

        // Auto-scroll to results area after a short delay for UI to update
        setTimeout(() => {
            if (resultsRef.current) {
                resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);

        try {
            let hotelCodesList = [];
            let staticMap = {};

            // Check if searching for a specific hotel or a city
            if (searchData.hotelCode) {
                // Single hotel search - use hotelInfo from search bar if available
                // console.log(`Searching for specific hotel: ${searchData.hotelCode}`);

                // Build static map from carried-over hotel info
                if (searchData.hotelInfo) {
                    staticMap[searchData.hotelCode] = {
                        HotelCode: searchData.hotelCode,
                        HotelName: searchData.hotelInfo.HotelName,
                        HotelAddress: searchData.hotelInfo.HotelAddress,
                        Address: searchData.hotelInfo.HotelAddress,
                        HotelRating: searchData.hotelInfo.StarRating,
                        StarRating: searchData.hotelInfo.StarRating,
                        Latitude: searchData.hotelInfo.Latitude,
                        Longitude: searchData.hotelInfo.Longitude
                    };
                    setStaticHotelsMap(staticMap);
                    setCurrentStaticMap(staticMap);
                }

                hotelCodesList = [searchData.hotelCode];
                setAllHotelCodes(hotelCodesList);
                setSearchParams(searchData);
                setHasMore(false); // Only one hotel, no pagination needed

                const results = await searchHotelChunk(hotelCodesList, searchData, staticMap, false);

                if (!results || results.length === 0) {
                    setError(`No rooms available for "${searchData.destination}" on the selected dates. Try different dates.`);
                }

            } else if (searchData.cityCode) {
                // City search - existing logic
                try {
                    const payload = await reduxDispatch(fetchCityHotelsData(searchData.cityCode)).unwrap();
                    if (payload && payload.hotels && Array.isArray(payload.hotels)) {
                        // Create a map of HotelCode -> Hotel Details for fast lookup
                        payload.hotels.forEach(h => {
                            staticMap[h.HotelCode] = h;
                        });
                        setStaticHotelsMap(staticMap);
                        setCurrentStaticMap(staticMap);

                        // Extract all hotel codes
                        hotelCodesList = payload.hotels.map(h => h.HotelCode);
                    }
                } catch (err) {
                    console.error('Failed to fetch hotel list for city:', err);
                }

                if (hotelCodesList.length === 0) {
                    setError('No hotels found for this city.');
                    setLoading(false);
                    return;
                }

                // Store all hotel codes and search params
                setAllHotelCodes(hotelCodesList);
                setSearchParams(searchData);

                // Split into chunks of CHUNK_SIZE (100) and fire multiple API calls in parallel
                const frontendChunks = [];
                for (let i = 0; i < hotelCodesList.length; i += CHUNK_SIZE) {
                    frontendChunks.push(hotelCodesList.slice(i, i + CHUNK_SIZE));
                }

                if (frontendChunks.length > 0) {
                    // Fire all chunk requests in parallel.
                    // Each chunk dismisses the loading spinner itself (via loadingDismissedRef)
                    // the moment it appends results to state — no need to wait for all.
                    const promises = frontendChunks.map(chunk =>
                        searchHotelChunk(chunk, searchData, staticMap, true).catch(err => {
                            console.error('Chunk search error:', err);
                            return [];
                        })
                    );

                    // Await all chunks so `finally` doesn't run prematurely.
                    // The spinner is already gone (dismissed by the first successful chunk).
                    const allResults = await Promise.all(promises);
                    setHasMore(false);

                    // If every chunk came back empty, show a message
                    const totalResults = allResults.flat().length;
                    if (totalResults === 0) {
                        setError('No hotels found for the selected dates. Try different dates.');
                    }
                } else {
                    setHasMore(false);
                }
            } else {
                setError('Please select a city or hotel to search.');
                setLoading(false);
                return;
            }

        } catch (err) {
            console.error('Search failed:', err);
            setError('Failed to fetch hotels. Please try again.');
        } finally {
            // Safety net: dismiss loading if no chunk ever did (e.g. all errored)
            if (!loadingDismissedRef.current) {
                loadingDismissedRef.current = true;
                setLoading(false);
            }
        }
    };

    // Load more hotels (for infinite scroll)
    const loadMoreHotels = useCallback(async () => {
        if (loadingMore || !hasMore || !searchParams || allHotelCodes.length === 0) {
            return;
        }

        const nextPage = currentPage + 1;
        const startIdx = nextPage * CHUNK_SIZE;
        const endIdx = startIdx + CHUNK_SIZE;
        const nextChunk = allHotelCodes.slice(startIdx, endIdx);

        // console.log(`Loading page ${nextPage + 1}: hotels ${startIdx} to ${endIdx}`);

        if (nextChunk.length === 0) {
            setHasMore(false);
            return;
        }

        setLoadingMore(true);

        try {
            await searchHotelChunk(nextChunk, searchParams, currentStaticMap, true);
            setCurrentPage(nextPage);

            // Check if there are more to load
            if (endIdx >= allHotelCodes.length) {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Failed to load more hotels:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, searchParams, allHotelCodes, currentPage, currentStaticMap, searchHotelChunk]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!sentinelRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    loadMoreHotels();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(sentinelRef.current);

        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, loadMoreHotels]);

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        // console.log('Filters:', newFilters);
    };

    // Apply filters with improved logic
    const filteredHotels = useMemo(() => {
        return hotels.filter(hotel => {
            // Price Filter
            const price = hotel.Rooms?.[0]?.RSP || hotel.Rooms?.[0]?.TotalFare || 0;
            if (price < filters.priceRange.min || price > filters.priceRange.max) return false;

            // Star Rating Filter
            if (filters.starRating.length > 0) {
                const stars = parseStarRating(hotel.StarRating);
                if (!filters.starRating.includes(stars)) return false;
            }

            // Guest Rating Filter
            if (filters.guestRating.length > 0) {
                const rating = parseFloat(hotel.Rating) || 0;
                // Check if hotel meets any of the selected rating thresholds
                const meetsRating = filters.guestRating.some(threshold => rating >= parseInt(threshold));
                if (!meetsRating) return false;
            }

            // Amenities Filter
            if (filters.amenities.length > 0) {
                const hotelAmenities = hotel.Facilities || [];
                const hasAmenity = filters.amenities.some(amenity =>
                    hotelAmenities.some(ha =>
                        typeof ha === 'string' && ha.toLowerCase().includes(amenity.toLowerCase())
                    )
                );
                if (!hasAmenity) return false;
            }

            // Meal Plans Filter
            if (filters.mealPlans.length > 0) {
                const mealType = hotel.Rooms?.[0]?.MealType || '';
                if (!filters.mealPlans.includes(mealType)) return false;
            }

            // Cancellation Filter
            if (filters.cancellation.length > 0) {
                const isRefundable = hotel.Rooms?.[0]?.IsRefundable;
                const hasFreeCancel = filters.cancellation.includes('Free Cancellation') && isRefundable === true;
                const hasNonRefund = filters.cancellation.includes('Non-refundable') && isRefundable === false;
                if (!hasFreeCancel && !hasNonRefund) return false;
            }

            return true;
        });
    }, [hotels, filters]);

    // Apply sorting to filtered hotels
    const sortedHotels = useMemo(() => {
        const sorted = [...filteredHotels];
        switch (sortBy) {
            case 'priceLowHigh':
                return sorted.sort((a, b) => (a.Rooms?.[0]?.RSP || a.Rooms?.[0]?.TotalFare || 0) - (b.Rooms?.[0]?.RSP || b.Rooms?.[0]?.TotalFare || 0));
            case 'price_desc':
                return sorted.sort((a, b) => (b.Rooms?.[0]?.RSP || b.Rooms?.[0]?.TotalFare || 0) - (a.Rooms?.[0]?.RSP || a.Rooms?.[0]?.TotalFare || 0));
            case 'starRating':
                return sorted.sort((a, b) => parseStarRating(b.StarRating) - parseStarRating(a.StarRating));
            case 'guestRating':
                return sorted.sort((a, b) => (parseFloat(b.Rating) || 0) - (parseFloat(a.Rating) || 0));
            case 'nameAZ':
                return sorted.sort((a, b) => (a.HotelName || '').localeCompare(b.HotelName || ''));
            case 'bestMatch':
            default:
                return sorted; // Keep original API order
        }
    }, [filteredHotels, sortBy]);

    const handleHotelSelect = (hotel) => {
        setInternalNavigation();
        navigate(`/hotel/${hotel.HotelCode}`, {
            state: {
                checkIn: searchParams?.checkInDate,
                checkOut: searchParams?.checkOutDate,
                guests: searchParams?.guests
            }
        });
    };

    // Calculate loaded/total counts for display
    const loadedCount = hotels.length;
    const totalCount = allHotelCodes.length;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-900 theme-transition">
            <HeroSearchBar onSearch={handleSearch} compact={hasSearched} locationState={location.state} cachedSearchParams={cachedSearch?.searchParams} />

            <div ref={resultsRef} className="container mx-auto px-4 py-8">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar */}
                    <div className="lg:w-72 flex-shrink-0">
                        <FilterSidebar
                            filters={filters}
                            onFilterChange={handleFilterChange}
                            filterOptions={filterOptions}
                            priceBounds={priceBounds}
                        />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-4 flex flex-wrap justify-between items-center gap-4 theme-transition">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                {loading ? 'Searching...' :
                                    totalCount > 0
                                        ? `Showing ${sortedHotels.length} properties`
                                        : `Showing ${sortedHotels.length} properties`
                                }
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-slate-400 text-sm">Sort by:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-all"
                                >
                                    <option value="bestMatch">Best Match</option>
                                    <option value="priceLowHigh">Price: Low to High</option>
                                    <option value="priceHighLow">Price: High to Low</option>
                                    <option value="starRating">Star Rating</option>
                                    <option value="guestRating">Guest Rating</option>
                                    <option value="nameAZ">Name: A-Z</option>
                                </select>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <ErrorAlert
                                message={error}
                                type="error"
                                dismissible={true}
                                onDismiss={() => setError(null)}
                                className="mb-4"
                            />
                        )}

                        {/* Initial Loading State */}
                        {loading && (
                            <div className="flex flex-col justify-center items-center py-16">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-200"></div>
                                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent absolute inset-0"></div>
                                </div>
                                <p className="text-gray-600 mt-4 animate-pulse">Searching for best deals...</p>
                            </div>
                        )}

                        {/* Hotel Cards with staggered animation */}
                        {sortedHotels.map((hotel, index) => (
                            <HotelCard
                                key={hotel.HotelCode || index}
                                hotel={hotel}
                                onSelect={handleHotelSelect}
                                index={index}
                            />
                        ))}

                        {/* Sentinel element for infinite scroll */}
                        {!loading && hotels.length > 0 && (
                            <div ref={sentinelRef} className="h-10" />
                        )}

                        {/* Loading More Indicator - Enhanced */}
                        {loadingMore && (
                            <div className="flex flex-col justify-center items-center py-8 animate-fade-in">
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <p className="text-gray-600 text-sm mt-3">Loading more hotels...</p>
                            </div>
                        )}

                        {/* End of Results - Enhanced */}
                        {!loading && !hasMore && hotels.length > 0 && (
                            <div className="text-center py-6 text-gray-500 border-t border-gray-200 mt-4 animate-fade-in">
                                <div className="inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    <p className="font-medium">You've seen all {loadedCount} hotels</p>
                                </div>
                            </div>
                        )}

                        {!loading && sortedHotels.length === 0 && !error && (
                            <div className="text-center py-12 text-gray-500">
                                {hotels.length > 0
                                    ? 'No hotels match your filters. Try adjusting your filters.'
                                    : hasSearched
                                        ? 'No hotels found for the selected criteria.'
                                        : 'Use the search bar to find hotels.'
                                }
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
