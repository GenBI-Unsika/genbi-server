// Usage:
//   node scripts/smoke-auth.mjs http://localhost:4000 admin@genbi.local ChangeMe123!
//
// Notes:
// - Uses Node 18+ built-in fetch.
// - Manually manages refresh cookie.

import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.argv[2] || 'http://localhost:4000';
const email = process.argv[3] || process.env.SMOKE_EMAIL || process.env.SEED_ADMIN_EMAIL;
const password = process.argv[4] || process.env.SMOKE_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Usage: node scripts/smoke-auth.mjs <baseUrl> <email> <password>');
  console.error('Or set env: SMOKE_EMAIL/SMOKE_PASSWORD (or SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)');
  process.exit(1);
}

function pickSetCookie(headers) {
  // Node fetch returns a single set-cookie header string (often), or multiple
  // exposed via headers.getSetCookie() in newer Node. Support both.
  if (typeof headers.getSetCookie === 'function') {
    const arr = headers.getSetCookie();
    return Array.isArray(arr) ? arr : [];
  }
  const v = headers.get('set-cookie');
  return v ? [v] : [];
}

function extractCookieJar(setCookies) {
  // Keep only cookie kv pairs (before first ';')
  const jar = [];
  for (const sc of setCookies) {
    const part = String(sc).split(';')[0]?.trim();
    if (part) jar.push(part);
  }
  return jar.join('; ');
}

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let cookie = '';

async function runFlow({ label, loginPath, expectRole }) {
  // 1) Login
  const loginRes = await fetch(`${baseUrl}/api/v1${loginPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginBody = await jsonOrText(loginRes);
  if (!loginRes.ok) {
    console.error(`${label}_LOGIN_FAILED`, loginRes.status, loginBody);
    process.exit(1);
  }

  cookie = extractCookieJar(pickSetCookie(loginRes.headers));
  const accessToken = loginBody?.data?.accessToken;
  if (!accessToken) {
    console.error(`${label}_LOGIN_NO_ACCESS_TOKEN`, loginBody);
    process.exit(1);
  }

  console.log(`${label}_LOGIN_OK`);

  // 2) /me
  const meRes = await fetch(`${baseUrl}/api/v1/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const meBody = await jsonOrText(meRes);
  if (!meRes.ok) {
    console.error(`${label}_ME_FAILED`, meRes.status, meBody);
    process.exit(1);
  }

  if (expectRole && meBody?.data?.role !== expectRole) {
    console.error(`${label}_ME_UNEXPECTED_ROLE`, meBody?.data?.role);
    process.exit(1);
  }

  console.log(`${label}_ME_OK`);

  // 3) Refresh
  const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: cookie ? { cookie } : {},
  });
  const refreshBody = await jsonOrText(refreshRes);
  if (!refreshRes.ok) {
    console.error(`${label}_REFRESH_FAILED`, refreshRes.status, refreshBody);
    process.exit(1);
  }
  cookie = extractCookieJar(pickSetCookie(refreshRes.headers)) || cookie;
  const nextAccessToken = refreshBody?.data?.accessToken;
  if (!nextAccessToken) {
    console.error(`${label}_REFRESH_NO_ACCESS_TOKEN`, refreshBody);
    process.exit(1);
  }
  console.log(`${label}_REFRESH_OK`);

  // 4) Logout
  const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: cookie ? { cookie } : {},
  });
  const logoutBody = await jsonOrText(logoutRes);
  if (!logoutRes.ok) {
    console.error(`${label}_LOGOUT_FAILED`, logoutRes.status, logoutBody);
    process.exit(1);
  }
  console.log(`${label}_LOGOUT_OK`);
}

await runFlow({ label: 'USER', loginPath: '/auth/login' });
await runFlow({ label: 'ADMIN', loginPath: '/auth/admin/login', expectRole: 'admin' });

console.log('SMOKE_AUTH_DONE');
