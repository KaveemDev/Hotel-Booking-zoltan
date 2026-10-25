const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/config');
const db = require('../config/db');
const bookingService = require('./bookingController');
const hotelController = require('./hotelController');
const adminController = require('./adminController');
const axios = require('axios');
const { sendEmail } = require('../services/emailService');
const { getBookingConfirmationTemplate } = require('../services/emailTemplates');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret
});

// Create axios instance for TBO API
const createSearchAxiosInstance = () => {
    return axios.create({
        headers: {
            'Content-Type': 'application/json'
        },
        auth: {
            username: config.tboApi.apiAuth.username,
            password: config.tboApi.apiAuth.password
        }
    });
};

const isValidSignature = (orderId, paymentId, signature) => {
    const expected = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return typeof signature === 'string' && signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

// Atomically claims a pending order so two concurrent verify/retry calls can't both book it
const claimOrder = async (orderId, paymentId) => {
    const [result] = await db.execute(
        `UPDATE bookings SET payment_id = ? WHERE order_id = ? AND status = 'pending' AND payment_id IS NULL`,
        [paymentId, orderId]
    );
    return result.affectedRows === 1;
};

// Undo a claim when booking threw before a result was saved, so the guest can retry
const releaseOrder = (orderId) => db.execute(
    `UPDATE bookings SET payment_id = NULL WHERE order_id = ? AND status = 'pending'`,
    [orderId]
).catch(err => console.error('Failed to release order claim:', err.message));

// Count a coupon use once its booking is confirmed (coupon code is kept on the Razorpay order)
const recordCouponFromOrder = (orderId) => razorpay.orders.fetch(orderId)
    .then(order => order.notes?.couponCode && adminController.recordCouponUse(order.notes.couponCode))
    .catch(err => console.error('Failed to record coupon use:', err.message));

/**
 * Create Razorpay order for hotel booking
 * Stores pending booking data in Firebase for later retrieval
 */
exports.createOrder = async (req, res) => {
    try {
        const {
            amount,
            currency = 'INR',
            bookingCode,
            guestNationality,
            hotelRoomsDetails,
            isPackageFare = false,
            isPackageDetailsMandatory = false,
            isVoucherBooking = true, // Default to voucher booking
            // Additional metadata for booking history
            hotelInfo,
            roomInfo,
            searchParams,
            contactDetails,
            // Rate conditions and policies for email
            rateConditions,
            cancellationPolicies,
            // Markup tracking
            originalAmount,
            markupAmount,
            markupPercentage
        } = req.body;

        // Validation
        if (!amount || !bookingCode || !guestNationality || !hotelRoomsDetails) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['amount', 'bookingCode', 'guestNationality', 'hotelRoomsDetails']
            });
        }

        console.log('\n=== Creating Razorpay Order ===');
        console.log(`Amount: ${amount} ${currency}`);
        console.log(`BookingCode: ${bookingCode}`);
        if (markupAmount) console.log(`Markup: ${markupPercentage}% = ₹${markupAmount}`);

        // Never trust the amount from the browser: recompute prebook fare minus coupon
        const fare = await hotelController.getPrebookFare(bookingCode);
        if (!fare) {
            return res.status(400).json({
                error: 'Price check failed',
                message: 'We could not confirm the room price. Please go back and select the room again.'
            });
        }
        let couponDiscount = 0;
        if (req.body.couponCode) {
            const coupon = await adminController.computeCouponDiscount(req.body.couponCode, fare);
            if (coupon.error) {
                return res.status(400).json({ error: 'Coupon not applicable', message: coupon.error });
            }
            couponDiscount = coupon.discount;
        }
        const expectedAmount = Math.round((fare - couponDiscount) * 100) / 100;
        // ₹1 tolerance for rounding differences between client and server
        if (Number(amount) < expectedAmount - 1) {
            console.error(`Amount mismatch for ${bookingCode}: got ${amount}, expected ${expectedAmount}`);
            return res.status(400).json({
                error: 'Price mismatch',
                message: 'The price has changed. Please go back and review your booking.'
            });
        }

        // Create Razorpay order
        const orderOptions = {
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency,
            receipt: `hotel_${Date.now()}`,
            notes: {
                bookingCode,
                guestNationality,
                couponCode: req.body.couponCode || ''
            }
        };

        const order = await razorpay.orders.create(orderOptions);
        console.log(`Razorpay Order Created: ${order.id}`);

        // Store pending booking in MySQL
        const bookingData = {
            // From the verified token, never the request body
            userId: req.user?.uid || null,
            orderId: order.id,
            bookingCode,
            amount,
            currency,
            guestNationality,
            hotelRoomsDetails,
            isPackageFare,
            isPackageDetailsMandatory,
            isVoucherBooking, // Store booking type
            // Metadata for booking history
            hotelInfo: hotelInfo || null,
            roomInfo: roomInfo || null,
            searchParams: searchParams || null,
            contactDetails: contactDetails || null,
            // Rate conditions and policies for email
            rateConditions: rateConditions || null,
            cancellationPolicies: cancellationPolicies || null,
            // Markup tracking
            originalAmount: originalAmount || amount,
            markupAmount: markupAmount || 0,
            markupPercentage: markupPercentage || 0,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        await bookingService.saveBookingData(bookingData);

        console.log(`Pending booking stored in Firebase: ${order.id}`);

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: config.razorpay.keyId
        });

    } catch (error) {
        console.error('\n=== Create Order Error ===');
        console.error('Error Message:', error.message);

        res.status(500).json({
            error: 'Failed to create payment order',
            message: error.message
        });
    }
};

