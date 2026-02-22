import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { googleSchema, loginSchema, registerSchema } from '@genbi/contracts';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { env } from '../config/env.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, sha256Base64 } from '../auth/tokens.js';
import { assertAllowedEmailDomain, normalizeEmail } from '../auth/domain.js';
import { hashToken, makeVerifyToken, sendVerifyEmail, verifyExpiresAt } from '../auth/email.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { requireAuth, ADMIN_ROLES } from '../middleware/auth.js';
import { sanitizeProfile } from '../lib/sanitizer.js';

const router = Router();

const REFRESH_COOKIE_NAME = 'genbi_refresh';

function refreshCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  const configuredSameSite = (env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const secureBase = env.COOKIE_SECURE || isProd;
  // SameSite=None membutuhkan Secure; jika tidak secure (misal log dev http), fallback ke lax.
  const sameSite = configuredSameSite === 'none' && !secureBase ? 'lax' : configuredSameSite;

  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : secureBase,
    sameSite,
    path: '/api/v1/auth',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  };
}

function assertEmailVerified(user) {
  if (!env.AUTH_REQUIRE_EMAIL_VERIFIED) return;
  if (user.emailVerifiedAt) return;
  throw new HttpError(403, 'Email belum diverifikasi. Silakan cek inbox/spam untuk verifikasi.');
}

function assertIsAdmin(user) {
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new HttpError(403, 'Akses ditolak. Akun ini tidak memiliki hak admin.');
  }
}

function defaultPasswordFromEmail(email) {
  const raw = String(email || '')
    .trim()
    .toLowerCase();
  const at = raw.indexOf('@');
  if (at <= 0) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const isStudent = domain === 'student.unsika.ac.id' && /^\d{8,}$/.test(local);
  return isStudent ? local : null;
}

async function issueSession(user, req, res) {
  try {
    const roleName = user.role?.name || 'user';
    const accessToken = signAccessToken({ userId: user.id, role: roleName });
    const { token: refreshToken, jti } = signRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash: sha256Base64(refreshToken),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
        status: 'active',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      },
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: roleName,
        profile: sanitizeProfile(user.profile),
      },
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, 'Terjadi kesalahan sistem saat membuat sesi login. Silakan coba beberapa saat lagi.');
  }
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const email = normalizeEmail(body.data.email);
    assertAllowedEmailDomain(email);
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: { include: { division: true } },
        role: true,
      },
    });

    if (!user || !user.isActive) throw new HttpError(401, 'Email atau password salah.');
    assertEmailVerified(user);

    const ok = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!ok) {
      if (user.googleSub) {
        throw new HttpError(401, 'Akun ini dibuat menggunakan Google. Silakan login dengan tombol "Masuk dengan Google" atau set password manual di halaman profil.');
      }
      throw new HttpError(401, 'Email atau password salah.');
    }

    const data = await issueSession(user, req, res);
    res.json({ data });
  }),
);

router.patch(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(8, 'Password minimal 8 karakter'),
      })
      .safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, email: true, isActive: true, passwordHash: true, googleSub: true },
    });

    if (!user || !user.isActive) throw new HttpError(401, 'Akun tidak ditemukan atau tidak aktif.');
    assertAllowedEmailDomain(user.email);

    if (!user.googleSub) {
      if (!body.data.currentPassword) throw new HttpError(400, 'Password lama wajib diisi.');
      const ok = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
      if (!ok) throw new HttpError(401, 'Password lama salah.');
    }

    const passwordHash = await bcrypt.hash(body.data.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ data: { ok: true } });
  }),
);

