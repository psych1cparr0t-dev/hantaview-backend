const axios = require('axios');
const { DataFetchError, ParsingError } = require('../utils/errorHandler');
const { validateAndNormalize } = require('./dataValidator');
const { STRAINS, SOURCES } = require('../config/constants');
const logger = require('../utils/logger');

// CDC NNDSS datasets by year (Socrata API). Most recent confirmed dataset is 2022.
// tfcp-ufzp = 2022, chmz-4uae = 2021, a9xa-yrhn = 2020
const NNDSS_DATASET_ID = 'tfcp-ufzp';
const CDC_API_BASE = 'https://data.cdc.gov/resource';

// US state/territory names to skip (non-geographic aggregates)
const SKIP_AREAS = new Set([
  'TOTAL', 'US RESIDENTS', 'NON-US RESIDENTS', 'UNITED STATES',
  'NEW ENGLAND', 'MID. ATLANTIC', 'E.N. CENTRAL', 'W.N. CENTRAL',
  'S. ATLANTIC', 'E.S. CENTRAL', 'W.S. CENTRAL', 'MOUNTAIN', 'PACIFIC',
  'WEST NORTH CENTRAL', 'EAST NORTH CENTRAL', 'WEST SOUTH CENTRAL',
  'EAST SOUTH CENTRAL', 'MIDDLE ATLANTIC', 'SOUTH ATLANTIC',
  'NEW ENGLAND', 'N.E.', 'MID-ATL',
]);

async function fetchCDCCases() {
  logger.info('Fetching CDC NNDSS hantavirus data via Socrata API');

  let rows;
  try {
    // Use encoded $ to avoid axios double-encoding; $select avoided for compat
    const res = await axios.get(
      `${CDC_API_BASE}/${NNDSS_DATASET_ID}.json?%24limit=2000`,
      {
        timeout: Number(process.env.CDC_TIMEOUT) || 10000,
        headers: { 'X-App-Token': process.env.CDC_APP_TOKEN || '' },
      }
    );
    rows = res.data;
  } catch (err) {
    throw new DataFetchError(SOURCES.CDC, `CDC API request failed: ${err.message}`, err);
  }

  if (!Array.isArray(rows)) {
    throw new ParsingError(SOURCES.CDC, 'CDC API returned non-array response');
  }

  return parseCDCRows(rows);
}

function parseCDCRows(rows) {
  // Get best (highest-week) row per reporting area, with non-zero HPS count
  const best = new Map();

  for (const row of rows) {
    if (typeof row !== 'object' || !row) continue;

    const area = (row.reporting_area || '').trim().toUpperCase();
    if (!area || SKIP_AREAS.has(area)) continue;

    const hps = toInt(row.hantavirus_pulmonary_syndrome_2) + toInt(row.hantavirus_pulmonary_syndrome_1);
    const nonHps = toInt(row.hantavirus_infection_non_2) + toInt(row.hantavirus_infection_non_1);
    if (hps <= 0) continue; // Only include areas with confirmed HPS cases

    const week = toInt(row.mmwr_week);
    const existing = best.get(area);
    if (!existing || week > existing.week) {
      best.set(area, { row, week, hps, nonHps });
    }
  }

  const rawCases = [];
  for (const [area, { row, hps, nonHps }] of best.entries()) {
    const coords = row.tableoneo?.coordinates; // [lng, lat] in GeoJSON order
    const year = row.mmwr_year || new Date().getFullYear().toString();

    rawCases.push({
      location: titleCase(area) + ', USA',
      country: 'USA',
      country_code: 'US',
      latitude: coords ? coords[1] : null,
      longitude: coords ? coords[0] : null,
      confirmed: hps,
      probable: nonHps,
      strain: STRAINS.SIN_NOMBRE,
      date: `${year}-01-01`,
      source: SOURCES.CDC,
      verified: true,
      source_url: `https://data.cdc.gov/d/${NNDSS_DATASET_ID}`,
      notes: `NNDSS cumulative ${year} data`,
    });
  }

  logger.info({ message: `CDC API: ${rawCases.length} state-level entries` });
  return rawCases;
}

function toInt(val) {
  if (val == null || val === '-' || val === 'N' || val === '') return 0;
  const n = parseInt(String(val).replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function getCDCCases() {
  const raw = await fetchCDCCases();
  return validateAndNormalize(raw, SOURCES.CDC);
}

module.exports = { getCDCCases, parseCDCRows };
