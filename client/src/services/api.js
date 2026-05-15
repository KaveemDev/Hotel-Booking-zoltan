import axios from 'axios';
import {
  getCachedCountries,
  getCachedCities,
  getCachedHotels,
  getCachedHotelDetails
} from './staticDataService';

const SERVER_URL = 'http://localhost:5001';
const API_BASE_URL = `${SERVER_URL}/api/hotels`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch countries - Firebase cache first, then API
 */
export const fetchCountries = async () => {
  try {
    // Try Firebase cache first
    const cached = await getCachedCountries();
    if (cached) {
      // console.log('Using cached countries from Firebase');
      return { CountryList: cached, source: 'cache' };
    }

    // Fallback to API (which will cache to Firebase)
    // console.log('Fetching countries from API');
    const response = await api.get('/countries');
    return response.data;
  } catch (error) {
    // Silently handle connection errors - will show empty state in UI
    throw error;
  }
};

/**
 * Fetch cities - Firebase cache first, then API
 */
export const fetchCities = async (countryCode) => {
  try {
    // Try Firebase cache first
    const cached = await getCachedCities(countryCode);
    if (cached) {
      // console.log(`Using cached cities for ${countryCode} from Firebase`);
      return { CityList: cached, source: 'cache' };
    }

    // Fallback to API (which will cache to Firebase)
    // console.log(`Fetching cities for ${countryCode} from API`);
    const response = await api.post('/cities', { countryCode });
    return response.data;
  } catch (error) {
    // Silently handle connection errors - will show empty state in UI
    throw error;
  }
};

/**
 * Fetch all cities across all countries
 */
export const fetchAllCities = async () => {
  try {
    const response = await api.get('/all-cities');
    return response.data;
  } catch (error) {
    console.error('Error fetching all cities:', error);
    throw error;
  }
};

/**
 * Search hotel names - Autocomplete from Firebase
 */
