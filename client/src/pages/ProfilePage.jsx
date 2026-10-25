import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';
import { useAuth } from '../context/AuthContext';
import { cancelBooking, getCancellationStatus } from '../services/api';
import {
    User,
    Heart,
    Calendar,
    Settings,
    MapPin,
    Star,
    Phone,
    Mail,
    Lock,
    Edit2,
    Check,
    X,
    AlertCircle,
    ChevronRight,
    RefreshCw,
    CreditCard,
    Clock,
    Users,
    AlertTriangle,
    Copy,
    CheckCircle
} from 'lucide-react';
import ErrorAlert from '../components/ErrorAlert';

const ProfilePage = () => {
    const navigate = useNavigate();
    const {
        currentUser,
        userData,
        likedHotels,
        bookings,
        updateUserProfile,
        changePassword,
        unlikeHotel,
        updateBookingStatus
    } = useAuth();

    // Tab state
    const [activeTab, setActiveTab] = useState('trips');

    // Edit states
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Form states
    const [phoneNumber, setPhoneNumber] = useState(userData?.phoneNumber || '');
    const [username, setUsername] = useState(userData?.username || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Loading states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Trips tab state
    const [tripsFilter, setTripsFilter] = useState('all');

    // Modal states
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showCancelDialog, setShowCancelDialog] = useState(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelRemarks, setCancelRemarks] = useState('');
    const [cancelResult, setCancelResult] = useState(null);
    const [copiedField, setCopiedField] = useState('');

    // Parse star rating helper
    const parseStars = (rating) => {
        if (!rating) return 0;
        if (typeof rating === 'number') return rating;
        if (typeof rating === 'string') {
            const lower = rating.toLowerCase();
            if (lower.includes('one')) return 1;
            if (lower.includes('two')) return 2;
            if (lower.includes('three')) return 3;
            if (lower.includes('four')) return 4;
            if (lower.includes('five')) return 5;
            const num = parseInt(rating);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    const handleUpdatePhone = async () => {
        if (!phoneNumber.trim()) {
            setError('Please enter a valid phone number');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await updateUserProfile({ phoneNumber });
            setSuccess('Phone number updated successfully!');
            setIsEditingPhone(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!username.trim()) {
            setError('Please enter a valid name');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await updateUserProfile({ username });
            setSuccess('Name updated successfully!');
            setIsEditingName(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Please fill in all password fields');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await changePassword(currentPassword, newPassword);
            setSuccess('Password changed successfully!');
            setIsChangingPassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            if (err.message.includes('wrong-password')) {
                setError('Current password is incorrect');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveLikedHotel = async (hotelCode) => {
        try {
            await unlikeHotel(hotelCode);
        } catch (err) {
            setError('Failed to remove hotel from favorites');
        }
    };

    const handleCancelBooking = async (booking) => {
        if (!cancelRemarks.trim()) {
            setError('Please enter a reason for cancellation');
            return;
        }
        setCancelLoading(true);
        setCancelResult(null);
        try {
            // Step 1: Call TBO SendChangeRequest API
            const tboBookingId = parseInt(booking.tboBookingId);
            if (!tboBookingId) {
                throw new Error('TBO Booking ID not found for this booking');
            }

            const cancelResponse = await cancelBooking(tboBookingId, cancelRemarks.trim());
            console.log('Cancel response:', cancelResponse);

            // Step 2: Fetch cancellation status for refund details
            let cancellationDetails = {
                changeRequestId: cancelResponse.changeRequestId,
                changeRequestStatus: cancelResponse.changeRequestStatus,
                cancelledAt: new Date().toISOString(),
                remarks: cancelRemarks.trim()
            };

            if (cancelResponse.changeRequestId) {
                try {
                    const statusResponse = await getCancellationStatus(cancelResponse.changeRequestId);
                    console.log('Cancellation status response:', statusResponse);
                    cancellationDetails = {
                        ...cancellationDetails,
                        cancellationCharge: statusResponse.cancellationCharge !== undefined ? statusResponse.cancellationCharge : null,
                        refundedAmount: statusResponse.refundedAmount !== undefined ? statusResponse.refundedAmount : null,
                        statusResponseStatus: statusResponse.changeRequestStatus !== undefined ? statusResponse.changeRequestStatus : null
                    };
                } catch (statusErr) {
                    console.error('Failed to fetch cancellation status:', statusErr);
                    // Continue even if status fetch fails — cancellation was successful
                }
            }

            // Step 3: Update Firebase booking status with cancellation details
            await updateBookingStatus(booking.bookingId, 'cancelled', cancellationDetails);

            // Show result
            setCancelResult(cancellationDetails);
            setSelectedBooking(null);
            setSuccess('Booking cancelled successfully');
            setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
            console.error('Cancel booking error:', err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to cancel booking';
            setError(errorMsg);
        } finally {
            setCancelLoading(false);
        }
    };

    const formatBookingDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Helper to parse DD-MM-YYYY HH:MM:SS format from API
    const parseCancellationDeadline = (dateStr) => {
        if (!dateStr) return null;
        // Format: "27-05-2026 23:59:59" -> DD-MM-YYYY HH:MM:SS
        const match = dateStr.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
        if (match) {
            const [, day, month, year, hour, minute, second] = match;
            // Create date using local timezone components to avoid UTC conversion issues
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
            return date;
        }
        // Fallback to standard parsing if format differs
        return new Date(dateStr);
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const filteredBookings = bookings.filter(booking => {
        if (tripsFilter === 'all') return true;
        return booking.status === tripsFilter;
    });

    const likedHotelsArray = Object.entries(likedHotels).map(([code, hotel]) => ({
        ...hotel,
        HotelCode: code
    }));

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <User size={64} className="mx-auto text-gray-400 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign in Required</h2>
                    <p className="text-gray-600 mb-4">Please sign in to view your profile</p>
                    <button
                        onClick={() => navigate('/signin')}
                        className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Profile Header */}
            <div className="profile-header-gradient text-white py-12 relative overflow-hidden">
                <div className="container mx-auto px-4 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-8 animate-fade-in-up stagger-1">
                        {/* Avatar */}
                        <div className="w-28 h-28 rounded-full glass-avatar text-blue-600 flex items-center justify-center text-4xl font-bold shadow-xl">
                            {getInitials(userData?.username || currentUser?.email)}
                        </div>

                        {/* User Info */}
                        <div className="text-center md:text-left flex-1">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="bg-white/20 border border-white/40 rounded px-3 py-1 text-white placeholder-white/60"
                                            placeholder="Enter name"
                                        />
                                        <button
                                            onClick={handleUpdateName}
                                            disabled={loading}
                                            className="p-1 hover:bg-white/20 rounded"
                                        >
                                            <Check size={20} />
                                        </button>
                                        <button
                                            onClick={() => setIsEditingName(false)}
                                            className="p-1 hover:bg-white/20 rounded"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-2xl font-bold">
                                            {userData?.username || currentUser?.email?.split('@')[0]}
                                        </h1>
                                        <button
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1 hover:bg-white/20 rounded"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-4 text-white/80 text-sm">
                                <div className="flex items-center gap-1">
                                    <Mail size={14} />
                                    <span>{currentUser?.email}</span>
                                </div>

                                {isEditingPhone ? (
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} />
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            className="bg-white/20 border border-white/40 rounded px-2 py-0.5 text-white placeholder-white/60 text-sm"
                                            placeholder="+91-XXXXXXXXXX"
                                        />
                                        <button
                                            onClick={handleUpdatePhone}
                                            disabled={loading}
                                            className="p-0.5 hover:bg-white/20 rounded"
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            onClick={() => setIsEditingPhone(false)}
                                            className="p-0.5 hover:bg-white/20 rounded"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => setIsEditingPhone(true)}
                                    >
                                        <Phone size={14} />
                                        <span>{userData?.phoneNumber || 'Add phone number'}</span>
                                        <Edit2 size={12} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-6 text-center">
                            <div>
                                <div className="text-3xl font-bold">{likedHotelsArray.length}</div>
                                <div className="text-sm text-white/80">Saved Hotels</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold">{bookings.length}</div>
                                <div className="text-sm text-white/80">Total Trips</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            <div className="container mx-auto px-4">
                {error && (
                    <div className="mt-4">
                        <ErrorAlert
                            message={error}
                            type="error"
                            dismissible={true}
                            onDismiss={() => setError('')}
                        />
                    </div>
                )}
                {success && (
                    <div className="mt-4">
                        <ErrorAlert
                            message={success}
                            type="success"
                            title="Success"
                            dismissible={false}
                        />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="bg-white border-b sticky top-[70px] z-10">
                <div className="container mx-auto px-4">
                    <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setActiveTab('trips')}
                            className={`tab-button px-4 sm:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap text-sm sm:text-base transition-colors ${activeTab === 'trips'
                                ? 'text-blue-600 active'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <Calendar size={18} className={activeTab === 'trips' ? 'animate-bounce' : ''} />
                            My Trips
                        </button>
                        <button
                            onClick={() => setActiveTab('saved')}
                            className={`tab-button px-4 sm:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap text-sm sm:text-base transition-colors ${activeTab === 'saved'
                                ? 'text-blue-600 active'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <Heart size={18} className={activeTab === 'saved' ? 'animate-pulse' : ''} />
                            Saved Hotels
                            {likedHotelsArray.length > 0 && (
                                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                                    {likedHotelsArray.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`tab-button px-4 sm:px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap text-sm sm:text-base transition-colors ${activeTab === 'settings'
                                ? 'text-blue-600 active'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <Settings size={18} />
                            Account Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="container mx-auto px-4 py-6">
                {/* My Trips Tab */}
                {activeTab === 'trips' && (
                    <div>
                        {/* Trips Filter */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {['all', 'booked', 'completed', 'cancelled'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTripsFilter(filter)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tripsFilter === filter
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                >
                                    {filter === 'all' ? 'All Trips' :
                                        filter === 'booked' ? 'Upcoming' :
                                            filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Bookings List */}
                        {filteredBookings.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                                <Calendar size={64} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">No trips found</h3>
                                <p className="text-gray-500 mb-4">
                                    {tripsFilter === 'all'
                                        ? "You haven't made any bookings yet"
                                        : `No ${tripsFilter} bookings`}
                                </p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Search Hotels
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in-up stagger-2">
                                {filteredBookings.map((booking, index) => (
                                    <div
                                        key={booking.bookingId}
                                        className="trip-card bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row gap-5"
                                        style={{ animationDelay: `${index * 0.1}s` }}
                                    >
                                        {/* Hotel Image */}
                                        <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden bg-gray-200">
                                            <img
                                                src={booking.hotelImage || 'https://cdn6.agoda.net/images/MVC/default/background_image/illustrations/bg-agoda-homepage.png'}
                                                alt={booking.hotelName}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Booking Details */}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-800">{booking.hotelName || 'Hotel Name'}</h3>
                                                    <div className="flex items-center text-sm text-gray-500">
                                                        <MapPin size={14} className="mr-1" />
                                                        {booking.hotelAddress || 'Address'}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.status === 'booked'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : booking.status === 'completed'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                        }`}
                                                >
                                                    {booking.status === 'booked' ? 'Upcoming' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                                <div>
                                                    <div className="text-gray-500">Check-in</div>
                                                    <div className="font-semibold">{booking.checkIn || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500">Check-out</div>
                                                    <div className="font-semibold">{booking.checkOut || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500">Booking ID</div>
                                                    <div className="font-semibold">{booking.bookingId?.slice(-8) || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500">Total</div>
                                                    <div className="font-bold text-blue-600">₹{booking.totalAmount || 'N/A'}</div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {booking.status === 'booked' && (() => {
                                                    const deadline = parseCancellationDeadline(booking.lastCancellationDeadline);
                                                    const now = new Date();
                                                    const canCancel = !deadline || now < deadline;

                                                    return canCancel ? (
                                                        <div className="flex flex-col gap-1">
                                                            <button
                                                                onClick={() => setShowCancelDialog(booking)}
                                                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                                            >
                                                                <X size={14} />
                                                                Cancel
                                                            </button>
                                                            {deadline && (
                                                                <span className="text-xs text-amber-600">
                                                                    Free cancel until {deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg">
                                                            <AlertCircle size={12} />
                                                            Cancellation deadline passed
                                                        </span>
                                                    );
                                                })()}
                                                {booking.status === 'cancelled' && (
                                                    <button
                                                        onClick={() => navigate(`/hotel/${booking.hotelCode}`)}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                                                    >
                                                        <RefreshCw size={14} />
                                                        Book Again
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedBooking(booking)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                                                >
                                                    View Details
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Saved Hotels Tab */}
                {activeTab === 'saved' && (
                    <div>
                        {likedHotelsArray.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                                <Heart size={64} className="mx-auto text-gray-300 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">No saved hotels</h3>
                                <p className="text-gray-500 mb-4">Start saving hotels you like to easily find them later</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Explore Hotels
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up stagger-2">
                                {likedHotelsArray.map((hotel, index) => (
                                    <div
                                        key={hotel.HotelCode}
                                        className="saved-hotel-card bg-white rounded-2xl shadow-sm overflow-hidden group cursor-pointer"
                                        style={{ animationDelay: `${index * 0.1}s` }}
                                        onClick={() => navigate(`/hotel/${hotel.HotelCode}`)}
                                    >
                                        {/* Image */}
                                        <div className="relative h-48 bg-gray-200">
                                            <img
                                                src={hotel.HotelPicture || 'https://cdn6.agoda.net/images/MVC/default/background_image/illustrations/bg-agoda-homepage.png'}
                                                alt={hotel.HotelName}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveLikedHotel(hotel.HotelCode);
                                                }}
                                                className="absolute top-3 right-3 p-2 bg-white rounded-full text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                            >
                                                <Heart size={18} className="fill-current" />
                                            </button>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4">
                                            <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
                                                {hotel.HotelName || 'Hotel Name'}
                                            </h3>

                                            <div className="flex items-center gap-1 text-yellow-500 mb-2">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={12}
                                                        className={i < parseStars(hotel.StarRating) ? 'fill-current' : 'text-gray-300'}
                                                    />
                                                ))}
                                            </div>

                                            <div className="flex items-center text-sm text-gray-500 mb-3">
                                                <MapPin size={14} className="mr-1 flex-shrink-0" />
                                                <span className="line-clamp-1">{hotel.HotelAddress || 'Address'}</span>
                                            </div>

                                            {hotel.TotalFare && hotel.TotalFare !== 'NA' && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl font-bold text-gray-800">₹{hotel.TotalFare}</span>
                                                    <span className="text-xs text-gray-500">per night</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-2xl mx-auto animate-fade-in-up stagger-2">
                        {/* Personal Information */}
                        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-gray-100 hover:shadow-md transition-shadow duration-300">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User size={20} />
                                Personal Information
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                    <div>
                                        <div className="text-sm text-gray-500">Full Name</div>
                                        <div className="font-medium">{userData?.username || 'Not set'}</div>
                                    </div>
                                    <button
                                        onClick={() => setIsEditingName(true)}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                        Edit
                                    </button>
                                </div>

                                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                    <div>
                                        <div className="text-sm text-gray-500">Email</div>
                                        <div className="font-medium">{currentUser?.email}</div>
                                    </div>
                                    <span className="text-gray-400 text-sm">Cannot change</span>
                                </div>

                                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                    <div>
                                        <div className="text-sm text-gray-500">Phone Number</div>
                                        <div className="font-medium">{userData?.phoneNumber || 'Not set'}</div>
                                    </div>
                                    <button
                                        onClick={() => setIsEditingPhone(true)}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                        {userData?.phoneNumber ? 'Edit' : 'Add'}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <div className="text-sm text-gray-500">Member Since</div>
                                        <div className="font-medium">
                                            {userData?.createdAt
                                                ? new Date(userData.createdAt).toLocaleDateString('en-IN', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })
                                                : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security */}
                        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 hover:shadow-md transition-shadow duration-300">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Lock size={20} />
                                Security
                            </h3>

                            {userData?.provider === 'google' ? (
                                <div className="text-gray-500 text-sm">
                                    You signed in with Google. Password management is handled by Google.
                                </div>
                            ) : isChangingPassword ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter current password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter new password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Confirm new password"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleChangePassword}
                                            disabled={loading}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {loading ? 'Updating...' : 'Update Password'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsChangingPassword(false);
                                                setCurrentPassword('');
                                                setNewPassword('');
                                                setConfirmPassword('');
                                            }}
                                            className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <div className="text-sm text-gray-500">Password</div>
                                        <div className="font-medium">••••••••</div>
                                    </div>
                                    <button
                                        onClick={() => setIsChangingPassword(true)}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                        Change Password
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Booking Details Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold mb-1">Booking Details</h2>
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedBooking.status === 'booked' ? 'bg-white/20 text-white' :
                                            selectedBooking.status === 'completed' ? 'bg-green-400/20 text-green-100' :
                                                'bg-red-400/20 text-red-100'
                                        }`}>
                                        {selectedBooking.status === 'booked' ? 'Upcoming' : selectedBooking.status?.charAt(0).toUpperCase() + selectedBooking.status?.slice(1)}
                                    </span>
                                </div>
                                <button onClick={() => setSelectedBooking(null)} className="p-1 hover:bg-white/20 rounded-full transition">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Hotel Info */}
                            <div className="flex gap-4">
                                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                                    <img
                                        src={selectedBooking.hotelImage || 'https://cdn6.agoda.net/images/MVC/default/background_image/illustrations/bg-agoda-homepage.png'}
                                        alt={selectedBooking.hotelName}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{selectedBooking.hotelName || 'Hotel'}</h3>
                                    <div className="flex items-center text-sm text-gray-500 mt-1">
                                        <MapPin size={14} className="mr-1 flex-shrink-0" />
                                        <span className="line-clamp-2">{selectedBooking.hotelAddress || 'N/A'}</span>
                                    </div>
                                    {selectedBooking.roomName && (
                                        <div className="text-sm text-blue-600 mt-1 font-medium">{selectedBooking.roomName}</div>
                                    )}
                                </div>
                            </div>

                            {/* Stay Details */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                        <Calendar size={12} />
                                        Check-in
                                    </div>
                                    <div className="font-semibold text-gray-800 text-sm">{formatBookingDate(selectedBooking.checkIn)}</div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                        <Calendar size={12} />
                                        Check-out
                                    </div>
                                    <div className="font-semibold text-gray-800 text-sm">{formatBookingDate(selectedBooking.checkOut)}</div>
                                </div>
                            </div>

                            {/* Guest & Room Info */}
                            <div className="flex gap-3">
                                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                        <Users size={12} />
                                        Guests
                                    </div>
                                    <div className="font-semibold text-gray-800 text-sm">{selectedBooking.guests || 1} Guest(s)</div>
                                </div>
                                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                        <CreditCard size={12} />
                                        Total Paid
                                    </div>
                                    <div className="font-bold text-blue-600 text-sm">₹{selectedBooking.totalAmount?.toLocaleString('en-IN') || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Booking IDs */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Reference Details</h4>
                                {[
                                    { label: 'Booking ID', value: selectedBooking.bookingId },
                                    { label: 'Order ID', value: selectedBooking.orderId },
                                    { label: 'Payment ID', value: selectedBooking.paymentId },
                                    { label: 'TBO Booking ID', value: selectedBooking.tboBookingId },
                                    { label: 'Reference No', value: selectedBooking.bookingRefNo },
                                    { label: 'Confirmation No', value: selectedBooking.confirmationNo },
                                ].filter(item => item.value).map(item => (
                                    <div key={item.label} className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">{item.label}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-mono text-gray-700">{item.value?.length > 20 ? `...${item.value.slice(-15)}` : item.value}</span>
                                            <button
                                                onClick={() => copyToClipboard(item.value, item.label)}
                                                className="p-0.5 hover:bg-gray-200 rounded transition"
                                                title="Copy"
                                            >
                                                {copiedField === item.label ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Cancellation Deadline */}
                            {selectedBooking.lastCancellationDeadline && (
                                <div className={`rounded-xl p-3 flex items-center gap-2 ${new Date() < parseCancellationDeadline(selectedBooking.lastCancellationDeadline)
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-600'
                                    }`}>
                                    <Clock size={16} />
                                    <div className="text-sm">
                                        {new Date() < parseCancellationDeadline(selectedBooking.lastCancellationDeadline)
                                            ? <>Free cancellation until <strong>{formatBookingDate(parseCancellationDeadline(selectedBooking.lastCancellationDeadline))}</strong></>
                                            : <>Cancellation deadline passed ({formatBookingDate(selectedBooking.lastCancellationDeadline)})</>
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Booked On */}
                            <div className="text-xs text-gray-400 text-center">
                                Booked on {formatBookingDate(selectedBooking.createdAt)}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                {selectedBooking.status === 'booked' && (() => {
                                    const deadline = parseCancellationDeadline(selectedBooking.lastCancellationDeadline);
                                    const canCancel = !deadline || new Date() < deadline;
                                    return canCancel ? (
                                        <button
                                            onClick={() => { setShowCancelDialog(selectedBooking); }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                                        >
                                            <X size={16} />
                                            Cancel Booking
                                        </button>
                                    ) : null;
                                })()}
                                <button
                                    onClick={() => setSelectedBooking(null)}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Dialog */}
            {showCancelDialog && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => !cancelLoading && !cancelResult && (setShowCancelDialog(null), setCancelRemarks(''), setCancelResult(null))}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            {cancelResult ? (
                                /* Cancellation Result */
                                <>
                                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={28} className="text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Booking Cancelled</h3>
                                    <p className="text-gray-500 text-sm text-center mb-5">
                                        Your booking at <strong className="text-gray-700">{showCancelDialog.hotelName}</strong> has been cancelled.
                                    </p>

                                    {/* Refund Details */}
                                    <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
                                        {cancelResult.cancellationCharge !== undefined && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Cancellation Charge</span>
                                                <span className="font-medium text-red-600">₹{cancelResult.cancellationCharge?.toLocaleString('en-IN') || '0'}</span>
                                            </div>
                                        )}
                                        {cancelResult.refundedAmount !== undefined && (
                                            <div className="flex justify-between text-sm border-t pt-2">
                                                <span className="text-gray-500">Refund Amount</span>
                                                <span className="font-bold text-green-600">₹{cancelResult.refundedAmount?.toLocaleString('en-IN') || '0'}</span>
                                            </div>
                                        )}
                                        {cancelResult.changeRequestId && (
                                            <div className="flex justify-between text-sm border-t pt-2">
                                                <span className="text-gray-500">Request ID</span>
                                                <span className="font-medium text-gray-700">{cancelResult.changeRequestId}</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => { setShowCancelDialog(null); setCancelRemarks(''); setCancelResult(null); }}
                                        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        Done
                                    </button>
                                </>
                            ) : (
                                /* Cancellation Confirmation */
                                <>
                                    {/* Warning Icon */}
                                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <AlertTriangle size={28} className="text-red-500" />
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Cancel Booking?</h3>
                                    <p className="text-gray-500 text-sm text-center mb-5">
                                        Are you sure you want to cancel your booking at <strong className="text-gray-700">{showCancelDialog.hotelName}</strong>?
                                    </p>

                                    {/* Booking Summary */}
                                    <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Check-in</span>
                                            <span className="font-medium text-gray-700">{formatBookingDate(showCancelDialog.checkIn)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Check-out</span>
                                            <span className="font-medium text-gray-700">{formatBookingDate(showCancelDialog.checkOut)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm border-t pt-2">
                                            <span className="text-gray-500">Amount</span>
                                            <span className="font-bold text-gray-800">₹{showCancelDialog.totalAmount?.toLocaleString('en-IN') || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {showCancelDialog.lastCancellationDeadline && new Date() < parseCancellationDeadline(showCancelDialog.lastCancellationDeadline) && (
                                        <div className="bg-green-50 rounded-lg p-3 mb-5 text-center">
                                            <p className="text-xs text-green-700">
                                                <CheckCircle size={12} className="inline mr-1" />
                                                This booking is eligible for free cancellation
                                            </p>
                                        </div>
                                    )}

                                    {/* Cancellation Remarks */}
                                    <div className="mb-5">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for cancellation <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={cancelRemarks}
                                            onChange={(e) => setCancelRemarks(e.target.value)}
                                            placeholder="Please provide a reason for cancellation..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                            disabled={cancelLoading}
                                        />
                                    </div>

                                    <p className="text-xs text-gray-400 text-center mb-5">This action cannot be undone.</p>

                                    {/* Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setShowCancelDialog(null); setCancelRemarks(''); }}
                                            disabled={cancelLoading}
                                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                                        >
                                            Keep Booking
                                        </button>
                                        <button
                                            onClick={() => handleCancelBooking(showCancelDialog)}
                                            disabled={cancelLoading || !cancelRemarks.trim()}
                                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {cancelLoading ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cancelling...</>
                                            ) : (
                                                <><X size={16} /> Yes, Cancel</>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
