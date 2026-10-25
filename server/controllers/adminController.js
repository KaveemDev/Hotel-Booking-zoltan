const config = require('../config/config');
const db = require('../config/db');
const bookingService = require('./bookingController');
const authService = require('../services/authService');
const firebaseUserService = require('../services/firebaseUserService');
const { admin } = require('../config/firebaseAdmin');
const axios = require('axios');

/**
 * Get Agency Balance from TBO SharedData API
 */
exports.getAgencyBalance = async (req, res) => {
    try {
        console.log('\n=== GetAgencyBalance Request ===');

        // Get fresh token and member info
        const tokenId = await authService.getTokenId();
        let memberInfo = authService.getMemberInfo();

        if (!memberInfo) {
            await authService.authenticate();
            memberInfo = authService.getMemberInfo();
            if (!memberInfo) {
                return res.status(500).json({
                    error: 'Failed to get member info',
                    message: 'Could not retrieve agency details from TBO'
                });
            }
        }

        const endUserIp = process.env.TBO_END_USER_IP || '192.168.11.120';

        const requestBody = {
            ClientId: config.tboApi.clientId,
            TokenAgencyId: String(memberInfo.AgencyId),
            TokenMemberId: String(memberInfo.MemberId),
            EndUserIp: endUserIp,
            TokenId: tokenId
        };

        console.log('Balance Request Body:', JSON.stringify(requestBody, null, 2));

        const response = await axios.post(
            config.tboApi.getAgencyBalanceUrl,
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const data = response.data;
        console.log('Balance Response:', JSON.stringify(data, null, 2));

        if (data.Status !== 1) {
            return res.status(400).json({
                error: 'Failed to get agency balance',
                message: data.Error?.ErrorMessage || 'Unknown error',
                status: data.Status
            });
        }

        res.json({
            success: true,
            agencyType: data.AgencyType,
            cashBalance: data.CashBalance,
            creditBalance: data.CreditBalance,
            agencyTypeName: data.AgencyType === 1 ? 'Cash' : data.AgencyType === 2 ? 'Credit' : 'Not Set'
        });

    } catch (error) {
        console.error('GetAgencyBalance Error:', error.message);
        if (error.response) {
            console.error('API Error:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({
            error: 'Failed to fetch agency balance',
            message: error.message
        });
    }
};

/**
 * Collect ALL bookings from MySQL
 */
async function collectAllBookings() {
    try {
        const mysqlBookings = await bookingService.getAllBookingsData();
        return mysqlBookings.map(b => ({
            ...b,
            _id: b.orderId,
            _source: 'mysql',
            amount: b.amount,
            status: b.status,
            completedAt: b.completedAt || b.createdAt,
            tboResponse: b.tboResponse || {},
            hotelInfo: b.hotelInfo || {}
        }));
    } catch (err) {
        console.error("collectAllBookings Error:", err);
        return [];
    }
}

/**
 * Get Dashboard Stats - Aggregates booking data from MySQL
 */
exports.getDashboardStats = async (req, res) => {
    try {
        console.log('\n=== GetDashboardStats Request ===');

        const allBookings = await collectAllBookings();

        // Basic counts
        const totalBookings = allBookings.length;
        const confirmedBookings = allBookings.filter(b =>
            b.status === 'confirmed' || b.status === 'booked'
        ).length;
        const failedBookings = allBookings.filter(b => b.status === 'failed').length;
        const pendingCount = allBookings.filter(b =>
            b.status === 'pending' || b._source === 'pending'
        ).length;
        const cancelledBookings = allBookings.filter(b =>
            b.status === 'cancelled' ||
            b.tboResponse?.hotelBookingStatus === 'Cancelled' ||
            b.tboResponse?.hotelBookingStatus === 'CancellationPending'
        ).length;

        // Revenue calculations
        const revenueBookings = allBookings.filter(b =>
            b.status === 'confirmed' || b.status === 'booked'
        );
        const totalRevenue = revenueBookings.reduce((sum, b) => {
            const amt = parseFloat(b.amount) || parseFloat(b.totalAmount) || parseFloat(b.price) || 0;
            return sum + amt;
        }, 0);

        const avgBookingValue = revenueBookings.length > 0 ? totalRevenue / revenueBookings.length : 0;

        // Cancellation rate
        const cancellationRate = totalBookings > 0
            ? ((cancelledBookings / totalBookings) * 100).toFixed(1)
            : 0;

        // Monthly breakdown (last 6 months)
        const now = new Date();
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            const monthName = monthDate.toLocaleString('en-US', { month: 'short' });
            const year = monthDate.getFullYear();

            const monthBookings = allBookings.filter(b => {
                const bDate = new Date(b.completedAt || b.createdAt);
                return bDate >= monthDate && bDate <= monthEnd;
            });

            const monthConfirmed = monthBookings.filter(b =>
                b.status === 'confirmed' || b.status === 'booked'
            ).length;
            const monthCancelled = monthBookings.filter(b =>
                b.status === 'cancelled' ||
                b.tboResponse?.hotelBookingStatus === 'Cancelled'
            ).length;
            const monthRevenue = monthBookings
                .filter(b => b.status === 'confirmed' || b.status === 'booked')
                .reduce((sum, b) => sum + (parseFloat(b.amount) || parseFloat(b.totalAmount) || 0), 0);

            monthlyData.push({
                month: `${monthName} ${year}`,
                shortMonth: monthName,
                total: monthBookings.length,
                confirmed: monthConfirmed,
                cancelled: monthCancelled,
                revenue: Math.round(monthRevenue)
            });
        }

        // Daily trend (last 30 days)
        const dailyData = [];
        for (let i = 29; i >= 0; i--) {
            const dayDate = new Date(now);
            dayDate.setDate(dayDate.getDate() - i);
            dayDate.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayDate);
            dayEnd.setHours(23, 59, 59, 999);

            const dayBookings = allBookings.filter(b => {
                const bDate = new Date(b.completedAt || b.createdAt);
                return bDate >= dayDate && bDate <= dayEnd;
            });

            dailyData.push({
                date: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                bookings: dayBookings.length,
                confirmed: dayBookings.filter(b => b.status === 'confirmed' || b.status === 'booked').length,
                revenue: dayBookings
                    .filter(b => b.status === 'confirmed' || b.status === 'booked')
                    .reduce((sum, b) => sum + (parseFloat(b.amount) || parseFloat(b.totalAmount) || 0), 0)
            });
        }

        // Top destinations
        const destinationMap = {};
        revenueBookings.forEach(b => {
            const hotelName = b.hotelInfo?.hotelName || b.hotelInfo?.HotelName ||
                b.hotelName || b.HotelName || 'Unknown Hotel';
            const city = b.hotelInfo?.cityName || b.searchParams?.cityName ||
                b.cityName || 'Unknown';
            const key = hotelName;
            if (!destinationMap[key]) {
                destinationMap[key] = { name: hotelName, city, count: 0, revenue: 0 };
            }
            destinationMap[key].count++;
            destinationMap[key].revenue += parseFloat(b.amount) || parseFloat(b.totalAmount) || 0;
        });
        const topDestinations = Object.values(destinationMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Room nights calculation
        let totalRoomNights = 0;
        let totalStayDuration = 0;
        let stayCount = 0;
        revenueBookings.forEach(b => {
            const checkIn = b.searchParams?.checkIn || b.searchParams?.CheckIn || b.checkIn;
            const checkOut = b.searchParams?.checkOut || b.searchParams?.CheckOut || b.checkOut;
            if (checkIn && checkOut) {
                const inDate = new Date(checkIn);
                const outDate = new Date(checkOut);
                const nights = Math.max(1, Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24)));
                const rooms = b.searchParams?.noOfRooms || b.searchParams?.NoOfRooms || b.noOfRooms || 1;
                totalRoomNights += nights * rooms;
                totalStayDuration += nights;
                stayCount++;
            }
        });
        const avgStayDuration = stayCount > 0 ? (totalStayDuration / stayCount).toFixed(1) : 0;

        res.json({
            success: true,
            stats: {
                totalBookings,
                confirmedBookings,
                failedBookings,
                pendingBookings: pendingCount,
                cancelledBookings,
                totalRevenue: Math.round(totalRevenue),
                avgBookingValue: Math.round(avgBookingValue),
                cancellationRate: parseFloat(cancellationRate),
                totalRoomNights,
                avgStayDuration: parseFloat(avgStayDuration),
                monthlyData,
                dailyData,
                topDestinations
            }
        });

    } catch (error) {
        console.error('GetDashboardStats Error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch dashboard stats',
            message: error.message
        });
    }
};

