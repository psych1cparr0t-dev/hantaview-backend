const NodeCache = require('node-cache');
const logger = require('../utils/logger');

const KEYS = {
  CASES: 'cases',
  STATS: 'stats',
  OUTBREAK_MV_HONDIUS: 'outbreak:mv_hondius',
  SOURCE_STATUS: 'source:status',
};

const TTL = {
  CASES: Number(process.env.CACHE_TTL_CASES) || 3600,
  STATS: Number(process.env.CACHE_TTL_STATS) || 1800,
  OUTBREAK: Number(process.env.CACHE_TTL_OUTBREAK) || 86400,
  SOURCE_STATUS: Number(process.env.CACHE_TTL_SOURCE_STATUS) || 300,
};

const cache = new NodeCache({ useClones: false });

function get(key) {
  return cache.get(key) ?? null;
}

function set(key, value, ttl) {
  cache.set(key, value, ttl);
  logger.debug({ message: 'Cache set', key, ttl });
}

function del(key) {
  cache.del(key);
}

function flush() {
  cache.flushAll();
  logger.info('Cache flushed');
}

function getAge(key) {
  const ttl = cache.getTtl(key);
  if (!ttl) return null;
  const remainingMs = ttl - Date.now();
  const originalTtl = getTtlForKey(key);
  return originalTtl - Math.ceil(remainingMs / 1000);
}

function getTtlForKey(key) {
  if (key === KEYS.CASES) return TTL.CASES;
  if (key === KEYS.STATS) return TTL.STATS;
  if (key.startsWith('outbreak')) return TTL.OUTBREAK;
  return TTL.SOURCE_STATUS;
}

function getStats() {
  return cache.getStats();
}

module.exports = { get, set, del, flush, getAge, getStats, KEYS, TTL };
