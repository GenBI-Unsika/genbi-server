import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_TOKEN_AUDIENCE = 'genbi-access';
export const REFRESH_TOKEN_AUDIENCE = 'genbi-refresh';
export const FILE_TOKEN_AUDIENCE = 'genbi-file';
export const SCHOLARSHIP_ANNOUNCEMENT_TOKEN_AUDIENCE = 'genbi-scholarship-announcement';

export function signAccessToken({ userId, role }) {
  const subject = String(userId);
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    // jsonwebtoken requires subject to be a string
    subject,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    audience: ACCESS_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

export function signRefreshToken({ userId }) {
  const subject = String(userId);
  const jti = crypto.randomUUID();
  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    // jsonwebtoken requires subject to be a string
    subject,
    jwtid: jti,
    expiresIn: env.JWT_REFRESH_TTL_SECONDS,
    audience: REFRESH_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });

  return { token, jti };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    audience: ACCESS_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    audience: REFRESH_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

export function sha256Base64(value) {
  return crypto.createHash('sha256').update(value).digest('base64');
}

export function signFileToken({ userId, fileObjectId, disposition }) {
  const subject = String(userId);
  const fid = Number(fileObjectId);
  if (!Number.isInteger(fid) || fid <= 0) throw new Error('Invalid fileObjectId');

  const disp = disposition === 'inline' ? 'inline' : 'attachment';

  return jwt.sign({ fid, disp }, env.JWT_ACCESS_SECRET, {
    subject,
    expiresIn: env.FILE_TOKEN_TTL_SECONDS,
    audience: FILE_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

export function verifyFileToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    audience: FILE_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

function publicAnnouncementSecret() {
  const s = String(env.JWT_PUBLIC_ANNOUNCEMENT_SECRET || '').trim();
  return s || env.JWT_ACCESS_SECRET;
}

/**
 * Token publik untuk membuka halaman pengumuman beasiswa tanpa login.
 * Payload dibuat minimal: appId + subject userId.
 */
export function signScholarshipAnnouncementToken({ userId, appId }) {
  const subject = String(userId);
  const aid = Number(appId);
  if (!Number.isInteger(aid) || aid <= 0) throw new Error('Invalid appId');

  return jwt.sign({ aid }, publicAnnouncementSecret(), {
    subject,
    expiresIn: env.JWT_PUBLIC_ANNOUNCEMENT_TTL_SECONDS,
    audience: SCHOLARSHIP_ANNOUNCEMENT_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

export function verifyScholarshipAnnouncementToken(token) {
  return jwt.verify(token, publicAnnouncementSecret(), {
    audience: SCHOLARSHIP_ANNOUNCEMENT_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}