/**
 * Get All Bookings for admin management — from MySQL
 */
exports.getAllBookings = async (req, res) => {
    try {
        const { status, email, dateFrom, dateTo, search } = req.query;

        console.log('\n=== GetAllBookings (Admin) ===');

        let allBookings = await collectAllBookings();

        // Apply filters
        if (status) {
            allBookings = allBookings.filter(b => b.status === status);
        }

        if (email) {
            allBookings = allBookings.filter(b =>
                (b.contactDetails?.email?.toLowerCase() || '').includes(email.toLowerCase()) ||
                (b._userEmail?.toLowerCase() || '').includes(email.toLowerCase())
            );
        }

        if (dateFrom) {
            const from = new Date(dateFrom);
            allBookings = allBookings.filter(b => {
                const bDate = new Date(b.completedAt || b.createdAt);
                return bDate >= from;
            });
        }

        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            allBookings = allBookings.filter(b => {
                const bDate = new Date(b.completedAt || b.createdAt);
                return bDate <= to;
            });
        }

        if (search) {
            const term = search.toLowerCase();
            allBookings = allBookings.filter(b =>
                (b.hotelInfo?.hotelName?.toLowerCase() || '').includes(term) ||
                (b.hotelInfo?.HotelName?.toLowerCase() || '').includes(term) ||
                (b.hotelName?.toLowerCase() || '').includes(term) ||
                (b.contactDetails?.email?.toLowerCase() || '').includes(term) ||
                (b.contactDetails?.firstName?.toLowerCase() || '').includes(term) ||
                (b.contactDetails?.lastName?.toLowerCase() || '').includes(term) ||
                (b._userEmail?.toLowerCase() || '').includes(term) ||
                (b._userName?.toLowerCase() || '').includes(term) ||
                (b._id?.toLowerCase() || '').includes(term) ||
                String(b.tboResponse?.bookingId || '').includes(term)
            );
        }

        // Sort by date (newest first)
        allBookings.sort((a, b) =>
            new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)
        );

        res.json({
            success: true,
            count: allBookings.length,
            bookings: allBookings
        });

    } catch (error) {
        console.error('GetAllBookings Error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch bookings',
            message: error.message
        });
    }
};

