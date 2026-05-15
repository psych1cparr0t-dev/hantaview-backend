require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { errorMiddleware } = require('./utils/errorHandler');
const { refreshAllCases } = require('./services/aggregator');

const casesRouter = require('./routes/cases');
const statsRouter = require('./routes/stats');
const outbreakRouter = require('./routes/outbreak');
const healthRouter = require('./routes/health');
const adminRouter = require('./routes/admin');
const alertsRouter = require('./routes/alerts');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());

// CORS — allow * in production (public read-only API), restrict admin routes separately
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsOptions = {
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key'],
};
app.use(cors(corsOptions));

// Rate limiting — generous for a public health dashboard
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests', error_code: 'RATE_LIMITED' },
});
app.use('/api/', limiter);

app.use(express.json());

// Serve the dashboard at /
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api/cases', casesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/outbreak', outbreakRouter);
app.use('/api/health', healthRouter);
app.use('/api/admin', adminRouter);
app.use('/api/alerts', alertsRouter);

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.path}`,
    error_code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
});

app.use(errorMiddleware);

app.listen(PORT, async () => {
  logger.info({ message: `Hantaview backend running on port ${PORT}`, env: process.env.NODE_ENV });

  // Warm the cache on startup (non-blocking — serve requests while fetching)
  refreshAllCases().catch(err => {
    logger.warn({ message: 'Initial data fetch failed — cache empty until next request', error: err.message });
  });
});

module.exports = app;
