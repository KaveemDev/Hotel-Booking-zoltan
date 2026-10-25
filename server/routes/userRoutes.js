const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireSelf } = require('../middleware/auth');

const fromParams = req => req.params.uid;

// User Profile
router.post('/profile', requireSelf(req => req.body.uid), userController.updateUserProfile);
router.get('/:uid', requireSelf(fromParams), userController.getUserProfile);

// Liked Hotels
router.get('/:uid/liked-hotels', requireSelf(fromParams), userController.getLikedHotels);
router.post('/:uid/liked-hotels', requireSelf(fromParams), userController.likeHotel);
router.delete('/:uid/liked-hotels/:hotelCode', requireSelf(fromParams), userController.unlikeHotel);

// User Bookings
router.get('/:uid/bookings', requireSelf(fromParams), userController.getUserBookings);

module.exports = router;
