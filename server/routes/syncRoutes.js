/**
 * Sync Routes
 * Admin routes for syncing TBO static data to Firebase
 */

const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Sync endpoints
router.post('/countries', syncController.syncCountries);
router.post('/cities', syncController.syncCities);
router.post('/hotels', syncController.syncHotels);
router.post('/hotel-details', syncController.syncHotelDetails);

// Cache management
router.get('/cache-status', syncController.getCacheStatus);
router.delete('/clear-cache', syncController.clearCache);

module.exports = router;
