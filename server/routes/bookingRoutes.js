const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { requireAdmin } = require('../middleware/auth');

// Save booking data (main, contacts, hotels, passengers)
router.post('/', requireAdmin, bookingController.createBooking);

// Fetch booking data by orderId
router.get('/:orderId', requireAdmin, bookingController.getBooking);

module.exports = router;
