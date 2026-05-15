const express = require('express');
const { refreshAllCases } = require('../services/aggregator');
const cache = require('../cache/cacheManager');
const logger = require('../utils/logger');

const router = express.Router();

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.admin_key;
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden',
      error_code: 'AUTH_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

router.post('/refresh', requireAdminKey, async (req, res, next) => {
  try {
    logger.info({ message: 'Manual cache refresh triggered', ip: req.ip });
    cache.flush();
    const result = await refreshAllCases();

    res.json({
      status: 'success',
      message: 'Cache refreshed',
      case_count: result?.cases?.length ?? 0,
      last_updated: result?.last_updated ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/cache', requireAdminKey, (req, res) => {
  cache.flush();
  logger.info({ message: 'Cache cleared via admin endpoint', ip: req.ip });
  res.json({ status: 'success', message: 'Cache cleared' });
});

module.exports = router;