/**
 * Verify Razorpay payment and complete hotel booking
 * Called after successful payment from frontend
 */
exports.verifyPayment = async (req, res) => {
    let claimedOrderId = null;
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Validation
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                error: 'Missing payment verification fields',
                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']
            });
        }

        console.log('\n=== Verifying Razorpay Payment ===');
        console.log(`Order ID: ${razorpay_order_id}`);
        console.log(`Payment ID: ${razorpay_payment_id}`);

        // Verify signature
        if (!isValidSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
            console.error('Payment signature verification failed');
            return res.status(400).json({
                error: 'Payment verification failed',
                message: 'Invalid payment signature'
            });
        }

        console.log('Payment signature verified successfully');

        // Retrieve pending booking from MySQL
        const pendingBooking = await bookingService.getBookingData(razorpay_order_id);

        if (!pendingBooking) {
            console.error('Pending booking not found');
            return res.status(404).json({
                error: 'Booking not found',
                message: 'Pending booking data not found for this order'
            });
        }

        if (pendingBooking.status !== 'pending' || !(await claimOrder(razorpay_order_id, razorpay_payment_id))) {
            console.error('Booking is not in pending state or is already being processed');
            return res.status(400).json({
                error: 'Invalid booking state',
                message: 'This booking has already been processed'
            });
        }
        claimedOrderId = razorpay_order_id;

        console.log('Retrieved pending booking from MySQL');

        // Build TBO Book request
        const bookRequest = {
            EndUserIp: req.ip || '127.0.0.1',
            BookingCode: pendingBooking.bookingCode,
            GuestNationality: pendingBooking.guestNationality,
            IsVoucherBooking: pendingBooking.isVoucherBooking !== undefined ? pendingBooking.isVoucherBooking : true,
            NetAmount: pendingBooking.amount,
            HotelRoomsDetails: pendingBooking.hotelRoomsDetails,
            IsPackageFare: pendingBooking.isPackageFare,
            IsPackageDetailsMandatory: pendingBooking.isPackageDetailsMandatory
        };

        console.log('Calling TBO Book API...');
        // Guest names/contact details stay out of the logs
        console.log(`Book Request: BookingCode=${bookRequest.BookingCode} NetAmount=${bookRequest.NetAmount} Rooms=${bookRequest.HotelRoomsDetails?.length || 0}`);

        // Call TBO Book API
        const axiosInstance = createSearchAxiosInstance();
        const tboResponse = await axiosInstance.post(config.tboApi.bookUrl, bookRequest);

        console.log('TBO Book Response:', JSON.stringify(tboResponse.data, null, 2));

        // TBO response is nested under BookResult
        const bookResult = tboResponse.data.BookResult || tboResponse.data;

        // Determine booking status - handle different response structures
        const bookingStatus = bookResult.HotelBookingStatus ||
            (bookResult.Status === 1 ? 'Confirmed' :
                bookResult.Status === 0 ? 'BookFailed' :
                    bookResult.Status === 3 ? 'VerifyPrice' : 'Unknown');

        const isSuccess = bookResult.Status === 1 ||
            bookingStatus === 'Confirmed' ||
            bookingStatus === 'Pending';

        // Store completed booking in MySQL - ensure no undefined values
        await bookingService.saveBookingData({
            ...pendingBooking,
            paymentId: razorpay_payment_id,
            paymentSignature: razorpay_signature,
            tboResponse: {
                status: bookResult.Status !== undefined ? bookResult.Status : null,
                hotelBookingStatus: bookingStatus || 'Unknown',
                bookingId: bookResult.BookingId !== undefined ? bookResult.BookingId : null,
                bookingRefNo: bookResult.BookingRefNo !== undefined ? bookResult.BookingRefNo : null,
                confirmationNo: bookResult.ConfirmationNo !== undefined ? bookResult.ConfirmationNo : null,
                voucherStatus: bookResult.VoucherStatus !== undefined ? bookResult.VoucherStatus : false,
                isPriceChanged: bookResult.IsPriceChanged !== undefined ? bookResult.IsPriceChanged : false,
                isCancellationPolicyChanged: bookResult.IsCancellationPolicyChanged !== undefined ? bookResult.IsCancellationPolicyChanged : false,
                responseStatus: bookResult.ResponseStatus !== undefined ? bookResult.ResponseStatus : null,
                error: bookResult.Error ? {
                    errorCode: bookResult.Error.ErrorCode || null,
                    errorMessage: bookResult.Error.ErrorMessage || null
                } : null,
                tboReferenceNo: bookResult.TBOReferenceNo || null,
                traceId: bookResult.TraceId || null
            },
            status: isSuccess ? 'confirmed' : 'failed',
            completedAt: new Date().toISOString()
        });

        console.log('Booking status updated in MySQL');
        if (isSuccess) recordCouponFromOrder(razorpay_order_id);

        // Handle different response scenarios
        if (!isSuccess) {
            const errorMessage = bookResult.Error?.ErrorMessage ||
                'Booking failed';

            return res.status(200).json({
                success: false,
                error: 'Hotel booking failed',
                message: errorMessage,
                paymentCompleted: true, // Payment was successful, booking failed
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                bookingStatus,
                tboResponse: bookResult
            });
        }

        // Check for price/policy changes
        if (bookResult.IsPriceChanged || bookResult.IsCancellationPolicyChanged) {
            console.log('Price or cancellation policy changed');
            return res.json({
                success: true,
                warning: 'Price or cancellation policy has changed',
                isPriceChanged: bookResult.IsPriceChanged,
                isCancellationPolicyChanged: bookResult.IsCancellationPolicyChanged,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                bookingStatus,
                bookingId: bookResult.BookingId,
                bookingRefNo: bookResult.BookingRefNo,
                confirmationNo: bookResult.ConfirmationNo,
                voucherStatus: bookResult.VoucherStatus,
                tboResponse: bookResult
            });
        }

        // Successful booking
        res.json({
            success: true,
            message: 'Booking confirmed successfully',
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            bookingStatus,
            bookingId: bookResult.BookingId,
            bookingRefNo: bookResult.BookingRefNo,
            confirmationNo: bookResult.ConfirmationNo,
            voucherStatus: bookResult.VoucherStatus,
            hotelInfo: pendingBooking.hotelInfo,
            roomInfo: pendingBooking.roomInfo,
            searchParams: pendingBooking.searchParams,
            contactDetails: pendingBooking.contactDetails
        });

        // 🔔 Send booking confirmation email (non-blocking)
        if (pendingBooking.contactDetails?.email) {
            const guestName = pendingBooking.hotelRoomsDetails?.[0]?.HotelPassenger?.[0];
            const fullName = guestName
                ? `${guestName.FirstName || ''} ${guestName.LastName || ''}`.trim()
                : 'Guest';

            const emailData = {
                customerName: fullName,
                hotelName: pendingBooking.hotelInfo?.hotelName || pendingBooking.hotelInfo?.HotelName || 'Your Hotel',
                hotelAddress: pendingBooking.hotelInfo?.address || '',
                checkIn: pendingBooking.searchParams?.checkIn || '',
                checkOut: pendingBooking.searchParams?.checkOut || '',
                bookingId: bookResult.BookingId || bookResult.BookingRefNo || razorpay_order_id,
                amount: pendingBooking.amount,
                roomDetails: pendingBooking.hotelRoomsDetails || [],
                rateConditions: pendingBooking.rateConditions || {},
                cancellationPolicies: pendingBooking.cancellationPolicies || []
            };

            sendEmail({
                to: pendingBooking.contactDetails.email,
                subject: `Booking Confirmed – ${emailData.hotelName} | Zovotel`,
                html: getBookingConfirmationTemplate(emailData),
            }).catch(err => console.error('Non-blocking confirmation email error:', err.message));
        }

    } catch (error) {
        console.error('\n=== Verify Payment Error ===');
        console.error('Error Message:', error.message);
        if (claimedOrderId) releaseOrder(claimedOrderId);

        if (error.response) {
            console.error('TBO API Error:', JSON.stringify(error.response.data, null, 2));
            return res.status(error.response.status).json({
                error: 'Hotel booking failed',
                message: error.response.data?.Status?.Description || error.message,
                details: error.response.data
            });
        }

        res.status(500).json({
            error: 'Payment verification failed',
            message: error.message
        });
    }
};