router.post(
  '/admin/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const email = normalizeEmail(body.data.email);
    assertAllowedEmailDomain(email);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: { include: { division: true } },
        role: true,
      },
    });

    if (!user || !user.isActive) throw new HttpError(401, 'Email atau password salah.');

    const roleName = user.role?.name;
    if (!ADMIN_ROLES.includes(roleName)) {
      throw new HttpError(403, 'Akses ditolak. Akun ini tidak memiliki hak admin.');
    }

    assertEmailVerified(user);

    const ok = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Email atau password salah.');

    const data = await issueSession(user, req, res);
    res.json({ data });
  }),
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const email = normalizeEmail(body.data.email);
    assertAllowedEmailDomain(email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) throw new HttpError(409, 'Email sudah terdaftar. Silakan login.');

    const passwordHash = await bcrypt.hash(body.data.password, 12);
    const token = makeVerifyToken();
    const tokenHash = hashToken(token);
    const expiresAt = verifyExpiresAt();

    const defaultRole = await prisma.role.findUnique({ where: { name: 'user' } });
    if (!defaultRole) throw new HttpError(500, 'Konfigurasi role belum di-seed.');

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        isActive: true,
        profile: body.data.name ? { upsert: { create: { name: body.data.name }, update: { name: body.data.name } } } : undefined,
      },
      create: {
        email,
        passwordHash,
        roleId: defaultRole.id,
        isActive: true,
        profile: body.data.name ? { create: { name: body.data.name } } : undefined,
      },
      include: {
        profile: { include: { division: true } },
        role: true,
      },
    });

    await prisma.emailVerificationToken.upsert({
      where: { userId: user.id },
      update: { tokenHash, expiresAt },
      create: { userId: user.id, tokenHash, expiresAt },
    });

    await sendVerifyEmail({ toEmail: email, token, expiresAt });

    res.status(201).json({ data: { ok: true } });
  }),
);

router.get(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = String(req.query?.token || '');
    if (!token) throw new HttpError(400, 'Token verifikasi tidak ditemukan.');

    const tokenHash = hashToken(token);
    const row = await prisma.emailVerificationToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row) throw new HttpError(400, 'Token verifikasi tidak valid atau sudah kedaluwarsa.');

    if (row.expiresAt <= new Date()) {
      await prisma.emailVerificationToken.delete({ where: { userId: row.userId } });
      throw new HttpError(400, 'Token verifikasi tidak valid atau sudah kedaluwarsa.');
    }

    assertAllowedEmailDomain(row.user.email);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: row.user.emailVerifiedAt || new Date() },
      }),
      prisma.emailVerificationToken.delete({ where: { userId: row.userId } }),
    ]);

    res.json({ data: { ok: true } });
  }),
);

router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const body = googleSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    try {
      const { sub, email, name, givenName, familyName, picture, locale } = await verifyGoogleIdToken(body.data.idToken);

      let user = await prisma.user.findUnique({
        where: { email },
        include: {
          profile: { include: { division: true } },
          role: true,
        },
      });

      if (!user) {
        const initialPassword = defaultPasswordFromEmail(email) || makeVerifyToken();
        const passwordHash = await bcrypt.hash(initialPassword, 12);

        const defaultRole = await prisma.role.findUnique({ where: { name: 'user' } });
        if (!defaultRole) {
          throw new HttpError(500, 'Sistem belum siap untuk menerima pendaftaran baru (Role error). Hubungi administrator.');
        }

        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            googleSub: sub,
            emailVerifiedAt: new Date(),
            roleId: defaultRole.id, // Connect role via ID
            isActive: true,
            profile:
              name || picture
                ? {
                  create: {
                    name: name || null,
                    avatar: picture || null,
                  },
                }
                : undefined,
          },
          include: {
            profile: { include: { division: true } },
            role: true,
          },
        });
      } else {
        if (!user.isActive) throw new HttpError(401, 'Akun dinonaktifkan. Hubungi admin.');
        if (user.googleSub && user.googleSub !== sub) throw new HttpError(409, 'Akun Google tidak cocok dengan akun ini.');

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleSub: user.googleSub ? undefined : sub,
            emailVerifiedAt: user.emailVerifiedAt || new Date(),
            profile: user.profile
              ? {
                update: {
                  avatar: picture ? picture : user.profile.avatar,
                  name: name ? name : user.profile.name,
                },
              }
              : name || picture
                ? {
                  create: {
                    name: name || null,
                    avatar: picture || null,
                  },
                }
                : undefined,
          },
          include: {
            profile: { include: { division: true } },
            role: true,
          },
        });
      }

      const data = await issueSession(user, req, res);
      res.json({ data });
    } catch (error) {
      if (req.log) {
        req.log.error({ err: error, body: req.body }, 'Google Login Error');
      } else {
        console.error('Google Login Error:', error);
      }
      throw error;
    }
  }),
);

