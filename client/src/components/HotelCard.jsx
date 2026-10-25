import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, Star, ThumbsUp, Wifi, Car, Coffee, Utensils, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HotelCard = ({ hotel, onSelect, index = 0 }) => {
  const navigate = useNavigate();
  const { currentUser, isHotelLiked, likeHotel, unlikeHotel } = useAuth();
  const [likeLoading, setLikeLoading] = useState(false);
  const [justLiked, setJustLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Helper to handle missing data
  const getVal = (val, fallback = "NA") => (val !== undefined && val !== null && val !== "") ? val : fallback;

  // Helper to parse StarRating
  const parseStars = (rating) => {
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

  // Map API data to UI props
  const name = getVal(hotel.HotelName || hotel.name);
  const fallbackUrl = "https://cdn6.agoda.net/images/MVC/default/background_image/illustrations/bg-agoda-homepage.png";
  const image = getVal(hotel.HotelPicture || hotel.image, fallbackUrl);
  const showLottieFallback = image === fallbackUrl || imageError;
  const stars = parseStars(hotel.StarRating || hotel.stars);
  const location = getVal(hotel.HotelAddress || hotel.location);
  const description = getVal(hotel.HotelDescription || hotel.description, "");
  const rating = getVal(hotel.Rating || hotel.rating);
  const ratingText = getVal(hotel.ratingText, "Rating NA");
  const reviews = getVal(hotel.reviews, "0");

  // Amenities mapping
  const amenitiesList = hotel.Facilities || hotel.amenities;
  const amenities = Array.isArray(amenitiesList) && amenitiesList.length > 0 ? amenitiesList : ["Amenities NA"];

  // Room info
  // The API response structure for rooms is hotel.Rooms[0]
  const roomData = hotel.Rooms?.[0] || {};
  const roomType = getVal(roomData.Name?.[0] || hotel.roomType);

  // Price handling
  // API structure: hotel.Rooms[0].TotalFare (includes tax)
  const totalFare = roomData.RSP || roomData.TotalFare || roomData.DayRates?.[0]?.[0]?.BasePrice;
  const basePrice = totalFare ? totalFare : null;
  const originalPrice = basePrice ? Math.round(basePrice) : "NA";

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN').format(amount);
  };
  // If we have a price, we can try to show a discount if applicable, or just show the price.
  // The prompt asked for "real data", so if no discount info is in API, we shouldn't fake it.
  // However, to keep the UI looking similar, we can show just the price.
  const finalPrice = formatINR(originalPrice);
  const discount = 0; // No discount data in provided API response example

  const freeCancellation = roomData.IsRefundable === true;
  const getMealTypeLabel = (mealType) => {
    const mealTypes = {
      'Room_Only': 'Room Only',
      'BreakFast': 'Breakfast Included',
      'Breakfast_For_2': 'Breakfast for 2',
      'Breakfast_For_1': 'Breakfast for 1',
      'All_Inclusive_All_Meal': 'All Inclusive',
      'HalfBoard': 'Half Board',
      'FullBoard': 'Full Board'
    };
    return mealTypes[mealType] || mealType;
  };
  const mealPlan = getVal(getMealTypeLabel(roomData.MealType), "Meal Plan NA");

  // Calculate animation delay based on index for staggered effect
  const animationDelay = Math.min(index * 30, 150);

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-2xl dark:hover:shadow-slate-700/50 transition-all duration-300 ease-out flex flex-col md:flex-row overflow-hidden cursor-pointer group mb-4 animate-fade-in-up hover:-translate-y-1 theme-transition box-border"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'both', maxWidth: '100%', width: '100%' }}
      onClick={() => onSelect && onSelect(hotel)}
    >
      {/* Image Section */}
      <div className="relative w-full md:w-[240px] lg:w-[280px] h-[200px] md:h-auto flex-shrink-0 bg-gray-200 dark:bg-slate-700 overflow-hidden">
        {showLottieFallback ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800">
            <svg className="w-16 h-16 text-gray-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        ) : (
          <img
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            onError={() => setImageError(true)}
          />
        )}
        {/* Overlay gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <button
          className={`absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 z-10 transform hover:scale-110 active:scale-95 ${likeLoading ? 'opacity-50 cursor-wait' : ''
            } ${isHotelLiked(hotel.HotelCode) ? 'text-red-500 shadow-lg' : 'text-gray-500 dark:text-slate-400 hover:text-red-500'}`}
          onClick={async (e) => {
            e.stopPropagation();
            if (!currentUser) {
              navigate('/signin');
              return;
            }
            if (likeLoading) return;
            setLikeLoading(true);
            try {
              const hotelCode = hotel.HotelCode;
              if (isHotelLiked(hotelCode)) {
                await unlikeHotel(hotelCode);
              } else {
                setJustLiked(true);
                setTimeout(() => setJustLiked(false), 1000);
                await likeHotel(hotelCode, {
                  HotelCode: hotelCode,
                  HotelName: name,
                  HotelPicture: image,
                  HotelAddress: location,
                  StarRating: hotel.StarRating,
                  Rating: rating,
                  TotalFare: originalPrice,
                });
              }
            } catch (err) {
              console.error('Error toggling like:', err);
            } finally {
              setLikeLoading(false);
            }
          }}
          disabled={likeLoading}
          aria-label={isHotelLiked(hotel.HotelCode) ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`w-5 h-5 transition-all duration-200 ${isHotelLiked(hotel.HotelCode) ? 'fill-red-500 text-red-500' : ''} ${justLiked ? 'animate-heart-beat' : ''}`} />
        </button>
        {discount > 0 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
            -{discount}% TODAY
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 min-w-0">

        {/* Info Column */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-start justify-between min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 line-clamp-2 break-words">
                {name}
              </h3>
              <div className="flex items-center mt-1">
                <div className="flex text-yellow-400 mr-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < stars ? 'fill-current' : 'text-gray-300 dark:text-slate-600'}`}
                    />
                  ))}
                </div>
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">
                  {stars > 0 ? `${stars}-Star` : "Rating NA"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium mt-1 min-w-0">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="underline hover:text-blue-800 dark:hover:text-blue-300 line-clamp-1 truncate" title={location}>{location}</span>
            {/* <span className="text-gray-500 no-underline ml-2 text-xs">• {distance}</span> */}
          </div>

          {/* Description (Truncated) */}
          {description && (
            <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mt-1">
              {description.replace(/<[^>]*>?/gm, '')} {/* Simple HTML strip */}
            </p>
          )}

          {/* Amenities */}
          <div className="flex flex-wrap gap-2 mt-2 overflow-hidden">
            {amenities.slice(0, 4).map((amenity, idx) => (
              <div key={idx} className="flex items-center text-xs text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 flex-shrink-0 max-w-full truncate">
                {typeof amenity === 'string' && amenity.includes('WiFi') && <Wifi className="w-3 h-3 mr-1" />}
                {typeof amenity === 'string' && amenity.includes('Parking') && <Car className="w-3 h-3 mr-1" />}
                {typeof amenity === 'string' && amenity.includes('Breakfast') && <Coffee className="w-3 h-3 mr-1" />}
                {typeof amenity === 'string' && amenity.includes('Restaurant') && <Utensils className="w-3 h-3 mr-1" />}
                {typeof amenity === 'string' && !amenity.match(/WiFi|Parking|Breakfast|Restaurant/) && <ThumbsUp className="w-3 h-3 mr-1" />}
                {amenity}
              </div>
            ))}
          </div>

          {/* Room & Badges */}
          <div className="mt-auto pt-3 border-t border-dashed border-gray-200 dark:border-slate-600 min-w-0">
            <p className="text-sm font-bold text-gray-700 dark:text-slate-200 line-clamp-1 truncate">{roomType}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {freeCancellation && (
                <span className="text-xs text-green-700 font-medium flex items-center">
                  <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1.5"></span>
                  Free cancellation
                </span>
              )}
              <span className="text-xs text-green-700 font-medium flex items-center">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1.5"></span>
                {mealPlan}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Column */}
        <div className="w-full md:w-44 lg:w-48 flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-600 pt-3 md:pt-0 md:pl-4 flex-shrink-0">

          {/* Rating Badge */}
          <div className="flex items-center justify-between md:justify-end mb-4">
            <div className="text-right mr-2">
              <div className="text-sm font-bold text-gray-800 dark:text-white">{ratingText}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{reviews} reviews</div>
            </div>
            <div className="bg-blue-600 text-white font-bold text-lg p-2 rounded-lg shadow-sm flex items-center justify-center w-10 h-10">
              {rating !== "NA" ? rating : "-"}
            </div>
          </div>

          {/* Price Info */}
          <div className="text-right mt-auto flex flex-row md:flex-col items-end md:items-stretch gap-2 md:gap-0 flex-wrap">
            {discount > 0 && (
              <div className="text-xs text-red-500 font-bold bg-red-50 inline-block px-2 py-0.5 rounded mb-1">
                SAVE {discount}%
              </div>
            )}
            {/* Only show original price if there is a discount, otherwise it's confusing */}
            {discount > 0 && (
              <div className="text-gray-400 text-sm line-through decoration-red-500">
                ₹ {formatINR(originalPrice)}
              </div>
            )}

            <div className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white leading-none">
              {finalPrice !== "NA" ? `₹ ${finalPrice}` : "Price NA"}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {finalPrice !== "NA" ? "Includes taxes & fees" : "Taxes & fees NA"}
            </div>

            <button className="w-full mt-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-1 transform hover:-translate-y-0.5 active:translate-y-0 btn-shine overflow-hidden relative">
              View Deals <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(HotelCard);