/**
 * Get all users (admin)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM users ORDER BY created_at DESC');
        const users = rows.map(r => ({
            uid: r.uid,
            email: r.email,
            username: r.username,
            phoneNumber: r.phone_number,
            provider: r.provider,
            photoURL: r.photo_url,
            role: r.role,
            isAdmin: r.is_admin === 1,
            createdAt: r.created_at
        }));
        res.json({ success: true, users });
    } catch (error) {
        console.error('GetAllUsers Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch users', message: error.message });
    }
};

/**
 * Get full user details including their bookings, liked hotels, etc.
 */
exports.getUserDetails = async (req, res) => {
    try {
        const { uid } = req.params;
        console.log(`\n=== GetUserDetails: ${uid} ===`);

        // Get user data from MySQL
        const [userRows] = await db.execute('SELECT * FROM users WHERE uid = ?', [uid]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userRows[0];

        // Get user's bookings via user_bookings join
        const [bookingRows] = await db.execute(
            `SELECT b.* FROM bookings b
             JOIN user_bookings ub ON b.order_id COLLATE utf8mb4_unicode_ci = ub.order_id
             WHERE ub.user_id = ?
             ORDER BY b.created_at DESC`,
            [uid]
        );

        const mergedBookings = bookingRows.map(b => {
            const booking = {
                _id: b.order_id,
                _source: 'mysql',
                orderId: b.order_id,
                hotelName: b.hotel_name,
                hotelCode: b.hotel_code,
                amount: parseFloat(b.amount),
                totalAmount: parseFloat(b.amount),
                originalAmount: parseFloat(b.original_amount),
                markupAmount: parseFloat(b.markup_amount),
                markupPercentage: parseFloat(b.markup_percentage),
                status: b.status,
                createdAt: b.created_at,
                completedAt: b.completed_at
            };
            if (b.contact_details) {
                booking.contactDetails = typeof b.contact_details === 'string' ? JSON.parse(b.contact_details) : b.contact_details;
            }
            if (b.tbo_response) {
                booking.tboResponse = typeof b.tbo_response === 'string' ? JSON.parse(b.tbo_response) : b.tbo_response;
            }
            if (b.hotel_name || b.hotel_code) {
                booking.hotelInfo = { hotelName: b.hotel_name, hotelCode: b.hotel_code, cityName: b.city_name };
            }
            if (b.search_params) {
                booking.searchParams = typeof b.search_params === 'string' ? JSON.parse(b.search_params) : b.search_params;
            }
            return booking;
        });

        // Get liked hotels from MySQL
        const [likedRows] = await db.execute('SELECT * FROM liked_hotels WHERE user_id = ?', [uid]);
        const likedHotels = likedRows.map(row => ({
            hotelCode: row.hotel_code,
            HotelName: row.hotel_name,
            HotelPicture: row.hotel_picture,
            HotelAddress: row.hotel_address,
            StarRating: row.star_rating,
            TotalFare: row.total_fare,
            likedAt: row.liked_at
        }));

        // Calculate user stats
        const confirmedBookings = mergedBookings.filter(b =>
            b.status === 'confirmed' || b.status === 'booked'
        ).length;
        const cancelledBookings = mergedBookings.filter(b => b.status === 'cancelled').length;
        const totalSpent = mergedBookings
            .filter(b => b.status === 'confirmed' || b.status === 'booked')
            .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

        res.json({
            success: true,
            user: {
                uid,
                email: userData.email,
                username: userData.username,
                phoneNumber: userData.phone_number,
                provider: userData.provider,
                photoURL: userData.photo_url,
                role: userData.role,
                isAdmin: userData.is_admin === 1,
                createdAt: userData.created_at,
                stats: {
                    totalBookings: mergedBookings.length,
                    confirmedBookings,
                    cancelledBookings,
                    totalSpent: Math.round(totalSpent),
                    likedHotelsCount: likedHotels.length
                }
            },
            bookings: mergedBookings,
            likedHotels
        });

    } catch (error) {
        console.error('GetUserDetails Error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch user details',
            message: error.message
        });
    }
};

