import { env } from '../config/env.js';

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function allowedEmailDomains() {
  const raw = String(env.AUTH_ALLOWED_EMAIL_DOMAIN || '').trim();
  const list = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return list.length ? list : ['unsika.ac.id'];
}

export function isAllowedEmailDomain(email) {
  const normalized = normalizeEmail(email);
  const domains = allowedEmailDomains();
  return domains.some((d) => normalized.endsWith(`@${d}`));
}

export function assertAllowedEmailDomain(email) {
  if (!isAllowedEmailDomain(email)) {
    const domains = allowedEmailDomains();
    const msg = domains.length === 1 ? `Email harus menggunakan domain @${domains[0]}` : `Email harus menggunakan domain @${domains[0]} atau @${domains[1]}`;
    const err = new Error(msg);
    err.statusCode = 403;
    throw err;
  }
}
