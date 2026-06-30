import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ data: null, error: { message: 'Route not found' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Prisma known errors -> friendlier responses.
  if (err.code === 'P2002') {
    statusCode = 409;
    message = `Duplicate value for unique field: ${err.meta?.target}`;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  } else if (err.code === 'P2003') {
    statusCode = 409;
    message = 'Cannot delete: this record is still referenced by other data.';
  }

  if (statusCode >= 500 && !env.isProd) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    data: null,
    error: { message, ...(details ? { details } : {}) },
  });
}
