export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(req, _res, next) {
  next(new HttpError(404, 'Endpoint tidak ditemukan.'));
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const payload = {
    error: {
      message: statusCode >= 500 ? (isProd ? 'Terjadi kesalahan pada server. Silakan coba lagi.' : err?.message || 'Terjadi kesalahan pada server.') : err?.message || 'Terjadi kesalahan.',
      code: err?.code,
      details: err?.details,
      ...(statusCode >= 500 && !isProd && err?.stack ? { stack: String(err.stack) } : {}),
    },
  };

  if (statusCode >= 500) {
    // avoid leaking stack traces to clients
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json(payload);
}
