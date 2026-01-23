import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_TOKEN_AUDIENCE = 'genbi-access';
export const REFRESH_TOKEN_AUDIENCE = 'genbi-refresh';

export function signAccessToken({ userId, role }) {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    audience: ACCESS_TOKEN_AUDIENCE,
    issuer: 'genbi-backend',
  });
}

export function signRefreshToken({ userId }) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    subject: userId,
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
