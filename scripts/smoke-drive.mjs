// Usage:
//   node scripts/smoke-drive.mjs http://127.0.0.1:4000
// Requires:
//   - Backend running
//   - SMOKE_EMAIL / SMOKE_PASSWORD in .env
//   - Google Drive credentials configured (GDRIVE_SERVICE_ACCOUNT_KEY_BASE64 recommended)

import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.argv[2] || 'http://127.0.0.1:4000';
const email = process.env.SMOKE_EMAIL || process.env.SEED_ADMIN_EMAIL;
const password = process.env.SMOKE_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Missing SMOKE_EMAIL/SMOKE_PASSWORD (or SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)');
  process.exit(1);
}

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// 1) Login to get access token
const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginBody = await jsonOrText(loginRes);
if (!loginRes.ok) {
  console.error('LOGIN_FAILED', loginRes.status, loginBody);
  process.exit(1);
}
const accessToken = loginBody?.data?.accessToken;
if (!accessToken) {
  console.error('LOGIN_NO_ACCESS_TOKEN', loginBody);
  process.exit(1);
}
console.log('LOGIN_OK');

// 2) Upload a small file
const form = new FormData();
const content = `hello-drive-${Date.now()}`;
form.append('file', new Blob([content], { type: 'text/plain' }), 'hello.txt');

const uploadRes = await fetch(`${baseUrl}/api/v1/files`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${accessToken}`,
  },
  body: form,
});
const uploadBody = await jsonOrText(uploadRes);
if (!uploadRes.ok) {
  console.error('UPLOAD_FAILED', uploadRes.status, uploadBody);
  process.exit(1);
}

const fileId = uploadBody?.data?.id;
console.log('UPLOAD_OK', fileId);
if (!fileId) process.exit(1);

// 3) Fetch metadata
const metaRes = await fetch(`${baseUrl}/api/v1/files/${fileId}`, {
  headers: { authorization: `Bearer ${accessToken}` },
});
const metaBody = await jsonOrText(metaRes);
if (!metaRes.ok) {
  console.error('META_FAILED', metaRes.status, metaBody);
  process.exit(1);
}
console.log('META_OK');

// 4) Download
const dlRes = await fetch(`${baseUrl}/api/v1/files/${fileId}/download`, {
  headers: { authorization: `Bearer ${accessToken}` },
});
if (!dlRes.ok) {
  const dlBody = await jsonOrText(dlRes);
  console.error('DOWNLOAD_FAILED', dlRes.status, dlBody);
  process.exit(1);
}
const downloaded = await dlRes.text();
if (downloaded !== content) {
  console.error('DOWNLOAD_MISMATCH', { expected: content, got: downloaded });
  process.exit(1);
}
console.log('DOWNLOAD_OK');

console.log('SMOKE_DRIVE_DONE');
