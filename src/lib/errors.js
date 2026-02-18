import { isPrismaConnectionError, isPrismaMissingTableError, isPrismaUniqueConstraintError, isPrismaValueTooLongError, isPrismaError, prismaErrorCode } from './prisma-errors.js';

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

  // Map common Prisma errors to clearer HTTP statuses.
  // This prevents noisy 500s for expected data/validation issues.
  if (statusCode >= 500) {
    if (isPrismaUniqueConstraintError(err)) {
      statusCode = 409;
    } else if (isPrismaValueTooLongError(err)) {
      statusCode = 400;
    } else if (isPrismaMissingTableError(err)) {
      // DB schema isn't ready (migrations not applied)
      statusCode = 503;
    } else if (isPrismaError(err, 'P2003')) {
      // Foreign key constraint
      statusCode = 409;
    } else if (isPrismaError(err, 'P2025')) {
      // Record not found
      statusCode = 404;
    }
  }

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
            : statusCode === 409
              ? 'Data bentrok dengan data yang sudah ada. Silakan refresh lalu coba lagi.'
              : statusCode === 503
                ? isPrismaMissingTableError(err)
                  ? 'Database belum siap (migrasi belum dijalankan). Hubungi admin/server untuk menjalankan migrasi.'
                  : 'Database sedang tidak tersedia. Pastikan database (MySQL) berjalan lalu coba lagi.'
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

  // Helpful for support/debugging without exposing internals.
  // pino-http attaches request id to `req.id`.
  if (_req?.id) payload.error.requestId = String(_req.id);

  if (statusCode >= 500) {
    // skip console.error for clean logs as per security policy
  }

  // Log the full error server-side (including stack and request id) so
  // container logs contain diagnostic info even when response messages
  // are sanitized for production clients.
  try {
    const rid = _req?.id || null;
    if (_req && typeof _req.log === 'function') {
      _req.log({ err }, 'http_error');
    } else if (_req && _req.log && typeof _req.log.error === 'function') {
      _req.log.error({ err, requestId: rid }, 'http_error');
    } else if (typeof console !== 'undefined' && console.error) {
      console.error('HTTP error', { requestId: rid, err: err && err.stack ? String(err.stack) : String(err) });
    }
  } catch (logErr) {
    try {
      console.error('Failed to log error', String(logErr));
    } catch {
      /* swallow */
    }
  }

  res.status(statusCode).json(payload);
}
