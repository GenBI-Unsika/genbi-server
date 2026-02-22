import { HttpError } from '../lib/errors.js';
import { verifyAccessToken } from '../auth/tokens.js';

const ROLE_HIERARCHY = {
  super_admin: 5,
  admin: 4,
  awardee: 3,
  member: 3, // nama beken buat mahasiswa yg dapet beasiswa (GenBI aktif)
  alumni: 1,
  user: 0,
};

const ADMIN_ROLES = ['super_admin', 'admin'];

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing Authorization Bearer token'));
  }

  try {
    const decoded = verifyAccessToken(token);

    const userId = Number.parseInt(String(decoded.sub), 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return next(new HttpError(401, 'Invalid access token subject'));
    }

    req.auth = {
      userId,
      role: decoded.role, // Anggap aja token skrg udh bawa info string nama role-nya
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

// Pastiin ini user punya kuasa admin (super_admin ato admin biasa)
export function requireAdminAccess(req, _res, next) {
  if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
  if (!ADMIN_ROLES.includes(req.auth.role)) {
    return next(new HttpError(403, 'Akses ditolak. Anda tidak memiliki hak akses admin.'));
  }
  return next();
}

// Pastiin ini beneran the real super_admin
export function requireSuperAdmin(req, _res, next) {
  if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
  if (req.auth.role !== 'super_admin') {
    return next(new HttpError(403, 'Akses ditolak. Hanya super admin yang diizinkan.'));
  }
  return next();
}

// Pastiin pangkat user ini cukup buat msk ke mari
export function requireMinRole(minRole) {
  return (req, _res, next) => {
    if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
    const userLevel = ROLE_HIERARCHY[req.auth.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 999;
    if (userLevel < requiredLevel) {
      return next(new HttpError(403, 'Insufficient permissions'));
    }
    return next();
  };
}

export { ADMIN_ROLES, ROLE_HIERARCHY };
