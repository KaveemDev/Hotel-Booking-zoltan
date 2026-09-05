import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Phone, Eye, EyeOff, AlertCircle, Check, Gift, Tag, Shield, Sparkles, Globe, Award } from 'lucide-react';
import '../styles/Auth.css';
import logo from '../assets/logo.png';

const SignUpPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        username: '',
        phoneNumber: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);

    const { signUp, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        setError('');
    };

    // Password strength calculation
    const passwordStrength = useMemo(() => {
        const password = formData.password;
        if (!password) return { level: '', text: '' };

        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 1) return { level: 'weak', text: 'Weak password' };
        if (score <= 2) return { level: 'fair', text: 'Fair password' };
        if (score <= 3) return { level: 'good', text: 'Good password' };
        return { level: 'strong', text: 'Strong password' };
    }, [formData.password]);

    const validateForm = () => {
        if (!formData.email || !formData.password || !formData.username) {
            setError('Please fill in all required fields');
            return false;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }

        if (formData.phoneNumber && !/^\+?[\d\s-]{10,}$/.test(formData.phoneNumber)) {
            setError('Please enter a valid phone number');
            return false;
        }

        if (!acceptTerms) {
            setError('Please accept the Terms of Service to continue');
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
            await signUp(
                formData.email,
                formData.password,
                formData.username,
                formData.phoneNumber
            );
            navigate('/');
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
            navigate('/');
        } catch (err) {
            setError(getErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const getErrorMessage = (code) => {
        switch (code) {
            case 'auth/email-already-in-use':
                return 'This email is already registered. Please sign in.';
            case 'auth/invalid-email':
                return 'Invalid email address format.';
            case 'auth/weak-password':
                return 'Password is too weak. Please use a stronger password.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed. Please try again.';
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
                        Start your journey with <span>Zovotel</span>
                    </h1>
                    <p className="auth-brand-subtitle">
                        Create your free account and unlock exclusive deals, instant bookings, and premium travel experiences.
                    </p>

                    <div className="auth-brand-features">
                        <div className="auth-brand-feature">
                            <div className="feature-icon">
                                <Gift size={20} />
                            </div>
                            <span>Earn rewards on every booking</span>
                        </div>
                        <div className="auth-brand-feature">
                            <div className="feature-icon">
                                <Tag size={20} />
                            </div>
                            <span>Save up to 30% with insider prices</span>
                        </div>
                        <div className="auth-brand-feature">
                            <div className="feature-icon">
                                <Award size={20} />
                            </div>
                            <span>Access exclusive member perks</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="auth-form-panel">
                <div className="auth-card">
                    <div className="auth-header">
                        <Link to="/" className="auth-logo" style={{ textDecoration: 'none' }}>
                            <img style={{ height: '30px' }} src={logo} alt="Zovotel Logo" />
                        </Link>
                        <h1 className="auth-title">Create Account</h1>
                        <p className="auth-subtitle">Join Zovotel for exclusive deals and rewards</p>
                    </div>

                    {/* Benefits Section */}
                    <div className="signup-benefits">
                        <div className="benefits-title">Why create an account?</div>
                        <ul className="benefits-list">
                            <li>
                                <Check size={16} />
                                <span>Get exclusive member-only deals</span>
                            </li>
                            <li>
                                <Gift size={16} />
                                <span>Earn rewards on every booking</span>
                            </li>
                            <li>
                                <Tag size={16} />
                                <span>Save up to 30% with insider prices</span>
                            </li>
                        </ul>
                    </div>

                    {error && (
                        <div className="auth-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <div className="form-input-wrapper">
                                <User className="form-input-icon" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    className="form-input"
                                    placeholder="Enter your full name"
                                    value={formData.username}
                                    onChange={handleChange}
                                    disabled={loading}
                                    autoComplete="name"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email Address *</label>
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
                            <label className="form-label">Phone Number (Optional)</label>
                            <div className="form-input-wrapper">
                                <Phone className="form-input-icon" size={18} />
                                <input
                                    type="tel"
                                    name="phoneNumber"
                                    className="form-input"
                                    placeholder="+91 9876543210"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    disabled={loading}
                                    autoComplete="tel"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password *</label>
                            <div className="form-input-wrapper">
                                <Lock className="form-input-icon" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    className="form-input"
                                    placeholder="Create a password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    disabled={loading}
                                    autoComplete="new-password"
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
                            {formData.password && (
                                <div className="password-strength">
                                    <div className="strength-bar">
                                        <div className={`strength-fill ${passwordStrength.level}`}></div>
                                    </div>
                                    <span className="strength-text">{passwordStrength.text}</span>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm Password *</label>
                            <div className="form-input-wrapper">
                                <Lock className="form-input-icon" size={18} />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    className="form-input"
                                    placeholder="Confirm your password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    disabled={loading}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Terms Checkbox */}
                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="acceptTerms"
                                checked={acceptTerms}
                                onChange={(e) => setAcceptTerms(e.target.checked)}
                            />
                            <label htmlFor="acceptTerms">
                                I agree to the <a href="/terms">Terms of Service</a> and{' '}
                                <a href="/privacy">Privacy Policy</a> *
                            </label>
                        </div>

                        {/* Newsletter Checkbox */}
                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="subscribeNewsletter"
                                checked={subscribeNewsletter}
                                onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                            />
                            <label htmlFor="subscribeNewsletter">
                                Send me exclusive deals and travel inspiration
                            </label>
                        </div>

                        <button
                            type="submit"
                            className={`auth-button ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="auth-divider">
                        <span className="auth-divider-line"></span>
                        <span className="auth-divider-text">or sign up with</span>
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
                        Already have an account?{' '}
                        <Link to="/signin" className="auth-link">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;