/**
 * Update user role
 */
exports.updateUserRole = async (req, res) => {
    try {
        const { uid } = req.params;
        const { role } = req.body;

        if (!['admin', 'support', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified. Must be admin, support, or user.' });
        }

        console.log(`\n=== UpdateUserRole: ${uid} -> ${role} ===`);

        const [existing] = await db.execute('SELECT uid FROM users WHERE uid = ?', [uid]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'User not found in MySQL' });
        }

        // Update MySQL
        await db.execute(
            `UPDATE users SET role = ?, is_admin = ?, updated_at = NOW() WHERE uid = ?`,
            [role, (role === 'admin' || role === 'support') ? 1 : 0, uid]
        );

        // Sync to Firebase Auth custom claims
        try {
            await firebaseUserService.setCustomUserClaims(uid, { role, isAdmin: role === 'admin' || role === 'support' });
        } catch (fbError) {
            console.error('Warning: Failed to sync role to Firebase:', fbError.message);
            // Don't fail the request if Firebase sync fails
        }

        res.json({ success: true, role, message: 'User role updated successfully in MySQL and Firebase' });
    } catch (error) {
        console.error('UpdateUserRole Error:', error.message);
        res.status(500).json({
            error: 'Failed to update user role',
            message: error.message
        });
    }
};

// ─── Helper: read/write settings from static_cache ─────────────
async function getSettingsFromCache(key) {
    const [rows] = await db.execute(
        `SELECT cache_data FROM static_cache WHERE cache_key = ?`, [key]
    );
    if (rows.length > 0 && rows[0].cache_data) {
        return typeof rows[0].cache_data === 'string'
            ? JSON.parse(rows[0].cache_data) : rows[0].cache_data;
    }
    return null;
}

async function setSettingsToCache(key, data) {
    await db.execute(
        `INSERT INTO static_cache (cache_key, cache_data, updated_at) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), updated_at = NOW()`,
        [key, JSON.stringify(data)]
    );
}

/**
 * Get markup settings from MySQL
 */
