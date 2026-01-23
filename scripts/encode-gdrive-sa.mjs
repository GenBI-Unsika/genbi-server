// Usage:
//   node scripts/encode-gdrive-sa.mjs path/to/service-account.json
// Output:
//   prints base64 string for GDRIVE_SERVICE_ACCOUNT_KEY_BASE64

import fs from 'fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/encode-gdrive-sa.mjs path/to/service-account.json');
  process.exit(1);
}

const raw = fs.readFileSync(filePath, 'utf8');
// validate JSON
JSON.parse(raw);

const b64 = Buffer.from(raw, 'utf8').toString('base64');
console.log(b64);
