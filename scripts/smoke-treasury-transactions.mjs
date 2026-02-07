// Usage:
//   node scripts/smoke-treasury-transactions.mjs http://localhost:4000 admin@genbi.local ChangeMe123!
//
// Notes:
// - Uses Node 18+ built-in fetch.
// - Does an admin login, creates a transaction, checks list + summary, then deletes it.

import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.argv[2] || 'http://localhost:4000';
const email = process.argv[3] || process.env.SMOKE_EMAIL || process.env.SEED_ADMIN_EMAIL;
const password = process.argv[4] || process.env.SMOKE_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Usage: node scripts/smoke-treasury-transactions.mjs <baseUrl> <email> <password>');
  console.error('Or set env: SMOKE_EMAIL/SMOKE_PASSWORD (or SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)');
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

async function assertOk(res, body, label) {
  if (res.ok) return;
  console.error(`${label}_FAILED`, res.status, body);
  process.exit(1);
}

// 1) Admin login
const loginRes = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginBody = await jsonOrText(loginRes);
await assertOk(loginRes, loginBody, 'LOGIN');

const accessToken = loginBody?.data?.accessToken;
if (!accessToken) {
  console.error('LOGIN_NO_ACCESS_TOKEN', loginBody);
  process.exit(1);
}
console.log('LOGIN_OK');

const authHeaders = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

// 2) Create a transaction
const marker = `SMOKE_${Date.now()}`;
const createRes = await fetch(`${baseUrl}/api/v1/treasury/transactions`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    type: 'INCOME',
    amount: 12345,
    occurredAt: new Date().toISOString(),
    category: 'SMOKE',
    description: marker,
    reference: marker,
  }),
});
const createBody = await jsonOrText(createRes);
await assertOk(createRes, createBody, 'CREATE');
const createdId = createBody?.data?.id;
if (!createdId) {
  console.error('CREATE_NO_ID', createBody);
  process.exit(1);
}
console.log('CREATE_OK', createdId);

// 3) List transactions
const listRes = await fetch(`${baseUrl}/api/v1/treasury/transactions`, { headers: { authorization: `Bearer ${accessToken}` } });
const listBody = await jsonOrText(listRes);
await assertOk(listRes, listBody, 'LIST');

const list = listBody?.data;
if (!Array.isArray(list)) {
  console.error('LIST_UNEXPECTED_BODY', listBody);
  process.exit(1);
}

const found = list.some((t) => t?.id === createdId);
if (!found) {
  console.error('LIST_DID_NOT_CONTAIN_CREATED_ID');
  process.exit(1);
}
console.log('LIST_OK');

// 4) Summary
const summaryRes = await fetch(`${baseUrl}/api/v1/treasury/transactions/summary`, { headers: { authorization: `Bearer ${accessToken}` } });
const summaryBody = await jsonOrText(summaryRes);
await assertOk(summaryRes, summaryBody, 'SUMMARY');

if (!summaryBody?.data || typeof summaryBody.data.totalIncome !== 'number') {
  console.error('SUMMARY_UNEXPECTED_BODY', summaryBody);
  process.exit(1);
}
console.log('SUMMARY_OK');

// 5) Delete
const delRes = await fetch(`${baseUrl}/api/v1/treasury/transactions/${createdId}`, {
  method: 'DELETE',
  headers: { authorization: `Bearer ${accessToken}` },
});
const delBody = await jsonOrText(delRes);
await assertOk(delRes, delBody, 'DELETE');
console.log('DELETE_OK');

console.log('SMOKE_TREASURY_TRANSACTIONS_DONE');
