const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const db = require('../config/db');
const { requireAuth, requireAdmin, optionalAuth, ownsTboBooking } = require('../middleware/auth');

// Cancelling or reading a booking: its owner or an admin. A guest on the payment page
// may also read it by sending the Razorpay orderId that created it.
const canAccessBooking = async (req, res, next) => {
  try {
    const bookingId = req.body.BookingId;
    if (await ownsTboBooking(req.user, bookingId)) return next();
    if (req.body.orderId) {
      const [rows] = await db.execute(
        'SELECT 1 FROM bookings WHERE order_id = ? AND tbo_booking_id = ? LIMIT 1',
        [String(req.body.orderId), String(bookingId)]
      );
      if (rows.length > 0) return next();
    }
    res.status(req.user ? 403 : 401).json({ error: 'Not allowed to access this booking' });
  } catch (err) {
    next(err);
  }
};

// Static data routes
router.get('/countries', hotelController.getCountryList);
router.post('/cities', hotelController.getCityList);
router.get('/all-cities', hotelController.getAllCities);
router.post('/hotels', hotelController.getHotelCodeList);
router.post('/hotel-details', hotelController.getHotelDetails);
router.post('/hotel-basic-info', hotelController.getBasicHotelInfo);

// Search route (with pricing and availability)
router.post('/search', hotelController.searchHotel);

// Hotel card info route (fetch and cache images, amenities, rating, reviews for search results)
router.post('/hotel-card-info', hotelController.fetchAndCacheHotelCardInfo);

// Autocomplete route
router.get('/search-names', hotelController.searchHotelNames);

// PreBook, Book and Details routes
router.post('/prebook', hotelController.preBookHotel);
// Direct booking skips payment; customers book through /api/payment
router.post('/book', requireAdmin, hotelController.bookHotel);
router.post('/get-booking-details', optionalAuth, canAccessBooking, hotelController.getBookingDetails);
router.post('/generate-voucher', requireAdmin, hotelController.generateVoucher);

// Authenticate route (for testing/debugging token)
router.post('/authenticate', requireAdmin, hotelController.authenticate);

// Cancellation routes
router.post('/cancel', requireAuth, canAccessBooking, hotelController.sendChangeRequest);
router.post('/cancel-status', requireAuth, hotelController.getChangeRequestStatus);

module.exports = router;
