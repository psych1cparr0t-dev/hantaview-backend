const express = require('express');
const { getCases } = require('../services/aggregator');
const { STRAINS, SOURCES } = require('../config/constants');
const cache = require('../cache/cacheManager');

const router = express.Router();

function computeStats(cases) {
  const strainCounts = Object.fromEntries(Object.values(STRAINS).map(s => [s, 0]));
  const sourceCounts = {};
  const countries = new Set();
  const locations = new Set();

  let total_confirmed = 0;
  let total_probable = 0;
  let total_deaths = 0;

  for (const c of cases) {
    total_confirmed += c.confirmed || 0;
    total_probable += c.probable || 0;
    total_deaths += c.deaths || 0;

    if (c.strain && strainCounts[c.strain] !== undefined) {
      strainCounts[c.strain] += (c.confirmed || 0) + (c.probable || 0);
    }

    const sources = c.source_list || [c.source];
    for (const src of sources) {
      if (src && src !== SOURCES.MERGED) {
        sourceCounts[src] = (sourceCounts[src] || 0) + (c.confirmed || 0);
      }
    }

    if (c.country_code) countries.add(c.country_code);
    if (c.location) locations.add(c.location);
  }

  return {
    total_confirmed,
    total_probable,
    total_deaths,
    active_countries: countries.size,
    active_locations: locations.size,
    strains: strainCounts,
    by_source: sourceCounts,
  };
}

router.get('/', async (req, res, next) => {
  try {
    // Check stats cache first
    const cachedStats = cache.get(cache.KEYS.STATS);
    if (cachedStats) {
      return res.json({
        status: 'success',
        data: cachedStats.data,
        last_updated: cachedStats.last_updated,
        cache_age_seconds: cache.getAge(cache.KEYS.STATS),
      });
    }

    const { cases, last_updated } = await getCases(true);
    const stats = computeStats(cases);

    cache.set(cache.KEYS.STATS, { data: stats, last_updated }, cache.TTL.STATS);

    res.json({
      status: 'success',
      data: stats,
      last_updated,
      cache_age_seconds: 0,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
