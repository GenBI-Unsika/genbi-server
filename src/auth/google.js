import { OAuth2Client } from 'google-auth-library';

import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';
import { allowedEmailDomains, normalizeEmail } from './domain.js';

let cachedClient = null;

function getClient() {
  if (!env.GOOGLE_CLIENT_ID) throw new HttpError(500, 'Konfigurasi login Google belum tersedia di server.');
  if (!cachedClient) cachedClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return cachedClient;
}

export async function verifyGoogleIdToken(idToken) {
  if (!idToken) throw new HttpError(400, 'Token Google tidak ditemukan.');

  const client = getClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new HttpError(401, 'Token Google tidak valid.');

  const email = normalizeEmail(payload.email);
  if (!email) throw new HttpError(400, 'Akun Google tidak memiliki email.');

  const domains = allowedEmailDomains();
  const emailAllowed = domains.some((d) => email.endsWith(`@${d}`));
  if (!emailAllowed) {
    const msg = domains.length === 1 ? `Akun Google harus menggunakan email @${domains[0]}` : `Akun Google harus menggunakan email @${domains[0]} atau @${domains[1]}`;
    throw new HttpError(403, msg);
  }

  // If Google provides hosted-domain (Workspace), ensure it matches allowed domains.
  if (payload.hd) {
    const hd = String(payload.hd).toLowerCase();
    if (!domains.includes(hd)) {
      const msg = domains.length === 1 ? `Akun Google harus menggunakan email @${domains[0]}` : `Akun Google harus menggunakan email @${domains[0]} atau @${domains[1]}`;
      throw new HttpError(403, msg);
    }
  }

  if (!payload.email_verified) throw new HttpError(403, 'Email Google belum terverifikasi.');

  return {
    sub: payload.sub,
    email,
    name: payload.name || '',
    givenName: payload.given_name || '',
    familyName: payload.family_name || '',
    picture: payload.picture || '',
    locale: payload.locale || '',
  };
}