exports.getMarkupSettings = async (req, res) => {
    try {
        const settings = await getSettingsFromCache('settings_markup') || { percentage: 0, isActive: false };

        res.json({
            success: true,
            markup: {
                percentage: settings.percentage || 0,
                isActive: settings.isActive || false,
                updatedAt: settings.updatedAt || null,
                updatedBy: settings.updatedBy || null
            }
        });
    } catch (error) {
        console.error('GetMarkupSettings Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch markup settings', message: error.message });
    }
};

/**
 * Set markup percentage
 */
exports.setMarkupSettings = async (req, res) => {
    try {
        const { percentage, isActive } = req.body;

        if (percentage === undefined || percentage === null) {
            return res.status(400).json({ error: 'Percentage is required' });
        }

        const pct = parseFloat(percentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return res.status(400).json({ error: 'Percentage must be between 0 and 100' });
        }

        console.log(`\n=== Setting Markup: ${pct}% (Active: ${isActive}) ===`);

        const data = {
            percentage: pct,
            isActive: isActive !== undefined ? isActive : true,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin'
        };
        await setSettingsToCache('settings_markup', data);

        res.json({
            success: true,
            markup: { percentage: pct, isActive: isActive !== undefined ? isActive : true }
        });
    } catch (error) {
        console.error('SetMarkupSettings Error:', error.message);
        res.status(500).json({ error: 'Failed to save markup settings', message: error.message });
    }
};

/**
 * Get all pricing strategies
 */
exports.getPricingStrategies = async (req, res) => {
    try {
        const strategies = await getSettingsFromCache('settings_pricing_strategies') || {};

        res.json({
            success: true,
            strategies
        });
    } catch (error) {
        console.error('GetPricingStrategies Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch pricing strategies', message: error.message });
    }
};

/**
 * Update pricing strategies
 */
exports.updatePricingStrategies = async (req, res) => {
    try {
        const updates = req.body;
        
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Invalid configuration updates' });
        }

        console.log('\n=== Updating Pricing Strategies ===');

        // Merge with existing
        const existing = await getSettingsFromCache('settings_pricing_strategies') || {};
        const merged = { ...existing, ...updates };
        await setSettingsToCache('settings_pricing_strategies', merged);

        // Optional: clear cache on pricing engine
        const pricingEngine = require('../services/pricingEngine');
        if (pricingEngine && pricingEngine.clearCache) {
            pricingEngine.clearCache();
        }

        res.json({
            success: true,
            strategies: merged,
            message: 'Pricing strategies updated successfully'
        });
    } catch (error) {
        console.error('UpdatePricingStrategies Error:', error.message);
        res.status(500).json({ error: 'Failed to save pricing strategies', message: error.message });
    }
};

/**
 * Get commission earnings stats
 */
