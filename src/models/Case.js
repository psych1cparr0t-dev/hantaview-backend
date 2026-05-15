const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { STRAINS, SOURCES, COUNTRY_CODE_MAP, REGION_COORDINATES, COUNTRY_COORDINATES } = require('../config/constants');

const CaseSchema = z.object({
  id: z.string().uuid().optional(),
  location: z.string().min(1),
  country: z.string().min(1),
  country_code: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  confirmed: z.number().int().min(0).default(0),
  probable: z.number().int().min(0).default(0),
  inconclusive: z.number().int().min(0).default(0),
  deaths: z.number().int().min(0).default(0),
  strain: z.enum(Object.values(STRAINS)).default(STRAINS.OTHER),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum([...Object.values(SOURCES)]).default(SOURCES.MANUAL),
  verified: z.boolean().default(false),
  notes: z.string().optional(),
  source_url: z.string().url().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

function resolveCoordinates(location, countryCode) {
  const key = (location || '').toLowerCase().trim();

  if (REGION_COORDINATES[key]) return REGION_COORDINATES[key];

  // Partial match on region
  for (const [region, coords] of Object.entries(REGION_COORDINATES)) {
    if (key.includes(region) || region.includes(key.split(',')[0])) {
      return coords;
    }
  }

  if (countryCode && COUNTRY_COORDINATES[countryCode]) {
    return COUNTRY_COORDINATES[countryCode];
  }

  return null;
}

function normalizeCountryCode(country) {
  if (!country) return null;
  const key = country.toLowerCase().trim();
  return COUNTRY_CODE_MAP[key] || null;
}

function normalizeDate(rawDate) {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function createCase(raw) {
  const country_code = raw.country_code || normalizeCountryCode(raw.country);
  const now = new Date().toISOString();

  let latitude = raw.latitude;
  let longitude = raw.longitude;

  if (latitude == null || longitude == null) {
    const coords = resolveCoordinates(raw.location, country_code);
    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
    }
  }

  const normalized = {
    id: raw.id || uuidv4(),
    location: raw.location,
    country: raw.country,
    country_code,
    latitude,
    longitude,
    confirmed: Number(raw.confirmed) || 0,
    probable: Number(raw.probable) || 0,
    inconclusive: Number(raw.inconclusive) || 0,
    deaths: Number(raw.deaths) || 0,
    strain: raw.strain || STRAINS.OTHER,
    date: normalizeDate(raw.date) || raw.date,
    source: raw.source || SOURCES.MANUAL,
    verified: raw.verified !== undefined ? raw.verified : false,
    notes: raw.notes || undefined,
    source_url: raw.source_url || undefined,
    created_at: raw.created_at || now,
    updated_at: raw.updated_at || now,
  };

  return CaseSchema.parse(normalized);
}

module.exports = { createCase, CaseSchema, normalizeCountryCode, normalizeDate, resolveCoordinates };