/**
 * Get booking history for a user
 * Can filter by email or phone number
 */
exports.getBookingHistory = async (req, res) => {
    try {
        const { email, phone } = req.query;

        console.log('\n=== Fetching Booking History ===');
        console.log(`Email: ${email}, Phone: ${phone}`);

        const allBookings = await bookingService.getAllBookingsData();

        // Filter bookings by email or phone if provided
        let bookings = allBookings;

        if (email) {
            bookings = bookings.filter(b =>
                b.contactDetails?.email?.toLowerCase() === email.toLowerCase()
            );
        }

        if (phone) {
            bookings = bookings.filter(b =>
                b.contactDetails?.phone === phone
            );
        }

        // Sort by completion date (newest first)
        bookings.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });

    } catch (error) {
        console.error('Get Booking History Error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch booking history',
            message: error.message
        });
    }
};

/**
 * Get single booking details
 */
exports.getBookingDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        console.log(`\n=== Fetching Booking Details: ${orderId} ===`);

        // Fetch from MySQL
        let booking = await bookingService.getBookingData(orderId);

        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found',
                message: `No booking found with order ID: ${orderId}`
            });
        }

        res.json({
            success: true,
            booking
        });

    } catch (error) {
        console.error('Get Booking Details Error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch booking details',
            message: error.message
        });
    }
};

