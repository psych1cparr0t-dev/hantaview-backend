const express = require('express');
const { z } = require('zod');
const { getCases } = require('../services/aggregator');
const { STRAINS } = require('../config/constants');
const cache = require('../cache/cacheManager');

const router = express.Router();

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2099).optional(),
  strain: z.enum([...Object.values(STRAINS)]).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  cache: z.enum(['true', 'false']).default('true'),
});

router.get('/', async (req, res, next) => {
  try {
    const query = QuerySchema.parse(req.query);
    const useCache = query.cache !== 'false';

    const { cases, last_updated } = await getCases(useCache);

    let filtered = cases;

    if (query.year) {
      filtered = filtered.filter(c => c.date?.startsWith(String(query.year)));
    }
    if (query.strain) {
      filtered = filtered.filter(c => c.strain === query.strain);
    }
    if (query.country) {
      filtered = filtered.filter(c => c.country_code === query.country);
    }

    const total = filtered.length;
    const paginated = filtered.slice(query.offset, query.offset + query.limit);
    const cacheAge = cache.getAge(cache.KEYS.CASES);

    res.json({
      status: 'success',
      data: paginated,
      count: total,
      last_updated,
      cache_age_seconds: cacheAge,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid query parameters',
        error_code: 'VALIDATION_ERROR',
        details: err.errors,
        timestamp: new Date().toISOString(),
      });
    }
    next(err);
  }
});

module.exports = router;