exports.getCommissionStats = async (req, res) => {
    try {
        console.log('\n=== GetCommissionStats ===');

        const allBookings = await collectAllBookings();

        // Get current markup settings
        const markupSettings = await getSettingsFromCache('settings_markup') || { percentage: 0, isActive: false };

        // Calculate commission from bookings that have markupAmount stored
        let totalCommission = 0;
        let totalOriginalAmount = 0;
        let totalChargedAmount = 0;
        const commissionBookings = [];

        const confirmedBookings = allBookings.filter(b =>
            b.status === 'confirmed' || b.status === 'booked'
        );

        confirmedBookings.forEach(b => {
            const markupAmt = parseFloat(b.markupAmount) || 0;
            const originalAmt = parseFloat(b.originalAmount) || 0;
            const chargedAmt = parseFloat(b.amount) || parseFloat(b.totalAmount) || 0;

            // If markupAmount was explicitly stored
            if (markupAmt > 0) {
                totalCommission += markupAmt;
                totalOriginalAmount += originalAmt;
                totalChargedAmount += chargedAmt;
                commissionBookings.push({
                    _id: b._id,
                    hotelName: b.hotelInfo?.hotelName || b.hotelInfo?.HotelName || b.hotelName || 'Unknown',
                    guestEmail: b.contactDetails?.email || b._userEmail || 'N/A',
                    guestName: `${b.contactDetails?.firstName || ''} ${b.contactDetails?.lastName || ''}`.trim() || b._userName || 'N/A',
                    originalAmount: originalAmt,
                    chargedAmount: chargedAmt,
                    markupAmount: markupAmt,
                    markupPercentage: b.markupPercentage || 0,
                    date: b.completedAt || b.createdAt,
                    status: b.status
                });
            } else if (chargedAmt > 0) {
                // For older bookings without explicit markup data, there's no commission
                totalOriginalAmount += chargedAmt;
                totalChargedAmount += chargedAmt;
            }
        });

        // Monthly commission breakdown
        const now = new Date();
        const monthlyCommission = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            const monthName = monthDate.toLocaleString('en-US', { month: 'short' });

            const monthBookings = commissionBookings.filter(b => {
                const bDate = new Date(b.date);
                return bDate >= monthDate && bDate <= monthEnd;
            });

            const monthCommission = monthBookings.reduce((sum, b) => sum + b.markupAmount, 0);
            const monthRevenue = monthBookings.reduce((sum, b) => sum + b.chargedAmount, 0);

            monthlyCommission.push({
                shortMonth: monthName,
                commission: Math.round(monthCommission),
                revenue: Math.round(monthRevenue),
                bookings: monthBookings.length
            });
        }

        // Sort commission bookings by date (newest first)
        commissionBookings.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            currentMarkup: markupSettings,
            commission: {
                totalCommission: Math.round(totalCommission),
                totalOriginalAmount: Math.round(totalOriginalAmount),
                totalChargedAmount: Math.round(totalChargedAmount),
                totalBookingsWithCommission: commissionBookings.length,
                avgCommissionPerBooking: commissionBookings.length > 0 ? Math.round(totalCommission / commissionBookings.length) : 0,
                monthlyCommission,
                bookings: commissionBookings
            }
        });

    } catch (error) {
        console.error('GetCommissionStats Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch commission stats', message: error.message });
    }
};

/**
 * Create a coupon code
 */
exports.createCoupon = async (req, res) => {
    try {
        const {
            code, discountType, discountValue, maxDiscount,
            minBookingAmount, expiryDate, usageLimit, description, isActive
        } = req.body;

        if (!code || !discountType || !discountValue) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['code', 'discountType', 'discountValue']
            });
        }

        const couponCode = code.toUpperCase().trim();

        // Check if coupon already exists
        const existing = await getSettingsFromCache(`coupon_${couponCode}`);
        if (existing) {
            return res.status(409).json({ error: 'Coupon code already exists' });
        }

        const couponData = {
            code: couponCode,
            discountType: discountType, // 'percentage' or 'flat'
            discountValue: parseFloat(discountValue),
            maxDiscount: parseFloat(maxDiscount) || 0, // max discount cap for percentage type
            minBookingAmount: parseFloat(minBookingAmount) || 0,
            expiryDate: expiryDate || null,
            usageLimit: parseInt(usageLimit) || 0, // 0 = unlimited
            usedCount: 0,
            description: description || '',
            isActive: isActive !== undefined ? isActive : true,
            createdAt: new Date().toISOString()
        };

        await setSettingsToCache(`coupon_${couponCode}`, couponData);
        console.log(`Coupon created: ${couponCode}`);

        res.json({ success: true, coupon: couponData });

    } catch (error) {
        console.error('CreateCoupon Error:', error.message);
        res.status(500).json({ error: 'Failed to create coupon', message: error.message });
    }
};

/**
 * Get all coupons
 */
