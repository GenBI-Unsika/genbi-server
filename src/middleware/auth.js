import { HttpError } from '../lib/errors.js';
import { verifyAccessToken } from '../auth/tokens.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing Authorization Bearer token'));
  }

  try {
    const decoded = verifyAccessToken(token);
    req.auth = {
      userId: decoded.sub,
      role: decoded.role,
    };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
    if (!roles.includes(req.auth.role)) return next(new HttpError(403, 'Forbidden'));
    return next();
  };
}
