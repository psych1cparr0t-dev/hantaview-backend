const { getCDCCases } = require('./cdc.service');
const { getWHOCases } = require('./who.service');
const { getECDCCases } = require('./ecdc.service');
const { deduplicateCases } = require('../utils/deduplicator');
const { MV_HONDIUS_OUTBREAK } = require('../config/constants');
const cache = require('../cache/cacheManager');
const logger = require('../utils/logger');
const { runAlertCheck } = require('./alertChecker');

// Per-source status tracking (in-memory, not persisted across restarts)
const sourceStatus = {
  cdc: { last_sync: null, status: 'pending', case_count: 0, error_message: null },
  who: { last_sync: null, status: 'pending', case_count: 0, error_message: null },
  ecdc: { last_sync: null, status: 'pending', case_count: 0, error_message: null },
};

async function fetchFromSource(name, fetchFn) {
  try {
    const cases = await fetchFn();
    sourceStatus[name] = {
      last_sync: new Date().toISOString(),
      status: 'success',
      case_count: cases.length,
      error_message: null,
    };
    return cases;
  } catch (err) {
    logger.error({ message: `Source ${name} failed`, error: err.message });
    sourceStatus[name] = {
      last_sync: new Date().toISOString(),
      status: 'failed',
      case_count: 0,
      error_message: err.message,
    };
    return [];
  }
}

async function refreshAllCases() {
  logger.info('Starting data refresh from all sources');

  // Fetch all three sources concurrently; failures are isolated per source
  const [cdcCases, whoCases, ecdcCases] = await Promise.all([
    fetchFromSource('cdc', getCDCCases),
    fetchFromSource('who', getWHOCases),
    fetchFromSource('ecdc', getECDCCases),
  ]);

  const combined = [...cdcCases, ...whoCases, ...ecdcCases];

  if (combined.length === 0) {
    logger.warn('All sources returned 0 cases — serving stale cache if available');
    return null;
  }

  const deduplicated = deduplicateCases(combined);
  logger.info({ message: `Aggregated: ${combined.length} raw → ${deduplicated.length} after dedup` });

  const result = {
    cases: deduplicated,
    last_updated: new Date().toISOString(),
  };

  cache.set(cache.KEYS.CASES, result, cache.TTL.CASES);
  cache.set(cache.KEYS.SOURCE_STATUS, sourceStatus, cache.TTL.SOURCE_STATUS);

  // Run alert checks in the background — don't await so the cache refresh
  // returns immediately and a mailer failure can't block the data pipeline.
  runAlertCheck(deduplicated).catch(err => {
    logger.error({ message: 'Alert check threw unexpectedly', error: err.message });
  });

  return result;
}

async function getCases(useCache = true) {
  if (useCache) {
    const cached = cache.get(cache.KEYS.CASES);
    if (cached) {
      logger.debug('Serving cases from cache');
      return cached;
    }
  }

  const fresh = await refreshAllCases();
  if (fresh) return fresh;

  // Graceful degradation: serve stale cache even if TTL expired
  const stale = cache.get(cache.KEYS.CASES);
  if (stale) {
    logger.warn('All sources failed — serving stale cache');
    return stale;
  }

  // Nothing at all
  return { cases: [], last_updated: null };
}

function getSourceStatus() {
  return { ...sourceStatus };
}

function getOutbreakData() {
  const cached = cache.get(cache.KEYS.OUTBREAK_MV_HONDIUS);
  if (cached) return cached;

  const data = { ...MV_HONDIUS_OUTBREAK, retrieved_at: new Date().toISOString() };
  cache.set(cache.KEYS.OUTBREAK_MV_HONDIUS, data, cache.TTL.OUTBREAK);
  return data;
}

module.exports = { getCases, refreshAllCases, getSourceStatus, getOutbreakData };
