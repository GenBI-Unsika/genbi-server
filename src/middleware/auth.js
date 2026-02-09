import { HttpError } from '../lib/errors.js';
import { verifyAccessToken } from '../auth/tokens.js';

// Hirarki role - role yang lebih tinggi mencakup izin role yang lebih rendah
const ROLE_HIERARCHY = {
  super_admin: 5,
  admin: 4,
  awardee: 3,
  alumni: 1,
};

// Role yang dapat mengakses panel admin
const ADMIN_ROLES = ['super_admin', 'admin'];

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing Authorization Bearer token'));
  }

  try {
    const decoded = verifyAccessToken(token);

    // JWT 'sub' didefinisikan sebagai string. Skema Prisma kami menggunakan ID Int.
    // Konversi ke number di awal agar query Prisma di bawah tidak error.
    const userId = Number.parseInt(String(decoded.sub), 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return next(new HttpError(401, 'Invalid access token subject'));
    }

    req.auth = {
      userId,
      role: decoded.role, // Assuming token payload now contains role name string
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

// Cek jika user memiliki akses level admin (super_admin, admin)
export function requireAdminAccess(req, _res, next) {
  if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
  if (!ADMIN_ROLES.includes(req.auth.role)) {
    return next(new HttpError(403, 'Akses ditolak. Anda tidak memiliki hak akses admin.'));
  }
  return next();
}

// Cek jika user adalah super_admin
export function requireSuperAdmin(req, _res, next) {
  if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
  if (req.auth.role !== 'super_admin') {
    return next(new HttpError(403, 'Akses ditolak. Hanya super admin yang diizinkan.'));
  }
  return next();
}

// Cek jika level role user setidaknya minimum yang ditentukan
export function requireMinRole(minRole) {
  return (req, _res, next) => {
    if (!req.auth?.role) return next(new HttpError(401, 'Unauthenticated'));
    const userLevel = ROLE_HIERARCHY[req.auth.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 999;
    if (userLevel < requiredLevel) {
      return next(new HttpError(403, 'Insufficient permissions'));
    }
    return next();
  };
}

export { ADMIN_ROLES, ROLE_HIERARCHY };
