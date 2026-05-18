import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import axios from 'axios';

const AuthContext = createContext();

const SERVER_URL = 'https://api.zovotel.com';
const API = `${SERVER_URL}/api/users`;

// Admin emails - add your admin email addresses here
const ADMIN_EMAILS = ['admin@zoltan.com'];

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [likedHotels, setLikedHotels] = useState({});
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user is admin
    const isAdmin = (email) => {
        return ADMIN_EMAILS.includes(email?.toLowerCase());
    };

    // Save user data to MySQL via API
    const saveUserData = async (uid, data, options = {}) => {
        try {
            await axios.post(`${API}/profile`, {
                uid,
                email: data.email,
                username: data.username,
                phoneNumber: data.phoneNumber,
                provider: data.provider,
                photoURL: data.photoURL || '',
            });
            return { success: true };
        } catch (err) {
            console.error('Error saving user data:', err);
            // Don't throw for network errors if silent mode is enabled
            if (options.silent && (!err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED')) {
                console.warn('Backend unavailable, user saved to Firebase only. Sync will be needed.');
                return { success: false, error: err, needsSync: true };
            }
            throw err;
        }
    };

    // Get user data from MySQL via API
    const getUserData = async (uid) => {
        try {
            const response = await axios.get(`${API}/${uid}`);
            if (response.data?.success) {
                return response.data.user;
            }
            return null;
        } catch (err) {
            // 404 is expected for new users
            if (err.response?.status === 404) return null;
            console.error('Error getting user data:', err);
            return null;
        }
    };

    // Sign up with email and password
    const signUp = async (email, password, username, phoneNumber) => {
        try {
            setError(null);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save additional user data to database (silent mode - don't fail if backend is down)
            const saveResult = await saveUserData(user.uid, {
                email: user.email,
                username,
                phoneNumber,
                provider: 'email',
            }, { silent: true });

            // If backend save failed, store pending sync flag
            if (!saveResult.success && saveResult.needsSync) {
                localStorage.setItem(`pending_user_sync_${user.uid}`, JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    username,
                    phoneNumber,
                    provider: 'email',
                    timestamp: Date.now()
                }));
            }

            return user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Sign in with email and password
    const signIn = async (email, password) => {
        try {
            setError(null);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            setError(null);
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Check if user already exists in database
            const existingData = await getUserData(user.uid);

            if (!existingData) {
                // Save new user data (silent mode)
                const saveResult = await saveUserData(user.uid, {
                    email: user.email,
                    username: user.displayName || user.email.split('@')[0],
                    phoneNumber: user.phoneNumber || '',
                    provider: 'google',
                    photoURL: user.photoURL || '',
                }, { silent: true });

                // If backend save failed, store pending sync flag
                if (!saveResult.success && saveResult.needsSync) {
                    localStorage.setItem(`pending_user_sync_${user.uid}`, JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        username: user.displayName || user.email.split('@')[0],
                        phoneNumber: user.phoneNumber || '',
                        provider: 'google',
                        photoURL: user.photoURL || '',
                        timestamp: Date.now()
                    }));
                }
            }

            return user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Sign out
    const logout = async () => {
        try {
            setError(null);
            await signOut(auth);
            setUserData(null);
            setLikedHotels({});
            setBookings([]);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Get all users (for admin) — no longer uses Firebase listener
    const getAllUsers = async (callback) => {
        try {
            // Admin endpoint fetches all users from MySQL
            const response = await axios.get(`${SERVER_URL}/api/admin/users`);
            if (response.data?.users) {
                callback(response.data.users);
            } else {
                callback([]);
            }
        } catch (err) {
            console.error('Error fetching all users:', err);
            callback([]);
        }
    };

    // Update user profile (phone number, username)
    const updateUserProfile = async (updates) => {
        if (!currentUser) throw new Error('No user logged in');
        try {
            setError(null);
            await axios.post(`${API}/profile`, {
                uid: currentUser.uid,
                ...updates,
            });
            // Refresh user data
            const data = await getUserData(currentUser.uid);
            setUserData(data);
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Change password (requires current password for reauthentication)
    const changePassword = async (currentPassword, newPassword) => {
        if (!currentUser) throw new Error('No user logged in');
        try {
            setError(null);
            // Reauthenticate user first
            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
            // Update password
            await updatePassword(currentUser, newPassword);
            return true;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Like a hotel
    const likeHotel = async (hotelCode, hotelData) => {
        if (!currentUser) throw new Error('Please sign in to save hotels');
        try {
            await axios.post(`${API}/${currentUser.uid}/liked-hotels`, {
                hotelCode,
                hotelName: hotelData.HotelName,
                hotelAddress: hotelData.HotelAddress || hotelData.Address,
                hotelPicture: hotelData.HotelPicture || hotelData.Images?.[0] || '',
                rating: hotelData.Rating || null,
                starRating: hotelData.StarRating || hotelData.HotelRating || null,
                totalFare: hotelData.TotalFare || null,
            });
            setLikedHotels(prev => ({ ...prev, [hotelCode]: hotelData }));
            return true;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Unlike a hotel
    const unlikeHotel = async (hotelCode) => {
        if (!currentUser) throw new Error('Please sign in');
        try {
            await axios.delete(`${API}/${currentUser.uid}/liked-hotels/${hotelCode}`);
            setLikedHotels(prev => {
                const updated = { ...prev };
                delete updated[hotelCode];
                return updated;
            });
            return true;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Check if hotel is liked
    const isHotelLiked = (hotelCode) => {
        return !!likedHotels[hotelCode];
    };

    // Add a booking (now a no-op for local state — the booking is already persisted via paymentController)
    const addBooking = async (bookingData) => {
        if (!currentUser) throw new Error('Please sign in');
        try {
            // The booking is already saved to MySQL via paymentController.saveBookingData
            // and linked via user_bookings table. We just refresh local state.
            const booking = {
                ...bookingData,
                status: 'booked',
                createdAt: new Date().toISOString(),
            };
            setBookings(prev => [booking, ...prev]);
            return booking;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Fetch liked hotels from API
    const fetchLikedHotels = useCallback(async (uid) => {
        try {
            const response = await axios.get(`${API}/${uid}/liked-hotels`);
            if (response.data?.success) {
                setLikedHotels(response.data.likedHotels || {});
            }
        } catch (err) {
            console.error('Error fetching liked hotels:', err);
            setLikedHotels({});
        }
    }, []);

    // Fetch bookings from API
    const fetchBookings = useCallback(async (uid) => {
        try {
            const response = await axios.get(`${API}/${uid}/bookings`);
            if (response.data?.success) {
                setBookings(response.data.bookings || []);
            }
        } catch (err) {
            console.error('Error fetching bookings:', err);
            setBookings([]);
        }
    }, []);

    // Update booking status
    const updateBookingStatus = async (bookingId, status, cancellationDetails = null) => {
        if (!currentUser) throw new Error('Please sign in');
        try {
            // Update local state — actual status change happens via admin/cancel API
            setBookings(prev => prev.map(b =>
                (b.bookingId === bookingId || b.orderId === bookingId)
                    ? { ...b, status, ...(cancellationDetails ? { cancellationDetails } : {}) }
                    : b
            ));
            // Refresh bookings from server to ensure we have the latest data
            await fetchBookings(currentUser.uid);
            return true;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Retry syncing pending user data to backend
    const retryPendingSyncs = async () => {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_user_sync_'));
            for (const key of keys) {
                const data = JSON.parse(localStorage.getItem(key));
                try {
                    const result = await saveUserData(data.uid, data);
                    if (result.success) {
                        localStorage.removeItem(key);
                        console.log(`Synced pending user data for ${data.uid}`);
                    }
                } catch (err) {
                    console.warn(`Still failed to sync user ${data.uid}:`, err.message);
                }
            }
        } catch (err) {
            console.error('Error retrying pending syncs:', err);
        }
    };

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                // Try to sync any pending user data first
                await retryPendingSyncs();

                const data = await getUserData(user.uid);
                setUserData(data);
                // Load liked hotels and bookings from MySQL
                fetchLikedHotels(user.uid);
                fetchBookings(user.uid);
            } else {
                setUserData(null);
                setLikedHotels({});
                setBookings([]);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [fetchLikedHotels, fetchBookings]);

    const userRole = userData?.role || (isAdmin(currentUser?.email) ? 'admin' : 'user');

    const value = {
        currentUser,
        userData,
        likedHotels,
        bookings,
        loading,
        error,
        signUp,
        signIn,
        signInWithGoogle,
        logout,
        getAllUsers,
        updateUserProfile,
        changePassword,
        likeHotel,
        unlikeHotel,
        isHotelLiked,
        addBooking,
        updateBookingStatus,
        retryPendingSyncs,
        isAdmin: userRole === 'admin' || userRole === 'support',
        role: userRole,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
