import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Hotel, Shield, Sparkles, Globe } from 'lucide-react';
import { setInternalNavigation } from '../components/DirectAccessGuard';
import logo from '../assets/logo.png';
import '../styles/Auth.css';

const SignInPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { signIn, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        setError('');
    };

    const validateForm = () => {
        if (!formData.email || !formData.password) {
            setError('Please fill in all fields');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            setLoading(true);
            setError('');
            await signIn(formData.email, formData.password);

            // Check if there's a pending booking to complete
            const pendingBooking = localStorage.getItem('pendingBooking');
            if (pendingBooking) {
                const bookingData = JSON.parse(pendingBooking);
                localStorage.removeItem('pendingBooking');
                setInternalNavigation();
                navigate('/checkout', { state: bookingData });
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(getErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            setError('');
            await signInWithGoogle();

            // Check if there's a pending booking to complete
            const pendingBooking = localStorage.getItem('pendingBooking');
            if (pendingBooking) {
                const bookingData = JSON.parse(pendingBooking);
                localStorage.removeItem('pendingBooking');
                setInternalNavigation();
                navigate('/checkout', { state: bookingData });
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(getErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const getErrorMessage = (code) => {
        switch (code) {
            case 'auth/user-not-found':
                return 'No account found with this email. Please sign up.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/invalid-email':
                return 'Invalid email address format.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed. Please try again.';
            case 'auth/invalid-credential':
                return 'Invalid email or password. Please try again.';
            default:
                return 'An error occurred. Please try again.';
        }
    };

    return (
        <div className="auth-page">
            {/* Left Brand Panel */}
            <div className="auth-brand-panel">
                {/* Floating decorative shapes */}
                <div className="auth-floating-shape"></div>
                <div className="auth-floating-shape"></div>
                <div className="auth-floating-shape"></div>
                <div className="auth-floating-shape"></div>

                <div className="auth-brand-content">
                    <Link to="/">
                        <img src={logo} alt="Zovotel" className="auth-brand-logo" />
                    </Link>
                    <h1 className="auth-brand-title">
                        Welcome back to <span>Zovotel</span>
                    </h1>
                    <p className="auth-brand-subtitle">
                        Sign in to access your bookings, explore exclusive deals, and manage your travel with ease.
                    </p>

                    <div className="auth-brand-features">
                        <div className="auth-brand-feature">
                            <div className="feature-icon">
                                <Shield size={20} />
                            </div>
                            <span>Secure & encrypted login</span>
                        </div>
                        <div className="auth-brand-feature">
                            <div className="feature-icon">
                                <Sparkles size={20} />
                            </div>
                            <span>Access exclusive member deals</span>
                        </div>
                        <div className="auth-brand-feature">
                            <div className="feature-icon">
                                <Globe size={20} />
                            </div>
                            <span>Manage bookings anywhere</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="auth-form-panel">
                <div className="auth-card">
                    <div className="auth-header">
                        <Link to="/" className="auth-logo" style={{ textDecoration: 'none' }}>
                            <Hotel />
                        </Link>
                        <h1 className="auth-title">Welcome Back</h1>
                        <p className="auth-subtitle">Sign in to access your bookings and exclusive deals</p>
                    </div>

                    {error && (
                        <div className="auth-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <div className="form-input-wrapper">
                                <Mail className="form-input-icon" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    className="form-input"
                                    placeholder="Enter your email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={loading}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="form-input-wrapper">
                                <Lock className="form-input-icon" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    className="form-input"
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label className="remember-me">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span>Remember me</span>
                            </label>
                            <Link to="/forgot-password" className="forgot-password">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            className={`auth-button ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="auth-divider">
                        <span className="auth-divider-line"></span>
                        <span className="auth-divider-text">or continue with</span>
                        <span className="auth-divider-line"></span>
                    </div>

                    <div className="social-login-buttons">
                        <button
                            type="button"
                            className="social-button google-button"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                        >
                            <svg className="google-icon" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Continue with Google
                        </button>

                        <button
                            type="button"
                            className="social-button facebook-button"
                            disabled={loading}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Continue with Facebook
                        </button>

                        <button
                            type="button"
                            className="social-button apple-button"
                            disabled={loading}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                            Continue with Apple
                        </button>
                    </div>

                    <p className="auth-footer">
                        Don't have an account?{' '}
                        <Link to="/signup" className="auth-link">
                            Sign Up
                        </Link>
                    </p>

                    <p className="auth-terms">
                        By signing in, you agree to our{' '}
                        <a href="/terms">Terms of Service</a> and{' '}
                        <a href="/privacy">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