/**
 * Retry booking with updated price/cancellation policy
 * Called when TBO returns price or cancellation policy changes
 */
exports.retryBookingWithUpdatedPrice = async (req, res) => {
    let claimedOrderId = null;
    try {
        const {
            orderId,
            razorpay_payment_id,
            razorpay_signature,
            updatedAmount,
            acceptPriceChange,
            acceptCancellationChange
        } = req.body;

        if (!orderId || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['orderId', 'razorpay_payment_id', 'razorpay_signature']
            });
        }

        // Without this anyone could book on the agency balance with a made-up payment id
        if (!isValidSignature(orderId, razorpay_payment_id, razorpay_signature)) {
            return res.status(400).json({
                error: 'Payment verification failed',
                message: 'Invalid payment signature'
            });
        }

        console.log('\n=== Retrying Booking with Updated Price ===');
        console.log(`Order ID: ${orderId}`);
        console.log(`Updated Amount: ${updatedAmount}`);

        // Retrieve the booking
        const pendingBooking = await bookingService.getBookingData(orderId);

        if (pendingBooking && (pendingBooking.status !== 'pending' || !(await claimOrder(orderId, razorpay_payment_id)))) {
            return res.json({
                success: true,
                message: 'Booking already processed or completed',
                alreadyCompleted: true
            });
        }

        if (!pendingBooking) {
            return res.status(404).json({
                error: 'Booking not found',
                message: 'Booking data not found for this order'
            });
        }
        claimedOrderId = orderId;

        // Update amount if provided
        if (updatedAmount) {
            pendingBooking.amount = updatedAmount;
        }

        // Build TBO Book request with updated values
        const bookRequest = {
            EndUserIp: req.ip || '127.0.0.1',
            BookingCode: pendingBooking.bookingCode,
            GuestNationality: pendingBooking.guestNationality,
            IsVoucherBooking: pendingBooking.isVoucherBooking !== undefined ? pendingBooking.isVoucherBooking : true,
            NetAmount: pendingBooking.amount,
            HotelRoomsDetails: pendingBooking.hotelRoomsDetails,
            IsPackageFare: pendingBooking.isPackageFare,
            IsPackageDetailsMandatory: pendingBooking.isPackageDetailsMandatory
        };

        console.log(`Retry Book Request: BookingCode=${bookRequest.BookingCode} NetAmount=${bookRequest.NetAmount} Rooms=${bookRequest.HotelRoomsDetails?.length || 0}`);

        // Call TBO Book API
        const axiosInstance = createSearchAxiosInstance();
        const tboResponse = await axiosInstance.post(config.tboApi.bookUrl, bookRequest);

        console.log('TBO Retry Book Response:', JSON.stringify(tboResponse.data, null, 2));

        const bookResult = tboResponse.data.BookResult || tboResponse.data;

        // Determine booking status
        const bookingStatus = bookResult.HotelBookingStatus ||
            (bookResult.Status === 1 ? 'Confirmed' :
                bookResult.Status === 0 ? 'BookFailed' :
                    bookResult.Status === 3 ? 'VerifyPrice' : 'Unknown');

        const isSuccess = bookResult.Status === 1 ||
            bookingStatus === 'Confirmed' ||
            bookingStatus === 'Pending';

        // Store updated booking in MySQL
        await bookingService.saveBookingData({
            ...pendingBooking,
            paymentId: razorpay_payment_id,
            paymentSignature: razorpay_signature,
            tboResponse: {
                status: bookResult.Status !== undefined ? bookResult.Status : null,
                hotelBookingStatus: bookingStatus || 'Unknown',
                bookingId: bookResult.BookingId !== undefined ? bookResult.BookingId : null,
                bookingRefNo: bookResult.BookingRefNo !== undefined ? bookResult.BookingRefNo : null,
                confirmationNo: bookResult.ConfirmationNo !== undefined ? bookResult.ConfirmationNo : null,
                voucherStatus: bookResult.VoucherStatus !== undefined ? bookResult.VoucherStatus : false,
                isPriceChanged: bookResult.IsPriceChanged !== undefined ? bookResult.IsPriceChanged : false,
                isCancellationPolicyChanged: bookResult.IsCancellationPolicyChanged !== undefined ? bookResult.IsCancellationPolicyChanged : false,
                responseStatus: bookResult.ResponseStatus !== undefined ? bookResult.ResponseStatus : null,
                error: bookResult.Error ? {
                    errorCode: bookResult.Error.ErrorCode || null,
                    errorMessage: bookResult.Error.ErrorMessage || null
                } : null,
                tboReferenceNo: bookResult.TBOReferenceNo || null,
                traceId: bookResult.TraceId || null
            },
            status: isSuccess ? 'confirmed' : 'failed',
            completedAt: new Date().toISOString(),
            retryAttempt: true,
            acceptPriceChange: acceptPriceChange || false,
            acceptCancellationChange: acceptCancellationChange || false
        });

        console.log('Booking status updated in MySQL after retry');
        if (isSuccess) recordCouponFromOrder(orderId);

        if (!isSuccess) {
            const errorMessage = bookResult.Error?.ErrorMessage || 'Booking failed';
            return res.status(200).json({
                success: false,
                error: 'Hotel booking failed',
                message: errorMessage,
                paymentCompleted: true,
                orderId,
                paymentId: razorpay_payment_id,
                bookingStatus,
                tboResponse: bookResult
            });
        }

        // Check for another price/policy change (rare but possible)
        if (bookResult.IsPriceChanged || bookResult.IsCancellationPolicyChanged) {
            return res.json({
                success: true,
                warning: 'Price or cancellation policy has changed again',
                isPriceChanged: bookResult.IsPriceChanged,
                isCancellationPolicyChanged: bookResult.IsCancellationPolicyChanged,
                orderId,
                paymentId: razorpay_payment_id,
                bookingStatus,
                bookingId: bookResult.BookingId,
                bookingRefNo: bookResult.BookingRefNo,
                confirmationNo: bookResult.ConfirmationNo,
                voucherStatus: bookResult.VoucherStatus,
                tboResponse: bookResult,
                requiresAnotherRetry: true
            });
        }

        // Successful booking
        res.json({
            success: true,
            message: 'Booking confirmed successfully (retry)',
            orderId,
            paymentId: razorpay_payment_id,
            bookingStatus,
            bookingId: bookResult.BookingId,
            bookingRefNo: bookResult.BookingRefNo,
            confirmationNo: bookResult.ConfirmationNo,
            voucherStatus: bookResult.VoucherStatus,
            hotelInfo: pendingBooking.hotelInfo,
            roomInfo: pendingBooking.roomInfo,
            searchParams: pendingBooking.searchParams,
            contactDetails: pendingBooking.contactDetails,
            retryAttempt: true
        });

        // Send booking confirmation email (non-blocking)
        if (pendingBooking.contactDetails?.email) {
            const guestName = pendingBooking.hotelRoomsDetails?.[0]?.HotelPassenger?.[0];
            const fullName = guestName
                ? `${guestName.FirstName || ''} ${guestName.LastName || ''}`.trim()
                : 'Guest';

            const emailData = {
                customerName: fullName,
                hotelName: pendingBooking.hotelInfo?.hotelName || pendingBooking.hotelInfo?.HotelName || 'Your Hotel',
                hotelAddress: pendingBooking.hotelInfo?.address || '',
                checkIn: pendingBooking.searchParams?.checkIn || '',
                checkOut: pendingBooking.searchParams?.checkOut || '',
                bookingId: bookResult.BookingId || bookResult.BookingRefNo || orderId,
                amount: pendingBooking.amount,
                roomDetails: pendingBooking.hotelRoomsDetails || [],
                rateConditions: pendingBooking.rateConditions || {},
                cancellationPolicies: pendingBooking.cancellationPolicies || []
            };

            sendEmail({
                to: pendingBooking.contactDetails.email,
                subject: `Booking Confirmed – ${emailData.hotelName} | Zovotel`,
                html: getBookingConfirmationTemplate(emailData),
            }).catch(err => console.error('Non-blocking confirmation email error:', err.message));
        }

    } catch (error) {
        console.error('\n=== Retry Booking Error ===');
        console.error('Error Message:', error.message);
        if (claimedOrderId) releaseOrder(claimedOrderId);

        if (error.response) {
            console.error('TBO API Error:', JSON.stringify(error.response.data, null, 2));
            return res.status(error.response.status).json({
                error: 'Hotel booking retry failed',
                message: error.response.data?.Status?.Description || error.message,
                details: error.response.data
            });
        }

        res.status(500).json({
            error: 'Booking retry failed',
            message: error.message
        });
    }
};

