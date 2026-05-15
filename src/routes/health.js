const express = require('express');
const { getSourceStatus } = require('../services/aggregator');
const cache = require('../cache/cacheManager');

const router = express.Router();
const startTime = Date.now();

router.get('/', (req, res) => {
  const sourceStatus = getSourceStatus();
  const cacheStats = cache.getStats();
  const lastCasesUpdate = cache.get(cache.KEYS.CASES)?.last_updated || null;

  const anySourceHealthy = Object.values(sourceStatus).some(s => s.status === 'success');
  const status = anySourceHealthy || lastCasesUpdate ? 'healthy' : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    cache_status: cacheStats.keys > 0 ? 'active' : 'empty',
    cache_hits: cacheStats.hits,
    cache_misses: cacheStats.misses,
    last_data_sync: lastCasesUpdate,
    sources: sourceStatus,
  });
});

module.exports = router;
