const axios = require('axios');
const xml2js = require('xml2js');
const { DataFetchError, ParsingError } = require('../utils/errorHandler');
const { validateAndNormalize } = require('./dataValidator');
const { STRAINS, SOURCES, COUNTRY_CODE_MAP } = require('../config/constants');
const { normalizeCountryCode, normalizeDate } = require('../models/Case');
const logger = require('../utils/logger');

// WHO retired the DON-specific feed; the general news RSS carries DON items too
const WHO_DON_FEED = 'https://www.who.int/rss-feeds/news-english.xml';

const STRAIN_MAP = {
  'sin nombre': STRAINS.SIN_NOMBRE,
  'snv': STRAINS.SIN_NOMBRE,
  'hps': STRAINS.SIN_NOMBRE,
  'seoul': STRAINS.SEOUL,
  'andes': STRAINS.ANDES,
  'andv': STRAINS.ANDES,
  'puumala': STRAINS.OTHER,
  'hantaan': STRAINS.OTHER,
  'dobrava': STRAINS.OTHER,
};

function inferStrainFromText(text) {
  const lower = (text || '').toLowerCase();
  for (const [keyword, strain] of Object.entries(STRAIN_MAP)) {
    if (lower.includes(keyword)) return strain;
  }
  return STRAINS.OTHER;
}

function extractCaseCount(text, pattern) {
  const match = text.match(pattern);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
}

function extractCountryFromTitle(title) {
  // WHO DON titles: "Disease - Country - Year" or "Disease - Country (Year)"
  const parts = title.split(/[-–—]/).map(p => p.trim());
  // Walk from the end, skip pure-year segments
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].replace(/\s*\(\d{4}\).*$/, '').trim();
    if (part && !/^\d{4}$/.test(part)) {
      return part;
    }
  }
  return null;
}

function parseWHOItem(item) {
  const title = (item.title?.[0] || '').trim();
  const description = (item.description?.[0] || '').trim();
  const pubDate = item.pubDate?.[0];
  const link = item.link?.[0] || '';

  const fullText = `${title} ${description}`;
  const lower = fullText.toLowerCase();

  if (!lower.includes('hantavirus') && !lower.includes('hantaan') && !lower.includes('sin nombre') && !lower.includes('andes virus') && !lower.includes('puumala') && !lower.includes('hps')) {
    return null;
  }

  const country = extractCountryFromTitle(title) || 'Unknown';
  const country_code = normalizeCountryCode(country) || undefined;
  const strain = inferStrainFromText(fullText);

  const confirmed = extractCaseCount(description, /(\d[\d,]*)\s+(?:laboratory[-\s]?confirmed|confirmed)\s+(?:human\s+)?cases?/i)
    || extractCaseCount(description, /(\d[\d,]*)\s+confirmed/i)
    || extractCaseCount(description, /(\d[\d,]*)\s+(?:human\s+)?cases?/i)
    || 1; // At minimum flag the outbreak

  const probable = extractCaseCount(description, /(\d[\d,]*)\s+probable\s+cases?/i);
  const deaths = extractCaseCount(description, /(\d[\d,]*)\s+(?:deaths?|fatalities|fatal cases?)/i);

  const date = normalizeDate(pubDate) || new Date().toISOString().slice(0, 10);

  return {
    location: country,
    country,
    country_code,
    confirmed,
    probable,
    deaths,
    strain,
    date,
    source: SOURCES.WHO,
    verified: true,
    source_url: link,
    notes: description.slice(0, 200),
  };
}

async function fetchWHOCases() {
  logger.info('Fetching WHO Disease Outbreak News RSS feed');

  let xmlData;
  try {
    const res = await axios.get(WHO_DON_FEED, {
      timeout: Number(process.env.WHO_TIMEOUT) || 10000,
      headers: {
        'User-Agent': 'Hantaview-Surveillance-Bot/1.0 (public health data aggregation)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    xmlData = res.data;
  } catch (err) {
    throw new DataFetchError(SOURCES.WHO, `Failed to fetch WHO RSS feed: ${err.message}`, err);
  }

  let parsed;
  try {
    parsed = await xml2js.parseStringPromise(xmlData, { explicitArray: true });
  } catch (err) {
    throw new ParsingError(SOURCES.WHO, `Failed to parse WHO RSS XML: ${err.message}`, err);
  }

  const items = parsed?.rss?.channel?.[0]?.item || [];
  logger.info({ message: `WHO RSS: ${items.length} items found` });

  const rawCases = items
    .map(parseWHOItem)
    .filter(Boolean);

  logger.info({ message: `WHO: ${rawCases.length} hantavirus entries extracted` });
  return rawCases;
}

async function getWHOCases() {
  const raw = await fetchWHOCases();
  return validateAndNormalize(raw, SOURCES.WHO);
}

module.exports = { getWHOCases, parseWHOItem };
