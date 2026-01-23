// Usage:
//   node scripts/set-gdrive-base64-env.mjs
//
// Reads .secrets/service-account.json, base64-encodes it, and writes it into .env as:
//   GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=<...>
// without printing the secret.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsonPath = path.join(root, '.secrets', 'service-account.json');
const envPath = path.join(root, '.env');

if (!fs.existsSync(jsonPath)) {
  console.error(`Missing ${jsonPath}`);
  process.exit(1);
}
if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, 'utf8');
if (!raw.trim()) {
  console.error('service-account.json is empty');
  process.exit(1);
}

// validate JSON
JSON.parse(raw);

const b64 = Buffer.from(raw, 'utf8').toString('base64');

const envText = fs.readFileSync(envPath, 'utf8');
const lines = envText.split(/\r?\n/);

let replaced = false;
const nextLines = lines.map((line) => {
  if (line.startsWith('GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=')) {
    replaced = true;
    return `GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=${b64}`;
  }
  return line;
});

if (!replaced) {
  nextLines.push(`GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=${b64}`);
}

fs.writeFileSync(envPath, nextLines.join('\n'), 'utf8');

console.log('Updated .env: GDRIVE_SERVICE_ACCOUNT_KEY_BASE64 set');
