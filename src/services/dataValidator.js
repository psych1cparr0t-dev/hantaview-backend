const { createCase } = require('../models/Case');
const { ValidationError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

function validateAndNormalize(rawCases, source) {
  const valid = [];
  const errors = [];

  for (const raw of rawCases) {
    try {
      if (!raw.location && !raw.country) {
        throw new ValidationError('Missing location and country', 'location');
      }
      if (raw.confirmed == null && raw.probable == null) {
        throw new ValidationError('No case counts provided', 'confirmed');
      }
      if (!raw.date) {
        throw new ValidationError('Missing date', 'date');
      }
      if (raw.latitude != null && (raw.latitude < -90 || raw.latitude > 90)) {
        throw new ValidationError(`Invalid latitude: ${raw.latitude}`, 'latitude');
      }
      if (raw.longitude != null && (raw.longitude < -180 || raw.longitude > 180)) {
        throw new ValidationError(`Invalid longitude: ${raw.longitude}`, 'longitude');
      }

      const normalized = createCase({ ...raw, source });

      // After coordinate resolution, verify we have valid coords
      if (normalized.latitude == null || normalized.longitude == null) {
        logger.warn({ message: 'Could not resolve coordinates', location: raw.location });
        // Still include the case — just log the warning
      }

      valid.push(normalized);
    } catch (err) {
      errors.push({ raw, error: err.message });
      logger.warn({ message: 'Case validation failed', error: err.message, raw });
    }
  }

  if (errors.length > 0) {
    logger.warn({ message: `Validation: ${errors.length} of ${rawCases.length} cases rejected from ${source}` });
  }

  return valid;
}

module.exports = { validateAndNormalize };
