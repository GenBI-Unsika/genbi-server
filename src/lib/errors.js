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

  // body-parser / express.json errors often use `status` instead of `statusCode`
  if (statusCode === 500 && err?.status && Number.isInteger(err.status)) {
    statusCode = err.status;
  }

  // Payload too large
  if (statusCode === 500 && (err?.type === 'entity.too.large' || err?.name === 'PayloadTooLargeError')) {
    statusCode = 413;
  }

  // Invalid JSON payload
  // body-parser sets `status`=400 for JSON syntax errors
  if (statusCode === 500 && err instanceof SyntaxError && (err?.status === 400 || err?.statusCode === 400) && 'body' in err) {
    statusCode = 400;
  }

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
        statusCode === 413
          ? 'Payload terlalu besar. Mohon kecilkan ukuran data/file lalu coba lagi.'
          : statusCode === 400 && err instanceof SyntaxError
            ? 'Format JSON tidak valid. Coba refresh halaman lalu kirim ulang.'
            : statusCode === 503
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