/**
 * Generate voucher for hold bookings
 * Must be called before last cancellation date to avoid cancellation
 */
exports.generateVoucher = async (req, res) => {
    try {
        const { orderId, bookingId } = req.body;

        if (!orderId && !bookingId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['orderId or bookingId']
            });
        }

        console.log('\n=== Generate Voucher Request ===');
        console.log(`Order ID: ${orderId}, Booking ID: ${bookingId}`);

        // Get booking from MySQL
        let bookingData = null;
        let orderIdToUse = orderId;

        if (orderId) {
            bookingData = await bookingService.getBookingData(orderId);
        }

        if (!bookingData && bookingId) {
            // Search by bookingId using db query
            console.log(`[SQL FETCH] Searching for booking by bookingId: ${bookingId}`);
            const [rows] = await db.execute(
                `SELECT order_id FROM bookings WHERE JSON_UNQUOTE(JSON_EXTRACT(tbo_response, '$.bookingId')) = ? LIMIT 1`,
                [Number(bookingId)]
            );
            console.log(`[SQL FETCH] Found ${rows.length} matching booking(s) by bookingId`);
            if (rows.length > 0) {
                orderIdToUse = rows[0].order_id;
                bookingData = await bookingService.getBookingData(orderIdToUse);
            }
        }

        if (!bookingData) {
            return res.status(404).json({
                error: 'Booking not found',
                message: 'No booking found with provided orderId or bookingId'
            });
        }

        // Check if already vouchered
        if (bookingData.tboResponse?.voucherStatus || bookingData.tboResponse?.hotelBookingStatus === 'Vouchered') {
            return res.json({
                success: true,
                message: 'Booking is already vouchered',
                alreadyVouchered: true
            });
        }

        // Build GenerateVoucher request (similar to Book but with specific flag)
        const voucherRequest = {
            EndUserIp: req.ip || '127.0.0.1',
            BookingCode: bookingData.bookingCode,
            GuestNationality: bookingData.guestNationality,
            IsVoucherBooking: true, // Now we want to voucher
            NetAmount: bookingData.amount,
            HotelRoomsDetails: bookingData.hotelRoomsDetails,
            IsPackageFare: bookingData.isPackageFare,
            IsPackageDetailsMandatory: bookingData.isPackageDetailsMandatory
        };

        console.log('GenerateVoucher Request:', JSON.stringify(voucherRequest, null, 2));

        // Call TBO Book API (which will generate voucher for hold booking)
        const axiosInstance = createSearchAxiosInstance();
        const tboResponse = await axiosInstance.post(config.tboApi.bookUrl, voucherRequest);

        console.log('TBO GenerateVoucher Response:', JSON.stringify(tboResponse.data, null, 2));

        const bookResult = tboResponse.data.BookResult || tboResponse.data;

        // Determine result
        const isSuccess = bookResult.Status === 1 ||
            bookResult.HotelBookingStatus === 'Confirmed' ||
            bookResult.HotelBookingStatus === 'Vouchered' ||
            bookResult.VoucherStatus === true;

        if (isSuccess) {
            // Update booking in MySQL
            console.log(`[SQL UPDATE] Updating voucher status for orderId: ${orderIdToUse}`);
            const [updateResult] = await db.execute(
                `UPDATE bookings SET
                    tbo_response = JSON_SET(COALESCE(tbo_response, '{}'),
                        '$.voucherStatus', true,
                        '$.hotelBookingStatus', ?,
                        '$.confirmationNo', ?
                    )
                WHERE order_id = ?`,
                [
                    bookResult.HotelBookingStatus || 'Vouchered',
                    bookResult.ConfirmationNo || bookingData.tboResponse?.confirmationNo || null,
                    orderIdToUse
                ]
            );
            console.log(`[SQL UPDATE] ✅ Voucher status updated - affectedRows: ${updateResult.affectedRows}`);

            res.json({
                success: true,
                message: 'Voucher generated successfully',
                bookingId: bookResult.BookingId || bookingData.tboResponse?.bookingId,
                confirmationNo: bookResult.ConfirmationNo || bookingData.tboResponse?.confirmationNo,
                hotelBookingStatus: bookResult.HotelBookingStatus || 'Vouchered'
            });
        } else {
            const errorMessage = bookResult.Error?.ErrorMessage || 'Failed to generate voucher';
            res.status(400).json({
                success: false,
                error: 'Voucher generation failed',
                message: errorMessage,
                tboResponse: bookResult
            });
        }

    } catch (error) {
        console.error('\n=== Generate Voucher Error ===');
        console.error('Error Message:', error.message);

        if (error.response) {
            console.error('TBO API Error:', JSON.stringify(error.response.data, null, 2));
            return res.status(error.response.status).json({
                error: 'Voucher generation failed',
                message: error.response.data?.Status?.Description || error.message,
                details: error.response.data
            });
        }

        res.status(500).json({
            error: 'Failed to generate voucher',
            message: error.message
        });
    }
};
