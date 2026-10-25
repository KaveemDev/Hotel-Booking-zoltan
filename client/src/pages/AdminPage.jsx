import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, Users, ShoppingBag, Wallet, LogOut, Home, Search,
    TrendingUp, TrendingDown, DollarSign, Hotel, XCircle, CheckCircle,
    Clock, AlertTriangle, BarChart3, PieChart, Activity, RefreshCw, Menu, X,
    Eye, Ban, CreditCard, MapPin, Moon, Percent, ArrowUpRight, Tag, Trash2, Plus, ToggleLeft, ToggleRight,
    MessageCircle
} from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getAgencyBalance, getDashboardStats, getAllAdminBookings, cancelBooking, getCancellationStatus, getUserDetails, updateUserRole, deleteUser, syncUsersFromFirebase, getMarkupSettings, setMarkupSettings as saveMarkupAPI, getCommissionStats, createCoupon as createCouponAPI, getAllCoupons, updateCoupon as updateCouponAPI, deleteCoupon as deleteCouponAPI, getPricingStrategies, updatePricingStrategies } from '../services/api';
import AdminChatSection from '../components/AdminChatSection';
import '../styles/AdminDashboard.css';
import logo from '../assets/logo.png';

const AdminPage = () => {
    const [activeSection, setActiveSection] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [stats, setStats] = useState(null);
    const [balance, setBalance] = useState(null);
    const [balanceError, setBalanceError] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [users, setUsers] = useState([]);
    const [bookingSearch, setBookingSearch] = useState('');
    const [bookingFilter, setBookingFilter] = useState('');
    const [userSearch, setUserSearch] = useState('');

    // Modal state
    const [cancelModal, setCancelModal] = useState({ open: false, booking: null });
    const [cancelRemarks, setCancelRemarks] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);
    const [statusModal, setStatusModal] = useState({ open: false, data: null, loading: false });

    // User detail panel state
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetail, setUserDetail] = useState(null);
    const [userDetailLoading, setUserDetailLoading] = useState(false);
    const [userSyncLoading, setUserSyncLoading] = useState(false);
    const [userDeleteLoading, setUserDeleteLoading] = useState(false);

    // Markup & Commission state
    const [markupPct, setMarkupPct] = useState(0);
    const [markupActive, setMarkupActive] = useState(false);
    const [markupSaving, setMarkupSaving] = useState(false);
    const [markupSaved, setMarkupSaved] = useState(false);
    const [commissionData, setCommissionData] = useState(null);
    const [commissionLoading, setCommissionLoading] = useState(false);
    const [showCommissionDetails, setShowCommissionDetails] = useState(false);

    // Pricing Strategies state
    const [pricingStrategies, setPricingStrategies] = useState(null);
    const [strategiesLoading, setStrategiesLoading] = useState(false);
    const [strategiesSaving, setStrategiesSaving] = useState(false);
    const [strategiesMsg, setStrategiesMsg] = useState('');

    // Coupon state
    const [coupons, setCoupons] = useState([]);
    const [couponsLoading, setCouponsLoading] = useState(false);
    const [couponForm, setCouponForm] = useState({
        code: '', discountType: 'percentage', discountValue: '', maxDiscount: '',
        minBookingAmount: '', expiryDate: '', usageLimit: '', description: ''
    });
    const [couponSaving, setCouponSaving] = useState(false);
    const [couponMsg, setCouponMsg] = useState('');

    const { currentUser, userData, isAdmin, role, getAllUsers, logout } = useAuth();
    const navigate = useNavigate();

    // Fetch all dashboard data
    const fetchDashboardData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);

            const [statsRes, bookingsRes, markupRes] = await Promise.all([
                getDashboardStats(),
                getAllAdminBookings(),
                getMarkupSettings().catch(() => null)
            ]);

            if (markupRes?.success) {
                setMarkupPct(markupRes.markup.percentage || 0);
                setMarkupActive(markupRes.markup.isActive || false);
            }

            if (statsRes?.success) setStats(statsRes.stats);
            if (bookingsRes?.success) setBookings(bookingsRes.bookings || []);

            // Fetch balance separately (may fail if TBO auth issues)
            try {
                const balanceRes = await getAgencyBalance();
                if (balanceRes?.success) {
                    setBalance(balanceRes);
                    setBalanceError(null);
                }
            } catch (err) {
                console.warn('Balance fetch failed:', err);
                setBalanceError('Unable to fetch balance');
            }

            // Fetch commission stats for dashboard KPIs
            try {
                const commRes = await getCommissionStats();
                if (commRes?.success) setCommissionData(commRes);
            } catch (err) {
                console.warn('Commission fetch failed:', err);
            }
        } catch (error) {
            console.error('Dashboard data fetch failed:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!currentUser || !isAdmin) {
            navigate('/signin');
            return;
        }

        if (role === 'support' && !['dashboard', 'bookings', 'users', 'chat'].includes(activeSection)) {
            setActiveSection('dashboard');
        }

        fetchDashboardData();

        const unsubscribe = getAllUsers((usersData) => {
            setUsers(usersData);
        });

        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, [currentUser, isAdmin, role, getAllUsers, navigate, fetchDashboardData, activeSection]);

    // Fetch dynamic pricing strategies
    useEffect(() => {
        if (activeSection === 'pricing-strategies' && !pricingStrategies) {
            setStrategiesLoading(true);
            getPricingStrategies()
                .then(res => {
                    if (res?.success) setPricingStrategies(res.strategies || {});
                })
                .catch(err => {
                    console.error('Error fetching pricing strategies:', err);
                    setPricingStrategies({});
                })
                .finally(() => setStrategiesLoading(false));
        }
    }, [activeSection, pricingStrategies]);

    const handleUpdateStrategy = async (strategyKey, updates) => {
        const updatedStrategies = {
            ...pricingStrategies,
            [strategyKey]: {
                ...(pricingStrategies[strategyKey] || {}),
                ...updates
            }
        };
        setPricingStrategies(updatedStrategies);
    };
    
    const savePricingStrategies = async () => {
        setStrategiesSaving(true);
        setStrategiesMsg('');
        try {
            await updatePricingStrategies(pricingStrategies);
            setStrategiesMsg('✓ Saved successfully!');
            setTimeout(() => setStrategiesMsg(''), 3000);
        } catch (err) {
            setStrategiesMsg('Failed to save');
            console.error(err);
        } finally {
            setStrategiesSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/signin');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleDeleteUser = async (uid, email) => {
        if (!window.confirm(`Are you sure you want to delete user ${email || uid}? This will permanently delete the user from both Firebase and MySQL.`)) {
            return;
        }
        setUserDeleteLoading(true);
        try {
            await deleteUser(uid);
            alert('User deleted successfully from both Firebase and MySQL!');
            setUsers(prev => prev.filter(u => u.uid !== uid));
            if (selectedUser?.uid === uid) {
                setSelectedUser(null);
                setUserDetail(null);
            }
        } catch (error) {
            alert('Failed to delete user: ' + (error.response?.data?.error || error.message));
            console.error(error);
        } finally {
            setUserDeleteLoading(false);
        }
    };

    const handleSyncUsers = async () => {
        if (!window.confirm('This will sync all users from Firebase to MySQL. Users existing only in Firebase will be added to MySQL. Continue?')) {
            return;
        }
        setUserSyncLoading(true);
        try {
            const result = await syncUsersFromFirebase();
            if (result?.success) {
                alert(`Sync completed! ${result.stats?.synced} new users added, ${result.stats?.skipped} users updated, ${result.stats?.failed} failed.`);
                // Refresh user list
                const unsubscribe = getAllUsers((usersData) => {
                    setUsers(usersData);
                });
                if (typeof unsubscribe === 'function') unsubscribe();
            } else {
                alert('Sync failed: ' + (result?.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Failed to sync users: ' + (error.response?.data?.error || error.message));
            console.error(error);
        } finally {
            setUserSyncLoading(false);
        }
    };

    const handleCancelBooking = async () => {
        if (!cancelModal.booking || !cancelRemarks.trim()) return;
        setCancelLoading(true);
        try {
            const bookingId = cancelModal.booking.tboResponse?.bookingId;
            if (!bookingId) {
                alert('No TBO Booking ID found for this booking.');
                return;
            }
            await cancelBooking(bookingId, cancelRemarks);
            alert('Cancellation request sent successfully!');
            setCancelModal({ open: false, booking: null });
            setCancelRemarks('');
            fetchDashboardData(true);
        } catch (error) {
            alert('Cancellation failed: ' + (error.message || 'Unknown error'));
        } finally {
            setCancelLoading(false);
        }
    };

    const handleViewCancelStatus = async (changeRequestId) => {
        setStatusModal({ open: true, data: null, loading: true });
        try {
            const res = await getCancellationStatus(changeRequestId);
            setStatusModal({ open: true, data: res, loading: false });
        } catch (error) {
            setStatusModal({ open: true, data: { error: error.message }, loading: false });
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(dateString));
    };

    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // Filter bookings
    const filteredBookings = bookings.filter(b => {
        if (bookingFilter && b.status !== bookingFilter) return false;
        if (bookingSearch) {
            const term = bookingSearch.toLowerCase();
            return (
                b.hotelInfo?.hotelName?.toLowerCase().includes(term) ||
                b.hotelInfo?.HotelName?.toLowerCase().includes(term) ||
                b.contactDetails?.email?.toLowerCase().includes(term) ||
                b.contactDetails?.firstName?.toLowerCase().includes(term) ||
                b._id?.toLowerCase().includes(term) ||
                String(b.tboResponse?.bookingId)?.includes(term)
            );
        }
        return true;
    });

    // Filter users
    const filteredUsers = users.filter(u => {
        if (!userSearch) return true;
        const term = userSearch.toLowerCase();
        return (
            u.username?.toLowerCase().includes(term) ||
            u.email?.toLowerCase().includes(term) ||
            u.phoneNumber?.includes(term)
        );
    });

    // Chart colors
    const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p className="admin-loading-text">Loading dashboard...</p>
            </div>
        );
    }

    // User stats
    const totalUsers = users.length;
    const googleUsers = users.filter(u => u.provider === 'google').length;
    const emailUsers = users.filter(u => u.provider === 'email').length;
    const adminUsers = users.filter(u => u.isAdmin).length;
    const newUsersThisMonth = users.filter(u => {
        if (!u.createdAt) return false;
        const d = new Date(u.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // Pie chart data
    const statusPieData = stats ? [
        { name: 'Confirmed', value: stats.confirmedBookings },
        { name: 'Pending', value: stats.pendingBookings },
        { name: 'Cancelled', value: stats.cancelledBookings },
        { name: 'Failed', value: stats.failedBookings },
    ].filter(d => d.value > 0) : [];

    // Custom tooltip for charts
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.78rem'
                }}>
                    <p style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>{label}</p>
                    {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
                            {p.name}: {typeof p.value === 'number' && p.name?.includes('Revenue') ? formatCurrency(p.value) : p.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const allSidebarLinks = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'bookings', label: 'Bookings', icon: ShoppingBag },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'balance', label: 'Agency Balance', icon: Wallet },
        { id: 'markup', label: 'Markup & Pricing', icon: Percent },
        { id: 'pricing-strategies', label: 'Dynamic Pricing', icon: DollarSign },
        { id: 'commission', label: 'Commission', icon: TrendingUp },
        { id: 'coupons', label: 'Coupons', icon: Tag },
        { id: 'chat', label: 'Chat Support', icon: MessageCircle },
    ];

    const sidebarLinks = allSidebarLinks.filter(link => {
        if (role === 'admin') return true;
        if (role === 'support') return ['dashboard', 'bookings', 'users', 'chat'].includes(link.id);
        return false;
    });

    return (
        <div className="admin-dashboard">
            {/* Sidebar */}
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <img src={logo} alt="Zovotel" />
                    <span className="sidebar-brand">Zovotel</span>
                </div>

                <nav className="sidebar-nav">
                    <p className="sidebar-section-title">Main</p>
                    {sidebarLinks.map(link => (
                        <button
                            key={link.id}
                            className={`sidebar-link ${activeSection === link.id ? 'active' : ''}`}
                            onClick={() => { setActiveSection(link.id); setSidebarOpen(false); }}
                        >
                            <link.icon />
                            {link.label}
                        </button>
                    ))}

                    <p className="sidebar-section-title">Quick Links</p>
                    <Link to="/" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
                        <Home /> Home Page
                    </Link>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {getInitials(userData?.username || currentUser?.email)}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">
                                {userData?.username || currentUser?.email?.split('@')[0]}
                            </div>
                            <div className="sidebar-user-role">Administrator</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && <div className="modal-overlay" style={{ zIndex: 99 }} onClick={() => setSidebarOpen(false)} />}

            {/* Main Content */}
            <div className={`admin-main ${sidebarOpen ? '' : ''}`}>
                {/* Top Bar */}
                <div className="admin-topbar">
                    <div className="topbar-left">
                        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <div>
                            <div className="topbar-title">
                                {sidebarLinks.find(l => l.id === activeSection)?.label || 'Dashboard'}
                            </div>
                            <div className="topbar-subtitle">
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    </div>
                    <div className="topbar-actions">
                        <button className="topbar-btn" onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'refresh-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <Link to="/" className="topbar-btn">
                            <Home size={14} /> Home
                        </Link>
                        <button className="topbar-btn danger" onClick={handleLogout}>
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="admin-content">
                    {/* ====== DASHBOARD SECTION ====== */}
                    {activeSection === 'dashboard' && (
                        <>
                            {/* KPI Row 1 - Booking Stats */}
                            <div className="kpi-grid">
                                <div className="kpi-card green">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{stats?.totalBookings || 0}</div>
                                            <div className="kpi-card-label">Total Bookings</div>
                                        </div>
                                        <div className="kpi-card-icon"><ShoppingBag size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><ArrowUpRight size={12} /> All time</div>
                                </div>

                                <div className="kpi-card blue">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{stats?.confirmedBookings || 0}</div>
                                            <div className="kpi-card-label">Confirmed Bookings</div>
                                        </div>
                                        <div className="kpi-card-icon"><CheckCircle size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><CheckCircle size={12} /> Confirmed</div>
                                </div>

                                <div className="kpi-card orange">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{stats?.pendingBookings || 0}</div>
                                            <div className="kpi-card-label">Pending Bookings</div>
                                        </div>
                                        <div className="kpi-card-icon"><Clock size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><Clock size={12} /> In queue</div>
                                </div>

                                <div className="kpi-card purple">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{stats?.cancelledBookings || 0}</div>
                                            <div className="kpi-card-label">Cancellations</div>
                                        </div>
                                        <div className="kpi-card-icon"><XCircle size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><TrendingDown size={12} /> {stats?.cancellationRate || 0}%</div>
                                </div>
                            </div>

                            {role === 'admin' && (
                                <>
                                {/* KPI Row 2 - Revenue & Balance */}
                                <div className="kpi-grid">
                                <div className="kpi-card cyan">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{formatCurrency(stats?.totalRevenue)}</div>
                                            <div className="kpi-card-label">Total Revenue</div>
                                        </div>
                                        <div className="kpi-card-icon"><DollarSign size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><TrendingUp size={12} /> Lifetime</div>
                                </div>

                                <div className="kpi-card pink">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{formatCurrency(stats?.avgBookingValue)}</div>
                                            <div className="kpi-card-label">Avg Booking Value</div>
                                        </div>
                                        <div className="kpi-card-icon"><BarChart3 size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><Activity size={12} /> Per booking</div>
                                </div>

                                <div className="kpi-card green">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {balance ? formatCurrency(balance.cashBalance) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Agency Cash Balance</div>
                                        </div>
                                        <div className="kpi-card-icon"><Wallet size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change">
                                        {balanceError ? <><AlertTriangle size={12} /> Unavailable</> : <><CreditCard size={12} /> TBO Account</>}
                                    </div>
                                </div>

                                <div className="kpi-card blue">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {balance ? formatCurrency(balance.creditBalance) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Agency Credit Balance</div>
                                        </div>
                                        <div className="kpi-card-icon"><CreditCard size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change">
                                        {balance?.agencyTypeName ? <><CheckCircle size={12} /> {balance.agencyTypeName}</> : <><Moon size={12} /> Not loaded</>}
                                    </div>
                                </div>
                            </div>

                            {/* KPI Row 3 - Markup & Commission */}
                            <div className="kpi-grid">
                                <div className="kpi-card purple" style={{ cursor: 'pointer' }} onClick={() => setActiveSection('markup')}>
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{markupPct}%</div>
                                            <div className="kpi-card-label">Markup Percentage</div>
                                        </div>
                                        <div className="kpi-card-icon"><Percent size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change">
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                background: markupActive ? '#22c55e' : '#ef4444',
                                                boxShadow: markupActive ? '0 0 6px #22c55e' : 'none'
                                            }} />
                                            {markupActive ? 'Active' : 'Inactive'}
                                        </div>
                                    </div>
                                </div>

                                <div className="kpi-card cyan" style={{ cursor: 'pointer' }} onClick={() => setActiveSection('commission')}>
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {commissionData ? formatCurrency(commissionData.commission?.totalCommission) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Commission Earned</div>
                                        </div>
                                        <div className="kpi-card-icon"><TrendingUp size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><Eye size={12} /> Click for details</div>
                                </div>

                                <div className="kpi-card pink">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {commissionData ? (commissionData.commission?.totalBookingsWithCommission || 0) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Commission Bookings</div>
                                        </div>
                                        <div className="kpi-card-icon"><ShoppingBag size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><DollarSign size={12} /> Bookings with markup</div>
                                </div>

                                <div className="kpi-card green">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {commissionData ? formatCurrency(commissionData.commission?.avgCommissionPerBooking) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Avg Commission</div>
                                        </div>
                                        <div className="kpi-card-icon"><BarChart3 size={20} /></div>
                                    </div>
                                    <div className="kpi-card-change"><Activity size={12} /> Per booking</div>
                                </div>
                            </div>

                            {/* Quick Markup Control Widget */}
                            <div className="widget-card" style={{ marginBottom: '20px' }}>
                                <div className="widget-card-header">
                                    <div className="widget-card-title"><Percent /> Quick Markup Control</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {markupSaved && <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>✓ Saved!</span>}
                                        <button
                                            onClick={() => setActiveSection('markup')}
                                            className="action-btn view"
                                            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                        >
                                            Full Settings <ArrowUpRight size={10} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Markup</label>
                                        <input
                                            type="range"
                                            min="0" max="50" step="0.5"
                                            value={markupPct}
                                            onChange={e => setMarkupPct(parseFloat(e.target.value))}
                                            style={{ width: '120px', accentColor: '#8b5cf6' }}
                                        />
                                        <span style={{ color: '#f1f5f9', fontWeight: 700, minWidth: '40px' }}>{markupPct}%</span>
                                    </div>
                                    <button
                                        onClick={() => setMarkupActive(!markupActive)}
                                        style={{
                                            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                            background: markupActive ? '#22c55e' : '#334155', position: 'relative', transition: 'background 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                                            position: 'absolute', top: '3px', transition: 'left 0.2s',
                                            left: markupActive ? '23px' : '3px'
                                        }} />
                                    </button>
                                    <span style={{ color: markupActive ? '#22c55e' : '#64748b', fontSize: '0.75rem' }}>
                                        {markupActive ? 'ON' : 'OFF'}
                                    </span>
                                    <button
                                        className="action-btn view"
                                        style={{ padding: '4px 12px', fontSize: '0.72rem', marginLeft: 'auto' }}
                                        disabled={markupSaving}
                                        onClick={async () => {
                                            setMarkupSaving(true);
                                            setMarkupSaved(false);
                                            try {
                                                await saveMarkupAPI({ percentage: markupPct, isActive: markupActive });
                                                setMarkupSaved(true);
                                                setTimeout(() => setMarkupSaved(false), 3000);
                                            } catch (err) { console.error(err); }
                                            finally { setMarkupSaving(false); }
                                        }}
                                    >
                                        {markupSaving ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                            </>
                            )}

                            {/* Charts Row */}
                            <div className="widgets-grid">
                                {/* Reservation Statistics - Line Chart */}
                                <div className="widget-card">
                                    <div className="widget-card-header">
                                        <div className="widget-card-title"><Activity /> Reservation Statistics</div>
                                        <span className="widget-card-badge">Last 30 days</span>
                                    </div>
                                    <div className="chart-container">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={stats?.dailyData || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                                                <Line type="monotone" dataKey="confirmed" stroke="#22c55e" strokeWidth={2} dot={false} name="Confirmed" />
                                                <Line type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {role === 'admin' && (
                                    <div className="widget-card">
                                        <div className="widget-card-header">
                                        <div className="widget-card-title"><TrendingUp /> Revenue Trend</div>
                                        <span className="widget-card-badge">Last 30 days</span>
                                    </div>
                                    <div className="chart-container">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats?.dailyData || []}>
                                                <defs>
                                                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickFormatter={v => `₹${v}`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="revenue" stroke="#06b6d4" fill="url(#revGradient)" strokeWidth={2} name="Revenue" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                )}
                            </div>

                            {/* Second Widget Row */}
                            <div className="widgets-grid">
                                {/* Monthly Bookings - Bar Chart */}
                                <div className="widget-card">
                                    <div className="widget-card-header">
                                        <div className="widget-card-title"><BarChart3 /> Monthly Bookings</div>
                                        <span className="widget-card-badge">Last 6 months</span>
                                    </div>
                                    <div className="chart-container">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats?.monthlyData || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                                                <Bar dataKey="confirmed" fill="#22c55e" radius={[4, 4, 0, 0]} name="Confirmed" />
                                                <Bar dataKey="cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cancelled" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Booking Status - Pie Chart */}
                                <div className="widget-card">
                                    <div className="widget-card-header">
                                        <div className="widget-card-title"><PieChart /> Booking Status Distribution</div>
                                    </div>
                                    <div className="chart-container">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={statusPieData.length > 0 ? statusPieData : [{ name: 'No Data', value: 1 }]}
                                                    cx="50%" cy="50%"
                                                    innerRadius={60} outerRadius={95}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                    labelLine={{ stroke: '#475569' }}
                                                >
                                                    {(statusPieData.length > 0 ? statusPieData : [{ name: 'No Data', value: 1 }]).map((entry, i) => (
                                                        <Cell key={i} fill={statusPieData.length > 0 ? PIE_COLORS[i % PIE_COLORS.length] : '#334155'} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Third Widget Row - Stats & Activity */}
                            <div className="widgets-grid-3">
                                {/* User Analytics */}
                                <div className="widget-card">
                                    <div className="widget-card-header">
                                        <div className="widget-card-title"><Users /> User Analytics</div>
                                        <span className="widget-card-badge">{totalUsers} Total</span>
                                    </div>
                                    <div className="stat-mini-grid">
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{totalUsers}</div>
                                            <div className="stat-mini-label">Total Users</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{googleUsers}</div>
                                            <div className="stat-mini-label">Google Sign-ups</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{emailUsers}</div>
                                            <div className="stat-mini-label">Email Sign-ups</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{newUsersThisMonth}</div>
                                            <div className="stat-mini-label">New This Month</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{adminUsers}</div>
                                            <div className="stat-mini-label">Admin Users</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{stats?.totalRoomNights || 0}</div>
                                            <div className="stat-mini-label">Room Nights Sold</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{stats?.avgStayDuration || 0}</div>
                                            <div className="stat-mini-label">Avg Stay (Nights)</div>
                                        </div>
                                        <div className="stat-mini-card">
                                            <div className="stat-mini-value">{stats?.failedBookings || 0}</div>
                                            <div className="stat-mini-label">Failed Bookings</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Top Destinations + Cancellation Rate */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {/* Top Destinations */}
                                    <div className="widget-card">
                                        <div className="widget-card-header">
                                            <div className="widget-card-title"><MapPin /> Top Destinations</div>
                                        </div>
                                        <div className="destination-list">
                                            {(stats?.topDestinations || []).length > 0 ? (
                                                stats.topDestinations.map((d, i) => (
                                                    <div className="destination-item" key={i}>
                                                        <div className="destination-rank">{i + 1}</div>
                                                        <div className="destination-info">
                                                            <div className="destination-name">{d.name}</div>
                                                            <div className="destination-city">{d.city}</div>
                                                        </div>
                                                        <div className="destination-count">{d.count} bookings</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="admin-empty"><p>No booking data yet</p></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cancellation Rate Gauge */}
                                    <div className="widget-card">
                                        <div className="widget-card-header">
                                            <div className="widget-card-title"><Percent /> Cancellation Rate</div>
                                        </div>
                                        <div className="gauge-container">
                                            <div className="gauge-value">{stats?.cancellationRate || 0}%</div>
                                            <div className="gauge-label">of total bookings</div>
                                            <div className="gauge-bar">
                                                <div
                                                    className={`gauge-fill ${(stats?.cancellationRate || 0) < 10 ? 'low' : (stats?.cancellationRate || 0) < 30 ? 'medium' : 'high'}`}
                                                    style={{ width: `${Math.min(stats?.cancellationRate || 0, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity Feed */}
                            <div className="widget-card">
                                <div className="widget-card-header">
                                    <div className="widget-card-title"><Activity /> Recent Activity</div>
                                    <span className="widget-card-badge">Latest {Math.min(bookings.length, 10)}</span>
                                </div>
                                <div className="activity-feed">
                                    {bookings.slice(0, 10).map((b, i) => (
                                        <div className={`activity-item ${b.status}`} key={i}>
                                            <div className={`activity-dot ${b.status}`} />
                                            <div className="activity-content">
                                                <div className="activity-title">
                                                    {b.hotelInfo?.hotelName || b.hotelInfo?.HotelName || 'Hotel Booking'}
                                                </div>
                                                <div className="activity-meta">
                                                    {b.contactDetails?.email || 'N/A'} · {formatDate(b.completedAt || b.createdAt)}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="activity-amount">{formatCurrency(b.amount)}</div>
                                                <span className={`status-badge ${b.status}`}>{b.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {bookings.length === 0 && (
                                        <div className="admin-empty"><p>No recent activity</p></div>
                                    )}
                                </div>
                            </div>

                            {role === 'admin' && (
                                <div className="widget-card" style={{ marginTop: '1.25rem' }}>
                                    <div className="widget-card-header">
                                    <div className="widget-card-title"><DollarSign /> Monthly Revenue</div>
                                    <span className="widget-card-badge">Last 6 months</span>
                                </div>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats?.monthlyData || []}>
                                            <defs>
                                                <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickFormatter={v => `₹${v}`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="revenue" fill="url(#revenueBarGrad)" radius={[6, 6, 0, 0]} name="Revenue" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            )}
                        </>
                    )}

                    {/* ====== BOOKINGS SECTION ====== */}
                    {activeSection === 'bookings' && (
                        <div className="admin-table-container">
                            <div className="admin-table-header">
                                <div className="admin-table-title">
                                    <ShoppingBag size={18} /> All Bookings ({filteredBookings.length})
                                </div>
                                <div className="admin-table-filters">
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                                        <input
                                            className="admin-filter-input"
                                            placeholder="Search by hotel, email, booking ID..."
                                            value={bookingSearch}
                                            onChange={e => setBookingSearch(e.target.value)}
                                            style={{ paddingLeft: '2.25rem' }}
                                        />
                                    </div>
                                    <select className="admin-filter-select" value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}>
                                        <option value="">All Status</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="booked">Booked</option>
                                        <option value="pending">Pending</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="admin-table-scroll">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Hotel</th>
                                            <th>Guest</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Booking ID</th>
                                            <th>Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map((b, i) => (
                                            <tr key={i}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                                    {b._id?.substring(0, 20) || 'N/A'}
                                                </td>
                                                <td>
                                                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {b.hotelInfo?.hotelName || b.hotelInfo?.HotelName || 'N/A'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>{b.contactDetails?.firstName || ''} {b.contactDetails?.lastName || ''}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{b.contactDetails?.email || ''}</div>
                                                </td>
                                                <td style={{ fontWeight: 600, color: '#22c55e' }}>{formatCurrency(b.amount)}</td>
                                                <td>
                                                    <span className={`status-badge ${b.status}`}>
                                                        {b.status === 'confirmed' && <CheckCircle size={10} />}
                                                        {b.status === 'pending' && <Clock size={10} />}
                                                        {b.status === 'cancelled' && <XCircle size={10} />}
                                                        {b.status === 'failed' && <AlertTriangle size={10} />}
                                                        {b.status}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                                    {b.tboResponse?.bookingId || 'N/A'}
                                                </td>
                                                <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {formatDate(b.completedAt || b.createdAt)}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                        {b.status === 'confirmed' && b.tboResponse?.bookingId && (
                                                            <button
                                                                className="action-btn cancel"
                                                                onClick={() => setCancelModal({ open: true, booking: b })}
                                                            >
                                                                <Ban size={12} /> Cancel
                                                            </button>
                                                        )}
                                                        {b.cancellationDetails?.changeRequestId && (
                                                            <button
                                                                className="action-btn view"
                                                                onClick={() => handleViewCancelStatus(b.cancellationDetails.changeRequestId)}
                                                            >
                                                                <Eye size={12} /> Status
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredBookings.length === 0 && (
                                            <tr>
                                                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                                                    No bookings found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="admin-table-footer">
                                <span>Showing {filteredBookings.length} of {bookings.length} bookings</span>
                                <span>Last updated: {new Date().toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    )}

                    {/* ====== USERS SECTION ====== */}
                    {activeSection === 'users' && (
                        <>
                            {/* User Detail Panel */}
                            {selectedUser && (
                                <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                                    <div className="widget-card-header">
                                        <div className="widget-card-title">
                                            <Eye /> User Details — {selectedUser.username || selectedUser.email}
                                        </div>
                                        <button className="action-btn" onClick={() => { setSelectedUser(null); setUserDetail(null); }}>
                                            <X size={14} /> Close
                                        </button>
                                    </div>

                                    {userDetailLoading ? (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                            <div className="admin-spinner" style={{ margin: '0 auto' }} />
                                            <p className="admin-loading-text">Loading user details...</p>
                                        </div>
                                    ) : userDetail ? (
                                        <div>
                                            {/* User Profile Card */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '1rem' }}>
                                                <div className="admin-user-avatar" style={{ width: '64px', height: '64px', fontSize: '1.2rem', borderRadius: '12px' }}>
                                                    {getInitials(userDetail.user?.username || userDetail.user?.email)}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                                                        {userDetail.user?.username || 'N/A'}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                                        {userDetail.user?.email}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                                                        <span>📱 {userDetail.user?.phoneNumber || 'N/A'}</span>
                                                        <span>🔐 {userDetail.user?.provider === 'google' ? 'Google' : 'Email'}</span>
                                                        <span>📅 Joined: {formatDate(userDetail.user?.createdAt)}</span>
                                                        {userDetail.user?.role === 'admin' && <span className="admin-role-badge admin" style={{ fontSize: '0.7rem' }}>Admin</span>}
                                                        {userDetail.user?.role === 'support' && <span className="admin-role-badge admin" style={{ fontSize: '0.7rem', background: '#3b82f6', color: '#fff' }}>Support</span>}
                                                        {(!userDetail.user?.role || userDetail.user?.role === 'user') && userDetail.user?.isAdmin && <span className="admin-role-badge admin" style={{ fontSize: '0.7rem' }}>Admin</span>}
                                                        {userDetail.user?.updatedAt && <span>✏️ Last updated: {formatDate(userDetail.user.updatedAt)}</span>}
                                                    </div>
                                                </div>
                                                
                                                {role === 'admin' && (
                                                    <>
                                                    <div style={{ padding: '0.5rem' }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Change Role</label>
                                                        <select
                                                            className="admin-filter-select"
                                                            style={{ padding: '4px 8px', fontSize: '0.8rem', height: 'auto', background: '#1e293b' }}
                                                            value={userDetail.user?.role || (userDetail.user?.isAdmin ? 'admin' : 'user')}
                                                            onChange={async (e) => {
                                                                try {
                                                                    const newRole = e.target.value;
                                                                    await updateUserRole(userDetail.user.uid, newRole);
                                                                    setUserDetail(prev => ({
                                                                        ...prev,
                                                                        user: { ...prev.user, role: newRole, isAdmin: newRole === 'admin' || newRole === 'support' }
                                                                    }));
                                                                    setUsers(prev => prev.map(u => u.uid === userDetail.user.uid ? { ...u, role: newRole, isAdmin: newRole === 'admin' || newRole === 'support' } : u));
                                                                    alert('User role updated successfully!');
                                                                } catch (err) {
                                                                    alert('Failed to update user role');
                                                                    console.error(err);
                                                                }
                                                            }}
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="support">Support</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                    </div>
                                                    <button
                                                        className="action-btn cancel"
                                                        style={{ marginLeft: 'auto', alignSelf: 'center' }}
                                                        disabled={userDeleteLoading}
                                                        onClick={() => handleDeleteUser(userDetail.user.uid, userDetail.user.email)}
                                                    >
                                                        <Trash2 size={14} /> {userDeleteLoading ? 'Deleting...' : 'Delete User'}
                                                    </button>
                                                    </>
                                                )}
                                            </div>

                                            {/* User Stats */}
                                            <div className="stat-mini-grid" style={{ marginBottom: '1rem' }}>
                                                <div className="stat-mini-card">
                                                    <div className="stat-mini-value">{userDetail.user?.stats?.totalBookings || 0}</div>
                                                    <div className="stat-mini-label">Total Bookings</div>
                                                </div>
                                                <div className="stat-mini-card">
                                                    <div className="stat-mini-value">{userDetail.user?.stats?.confirmedBookings || 0}</div>
                                                    <div className="stat-mini-label">Confirmed</div>
                                                </div>
                                                <div className="stat-mini-card">
                                                    <div className="stat-mini-value">{userDetail.user?.stats?.cancelledBookings || 0}</div>
                                                    <div className="stat-mini-label">Cancelled</div>
                                                </div>
                                                <div className="stat-mini-card">
                                                    <div className="stat-mini-value">{formatCurrency(userDetail.user?.stats?.totalSpent || 0)}</div>
                                                    <div className="stat-mini-label">Total Spent</div>
                                                </div>
                                                <div className="stat-mini-card">
                                                    <div className="stat-mini-value">{userDetail.user?.stats?.likedHotelsCount || 0}</div>
                                                    <div className="stat-mini-label">Liked Hotels</div>
                                                </div>
                                                <div className="stat-mini-card">
                                                    <div className="stat-mini-value">{userDetail.user?.photoURL ? '✅' : '—'}</div>
                                                    <div className="stat-mini-label">Has Photo</div>
                                                </div>
                                            </div>

                                            {/* User Bookings */}
                                            {userDetail.bookings && userDetail.bookings.length > 0 && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <h4 style={{ color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <ShoppingBag size={16} /> Booking History ({userDetail.bookings.length})
                                                    </h4>
                                                    <div className="admin-table-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                        <table className="admin-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Hotel</th>
                                                                    <th>Amount</th>
                                                                    <th>Status</th>
                                                                    <th>Date</th>
                                                                    <th>Check-in</th>
                                                                    <th>Check-out</th>
                                                                    <th>Booking ID</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {userDetail.bookings.map((b, i) => (
                                                                    <tr key={i}>
                                                                        <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {b.hotelInfo?.hotelName || b.hotelInfo?.HotelName || b.hotelName || 'N/A'}
                                                                        </td>
                                                                        <td style={{ fontWeight: 600, color: '#22c55e' }}>
                                                                            {formatCurrency(b.amount || b.totalAmount || b.price)}
                                                                        </td>
                                                                        <td>
                                                                            <span className={`status-badge ${b.status || 'booked'}`}>
                                                                                {b.status || 'booked'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                                            {formatDate(b.completedAt || b.createdAt)}
                                                                        </td>
                                                                        <td style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                            {b.searchParams?.checkIn || b.searchParams?.CheckIn || b.checkIn || '—'}
                                                                        </td>
                                                                        <td style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                            {b.searchParams?.checkOut || b.searchParams?.CheckOut || b.checkOut || '—'}
                                                                        </td>
                                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                                                            {b.tboResponse?.bookingId || b.bookingId || b._id?.substring(0, 15) || '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Liked Hotels */}
                                            {userDetail.likedHotels && userDetail.likedHotels.length > 0 && (
                                                <div>
                                                    <h4 style={{ color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        ❤️ Liked Hotels ({userDetail.likedHotels.length})
                                                    </h4>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {userDetail.likedHotels.map((h, i) => (
                                                            <div key={i} style={{
                                                                background: 'rgba(255,255,255,0.03)',
                                                                border: '1px solid rgba(255,255,255,0.06)',
                                                                borderRadius: '8px',
                                                                padding: '0.5rem 0.75rem',
                                                                fontSize: '0.78rem'
                                                            }}>
                                                                <div style={{ color: '#e2e8f0', fontWeight: 500 }}>
                                                                    {h.hotelName || h.HotelName || `Hotel #${h.hotelCode}`}
                                                                </div>
                                                                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                                                    Liked: {formatDate(h.likedAt)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {userDetail.bookings?.length === 0 && userDetail.likedHotels?.length === 0 && (
                                                <div className="admin-empty">
                                                    <p>This user has no bookings or liked hotels yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* Users Table */}
                            <div className="admin-table-container">
                                <div className="admin-table-header">
                                    <div className="admin-table-title">
                                        <Users size={18} /> All Users ({filteredUsers.length})
                                    </div>
                                    <div className="admin-table-filters">
                                        <div style={{ position: 'relative' }}>
                                            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                                            <input
                                                className="admin-filter-input"
                                                placeholder="Search by name, email, phone..."
                                                value={userSearch}
                                                onChange={e => setUserSearch(e.target.value)}
                                                style={{ paddingLeft: '2.25rem' }}
                                            />
                                        </div>
                                        {role === 'admin' && (
                                            <button
                                                className="action-btn view"
                                                disabled={userSyncLoading}
                                                onClick={handleSyncUsers}
                                                title="Sync Firebase users to MySQL"
                                            >
                                                <RefreshCw size={12} className={userSyncLoading ? 'refresh-spin' : ''} />
                                                {userSyncLoading ? 'Syncing...' : 'Sync Firebase'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="admin-table-scroll">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Email</th>
                                                <th>Phone</th>
                                                <th>Provider</th>
                                                <th>Role</th>
                                                <th>Joined</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map((user) => (
                                                <tr key={user.uid} style={{ cursor: 'pointer' }} onClick={async () => {
                                                    setSelectedUser(user);
                                                    setUserDetailLoading(true);
                                                    try {
                                                        const res = await getUserDetails(user.uid);
                                                        setUserDetail(res);
                                                    } catch (err) {
                                                        console.error('Error loading user details:', err);
                                                        setUserDetail({ user: { ...user, stats: {} }, bookings: [], likedHotels: [] });
                                                    } finally {
                                                        setUserDetailLoading(false);
                                                    }
                                                }}>
                                                    <td>
                                                        <div className="admin-user-info">
                                                            <div className="admin-user-avatar">
                                                                {getInitials(user.username || user.email)}
                                                            </div>
                                                            <div>
                                                                <div className="admin-user-name">{user.username || 'N/A'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{user.email}</td>
                                                    <td>{user.phoneNumber || 'N/A'}</td>
                                                    <td>
                                                        <span className={`admin-provider-badge ${user.provider}`}>
                                                            {user.provider === 'google' ? 'Google' : 'Email'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {user.role === 'admin' ? (
                                                            <span className="admin-role-badge admin">Admin</span>
                                                        ) : user.role === 'support' ? (
                                                            <span className="admin-role-badge admin" style={{ background: '#3b82f6', color: '#fff' }}>Support</span>
                                                        ) : user.isAdmin && (!user.role || user.role === 'user') ? (
                                                            // Legacy users might just have isAdmin true but no role
                                                            <span className="admin-role-badge admin">Admin</span>
                                                        ) : (
                                                            <span className="admin-role-badge user">User</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {formatDate(user.createdAt)}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                            <button className="action-btn view" onClick={(e) => { e.stopPropagation(); }}>
                                                                <Eye size={12} /> View
                                                            </button>
                                                            {role === 'admin' && (
                                                                <button
                                                                    className="action-btn cancel"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.uid, user.email); }}
                                                                    disabled={userDeleteLoading}
                                                                    title="Delete user from Firebase and MySQL"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                                                        No users found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="admin-table-footer">
                                    <span>Showing {filteredUsers.length} of {totalUsers} users</span>
                                    <span>Last updated: {new Date().toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ====== COUPONS SECTION ====== */}
                    {activeSection === 'coupons' && (
                        <>
                            {/* Create Coupon Form */}
                            <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                                <div className="widget-card-header">
                                    <div className="widget-card-title"><Plus /> Create Coupon</div>
                                    {couponMsg && <span style={{ color: couponMsg.includes('Error') ? '#ef4444' : '#22c55e', fontSize: '0.78rem' }}>{couponMsg}</span>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Coupon Code *</label>
                                        <input className="admin-filter-input" placeholder="e.g. FLAT500" style={{ textTransform: 'uppercase' }}
                                            value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Discount Type *</label>
                                        <select className="admin-filter-input" value={couponForm.discountType}
                                            onChange={e => setCouponForm({ ...couponForm, discountType: e.target.value })}>
                                            <option value="percentage">Percentage (%)</option>
                                            <option value="flat">Flat Amount (₹)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Discount Value *</label>
                                        <input className="admin-filter-input" type="number" placeholder={couponForm.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                                            value={couponForm.discountValue} onChange={e => setCouponForm({ ...couponForm, discountValue: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Max Discount (₹)</label>
                                        <input className="admin-filter-input" type="number" placeholder="e.g. 2000"
                                            value={couponForm.maxDiscount} onChange={e => setCouponForm({ ...couponForm, maxDiscount: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Min Booking (₹)</label>
                                        <input className="admin-filter-input" type="number" placeholder="e.g. 3000"
                                            value={couponForm.minBookingAmount} onChange={e => setCouponForm({ ...couponForm, minBookingAmount: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Expiry Date</label>
                                        <input className="admin-filter-input" type="date"
                                            value={couponForm.expiryDate} onChange={e => setCouponForm({ ...couponForm, expiryDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Usage Limit (0=unlimited)</label>
                                        <input className="admin-filter-input" type="number" placeholder="0"
                                            value={couponForm.usageLimit} onChange={e => setCouponForm({ ...couponForm, usageLimit: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '4px' }}>Description</label>
                                        <input className="admin-filter-input" placeholder="Get 10% off on bookings"
                                            value={couponForm.description} onChange={e => setCouponForm({ ...couponForm, description: e.target.value })} />
                                    </div>
                                </div>
                                <button className="action-btn view" disabled={couponSaving || !couponForm.code || !couponForm.discountValue}
                                    style={{ padding: '0.5rem 1.5rem' }}
                                    onClick={async () => {
                                        setCouponSaving(true);
                                        setCouponMsg('');
                                        try {
                                            await createCouponAPI(couponForm);
                                            setCouponMsg('✓ Coupon created!');
                                            setCouponForm({ code: '', discountType: 'percentage', discountValue: '', maxDiscount: '', minBookingAmount: '', expiryDate: '', usageLimit: '', description: '' });
                                            // Refresh list
                                            const res = await getAllCoupons();
                                            if (res?.success) setCoupons(res.coupons);
                                            setTimeout(() => setCouponMsg(''), 3000);
                                        } catch (err) {
                                            setCouponMsg('Error: ' + (err.response?.data?.error || err.message));
                                        } finally { setCouponSaving(false); }
                                    }}
                                >
                                    <Plus size={14} /> {couponSaving ? 'Creating...' : 'Create Coupon'}
                                </button>
                            </div>

                            {/* Coupons List */}
                            <div className="widget-card">
                                <div className="widget-card-header">
                                    <div className="widget-card-title"><Tag /> Existing Coupons</div>
                                    <button className="action-btn view" onClick={async () => {
                                        setCouponsLoading(true);
                                        try {
                                            const res = await getAllCoupons();
                                            if (res?.success) setCoupons(res.coupons);
                                        } catch (err) { console.error(err); }
                                        finally { setCouponsLoading(false); }
                                    }}>
                                        <RefreshCw size={12} /> Refresh
                                    </button>
                                </div>

                                {couponsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <div className="admin-spinner" style={{ margin: '0 auto' }} />
                                    </div>
                                ) : coupons.length === 0 ? (
                                    <div className="admin-empty">
                                        <p>No coupons yet. Create one above!</p>
                                        <button className="action-btn view" style={{ marginTop: '0.5rem' }}
                                            onClick={async () => {
                                                setCouponsLoading(true);
                                                try {
                                                    const res = await getAllCoupons();
                                                    if (res?.success) setCoupons(res.coupons);
                                                } catch (err) { console.error(err); }
                                                finally { setCouponsLoading(false); }
                                            }}>
                                            <RefreshCw size={12} /> Load Coupons
                                        </button>
                                    </div>
                                ) : (
                                    <div className="admin-table-scroll">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>Code</th>
                                                    <th>Type</th>
                                                    <th>Value</th>
                                                    <th>Max Disc.</th>
                                                    <th>Min Booking</th>
                                                    <th>Expiry</th>
                                                    <th>Used / Limit</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {coupons.map((c, i) => (
                                                    <tr key={i}>
                                                        <td><code style={{ color: '#8b5cf6', fontWeight: 700, background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{c.code}</code></td>
                                                        <td>{c.discountType === 'percentage' ? '%' : '₹'}</td>
                                                        <td style={{ fontWeight: 600 }}>{c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`}</td>
                                                        <td>{c.maxDiscount > 0 ? `₹${c.maxDiscount}` : '—'}</td>
                                                        <td>{c.minBookingAmount > 0 ? `₹${c.minBookingAmount}` : '—'}</td>
                                                        <td style={{ fontSize: '0.72rem' }}>{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'No expiry'}</td>
                                                        <td>{c.usedCount} / {c.usageLimit > 0 ? c.usageLimit : '∞'}</td>
                                                        <td>
                                                            <span className={`status-badge ${c.isActive ? 'confirmed' : 'cancelled'}`}>
                                                                {c.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button className={`action-btn ${c.isActive ? 'cancel' : 'view'}`}
                                                                    title={c.isActive ? 'Deactivate' : 'Activate'}
                                                                    onClick={async () => {
                                                                        try {
                                                                            await updateCouponAPI(c.code, { isActive: !c.isActive });
                                                                            setCoupons(prev => prev.map(x => x.code === c.code ? { ...x, isActive: !x.isActive } : x));
                                                                        } catch (err) { console.error(err); }
                                                                    }}
                                                                >
                                                                    {c.isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                                                                </button>
                                                                <button className="action-btn cancel" title="Delete"
                                                                    onClick={async () => {
                                                                        if (!window.confirm(`Delete coupon ${c.code}?`)) return;
                                                                        try {
                                                                            await deleteCouponAPI(c.code);
                                                                            setCoupons(prev => prev.filter(x => x.code !== c.code));
                                                                        } catch (err) { console.error(err); }
                                                                    }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ====== BALANCE SECTION ====== */}
                    {/* ====== MARKUP SECTION ====== */}
                    {activeSection === 'markup' && (
                        <>
                            <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                                <div className="widget-card-header">
                                    <div className="widget-card-title"><Percent /> Markup Settings</div>
                                    {markupSaved && <span style={{ color: '#22c55e', fontSize: '0.78rem' }}>✓ Saved!</span>}
                                </div>
                                <div style={{ padding: '0.5rem 0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                        <label style={{ color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Markup %</label>
                                        <input
                                            type="range"
                                            min="0" max="50" step="0.5"
                                            value={markupPct}
                                            onChange={e => setMarkupPct(parseFloat(e.target.value))}
                                            style={{ flex: 1, accentColor: '#8b5cf6' }}
                                        />
                                        <input
                                            type="number"
                                            min="0" max="100" step="0.5"
                                            value={markupPct}
                                            onChange={e => setMarkupPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                            className="admin-filter-input"
                                            style={{ width: '80px', textAlign: 'center' }}
                                        />
                                        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem' }}>{markupPct}%</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Active</label>
                                            <button
                                                onClick={() => setMarkupActive(!markupActive)}
                                                style={{
                                                    width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                                    background: markupActive ? '#22c55e' : '#334155', position: 'relative', transition: 'background 0.2s'
                                                }}
                                            >
                                                <div style={{
                                                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                                                    position: 'absolute', top: '3px', transition: 'left 0.2s',
                                                    left: markupActive ? '25px' : '3px'
                                                }} />
                                            </button>
                                            <span style={{ color: markupActive ? '#22c55e' : '#64748b', fontSize: '0.78rem' }}>
                                                {markupActive ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>

                                        <button
                                            className="action-btn view"
                                            style={{ padding: '0.5rem 1.25rem' }}
                                            disabled={markupSaving}
                                            onClick={async () => {
                                                setMarkupSaving(true);
                                                setMarkupSaved(false);
                                                try {
                                                    await saveMarkupAPI({ percentage: markupPct, isActive: markupActive });
                                                    setMarkupSaved(true);
                                                    setTimeout(() => setMarkupSaved(false), 3000);
                                                } catch (err) {
                                                    console.error('Save markup error:', err);
                                                } finally {
                                                    setMarkupSaving(false);
                                                }
                                            }}
                                        >
                                            {markupSaving ? 'Saving...' : 'Save Markup'}
                                        </button>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                                        <p style={{ marginBottom: '0.5rem' }}><strong style={{ color: '#f1f5f9' }}>How it works:</strong></p>
                                        <ul style={{ paddingLeft: '1.2rem', listStyle: 'disc', lineHeight: 1.7 }}>
                                            <li>When enabled, the markup percentage is added to all hotel room prices in search results.</li>
                                            <li>Users see and pay the marked-up price via Razorpay.</li>
                                            <li>TBO is charged the original base price — the difference is your commission.</li>
                                            <li>Example: TBO price ₹5,000 + {markupPct}% markup = <strong style={{ color: '#22c55e' }}>₹{(5000 * (1 + markupPct / 100)).toFixed(0)}</strong> (User pays). Commission: <strong style={{ color: '#8b5cf6' }}>₹{(5000 * markupPct / 100).toFixed(0)}</strong></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ====== PRICING STRATEGIES SECTION ====== */}
                    {activeSection === 'pricing-strategies' && (
                        <div className="widget-card">
                            <div className="widget-card-header">
                                <div className="widget-card-title"><DollarSign /> Dynamic Pricing Strategies</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {strategiesMsg && <span style={{ color: strategiesMsg.includes('Failed') ? '#ef4444' : '#22c55e', fontSize: '0.85rem' }}>{strategiesMsg}</span>}
                                    <button 
                                        className="action-btn view" 
                                        style={{ padding: '0.5rem 1.25rem' }}
                                        onClick={savePricingStrategies}
                                        disabled={strategiesSaving || strategiesLoading}
                                    >
                                        {strategiesSaving ? 'Saving...' : 'Save All Strategies'}
                                    </button>
                                </div>
                            </div>

                            {strategiesLoading && !pricingStrategies ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div className="admin-spinner" style={{ margin: '0 auto' }} />
                                    <p className="admin-loading-text">Loading strategies...</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                                    {/* Device Based Pricing */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div>
                                                <h4 style={{ color: '#f1f5f9', margin: 0 }}>Device-Based Pricing</h4>
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Offer different markup/discounts based on the user's device.</p>
                                            </div>
                                            <button 
                                                className="action-btn"
                                                onClick={() => handleUpdateStrategy('deviceBased', { enabled: !pricingStrategies?.deviceBased?.enabled })}
                                                style={{ background: pricingStrategies?.deviceBased?.enabled ? '#22c55e' : '#334155', color: '#fff' }}
                                            >
                                                {pricingStrategies?.deviceBased?.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </div>
                                        {pricingStrategies?.deviceBased?.enabled && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Mobile Markup (%)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.deviceBased?.mobileMarkup || 0} onChange={e => handleUpdateStrategy('deviceBased', { mobileMarkup: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Desktop Markup (%)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.deviceBased?.desktopMarkup || 0} onChange={e => handleUpdateStrategy('deviceBased', { desktopMarkup: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Time Based Pricing */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div>
                                                <h4 style={{ color: '#f1f5f9', margin: 0 }}>Time-Based Pricing (Urgency)</h4>
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Increase prices for last-minute bookings or apply early-bird discounts.</p>
                                            </div>
                                            <button 
                                                className="action-btn"
                                                onClick={() => handleUpdateStrategy('timeBased', { enabled: !pricingStrategies?.timeBased?.enabled })}
                                                style={{ background: pricingStrategies?.timeBased?.enabled ? '#22c55e' : '#334155', color: '#fff' }}
                                            >
                                                {pricingStrategies?.timeBased?.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </div>
                                        {pricingStrategies?.timeBased?.enabled && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Last Minute Markup (%)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.timeBased?.lastMinuteMarkup || 0} onChange={e => handleUpdateStrategy('timeBased', { lastMinuteMarkup: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Last Minute Threshold (Days)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.timeBased?.lastMinuteDaysThreshold || 0} onChange={e => handleUpdateStrategy('timeBased', { lastMinuteDaysThreshold: parseInt(e.target.value) || 0 })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Weekend / Peak Pricing */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div>
                                                <h4 style={{ color: '#f1f5f9', margin: 0 }}>Weekend / Peak Pricing</h4>
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Automatically apply a markup if the check-in is on a weekend.</p>
                                            </div>
                                            <button 
                                                className="action-btn"
                                                onClick={() => handleUpdateStrategy('weekendPeak', { enabled: !pricingStrategies?.weekendPeak?.enabled })}
                                                style={{ background: pricingStrategies?.weekendPeak?.enabled ? '#22c55e' : '#334155', color: '#fff' }}
                                            >
                                                {pricingStrategies?.weekendPeak?.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </div>
                                        {pricingStrategies?.weekendPeak?.enabled && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Weekend Markup (%)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.weekendPeak?.weekendMarkup || 0} onChange={e => handleUpdateStrategy('weekendPeak', { weekendMarkup: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Loyalty Pricing */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div>
                                                <h4 style={{ color: '#f1f5f9', margin: 0 }}>Loyalty Pricing</h4>
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Provide discounts for returning customers.</p>
                                            </div>
                                            <button 
                                                className="action-btn"
                                                onClick={() => handleUpdateStrategy('loyalty', { enabled: !pricingStrategies?.loyalty?.enabled })}
                                                style={{ background: pricingStrategies?.loyalty?.enabled ? '#22c55e' : '#334155', color: '#fff' }}
                                            >
                                                {pricingStrategies?.loyalty?.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </div>
                                        {pricingStrategies?.loyalty?.enabled && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Loyalty Discount (%)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.loyalty?.discountAmount || 0} onChange={e => handleUpdateStrategy('loyalty', { discountAmount: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Min Past Bookings</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.loyalty?.minBookingsThreshold || 0} onChange={e => handleUpdateStrategy('loyalty', { minBookingsThreshold: parseInt(e.target.value) || 0 })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Demand Based Pricing */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div>
                                                <h4 style={{ color: '#f1f5f9', margin: 0 }}>Demand-Based Pricing</h4>
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Apply a markup if a hotel is experiencing high recent bookings.</p>
                                            </div>
                                            <button 
                                                className="action-btn"
                                                onClick={() => handleUpdateStrategy('demandBased', { enabled: !pricingStrategies?.demandBased?.enabled })}
                                                style={{ background: pricingStrategies?.demandBased?.enabled ? '#22c55e' : '#334155', color: '#fff' }}
                                            >
                                                {pricingStrategies?.demandBased?.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </div>
                                        {pricingStrategies?.demandBased?.enabled && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>High Demand Markup (%)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.demandBased?.highDemandMarkup || 0} onChange={e => handleUpdateStrategy('demandBased', { highDemandMarkup: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                                <div>
                                                    <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Demand Threshold (Recent Bookings)</label>
                                                    <input type="number" className="admin-filter-input" value={pricingStrategies.demandBased?.demandThreshold || 0} onChange={e => handleUpdateStrategy('demandBased', { demandThreshold: parseInt(e.target.value) || 0 })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Other strategies can be added easily based on this pattern */}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ====== COMMISSION SECTION ====== */}
                    {activeSection === 'commission' && (
                        <>
                            {commissionData === null && !commissionLoading && (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <button className="action-btn view" onClick={async () => {
                                        setCommissionLoading(true);
                                        try {
                                            const res = await getCommissionStats();
                                            if (res?.success) setCommissionData(res);
                                        } catch (err) { console.error(err); }
                                        finally { setCommissionLoading(false); }
                                    }}>
                                        <TrendingUp size={14} /> Load Commission Data
                                    </button>
                                </div>
                            )}
                            {commissionLoading && (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <div className="admin-spinner" style={{ margin: '0 auto' }} />
                                    <p className="admin-loading-text">Loading commission data...</p>
                                </div>
                            )}
                            {commissionData && (
                                <>
                                    {/* Commission KPI Cards */}
                                    <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
                                        <div className="kpi-card purple">
                                            <div className="kpi-card-header">
                                                <div>
                                                    <div className="kpi-card-value">{formatCurrency(commissionData.commission?.totalCommission)}</div>
                                                    <div className="kpi-card-label">Total Commission Earned</div>
                                                </div>
                                                <div className="kpi-card-icon"><TrendingUp size={20} /></div>
                                            </div>
                                        </div>
                                        <div className="kpi-card green">
                                            <div className="kpi-card-header">
                                                <div>
                                                    <div className="kpi-card-value">{commissionData.commission?.totalBookingsWithCommission || 0}</div>
                                                    <div className="kpi-card-label">Bookings with Commission</div>
                                                </div>
                                                <div className="kpi-card-icon"><ShoppingBag size={20} /></div>
                                            </div>
                                        </div>
                                        <div className="kpi-card blue">
                                            <div className="kpi-card-header">
                                                <div>
                                                    <div className="kpi-card-value">{formatCurrency(commissionData.commission?.avgCommissionPerBooking)}</div>
                                                    <div className="kpi-card-label">Avg Commission / Booking</div>
                                                </div>
                                                <div className="kpi-card-icon"><DollarSign size={20} /></div>
                                            </div>
                                        </div>
                                        <div className="kpi-card orange">
                                            <div className="kpi-card-header">
                                                <div>
                                                    <div className="kpi-card-value">{commissionData.currentMarkup?.percentage || 0}%</div>
                                                    <div className="kpi-card-label">Current Markup Rate</div>
                                                </div>
                                                <div className="kpi-card-icon"><Percent size={20} /></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Commission Chart */}
                                    <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                                        <div className="widget-card-header">
                                            <div className="widget-card-title"><BarChart3 /> Monthly Commission</div>
                                            <span className="widget-card-badge">Last 6 months</span>
                                        </div>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={commissionData.commission?.monthlyCommission || []}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickFormatter={v => `₹${v}`} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="commission" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Commission" />
                                                    <Bar dataKey="revenue" fill="#22c55e" radius={[6, 6, 0, 0]} name="Revenue" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Commission Details Toggle */}
                                    <div className="widget-card">
                                        <div className="widget-card-header">
                                            <div className="widget-card-title"><DollarSign /> Commission Bookings</div>
                                            <button className="action-btn view" onClick={() => setShowCommissionDetails(!showCommissionDetails)}>
                                                <Eye size={12} /> {showCommissionDetails ? 'Hide' : 'Show'} Details
                                            </button>
                                        </div>

                                        {showCommissionDetails && commissionData.commission?.bookings?.length > 0 ? (
                                            <div className="admin-table-scroll" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Hotel</th>
                                                            <th>Guest</th>
                                                            <th>Original</th>
                                                            <th>Charged</th>
                                                            <th>Commission</th>
                                                            <th>Markup %</th>
                                                            <th>Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {commissionData.commission.bookings.map((b, i) => (
                                                            <tr key={i}>
                                                                <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {b.hotelName}
                                                                </td>
                                                                <td style={{ fontSize: '0.75rem' }}>
                                                                    <div>{b.guestName}</div>
                                                                    <div style={{ color: '#64748b' }}>{b.guestEmail}</div>
                                                                </td>
                                                                <td style={{ color: '#94a3b8' }}>{formatCurrency(b.originalAmount)}</td>
                                                                <td style={{ color: '#22c55e', fontWeight: 600 }}>{formatCurrency(b.chargedAmount)}</td>
                                                                <td style={{ color: '#8b5cf6', fontWeight: 700 }}>{formatCurrency(b.markupAmount)}</td>
                                                                <td>{b.markupPercentage}%</td>
                                                                <td style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatDate(b.date)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : showCommissionDetails ? (
                                            <div className="admin-empty"><p>No commission bookings yet. Start by enabling markup and having users make bookings.</p></div>
                                        ) : (
                                            <div className="admin-empty" style={{ padding: '1rem' }}>
                                                <p>Click "Show Details" to see per-booking commission breakdown.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {activeSection === 'balance' && (
                        <>
                            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
                                <div className="kpi-card green">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {balance ? formatCurrency(balance.cashBalance) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Cash Balance</div>
                                        </div>
                                        <div className="kpi-card-icon"><Wallet size={20} /></div>
                                    </div>
                                </div>

                                <div className="kpi-card blue">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {balance ? formatCurrency(balance.creditBalance) : '—'}
                                            </div>
                                            <div className="kpi-card-label">Credit Balance</div>
                                        </div>
                                        <div className="kpi-card-icon"><CreditCard size={20} /></div>
                                    </div>
                                </div>

                                <div className="kpi-card purple">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">
                                                {balance?.agencyTypeName || '—'}
                                            </div>
                                            <div className="kpi-card-label">Agency Type</div>
                                        </div>
                                        <div className="kpi-card-icon"><Hotel size={20} /></div>
                                    </div>
                                </div>

                                <div className="kpi-card cyan">
                                    <div className="kpi-card-header">
                                        <div>
                                            <div className="kpi-card-value">{formatCurrency(stats?.totalRevenue)}</div>
                                            <div className="kpi-card-label">Total Revenue</div>
                                        </div>
                                        <div className="kpi-card-icon"><DollarSign size={20} /></div>
                                    </div>
                                </div>
                            </div>

                            {balanceError && (
                                <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', color: '#f59e0b' }}>
                                        <AlertTriangle size={20} />
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Balance Unavailable</div>
                                            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                                Could not fetch agency balance from TBO API. This may be due to authentication issues or API downtime.
                                                Try clicking "Refresh" to retry.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Revenue chart in balance page */}
                            <div className="widget-card">
                                <div className="widget-card-header">
                                    <div className="widget-card-title"><TrendingUp /> Revenue vs Bookings (6 months)</div>
                                </div>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats?.monthlyData || []}>
                                            <defs>
                                                <linearGradient id="balRevGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                                            <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#balRevGrad)" strokeWidth={2} name="Revenue (₹)" />
                                            <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Total Bookings" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ====== CHAT SUPPORT SECTION ====== */}
                    {activeSection === 'chat' && (
                        <AdminChatSection currentUser={currentUser} userData={userData} />
                    )}
                </div>
            </div>

            {/* ====== CANCEL BOOKING MODAL ====== */}
            {cancelModal.open && (
                <div className="modal-overlay" onClick={() => !cancelLoading && setCancelModal({ open: false, booking: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-title">Cancel Booking</div>
                        <div className="modal-desc">
                            Are you sure you want to cancel the booking at <strong>{cancelModal.booking?.hotelInfo?.hotelName || cancelModal.booking?.hotelInfo?.HotelName || 'this hotel'}</strong>?
                            <br />TBO Booking ID: <strong>{cancelModal.booking?.tboResponse?.bookingId || 'N/A'}</strong>
                        </div>
                        <textarea
                            className="modal-input"
                            placeholder="Enter reason for cancellation..."
                            value={cancelRemarks}
                            onChange={e => setCancelRemarks(e.target.value)}
                        />
                        <div className="modal-actions">
                            <button className="modal-btn secondary" onClick={() => setCancelModal({ open: false, booking: null })} disabled={cancelLoading}>
                                Cancel
                            </button>
                            <button className="modal-btn danger" onClick={handleCancelBooking} disabled={cancelLoading || !cancelRemarks.trim()}>
                                {cancelLoading ? 'Processing...' : 'Confirm Cancellation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== CANCELLATION STATUS MODAL ====== */}
            {statusModal.open && (
                <div className="modal-overlay" onClick={() => setStatusModal({ open: false, data: null, loading: false })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-title">Cancellation Status</div>
                        {statusModal.loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <div className="admin-spinner" style={{ margin: '0 auto' }} />
                                <p className="admin-loading-text">Fetching status...</p>
                            </div>
                        ) : statusModal.data?.error ? (
                            <div className="modal-desc" style={{ color: '#ef4444' }}>
                                Error: {statusModal.data.error}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                                <p><strong>Status:</strong> {statusModal.data?.ChangeRequestStatus || statusModal.data?.status || 'N/A'}</p>
                                <p><strong>Refund Amount:</strong> {formatCurrency(statusModal.data?.RefundAmount || statusModal.data?.refundAmount)}</p>
                                <p><strong>Cancellation Charges:</strong> {formatCurrency(statusModal.data?.CancellationCharges || statusModal.data?.cancellationCharges)}</p>
                                <p><strong>Remarks:</strong> {statusModal.data?.Remarks || statusModal.data?.remarks || 'N/A'}</p>
                            </div>
                        )}
                        <div className="modal-actions" style={{ marginTop: '1rem' }}>
                            <button className="modal-btn secondary" onClick={() => setStatusModal({ open: false, data: null, loading: false })}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
