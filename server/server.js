const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const hotelRoutes = require('./routes/hotelRoutes');
const syncRoutes = require('./routes/syncRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: [
    "https://zovotel.com",
    "http://localhost:3000"
  ],
  credentials: true
}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/hotels', hotelRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'TBO Hotels Proxy Server'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('TBO Hotels Proxy Server Started');
  console.log('='.repeat(60));
  console.log(`Server running on: http://0.0.0.0:${PORT}`);
  console.log(`Health Check: http://0.0.0.0:${PORT}/health`);
  console.log('='.repeat(60));

  // Initialize hotels table and backfill from existing static_cache
  const mysqlDataService = require('./services/mysqlDataService');
  mysqlDataService.ensureHotelsTable()
    .then(() => mysqlDataService.backfillFromStaticCache())
    .catch(err => console.error('Database initialization/backfill warning:', err.message));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
