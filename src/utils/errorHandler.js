const logger = require('./logger');

class DataFetchError extends Error {
  constructor(source, message, cause) {
    super(message);
    this.name = 'DataFetchError';
    this.source = source;
    this.cause = cause;
    this.code = 'FETCH_ERROR';
  }
}

class ParsingError extends Error {
  constructor(source, message, cause) {
    super(message);
    this.name = 'ParsingError';
    this.source = source;
    this.cause = cause;
    this.code = 'PARSE_ERROR';
  }
}

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = 'VALIDATION_ERROR';
  }
}

class CacheError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CacheError';
    this.cause = cause;
    this.code = 'CACHE_ERROR';
  }
}

function errorMiddleware(err, req, res, next) {
  const timestamp = new Date().toISOString();

  logger.error({
    message: err.message,
    code: err.code || 'INTERNAL_ERROR',
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: err.message,
      error_code: err.code,
      timestamp,
    });
  }

  if (err.name === 'DataFetchError') {
    return res.status(503).json({
      status: 'error',
      message: `Data source temporarily unavailable: ${err.source}`,
      error_code: err.code,
      timestamp,
    });
  }

  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    error_code: err.code || 'INTERNAL_ERROR',
    timestamp,
  });
}

module.exports = { DataFetchError, ParsingError, ValidationError, CacheError, errorMiddleware };