export const searchHotelNames = async (query) => {
  try {
    if (!query || query.length < 2) return { suggestions: [] };

    // // console.log(`Searching hotel names for: ${query}`);
    const response = await api.get(`/search-names?query=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Error searching hotel names:', error);
    return { suggestions: [] };
  }
};

/**
 * Fetch hotels - Firebase cache first, then API
 */
export const fetchHotels = async (cityCode) => {
  try {
    // Try Firebase cache first
    const cached = await getCachedHotels(cityCode);
    if (cached) {
      // console.log(`Using cached hotels for city ${cityCode} from Firebase`);
      return { Hotels: cached, source: 'cache' };
    }

    // Fallback to API (which will cache to Firebase)
    // console.log(`Fetching hotels for city ${cityCode} from API`);
    const response = await api.post('/hotels', { cityCode });
    return response.data;
  } catch (error) {
    // Silently handle connection errors - will show empty state in UI
    throw error;
  }
};

/**
 * Fetch hotel details - Firebase cache first, then API
 * Returns null if unable to fetch from any source
 */
export const fetchHotelDetails = async (hotelCode) => {
  try {
    // Try Firebase cache first
    // const cached = await getCachedHotelDetails(hotelCode);
    // if (cached) {
    //   // console.log(`Using cached hotel details for ${hotelCode} from Firebase`);
    //   return { HotelDetails: [cached], source: 'cache' };
    // }

    // // Fallback to API (which will cache to Firebase)
    // // console.log(`Fetching hotel details for ${hotelCode} from API`);
    const response = await api.post('/hotel-details', { hotelCode });

    // Check if API returned an error status
    if (response.data.Status && response.data.Status.Code !== 200) {
      console.warn(`TBO API returned error for hotel ${hotelCode}:`, response.data.Status.Description);
      return null;
    }
    // console.log(response.data, 'response.data')
    return response.data;
  } catch (error) {
    console.error('Error fetching hotel details:', error.message || error);
    // Return null instead of throwing - caller can handle fallback
    return null;
  }
};


/**
 * Search hotels - ALWAYS calls API for live pricing/availability
 * This should NEVER be cached as prices change frequently
 */
export const searchHotels = async (searchParams) => {
  try {
    // console.log('Searching hotels (live pricing - no cache)');
    const response = await api.post('/search', searchParams);
    return response.data;
  } catch (error) {
    console.error('Error searching hotels:', error);
    throw error;
  }
};

/**
 * Fetch hotel card info - Fetches and caches images, amenities, rating, reviews for hotels
 * Returns cached info for hotels that have it, fetches from TBO API for missing ones
 * @param {string[]} hotelCodes - Array of hotel codes to fetch info for
 * @returns {Object} { hotelInfo: { hotelCode: { imageUrl, amenities, rating, reviews, ... }, ... } }
 */
export const fetchHotelCardInfo = async (hotelCodes) => {
  try {
    // console.log(`Fetching card info for ${hotelCodes.length} hotels`);
    const response = await api.post('/hotel-card-info', { hotelCodes });
    return response.data;
  } catch (error) {
    console.error('Error fetching hotel card info:', error);
    // Return empty object on error - hotels will show placeholder/NA values
    return { hotelInfo: {}, source: 'error', cachedCount: 0, fetchedCount: 0 };
  }
};

/**
 * Fetch basic hotel info from cached hotel lists
 * Used as fallback when the TBO hotel details API fails
 */
export const fetchBasicHotelInfo = async (hotelCode) => {
  try {
    // console.log(`Fetching basic hotel info for ${hotelCode} from cached hotel lists`);
    const response = await api.post('/hotel-basic-info', { hotelCode });
    return response.data;
  } catch (error) {
    console.error('Error fetching basic hotel info:', error.message || error);
    return null;
  }
};

/**
 * PreBook hotel - Validates availability and returns final pricing
 * Call this before showing the checkout/guest details page
 */
export const preBookHotel = async (bookingCode) => {
  try {
    // console.log('PreBooking hotel with BookingCode:', bookingCode);
    const response = await api.post('/prebook', { BookingCode: bookingCode });
    return response.data;
  } catch (error) {
    console.error('Error prebooking hotel:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Book hotel - Finalizes the booking with guest details
 * @param {Object} bookingData - Contains BookingCode, GuestNationality, NetAmount, HotelRoomsDetails, etc.
 */
export const bookHotel = async (bookingData) => {
  console.log('Booking hotel with data:', bookingData);
  try {
    // console.log('Booking hotel with data:', bookingData);
    const response = await api.post('/book', bookingData);
    console.log('Booking hotel response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error booking hotel:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch booking details from TBO
 */
export const fetchTboBookingDetails = async (bookingData) => {
  try {
    const response = await api.post('/get-booking-details', bookingData);
    return response.data;
  } catch (error) {
    console.error('Error fetching booking details:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create Razorpay payment order
 * @param {Object} orderData - Contains amount, bookingCode, guestNationality, hotelRoomsDetails, etc.
 */
export const createPaymentOrder = async (orderData) => {
  try {
    // console.log('Creating payment order:', orderData);
    const response = await axios.post(`${SERVER_URL}/api/payment/create-order`, orderData);
    return response.data;
  } catch (error) {
    console.error('Error creating payment order:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Verify Razorpay payment and complete hotel booking
 * @param {Object} paymentData - Contains razorpay_order_id, razorpay_payment_id, razorpay_signature
 */
export const verifyPayment = async (paymentData) => {
  try {
    // console.log('Verifying payment:', paymentData);
    const response = await axios.post(`${SERVER_URL}/api/payment/verify`, paymentData);
    return response.data;
  } catch (error) {
    console.error('Error verifying payment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Retry booking with updated price (for price/cancellation policy changes)
 * @param {Object} retryData - Contains orderId, paymentId, signature, updatedAmount, etc.
 */
export const retryBooking = async (retryData) => {
  try {
    console.log('Retrying booking with updated data:', retryData);
    const response = await axios.post(`${SERVER_URL}/api/payment/retry-booking`, retryData);
    return response.data;
  } catch (error) {
    console.error('Error retrying booking:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Generate voucher for hold bookings
 * @param {Object} data - Contains orderId or bookingId
 */
export const generateVoucher = async (data) => {
  try {
    console.log('Generating voucher:', data);
    const response = await axios.post(`${SERVER_URL}/api/payment/generate-voucher`, data);
    return response.data;
  } catch (error) {
    console.error('Error generating voucher:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get booking history
 * @param {Object} filters - Optional filters { email, phone }
 */
export const getBookingHistory = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const url = params ? `${SERVER_URL}/api/payment/bookings?${params}` : `${SERVER_URL}/api/payment/bookings`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching booking history:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get single booking details
 * @param {string} orderId - Razorpay order ID
 */
export const getBookingDetails = async (orderId) => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/payment/bookings/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching booking details:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Cancel a hotel booking via TBO SendChangeRequest API
 * @param {number} bookingId - TBO Booking ID
 * @param {string} remarks - Reason for cancellation
 */
export const cancelBooking = async (bookingId, remarks) => {
  try {
    console.log('Cancelling booking:', bookingId, remarks);
    const response = await api.post('/cancel', {
      BookingId: bookingId,
      Remarks: remarks
    });
    return response.data;
  } catch (error) {
    console.error('Error cancelling booking:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get cancellation status and refund details via TBO GetChangeRequestStatus API
 * @param {number} changeRequestId - Change Request ID from SendChangeRequest response
 */
export const getCancellationStatus = async (changeRequestId) => {
  try {
    console.log('Fetching cancellation status for:', changeRequestId);
    const response = await api.post('/cancel-status', {
      ChangeRequestId: changeRequestId
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching cancellation status:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get agency balance from TBO API (Admin)
 */
export const getAgencyBalance = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/admin/balance`);
    return response.data;
  } catch (error) {
    console.error('Error fetching agency balance:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get dashboard stats (Admin)
 */
export const getDashboardStats = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/admin/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get all bookings for admin management
 * @param {Object} filters - Optional filters { status, email, dateFrom, dateTo, search }
 */
export const getAllAdminBookings = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const url = params ? `${SERVER_URL}/api/admin/bookings?${params}` : `${SERVER_URL}/api/admin/bookings`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin bookings:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get full user details (Admin)
 * @param {string} uid - User UID
 */
export const getUserDetails = async (uid) => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/admin/users/${uid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user details:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update user role (Admin)
 * @param {string} uid - User UID
 * @param {string} role - New role
 */
export const updateUserRole = async (uid, role) => {
  try {
    const response = await axios.put(`${SERVER_URL}/api/admin/users/${uid}/role`, { role });
    return response.data;
  } catch (error) {
    console.error('Error updating user role:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete user from both Firebase and MySQL (Admin)
 * @param {string} uid - User UID
 */
export const deleteUser = async (uid) => {
  try {
    const response = await axios.delete(`${SERVER_URL}/api/admin/users/${uid}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Sync all Firebase users to MySQL (Admin)
 */
export const syncUsersFromFirebase = async () => {
  try {
    const response = await axios.post(`${SERVER_URL}/api/admin/users/sync`);
    return response.data;
  } catch (error) {
    console.error('Error syncing users from Firebase:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get markup settings
 */
export const getMarkupSettings = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/admin/markup`);
    return response.data;
  } catch (error) {
    console.error('Error fetching markup settings:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Set markup settings
 */
export const setMarkupSettings = async (data) => {
  try {
    const response = await axios.post(`${SERVER_URL}/api/admin/markup`, data);
    return response.data;
  } catch (error) {
    console.error('Error saving markup settings:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get pricing strategies
 */
export const getPricingStrategies = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/admin/pricing-strategies`);
    return response.data;
  } catch (error) {
    console.error('Error fetching pricing strategies:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Update pricing strategies
 */
export const updatePricingStrategies = async (data) => {
  try {
    const response = await axios.post(`${SERVER_URL}/api/admin/pricing-strategies`, data);
    return response.data;
  } catch (error) {
    console.error('Error saving pricing strategies:', error.response?.data || error.message);
    throw error;
  }
};


/**
 * Get commission stats
 */
export const getCommissionStats = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/admin/commission`);
    return response.data;
  } catch (error) {
    console.error('Error fetching commission stats:', error.response?.data || error.message);
    throw error;
  }
};

// ===== Coupon APIs =====

export const createCoupon = async (data) => {
  const response = await axios.post(`${SERVER_URL}/api/admin/coupons`, data);
  return response.data;
};

export const getAllCoupons = async () => {
  const response = await axios.get(`${SERVER_URL}/api/admin/coupons`);
  return response.data;
};

export const updateCoupon = async (code, data) => {
  const response = await axios.put(`${SERVER_URL}/api/admin/coupons/${code}`, data);
  return response.data;
};

export const deleteCoupon = async (code) => {
  const response = await axios.delete(`${SERVER_URL}/api/admin/coupons/${code}`);
  return response.data;
};

export const validateCoupon = async (code, bookingAmount) => {
  const response = await axios.post(`${SERVER_URL}/api/admin/coupons/validate`, { code, bookingAmount });
  return response.data;
};

// ===== Chat Support APIs =====

export const sendChatMessage = async (data) => {
  const response = await axios.post(`${SERVER_URL}/api/chat/send`, data);
  return response.data;
};

export const getChatConversations = async () => {
  const response = await axios.get(`${SERVER_URL}/api/chat/conversations`);
  return response.data;
};

export const toggleChatPin = async (chatId) => {
  const response = await axios.post(`${SERVER_URL}/api/chat/pin/${chatId}`);
  return response.data;
};

export const markChatAsRead = async (chatId) => {
  const response = await axios.post(`${SERVER_URL}/api/chat/read/${chatId}`);
  return response.data;
};

export const cleanupOldChats = async () => {
  const response = await axios.delete(`${SERVER_URL}/api/chat/cleanup`);
  return response.data;
};

export default api;