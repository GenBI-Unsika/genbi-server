import { isPrismaConnectionError, prismaErrorCode } from './prisma-errors.js';

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
  let statusCode = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  // Normalize common infra failures into clearer HTTP statuses.
  // Prisma may throw initialization/connection errors when DB isn't running.
  const prismaCode = prismaErrorCode(err);
  const looksLikePrismaCantReachDb = isPrismaConnectionError(err) || err?.name === 'PrismaClientInitializationError' || (typeof err?.message === 'string' && err.message.includes("Can't reach database server"));

  if (statusCode >= 500 && looksLikePrismaCantReachDb) {
    statusCode = 503;
  }

  const payload = {
    error: {
      message:
        statusCode === 503
          ? 'Database sedang tidak tersedia. Pastikan database (MySQL) berjalan lalu coba lagi.'
          : statusCode >= 500
            ? isProd
              ? 'Terjadi kesalahan pada server. Silakan coba lagi.'
              : err?.message || 'Terjadi kesalahan pada server.'
            : err?.message || 'Terjadi kesalahan.',
      code: prismaCode || err?.code,
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
