import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import HotelDetailsPage from './pages/HotelDetailsPage';
import GuestDetailsPage from './pages/GuestDetailsPage';
import PaymentPage from './pages/PaymentPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import DirectAccessGuard from './components/DirectAccessGuard';
import HelpCenterPage from './pages/HelpCenterPage';
import ContactUsPage from './pages/ContactUsPage';
import CancellationPage from './pages/CancellationPage';
import SafetyPage from './pages/SafetyPage';
import AboutUsPage from './pages/AboutUsPage';
import ChatWidget from './components/ChatWidget';
import { Hotel, LogOut, Shield, Heart, HelpCircle, User, Sun, Moon, Menu, X, Calendar } from 'lucide-react';
import './styles/Auth.css';
import logo from './assets/logo.png';

// Navigation Header Component
const NavHeader = () => {
  const { currentUser, userData, isAdmin, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
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

  return (
    <header className="nav-header theme-transition dark:bg-slate-900 dark:border-slate-700">
      <Link to="/" className="nav-logo">
        <img style={{ height: '50px' }} src={logo} alt="Zovotel Logo" />
      </Link>

      {/* Hamburger button - mobile only */}
      <button
        className="hamburger-btn dark:text-slate-200"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`nav-links ${mobileMenuOpen ? 'nav-links-open' : ''}`}>
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300 mr-2 group"
          aria-label="Toggle theme"
        >
          {isDarkMode ? (
            <Sun size={20} className="text-yellow-400 group-hover:animate-wiggle" />
          ) : (
            <Moon size={20} className="text-slate-600 group-hover:animate-wiggle" />
          )}
        </button>

        {currentUser ? (
          <>
            {/* Help Link */}
            <Link to="/help" className="nav-link dark:text-slate-300 dark:hover:text-white" onClick={closeMobileMenu}>
              <HelpCircle size={18} />
              Help
            </Link>

            {/* Bookings Link */}
            <Link to="/profile" className="nav-link dark:text-slate-300 dark:hover:text-white" onClick={closeMobileMenu}>
              <Calendar size={18} />
              Bookings
            </Link>

            {/* Saved Link - goes to profile */}
            <Link to="/profile" className="nav-link dark:text-slate-300 dark:hover:text-white" onClick={closeMobileMenu}>
              <Heart size={18} />
              Saved
            </Link>

            {/* Admin Link */}
            {isAdmin && (
              <Link to="/admin" className="nav-link dark:text-slate-300 dark:hover:text-white" onClick={closeMobileMenu}>
                <Shield size={18} />
                Admin
              </Link>
            )}

            {/* User Info - clickable to profile */}
            <Link to="/profile" className="user-info-nav dark:bg-slate-800" style={{ textDecoration: 'none', cursor: 'pointer' }} onClick={closeMobileMenu}>
              <div className="user-avatar-nav">
                {getInitials(userData?.username || currentUser?.email)}
              </div>
              <span className="dark:text-slate-200" style={{ color: 'var(--agoda-dark)', fontSize: '0.875rem', fontWeight: 500 }}>
                {userData?.username || currentUser?.email?.split('@')[0]}
              </span>
            </Link>

            {/* Logout Button */}
            <button className="nav-button nav-button-secondary dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600" onClick={() => { handleLogout(); closeMobileMenu(); }}>
              <LogOut size={16} />
              Logout
            </button>
          </>
        ) : (
          <>
            {/* Help Link */}
            <Link to="/help" className="nav-link dark:text-slate-300 dark:hover:text-white" onClick={closeMobileMenu}>
              <HelpCircle size={18} />
              Help
            </Link>

            {/* Sign In Link */}
            <Link to="/signin" className="nav-link dark:text-slate-300 dark:hover:text-white" onClick={closeMobileMenu}>
              Sign In
            </Link>

            {/* Sign Up Button */}
            <Link to="/signup" className="nav-button" onClick={closeMobileMenu}>
              <User size={16} />
              Sign Up
            </Link>
          </>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="nav-overlay" onClick={closeMobileMenu} />
      )}
    </header>
  );
};

// Layout wrapper with navigation
const Layout = ({ children, showNav = true }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 theme-transition">
      {showNav && <NavHeader />}
      <main style={{ paddingTop: showNav ? '70px' : '0' }}>{children}</main>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage />}
      />
      <Route
        path="/search"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />
      <Route
        path="/hotel/:hotelId"
        element={
          <DirectAccessGuard>
            <Layout>
              <HotelDetailsPage />
            </Layout>
          </DirectAccessGuard>
        }
      />
      <Route
        path="/checkout"
        element={
          <DirectAccessGuard>
            <Layout>
              <GuestDetailsPage />
            </Layout>
          </DirectAccessGuard>
        }
      />
      <Route
        path="/payment"
        element={
          <DirectAccessGuard>
            <Layout>
              <PaymentPage />
            </Layout>
          </DirectAccessGuard>
        }
      />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      {/* Admin Dashboard - has its own layout */}
      {/* Profile Page */}
      <Route
        path="/profile"
        element={
          <Layout>
            <ProfilePage />
          </Layout>
        }
      />
      {/* Redirect wishlist to profile */}
      <Route
        path="/wishlist"
        element={<Navigate to="/profile" replace />}
      />
      <Route
        path="/help"
        element={
          <Layout>
            <HelpCenterPage />
          </Layout>
        }
      />
      <Route
        path="/contact"
        element={
          <Layout>
            <ContactUsPage />
          </Layout>
        }
      />
      <Route
        path="/cancellation"
        element={
          <Layout>
            <CancellationPage />
          </Layout>
        }
      />
      <Route
        path="/safety"
        element={
          <Layout>
            <SafetyPage />
          </Layout>
        }
      />
      <Route
        path="/about"
        element={
          <Layout>
            <AboutUsPage />
          </Layout>
        }
      />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    if (window.hideLoader) {
      window.hideLoader();
    }
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <ChatWidget />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
