const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

// Public coupon validation (users apply coupons) — registered before the admin guard
router.post('/coupons/validate', adminController.validateCoupon);

router.use(requireAdmin);

// Get agency balance from TBO
router.get('/balance', adminController.getAgencyBalance);

// Get aggregated dashboard stats
router.get('/stats', adminController.getDashboardStats);

// Get all bookings for admin management
router.get('/bookings', adminController.getAllBookings);

// Get all users (admin)
router.get('/users', adminController.getAllUsers);

// Get full details for a specific user
router.get('/users/:uid', adminController.getUserDetails);

// Update user role
router.put('/users/:uid/role', adminController.updateUserRole);

// Update user (email, username, phone, disabled status)
router.put('/users/:uid', adminController.updateUser);

// Delete user from both MySQL and Firebase
router.delete('/users/:uid', adminController.deleteUser);

// Sync all Firebase users to MySQL
router.post('/users/sync', adminController.syncUsersFromFirebase);

// Markup settings
router.get('/markup', adminController.getMarkupSettings);
router.post('/markup', adminController.setMarkupSettings);

// Commission stats
router.get('/commission', adminController.getCommissionStats);

// Pricing strategies
router.get('/pricing-strategies', adminController.getPricingStrategies);
router.post('/pricing-strategies', adminController.updatePricingStrategies);

// Coupon management
router.post('/coupons', adminController.createCoupon);
router.get('/coupons', adminController.getAllCoupons);
router.put('/coupons/:code', adminController.updateCoupon);
router.delete('/coupons/:code', adminController.deleteCoupon);

module.exports = router;
