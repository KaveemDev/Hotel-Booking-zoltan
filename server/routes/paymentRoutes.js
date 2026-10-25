const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalAuth, requireAdmin } = require('../middleware/auth');

// Create Razorpay order for hotel booking (guests allowed; signed-in users get linked)
router.post('/create-order', optionalAuth, paymentController.createOrder);

// Verify payment and complete hotel booking
router.post('/verify', paymentController.verifyPayment);

// Retry booking with updated price (for price/cancellation policy changes)
router.post('/retry-booking', paymentController.retryBookingWithUpdatedPrice);

// Generate voucher for hold bookings
router.post('/generate-voucher', requireAdmin, paymentController.generateVoucher);

// Get booking history (with optional email/phone filter)
router.get('/bookings', requireAdmin, paymentController.getBookingHistory);

// Get single booking details
router.get('/bookings/:orderId', requireAdmin, paymentController.getBookingDetails);

module.exports = router;
