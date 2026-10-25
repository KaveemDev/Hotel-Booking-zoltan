/**
 * Auth middleware
 * Verifies the Firebase ID token sent by the client as `Authorization: Bearer <token>`.
 * Admin rules match the client (AuthContext): role admin/support in MySQL, or a listed admin email.
 */

const { admin } = require('../config/firebaseAdmin');
const db = require('../config/db');

const ADMIN_EMAILS = ['admin@zovotel.com', 'admin@zoltan.com'];

const readUser = async (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    try {
        const decoded = await admin.auth().verifyIdToken(header.slice(7));
        const [rows] = await db.execute('SELECT role FROM users WHERE uid = ?', [decoded.uid]);
        const role = rows[0]?.role;
        return {
            uid: decoded.uid,
            email: (decoded.email || '').toLowerCase(),
            isAdmin: role === 'admin' || role === 'support' || ADMIN_EMAILS.includes((decoded.email || '').toLowerCase())
        };
    } catch (err) {
        return null;
    }
};

// Sets req.user when a valid token is present, never rejects
exports.optionalAuth = async (req, res, next) => {
    req.user = await readUser(req);
    next();
};

exports.requireAuth = async (req, res, next) => {
    req.user = await readUser(req);
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
    next();
};

exports.requireAdmin = async (req, res, next) => {
    req.user = await readUser(req);
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
};

// For /:uid routes and bodies carrying a uid: only that user (or an admin) may act
exports.requireSelf = (getUid) => async (req, res, next) => {
    req.user = await readUser(req);
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
    if (!req.user.isAdmin && getUid(req) !== req.user.uid) {
        return res.status(403).json({ error: 'Not allowed' });
    }
    next();
};

// True when the TBO booking belongs to the signed-in user (linked account or matching contact email)
exports.ownsTboBooking = async (user, tboBookingId) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    const [rows] = await db.execute(
        `SELECT b.order_id, b.contact_details, ub.user_id
         FROM bookings b LEFT JOIN user_bookings ub ON ub.order_id = b.order_id
         WHERE b.tbo_booking_id = ?`,
        [String(tboBookingId)]
    );
    return rows.some(r => {
        if (r.user_id === user.uid) return true;
        const contact = typeof r.contact_details === 'string' ? JSON.parse(r.contact_details || 'null') : r.contact_details;
        return !!user.email && contact?.email?.toLowerCase() === user.email;
    });
};