router.post(
  '/admin/google',
  asyncHandler(async (req, res) => {
    const body = googleSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    try {
      const { sub, email, name, givenName, familyName, picture, locale } = await verifyGoogleIdToken(body.data.idToken);

      const user0 = await prisma.user.findUnique({
        where: { email },
        include: {
          profile: { include: { division: true } },
          role: true,
        },
      });

      if (!user0) {
        throw new HttpError(401, 'Akun admin tidak ditemukan atau tidak aktif.');
      }
      if (!user0.isActive) {
        throw new HttpError(401, 'Akun admin tidak ditemukan atau tidak aktif.');
      }

      const roleName = user0.role?.name;
      if (!ADMIN_ROLES.includes(roleName)) {
        throw new HttpError(403, `Akses ditolak. Role anda (${roleName}) tidak memiliki hak akses admin.`);
      }

      if (user0.googleSub && user0.googleSub !== sub) {
        throw new HttpError(409, 'Akun Google tidak cocok dengan akun ini.');
      }

      const user = await prisma.user.update({
        where: { id: user0.id },
        data: {
          googleSub: user0.googleSub ? undefined : sub,
          emailVerifiedAt: user0.emailVerifiedAt || new Date(),
          profile: user0.profile
            ? {
              update: {
                avatar: picture ? picture : user0.profile.avatar,
                name: name ? name : user0.profile.name,
              },
            }
            : name || picture
              ? {
                create: {
                  name: name || null,
                  avatar: picture || null,
                },
              }
              : undefined,
        },
        include: {
          profile: { include: { division: true } },
          role: true,
        },
      });

      const data = await issueSession(user, req, res);
      res.json({ data });
    } catch (error) {
      if (req.log) {
        req.log.error({ err: error, body: req.body }, 'Admin Google Login Error');
      } else {
        console.error('Admin Google Login Error:', error);
      }
      throw error;
    }
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) throw new HttpError(401, 'Sesi login tidak ditemukan. Silakan login ulang.');

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, 'Sesi login tidak valid. Silakan login ulang.');
    }

    const jti = decoded.jti;
    const userId = typeof decoded.sub === 'number' ? decoded.sub : Number.parseInt(String(decoded.sub), 10);

    if (!Number.isInteger(userId)) {
      throw new HttpError(401, 'Sesi login tidak valid. Silakan login ulang.');
    }

    const row = await prisma.refreshToken.findUnique({ where: { jti } });
    if (!row) throw new HttpError(401, 'Sesi login sudah berakhir. Silakan login ulang.');

    if (row.userId !== userId) {
      throw new HttpError(401, 'Sesi login tidak valid. Silakan login ulang.');
    }

    const now = new Date();
    if (row.status !== 'active' || row.revokedAt) throw new HttpError(401, 'Sesi login sudah berakhir. Silakan login ulang.');
    if (row.expiresAt <= now) {
      await prisma.refreshToken.update({ where: { jti }, data: { status: 'expired' } });
      throw new HttpError(401, 'Sesi login sudah berakhir. Silakan login ulang.');
    }

    if (row.tokenHash !== sha256Base64(refreshToken)) throw new HttpError(401, 'Sesi login sudah berakhir. Silakan login ulang.');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { division: true } },
        role: true,
      },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'Akun dinonaktifkan. Hubungi admin.');
    assertAllowedEmailDomain(user.email);
    assertEmailVerified(user);

    const { token: nextRefreshToken, jti: nextJti } = signRefreshToken({ userId: user.id });

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { jti },
        data: {
          status: 'revoked',
          revokedAt: now,
          replacedByJti: nextJti,
        },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          jti: nextJti,
          tokenHash: sha256Base64(nextRefreshToken),
          expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
          status: 'active',
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        },
      }),
    ]);

    const accessToken = signAccessToken({ userId: user.id, role: user.role?.name || 'user' });

    res.cookie(REFRESH_COOKIE_NAME, nextRefreshToken, refreshCookieOptions());

    res.json({
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role?.name || 'user',
          profile: sanitizeProfile(user.profile),
        },
      },
    });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const jti = decoded.jti;
        const row = await prisma.refreshToken.findUnique({ where: { jti } });
        if (row && row.status === 'active') {
          await prisma.refreshToken.update({
            where: { jti },
            data: { status: 'revoked', revokedAt: new Date() },
          });
        }
      } catch {
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: 0 });
    res.json({ data: { ok: true } });
  }),
);

export default router;