exports.getAllCoupons = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT cache_data FROM static_cache WHERE cache_key LIKE 'coupon_%'`
        );
        const coupons = rows
            .map(r => typeof r.cache_data === 'string' ? JSON.parse(r.cache_data) : r.cache_data)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, coupons });
    } catch (error) {
        console.error('GetAllCoupons Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch coupons', message: error.message });
    }
};

/**
 * Update coupon (toggle active, edit fields)
 */
exports.updateCoupon = async (req, res) => {
    try {
        const { code } = req.params;
        const updates = req.body;
        const couponCode = code.toUpperCase();

        const existing = await getSettingsFromCache(`coupon_${couponCode}`);
        if (!existing) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        const updated = { ...existing, ...updates };
        await setSettingsToCache(`coupon_${couponCode}`, updated);

        res.json({ success: true, coupon: updated });
    } catch (error) {
        console.error('UpdateCoupon Error:', error.message);
        res.status(500).json({ error: 'Failed to update coupon', message: error.message });
    }
};

/**
 * Delete coupon
 */
exports.deleteCoupon = async (req, res) => {
    try {
        const { code } = req.params;
        const couponCode = code.toUpperCase();
        await db.execute('DELETE FROM static_cache WHERE cache_key = ?', [`coupon_${couponCode}`]);
        res.json({ success: true });
    } catch (error) {
        console.error('DeleteCoupon Error:', error.message);
        res.status(500).json({ error: 'Failed to delete coupon', message: error.message });
    }
};

/**
 * Validate and apply a coupon code (public endpoint for users)
 */
/**
 * Shared coupon rules for /coupons/validate and payment order creation.
 * Returns { coupon, discount, amount } or { status, error } when the coupon can't be used.
 */
exports.computeCouponDiscount = async (code, bookingAmount) => {
    const couponCode = String(code).toUpperCase().trim();
    const coupon = await getSettingsFromCache(`coupon_${couponCode}`);

    if (!coupon) return { status: 404, error: 'Invalid coupon code' };
    if (!coupon.isActive) return { status: 400, error: 'This coupon is no longer active' };
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        return { status: 400, error: 'This coupon has expired' };
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        return { status: 400, error: 'This coupon has reached its usage limit' };
    }

    const amount = parseFloat(bookingAmount) || 0;
    if (coupon.minBookingAmount > 0 && amount < coupon.minBookingAmount) {
        return { status: 400, error: `Minimum booking amount of ₹${coupon.minBookingAmount} required` };
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
        discount = (amount * coupon.discountValue) / 100;
        if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
        }
    } else {
        discount = coupon.discountValue;
    }

    discount = Math.min(discount, amount); // Can't discount more than the amount
    return { coupon, discount, amount };
};

// Count one use of a coupon after a confirmed booking
// shortcut: read-modify-write on a JSON row, two bookings confirming in the same instant can count once; move to an atomic column if coupons get heavy use
exports.recordCouponUse = async (code) => {
    const key = `coupon_${String(code).toUpperCase().trim()}`;
    const coupon = await getSettingsFromCache(key);
    if (!coupon) return;
    await setSettingsToCache(key, { ...coupon, usedCount: (coupon.usedCount || 0) + 1 });
};

exports.validateCoupon = async (req, res) => {
    try {
        const { code, bookingAmount } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Coupon code is required' });
        }

        const result = await exports.computeCouponDiscount(code, bookingAmount);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }
        const { coupon, discount, amount } = result;

        res.json({
            success: true,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                maxDiscount: coupon.maxDiscount,
                description: coupon.description
            },
            discount: Math.round(discount * 100) / 100,
            finalAmount: Math.round((amount - discount) * 100) / 100
        });

    } catch (error) {
        console.error('ValidateCoupon Error:', error.message);
        res.status(500).json({ error: 'Failed to validate coupon', message: error.message });
    }
};

/**
 * Delete user from both MySQL and Firebase Auth
 */
exports.deleteUser = async (req, res) => {
    try {
        const { uid } = req.params;
        console.log(`\n=== DeleteUser: ${uid} ===`);

        // Check if user exists in MySQL
        const [existing] = await db.execute('SELECT uid, email FROM users WHERE uid = ?', [uid]);
        const userExistsInMySQL = existing.length > 0;

        // Delete from Firebase Auth
        try {
            await firebaseUserService.deleteUser(uid);
        } catch (fbError) {
            console.error('Firebase deletion error:', fbError.message);
            // Continue even if Firebase deletion fails (user might not exist)
        }

        // Delete from MySQL if exists
        if (userExistsInMySQL) {
            // Delete related data first (liked_hotels, user_bookings via CASCADE or manually)
            await db.execute('DELETE FROM liked_hotels WHERE user_id = ?', [uid]);

            // Get user's bookings to clean up user_bookings
            const [bookings] = await db.execute(
                'SELECT order_id FROM user_bookings WHERE user_id = ?',
                [uid]
            );

            // Delete user_bookings entries
            await db.execute('DELETE FROM user_bookings WHERE user_id = ?', [uid]);

            // Finally delete the user
            await db.execute('DELETE FROM users WHERE uid = ?', [uid]);
        }

        res.json({
            success: true,
            message: 'User deleted successfully from MySQL and Firebase',
            deletedFromMySQL: userExistsInMySQL,
            deletedFromFirebase: true
        });

    } catch (error) {
        console.error('DeleteUser Error:', error.message);
        res.status(500).json({
            error: 'Failed to delete user',
            message: error.message
        });
    }
};

/**
 * Sync all Firebase Auth users to MySQL database
 * This is useful when Firebase has users but MySQL doesn't
 */
exports.syncUsersFromFirebase = async (req, res) => {
    try {
        console.log('\n=== SyncUsersFromFirebase ===');

        // Get all users from Firebase Auth
        const firebaseUsers = await firebaseUserService.listAllUsers();
        console.log(`Found ${firebaseUsers.length} users in Firebase Auth`);

        let synced = 0;
        let failed = 0;
        let skipped = 0;
        const errors = [];

        for (const firebaseUser of firebaseUsers) {
            try {
                // Check if user already exists in MySQL
                const [existing] = await db.execute('SELECT uid FROM users WHERE uid = ?', [firebaseUser.uid]);

                if (existing.length > 0) {
                    // Update existing user
                    await db.execute(
                        `UPDATE users SET
                            email = ?,
                            username = COALESCE(?, username),
                            photo_url = ?,
                            provider = ?,
                            updated_at = NOW()
                        WHERE uid = ?`,
                        [
                            firebaseUser.email,
                            firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                            firebaseUser.photoURL,
                            firebaseUser.providerData?.[0]?.providerId || 'email',
                            firebaseUser.uid
                        ]
                    );
                    skipped++;
                } else {
                    // Insert new user
                    const userData = firebaseUserService.prepareUserDataForMySQL(firebaseUser);
                    await db.execute(
                        `INSERT INTO users (uid, email, username, phone_number, provider, photo_url, role, is_admin, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'user', 0, NOW())`,
                        [
                            userData.uid,
                            userData.email,
                            userData.username,
                            userData.phoneNumber,
                            userData.provider,
                            userData.photoURL
                        ]
                    );
                    synced++;
                }
            } catch (userError) {
                console.error(`Error syncing user ${firebaseUser.uid}:`, userError.message);
                failed++;
                errors.push({ uid: firebaseUser.uid, error: userError.message });
            }
        }

        res.json({
            success: true,
            message: 'User sync completed',
            stats: {
                totalFirebaseUsers: firebaseUsers.length,
                synced,
                skipped,
                failed
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('SyncUsersFromFirebase Error:', error.message);
        res.status(500).json({
            error: 'Failed to sync users from Firebase',
            message: error.message
        });
    }
};

/**
 * Update user in both MySQL and Firebase
 */
exports.updateUser = async (req, res) => {
    try {
        const { uid } = req.params;
        const { email, username, phoneNumber, disabled } = req.body;

        console.log(`\n=== UpdateUser: ${uid} ===`);

        // Check if user exists in MySQL
        const [existing] = await db.execute('SELECT * FROM users WHERE uid = ?', [uid]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'User not found in MySQL' });
        }

        // Update MySQL
        const updates = [];
        const values = [];

        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (username !== undefined) {
            updates.push('username = ?');
            values.push(username);
        }
        if (phoneNumber !== undefined) {
            updates.push('phone_number = ?');
            values.push(phoneNumber);
        }

        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            values.push(uid);

            await db.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE uid = ?`,
                values
            );
        }

        // Update Firebase
        try {
            const fbUpdates = {};
            if (email !== undefined) fbUpdates.email = email;
            if (disabled !== undefined) fbUpdates.disabled = disabled;

            if (Object.keys(fbUpdates).length > 0) {
                await admin.auth().updateUser(uid, fbUpdates);
            }
        } catch (fbError) {
            console.error('Firebase update error:', fbError.message);
            return res.status(500).json({
                error: 'Failed to update Firebase user',
                message: fbError.message
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully in MySQL and Firebase'
        });

    } catch (error) {
        console.error('UpdateUser Error:', error.message);
        res.status(500).json({
            error: 'Failed to update user',
            message: error.message
        });
    }
};
