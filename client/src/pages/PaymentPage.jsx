import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MapPin, Star, Calendar, Users, CreditCard, Shield, Check,
    AlertCircle, ArrowLeft, Clock, X, Loader, Lock, ChevronRight, Tag
} from 'lucide-react';
import { createPaymentOrder, verifyPayment, validateCoupon, retryBooking, fetchTboBookingDetails } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ErrorAlert from '../components/ErrorAlert';

const PaymentPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { addBooking, currentUser } = useAuth();

    // Data passed from GuestDetailsPage
    const {
        hotel,
        room,
        searchParams,
        bookingCode,
        preBookData,
        guestDetails,
        contactDetails,
        billingDetails,
        isInternational,
        netAmount,
        isVoucherBooking = true
    } = location.state || {};

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [bookingResult, setBookingResult] = useState(null);
    const [bookingFailedButPaid, setBookingFailedButPaid] = useState(false);
    const [failedBookingResult, setFailedBookingResult] = useState(null);
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);

    // Price/Cancellation change dialog state
    const [priceChangeDialog, setPriceChangeDialog] = useState(null);
    const [retryingBooking, setRetryingBooking] = useState(false);

    // Pending status auto-retry state
    const [pendingCheckCount, setPendingCheckCount] = useState(0);
    const [checkingPendingStatus, setCheckingPendingStatus] = useState(false);

    // Coupon state
    const [couponCode, setCouponCode] = useState('');
    const [couponApplied, setCouponApplied] = useState(null); // { code, discount, finalAmount, coupon }
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');

    // Load Razorpay script
    useEffect(() => {
        const loadRazorpay = () => {
            return new Promise((resolve) => {
                if (window.Razorpay) {
                    resolve(true);
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.onload = () => resolve(true);
                script.onerror = () => resolve(false);
                document.body.appendChild(script);
            });
        };

        loadRazorpay().then((loaded) => {
            setRazorpayLoaded(loaded);
            if (!loaded) {
                setError('Failed to load payment gateway. Please refresh the page.');
            }
        });
    }, []);

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Calculate nights
    const calculateNights = () => {
        if (!searchParams?.checkIn || !searchParams?.checkOut) return 1;
        const checkIn = new Date(searchParams.checkIn);
        const checkOut = new Date(searchParams.checkOut);
        return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    };

    // Get room name
    const getRoomName = () => {
        return preBookData?.Rooms?.[0]?.Name?.[0] || room?.Name?.[0] || 'Selected Room';
    };

    // Parse rate conditions from preBookData
    const getRateConditions = () => {
        const conditions = preBookData?.RateConditions || [];
        const parsed = {
            checkInTimeBegin: '',
            checkInTimeEnd: '',
            checkOutTime: '',
            checkInInstructions: '',
            specialInstructions: '',
            minimumCheckInAge: '',
            optionalFees: '',
            cardsAccepted: '',
            otherPolicies: []
        };

        conditions.forEach(condition => {
            const trimmed = condition.trim();
            if (trimmed.startsWith('CheckIn Time-Begin:')) {
                parsed.checkInTimeBegin = trimmed.replace('CheckIn Time-Begin:', '').trim();
            } else if (trimmed.startsWith('CheckIn Time-End:')) {
                parsed.checkInTimeEnd = trimmed.replace('CheckIn Time-End:', '').trim();
            } else if (trimmed.startsWith('CheckOut Time:')) {
                parsed.checkOutTime = trimmed.replace('CheckOut Time:', '').trim();
            } else if (trimmed.startsWith('CheckIn Instructions:')) {
                parsed.checkInInstructions = trimmed.replace('CheckIn Instructions:', '').trim();
            } else if (trimmed.startsWith('Special Instructions')) {
                parsed.specialInstructions = trimmed.replace(/Special Instructions\s*:?/, '').trim();
            } else if (trimmed.startsWith('Minimum CheckIn Age')) {
                parsed.minimumCheckInAge = trimmed.replace(/Minimum CheckIn Age\s*:?/, '').trim();
            } else if (trimmed.startsWith('Optional Fees:')) {
                parsed.optionalFees = trimmed.replace('Optional Fees:', '').trim();
            } else if (trimmed.startsWith('Cards Accepted:')) {
                parsed.cardsAccepted = trimmed.replace('Cards Accepted:', '').trim();
            } else {
                parsed.otherPolicies.push(trimmed);
            }
        });

        return parsed;
    };

    // Get cancellation policies from preBookData
    const getCancellationPolicies = () => {
        const roomData = preBookData?.Rooms?.[0] || {};
        return roomData.CancelPolicies || [];
    };

    // Get currency and amount
    const getCurrency = () => preBookData?.Currency || 'INR';
    const getAmount = () => netAmount || preBookData?.Rooms?.[0]?.TotalFare || room?.TotalFare || 0;
    const getFinalAmount = () => couponApplied ? couponApplied.finalAmount : getAmount();

    // Get TDS information from preBookData
    const getTDSInfo = () => {
        const roomData = preBookData?.Rooms?.[0];
        const priceBreakUp = roomData?.PriceBreakUp?.[0];
        const taxBreakup = priceBreakUp?.TaxBreakup || [];
        const tdsTax = taxBreakup.find(tax => tax.TaxType === 'Tax_TDS');

        return {
            hasTDS: !!tdsTax,
            amount: tdsTax ? tdsTax.TaxAmount : 0,
            percentage: tdsTax ? tdsTax.TaxPercentage : 0,
            totalFare: roomData?.TotalFare || 0,
            netAmount: roomData?.NetAmount || roomData?.TotalFare || 0
        };
    };

    // Handle coupon apply
    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponError('');
        try {
            const res = await validateCoupon(couponCode.trim(), getAmount());
            if (res.success) {
                setCouponApplied({
                    code: res.coupon.code,
                    discount: res.discount,
                    finalAmount: res.finalAmount,
                    coupon: res.coupon
                });
            }
        } catch (err) {
            setCouponError(err.response?.data?.error || 'Invalid coupon code');
            setCouponApplied(null);
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setCouponApplied(null);
        setCouponCode('');
        setCouponError('');
    };

    // Handle payment
    const handlePayment = async () => {
        if (!razorpayLoaded) {
            setError('Payment gateway not loaded. Please refresh the page.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Build hotel rooms details for TBO API
            // Map pax onto correct rooms dynamically based on roomIndex
            const numRooms = searchParams?.rooms || 1;
            const hotelRoomsDetails = [];
            
            const prebookRooms = preBookData?.Rooms || [];
            
            for (let i = 0; i < numRooms; i++) {
                // For bundled rooms (1 room object for multiple rooms), fallback to index 0
                const roomIndexData = prebookRooms[i] || prebookRooms[0] || {};
                
                // Extract RoomTypeName safely (can be an array if bundled)
                let roomTypeName = roomIndexData.RoomTypeName;
                if (!roomTypeName && roomIndexData.Name) {
                    if (Array.isArray(roomIndexData.Name)) {
                        roomTypeName = roomIndexData.Name[i] || roomIndexData.Name[0];
                    } else {
                        roomTypeName = roomIndexData.Name;
                    }
                }

                // Get all guests for this room and find the lead passenger's PAN
                const roomGuests = guestDetails.filter(g => g.roomIndex === (i + 1));
                const leadPassenger = roomGuests.find(g => g.isRoomLead);
                const leadPassengerPan = leadPassenger?.panNumber || '';

                const roomPax = roomGuests.map((guest) => {
                        let title = guest.title;
                        if (title === 'Master') title = 'Mr';
                        
                        const pax = {
                            Title: title,
                            FirstName: guest.firstName.trim().substring(0, 25),
                            MiddleName: guest.middleName?.trim() || '',
                            LastName: guest.lastName.trim().substring(0, 25),
                            Phoneno: guest.isRoomLead ? contactDetails.phone : '',
                            Email: guest.isRoomLead ? contactDetails.email : '',
                            PaxType: guest.type === 'adult' ? 1 : 2,
                            LeadPassenger: guest.isRoomLead,
                            Age: parseInt(guest.age) || (guest.type === 'child' ? 5 : 25)
                        };

                        // PAN is required for ALL adults in international bookings
                        if (isInternational && guest.type === 'adult' && guest.panNumber) {
                            pax.PAN = guest.panNumber;
                        }

                        // For child passengers in international bookings, automatically use lead passenger's PAN as guardian PAN
                        if (isInternational && guest.type === 'child' && leadPassengerPan) {
                            pax.GuardianDetail = {
                                Title: leadPassenger?.title || 'Mr',
                                FirstName: leadPassenger?.firstName || 'Guardian',
                                LastName: leadPassenger?.lastName || 'Parent',
                                PAN: leadPassengerPan
                            };
                        }

                        // Remove strictly empty fields completely
                        Object.keys(pax).forEach(key => {
                            if (pax[key] === '' || pax[key] === null || pax[key] === undefined) {
                                delete pax[key];
                            }
                        });

                        return pax;
                    });
                
                const roomDetail = {
                    RoomIndex: (i + 1),
                    HotelPassenger: roomPax
                };

                // Add optional fields that TBO might require if provided by PreBook
                if (roomIndexData.RoomTypeCode) roomDetail.RoomTypeCode = roomIndexData.RoomTypeCode;
                if (roomTypeName) roomDetail.RoomTypeName = roomTypeName;
                if (roomIndexData.RatePlanCode) roomDetail.RatePlanCode = roomIndexData.RatePlanCode;
                if (roomIndexData.Price) roomDetail.Price = roomIndexData.Price;

                hotelRoomsDetails.push(roomDetail);
            }

            // Create payment order
            const orderData = {
                amount: getFinalAmount(),
                currency: getCurrency(),
                userId: currentUser?.uid || null,
                bookingCode,
                guestNationality: contactDetails.nationality,
                hotelRoomsDetails: hotelRoomsDetails,
                isPackageFare: preBookData?.Rooms?.[0]?.PackageFare || false,
                isPackageDetailsMandatory: preBookData?.Rooms?.[0]?.PackageDetailsMandatory || false,
                isVoucherBooking, // Pass the booking type
                // Metadata for booking history
                hotelInfo: {
                    hotelCode: hotel?.HotelCode,
                    hotelName: hotel?.HotelName,
                    address: hotel?.Address,
                    cityName: hotel?.CityName,
                    rating: hotel?.HotelRating,
                    picture: hotel?.Images?.[0] || null
                },
                roomInfo: {
                    name: getRoomName(),
                    mealType: preBookData?.Rooms?.[0]?.MealType || room?.MealType,
                    inclusion: preBookData?.Rooms?.[0]?.Inclusion || room?.Inclusion
                },
                searchParams: {
                    checkIn: searchParams?.checkIn,
                    checkOut: searchParams?.checkOut,
                    adults: searchParams?.adults,
                    children: searchParams?.children,
                    rooms: searchParams?.rooms
                },
                contactDetails,
                billingDetails,
                // Markup tracking
                originalAmount: room?.OriginalTotalFare || getAmount(),
                markupAmount: room?.OriginalTotalFare ? (getAmount() - room.OriginalTotalFare) : 0,
                markupPercentage: room?.MarkupPercentage || 0,
                // Coupon tracking
                couponCode: couponApplied?.code || null,
                couponDiscount: couponApplied?.discount || 0,
                // Rate conditions and cancellation policies for email
                rateConditions: getRateConditions(),
                cancellationPolicies: getCancellationPolicies()
            };

            // console.log('Creating payment order:', orderData);
            const orderResponse = await createPaymentOrder(orderData);
            // console.log('Order created:', orderResponse);

            if (!orderResponse.success || !orderResponse.orderId) {
                throw new Error(orderResponse.message || 'Failed to create payment order');
            }

            // Configure Razorpay options
            const options = {
                key: orderResponse.keyId,
                amount: orderResponse.amount,
                currency: orderResponse.currency,
                name: 'Zovotel',
                description: `Hotel Booking - ${hotel?.HotelName || 'Hotel'}`,
                order_id: orderResponse.orderId,
                handler: async function (response) {
                    // console.log('Payment successful:', response);
                    await handlePaymentSuccess(response);
                },
                prefill: {
                    name: `${contactDetails.firstName} ${contactDetails.lastName}`,
                    email: contactDetails.email,
                    contact: contactDetails.phone
                },
                notes: {
                    hotelName: hotel?.HotelName,
                    checkIn: searchParams?.checkIn,
                    checkOut: searchParams?.checkOut
                },
                theme: {
                    color: '#5391F0'
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                        // console.log('Payment modal closed');
                    }
                }
            };

            // Open Razorpay checkout
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                console.error('Payment failed:', response.error);
                setError(`Payment failed: ${response.error.description}`);
                setLoading(false);
            });
            rzp.open();

        } catch (err) {
            console.error('Payment error:', err);
            setError(err.message || 'Failed to initiate payment. Please try again.');
            setLoading(false);
        }
    };

    // Handle successful payment
    const handlePaymentSuccess = async (razorpayResponse) => {
        try {
            const verifyResponse = await verifyPayment({
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature
            });

            // Check for price or cancellation policy changes
            if (verifyResponse.warning && (verifyResponse.isPriceChanged || verifyResponse.isCancellationPolicyChanged)) {
                console.log('Price/Cancellation policy change detected:', verifyResponse);
                setPriceChangeDialog({
                    type: verifyResponse.isPriceChanged ? 'price' : 'cancellation',
                    verifyResponse,
                    razorpayResponse,
                    newAmount: verifyResponse.tboResponse?.NetAmount || verifyResponse.tboResponse?.TotalFare,
                    oldAmount: getAmount()
                });
                setLoading(false);
                return;
            }

            // Check for another retry required (rare case)
            if (verifyResponse.requiresAnotherRetry) {
                setError('Price changed again. Please review and retry.');
                setPriceChangeDialog({
                    type: 'price',
                    verifyResponse,
                    razorpayResponse,
                    newAmount: verifyResponse.tboResponse?.NetAmount,
                    oldAmount: getAmount(),
                    requiresAnotherRetry: true
                });
                setLoading(false);
                return;
            }

            if (verifyResponse.success) {
                await processSuccessfulBooking(verifyResponse, razorpayResponse);
            } else if (verifyResponse.paymentCompleted) {
                setBookingFailedButPaid(true);
                setFailedBookingResult(verifyResponse);
            } else {
                setError(verifyResponse.message || 'Booking failed after payment. Please contact support.');
            }
        } catch (err) {
            console.error('Verification error:', err);
            if (err.response?.data?.paymentCompleted) {
                setBookingFailedButPaid(true);
                setFailedBookingResult(err.response.data);
            } else {
                setError(err.response?.data?.message || 'Payment verification failed. Please contact support.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Process successful booking (extracted for reuse)
    const processSuccessfulBooking = async (verifyResponse, razorpayResponse) => {
        try {
            console.log('=== Saving booking to user profile ===');
            const savedBooking = await addBooking({
                hotelName: hotel?.HotelName || 'Hotel',
                hotelAddress: hotel?.Address || hotel?.CityName || '',
                hotelCode: hotel?.HotelCode || '',
                hotelImage: hotel?.Images?.[0] || '',
                checkIn: searchParams?.checkIn || '',
                checkOut: searchParams?.checkOut || '',
                totalAmount: getAmount(),
                currency: getCurrency(),
                guests: guestDetails?.length || 1,
                rooms: searchParams?.rooms || 1,
                roomName: getRoomName(),
                orderId: verifyResponse.orderId || razorpayResponse.razorpay_order_id,
                paymentId: verifyResponse.paymentId || razorpayResponse.razorpay_payment_id,
                tboBookingId: verifyResponse.bookingId || '',
                bookingRefNo: verifyResponse.bookingRefNo || '',
                confirmationNo: verifyResponse.confirmationNo || '',
                bookingStatus: verifyResponse.bookingStatus || 'Confirmed',
                lastCancellationDeadline: preBookData?.Rooms?.[0]?.LastCancellationDeadline || '',
                billingDetails: billingDetails || null,
            });
            console.log('=== Booking saved successfully ===', savedBooking);
        } catch (bookingErr) {
            console.error('Failed to save booking to profile:', bookingErr.message, bookingErr);
        }

        setPaymentSuccess(true);
        setBookingResult(verifyResponse);

        // If booking is pending, start auto-retry after 120 seconds
        if (verifyResponse.bookingStatus === 'Pending') {
            startPendingStatusCheck(verifyResponse, razorpayResponse);
        }
    };

    // Handle retry booking with updated price/cancellation policy
    const handleRetryBooking = async (acceptChanges, updatedAmount) => {
        if (!priceChangeDialog) return;

        setRetryingBooking(true);
        try {
            const { razorpayResponse } = priceChangeDialog;

            const retryData = {
                orderId: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                updatedAmount: updatedAmount,
                acceptPriceChange: priceChangeDialog.type === 'price' && acceptChanges,
                acceptCancellationChange: priceChangeDialog.type === 'cancellation' && acceptChanges
            };

            const retryResponse = await retryBooking(retryData);

            if (retryResponse.success) {
                setPriceChangeDialog(null);
                await processSuccessfulBooking(retryResponse, razorpayResponse);
            } else if (retryResponse.paymentCompleted) {
                setBookingFailedButPaid(true);
                setFailedBookingResult(retryResponse);
            } else {
                setError(retryResponse.message || 'Booking retry failed. Please contact support.');
            }
        } catch (err) {
            console.error('Retry booking error:', err);
            if (err.response?.data?.paymentCompleted) {
                setBookingFailedButPaid(true);
                setFailedBookingResult(err.response.data);
            } else {
                setError(err.response?.data?.message || 'Failed to retry booking. Please contact support.');
            }
        } finally {
            setRetryingBooking(false);
        }
    };

    // Auto-check pending status after 120 seconds (TBO requirement)
    const startPendingStatusCheck = (verifyResponse, razorpayResponse) => {
        console.log('Starting pending status check, will check in 120 seconds...');

        setTimeout(async () => {
            if (paymentSuccess && bookingResult?.bookingStatus === 'Pending') {
                await checkPendingStatus(verifyResponse, razorpayResponse);
            }
        }, 120000); // 120 seconds
    };

    // Check pending booking status via GetBookingDetail
    const checkPendingStatus = async (verifyResponse, razorpayResponse) => {
        if (!verifyResponse.bookingId) return;

        setCheckingPendingStatus(true);
        try {
            const bookingData = {
                BookingId: verifyResponse.bookingId,
                EndUserIp: '127.0.0.1',
                // Lets the server confirm this guest owns the booking
                orderId: razorpayResponse?.razorpay_order_id
            };

            const statusResponse = await fetchTboBookingDetails(bookingData);
            console.log('Pending status check response:', statusResponse);

            const bookingStatus = statusResponse?.BookResult?.HotelBookingStatus ||
                                statusResponse?.BookingStatus ||
                                statusResponse?.BookResult?.Status;

            if (bookingStatus === 'Confirmed' || bookingStatus === 'Vouchered') {
                // Update booking status
                const updatedResult = {
                    ...verifyResponse,
                    bookingStatus: 'Confirmed',
                    confirmationNo: statusResponse?.BookResult?.ConfirmationNo || verifyResponse.confirmationNo
                };
                setBookingResult(updatedResult);
                setPendingCheckCount(prev => prev + 1);
            } else if (bookingStatus === 'Pending' && pendingCheckCount < 3) {
                // Retry up to 3 times
                setPendingCheckCount(prev => prev + 1);
                startPendingStatusCheck(verifyResponse, razorpayResponse);
            }
        } catch (err) {
            console.error('Pending status check error:', err);
        } finally {
            setCheckingPendingStatus(false);
        }
    };

    // Redirect if no data
    if (!hotel || !bookingCode) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">No Booking Data</h2>
                    <p className="text-gray-600 mb-4">Please complete guest details first.</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Payment Successful but Booking Failed state
    if (bookingFailedButPaid && failedBookingResult) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center border-t-4 border-red-500">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Failed</h2>
                    <p className="text-gray-600 mb-6">
                        Your payment was processed successfully, but the hotel reservation failed. 
                        <strong> Your money will be refunded within 3-5 business days.</strong>
                    </p>
                    
                    <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Payment ID</span>
                            <span className="font-mono text-xs text-gray-700">{failedBookingResult.paymentId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Order ID</span>
                            <span className="font-mono text-xs text-gray-700">{failedBookingResult.orderId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Reason</span>
                            <span className="font-medium text-red-600">{failedBookingResult.message || 'Failed at hotel provider'}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="bg-gray-800 text-white w-full py-3 rounded-lg font-semibold hover:bg-gray-900 transition"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    // Success state
    if (paymentSuccess && bookingResult) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check size={40} className="text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
                        <p className="text-gray-600">Your hotel reservation has been successfully completed.</p>
                    </div>

                    {/* Booking Details */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Booking Status</span>
                            <span className="font-semibold text-green-600">{bookingResult.bookingStatus}</span>
                        </div>
                        {bookingResult.bookingId && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Booking ID</span>
                                <span className="font-semibold text-gray-800">{bookingResult.bookingId}</span>
                            </div>
                        )}
                        {bookingResult.bookingRefNo && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Reference No</span>
                                <span className="font-semibold text-gray-800">{bookingResult.bookingRefNo}</span>
                            </div>
                        )}
                        {bookingResult.confirmationNo && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Confirmation No</span>
                                <span className="font-semibold text-gray-800">{bookingResult.confirmationNo}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Payment ID</span>
                            <span className="font-mono text-xs text-gray-600">{bookingResult.paymentId}</span>
                        </div>
                    </div>

                    {/* Hotel Info */}
                    <div className="bg-blue-50 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold text-gray-800 mb-2">{hotel?.HotelName}</h3>
                        <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-1">
                                <MapPin size={14} />
                                {hotel?.Address || hotel?.CityName}
                            </div>
                            <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(searchParams?.checkIn)} - {formatDate(searchParams?.checkOut)}
                            </div>
                            <div className="flex items-center gap-1">
                                <Users size={14} />
                                {guestDetails?.length || 1} Guest(s), {calculateNights()} Night(s)
                            </div>
                        </div>
                    </div>

                    {/* Warning if pending */}
                    {bookingResult.bookingStatus === 'Pending' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                            <div className="flex items-start gap-2">
                                <Clock size={18} className="text-amber-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-amber-800">Confirmation Pending</p>
                                    <p className="text-xs text-amber-600">
                                        Your booking is being confirmed by the hotel.
                                        {checkingPendingStatus && (
                                            <span className="flex items-center gap-1 mt-1">
                                                <Loader size={12} className="animate-spin" />
                                                Checking status...
                                            </span>
                                        )}
                                        {!checkingPendingStatus && pendingCheckCount > 0 && (
                                            <span className="block mt-1">
                                                Status check #{pendingCheckCount} completed. Will retry automatically.
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/profile')}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                        >
                            View My Bookings
                            <ChevronRight size={18} />
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const nights = calculateNights();
    const amount = getAmount();
    const currency = getCurrency();
    const numRooms = searchParams?.rooms || 1;

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-6">
                <div className="container mx-auto px-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center text-white/80 hover:text-white mb-4 transition"
                    >
                        <ArrowLeft size={20} className="mr-2" />
                        Back to Guest Details
                    </button>
                    <h1 className="text-2xl font-bold">Complete Payment</h1>
                    <p className="text-white/80 text-sm mt-1">Secure checkout powered by Razorpay</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                {/* Error Alert */}
                {error && (
                    <ErrorAlert
                        message={error}
                        type="error"
                        title="Payment Error"
                        dismissible={true}
                        onDismiss={() => setError(null)}
                        onRetry={handlePayment}
                        className="mb-6"
                    />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Booking Summary */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Hotel Card */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <MapPin size={20} className="mr-2 text-blue-600" />
                                Booking Summary
                            </h2>

                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Hotel Image */}
                                <div className="w-full sm:w-32 h-40 sm:h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                    {hotel?.Images?.[0] ? (
                                        <img
                                            src={hotel.Images[0]}
                                            alt={hotel?.HotelName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                                            <MapPin size={24} className="text-blue-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Hotel Info */}
                                <div className="flex-1">
                                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                                        <h3 className="font-bold text-gray-800">{hotel?.HotelName}</h3>
                                        <div className="flex text-yellow-400">
                                            {[...Array(parseInt(hotel?.HotelRating) || 0)].map((_, i) => (
                                                <Star key={i} size={14} fill="currentColor" />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2">{hotel?.Address || hotel?.CityName}</p>
                                    <p className="text-sm font-medium text-blue-600">{getRoomName()}</p>
                                </div>
                            </div>

                            {/* Dates and Guests */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Check-in</div>
                                    <div className="font-semibold text-sm text-gray-800">
                                        {formatDate(searchParams?.checkIn)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Check-out</div>
                                    <div className="font-semibold text-sm text-gray-800">
                                        {formatDate(searchParams?.checkOut)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Duration & Rooms</div>
                                    <div className="font-semibold text-sm text-gray-800">
                                        {nights} night{nights > 1 ? 's' : ''} • {numRooms} room{numRooms > 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Guest Details */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Users size={20} className="mr-2 text-blue-600" />
                                Guest Details
                            </h2>
                            <div className="space-y-3">
                                {guestDetails?.map((guest, index) => (
                                    <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div>
                                            <span className="font-medium text-gray-800">
                                                {guest.title} {guest.firstName} {guest.lastName}
                                            </span>
                                            {guest.isLead && (
                                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                    Lead Guest
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-sm text-gray-500 capitalize">{guest.type}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Contact Info */}
                            <div className="mt-4 pt-4 border-t">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Contact:</span> {contactDetails?.email} | {contactDetails?.phone}
                                </div>
                            </div>

                            {/* Billing Info */}
                            {billingDetails && (
                                <div className="mt-3 pt-3 border-t">
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium">Billing:</span>{' '}
                                        {billingDetails.address}, {billingDetails.city}, {billingDetails.state} - {billingDetails.pincode}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Payment */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 sticky top-24">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <CreditCard size={20} className="mr-2 text-blue-600" />
                                Payment Details
                            </h2>

                            {/* Price Breakdown */}
                            {(() => {
                                const tdsInfo = getTDSInfo();
                                const roomData = preBookData?.Rooms?.[0] || room;
                                const totalFare = roomData?.TotalFare || amount;
                                const totalTax = roomData?.TotalTax || 0;
                                // TDS is not part of what customer pays - it's deducted from hotel payout
                                const taxExcludingTDS = Math.max(0, totalTax - tdsInfo.amount);
                                const roomRate = totalFare - totalTax;

                                return (
                                    <div className="space-y-3 mb-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Room ({nights} night{nights > 1 ? 's' : ''})</span>
                                            <span className="text-gray-800">
                                                {currency} {roomRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Taxes & Fees</span>
                                            <span className="text-gray-800">
                                                {currency} {taxExcludingTDS.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {couponApplied && (
                                            <div className="flex justify-between text-sm mt-2">
                                                <span className="text-green-600 flex items-center gap-1">
                                                    <Tag size={12} /> Coupon ({couponApplied.code})
                                                </span>
                                                <span className="text-green-600 font-semibold">- {currency} {couponApplied.discount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="border-t pt-3 flex justify-between font-bold">
                                            <span className="text-gray-800">
                                                Total Amount
                                            </span>
                                            <div className="text-right">
                                                {couponApplied && (
                                                    <div className="text-xs text-gray-400 line-through">
                                                        {currency} {amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                                <span className="text-xl text-blue-600">
                                                    {currency} {getFinalAmount().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Coupon Code Input */}
                            <div className="mb-6">
                                <div className="border border-dashed border-gray-300 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Tag size={16} className="text-indigo-500" />
                                        <span className="text-sm font-medium text-gray-700">Have a coupon code?</span>
                                    </div>
                                    {couponApplied ? (
                                        <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <Check size={16} className="text-green-600" />
                                                <span className="text-sm font-semibold text-green-700">{couponApplied.code}</span>
                                                <span className="text-xs text-green-600">
                                                    ({couponApplied.coupon.discountType === 'percentage'
                                                        ? `${couponApplied.coupon.discountValue}% off`
                                                        : `₹${couponApplied.coupon.discountValue} off`})
                                                </span>
                                            </div>
                                            <button onClick={handleRemoveCoupon}
                                                className="text-red-500 hover:text-red-700 transition">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                                    placeholder="Enter coupon code"
                                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase"
                                                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                                                />
                                                <button
                                                    onClick={handleApplyCoupon}
                                                    disabled={couponLoading || !couponCode.trim()}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${couponLoading || !couponCode.trim()
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                        }`}
                                                >
                                                    {couponLoading ? <Loader size={14} className="animate-spin" /> : 'Apply'}
                                                </button>
                                            </div>
                                            {couponError && (
                                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                    <AlertCircle size={12} /> {couponError}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Security Notice */}
                            <div className="bg-green-50 rounded-lg p-3 mb-6">
                                <div className="flex items-center gap-2 text-green-700 text-sm">
                                    <Shield size={16} />
                                    <span className="font-medium">Secure Payment</span>
                                </div>
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <Lock size={12} />
                                    Your payment info is encrypted and secure
                                </p>
                            </div>

                            {/* Pay Button */}
                            <button
                                onClick={handlePayment}
                                disabled={loading || !razorpayLoaded}
                                className={`w-full py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 ${loading || !razorpayLoaded
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader size={20} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Lock size={18} />
                                        Pay {currency} {getFinalAmount().toLocaleString('en-IN')}
                                    </>
                                )}
                            </button>

                            {/* Payment Methods */}
                            <div className="mt-4 text-center">
                                <p className="text-xs text-gray-500 mb-2">Accepted Payment Methods</p>
                                <div className="flex justify-center gap-2">
                                    <div className="bg-gray-100 rounded px-2 py-1 text-xs font-medium text-gray-600">
                                        VISA
                                    </div>
                                    <div className="bg-gray-100 rounded px-2 py-1 text-xs font-medium text-gray-600">
                                        MasterCard
                                    </div>
                                    <div className="bg-gray-100 rounded px-2 py-1 text-xs font-medium text-gray-600">
                                        UPI
                                    </div>
                                    <div className="bg-gray-100 rounded px-2 py-1 text-xs font-medium text-gray-600">
                                        NetBanking
                                    </div>
                                </div>
                            </div>

                            {/* Booking Type Notice */}
                            <div className="mt-4 text-center">
                                <p className={`text-xs rounded-lg p-2 ${
                                    isVoucherBooking 
                                        ? 'text-green-700 bg-green-50' 
                                        : 'text-amber-600 bg-amber-50'
                                }`}>
                                    {isVoucherBooking 
                                        ? '✓ Voucher Booking: Immediate confirmation will be generated' 
                                        : '⚠️ Hold Booking: Room will be held without voucher'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Price/Cancellation Change Dialog */}
                {priceChangeDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                    <AlertCircle size={24} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">
                                        {priceChangeDialog.type === 'price' ? 'Price Changed' : 'Policy Changed'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        The hotel has updated their terms
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                {priceChangeDialog.type === 'price' && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Original Price:</span>
                                            <span className="line-through">₹{priceChangeDialog.oldAmount?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 font-medium">New Price:</span>
                                            <span className="font-bold text-blue-600">₹{priceChangeDialog.newAmount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                                {priceChangeDialog.type === 'cancellation' && (
                                    <p className="text-sm text-gray-600">
                                        The cancellation policy has been updated. Please review the new terms before confirming.
                                    </p>
                                )}
                            </div>

                            <p className="text-sm text-gray-600 mb-4">
                                Do you want to accept the changes and proceed with the booking?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPriceChangeDialog(null)}
                                    disabled={retryingBooking}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleRetryBooking(true, priceChangeDialog.newAmount)}
                                    disabled={retryingBooking}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {retryingBooking ? (
                                        <>
                                            <Loader size={16} className="animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Accept & Continue'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentPage;
