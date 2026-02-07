// Usage:
//   node scripts/set-gdrive-oauth-env.mjs
//
// What it does:
// - Starts a local callback server
// - Prints an authorization URL
// - Exchanges the auth code for tokens
// - Writes GDRIVE_OAUTH_REFRESH_TOKEN into genbi-server/.env
//
// Prereqs:
// - Create OAuth Client ID in Google Cloud Console
//   - Type: "Desktop app" (recommended)
//   - Enable Google Drive API
// - Set env before running:
//   - GOOGLE_CLIENT_ID (or GDRIVE_OAUTH_CLIENT_ID)
//   - GDRIVE_OAUTH_CLIENT_SECRET
//
// Notes:
// - This does NOT require Google Workspace admin.
// - Use a Google account with Drive quota.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const clientId = (process.env.GDRIVE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').split(',')[0].trim();
const clientSecret = process.env.GDRIVE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID (or GDRIVE_OAUTH_CLIENT_ID) or GDRIVE_OAUTH_CLIENT_SECRET in environment (.env)');
  process.exit(1);
}

const PORT = Number(process.env.GDRIVE_OAUTH_PORT || 53682);
// If you reuse a Web OAuth client, you MUST add this redirect URI to "Authorized redirect URIs".
// You can override it via env if needed.
const redirectUri = process.env.GDRIVE_OAUTH_REDIRECT_URI || `http://localhost:${PORT}/oauth2/callback`;

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const scopes = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes,
});

const localOpenUrl = `http://localhost:${PORT}/open`;

const isManual = process.argv.includes('--manual');

function tryOpenInDefaultBrowser(url) {
  try {
    if (process.platform === 'win32') {
      // Use cmd.exe start to open default browser
      exec(`cmd.exe /c start "" "${url}"`);
      return true;
    }
    if (process.platform === 'darwin') {
      exec(`open "${url}"`);
      return true;
    }
    // linux
    exec(`xdg-open "${url}"`);
    return true;
  } catch {
    return false;
  }
}

function tryCopyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      // Avoid quoting issues by sending through stdin
      const child = exec('cmd.exe /c clip');
      child.stdin?.end(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function upsertEnvValue(envText, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(envText)) return envText.replace(re, line);
  const suffix = envText.endsWith('\n') || envText.length === 0 ? '' : '\n';
  return `${envText}${suffix}${line}\n`;
}

function extractCodeFromUserInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  // Allow pasting either full URL or the bare code
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return raw;

  try {
    const u = new URL(raw);
    return u.searchParams.get('code');
  } catch {
    return null;
  }
}

function writeRefreshTokenToEnv({ refreshToken }) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '../.env');

  let envText = '';
  if (fs.existsSync(envPath)) {
    envText = fs.readFileSync(envPath, 'utf8');
  }

  envText = upsertEnvValue(envText, 'GDRIVE_OAUTH_CLIENT_SECRET', clientSecret);
  envText = upsertEnvValue(envText, 'GDRIVE_OAUTH_REFRESH_TOKEN', refreshToken);
  fs.writeFileSync(envPath, envText, 'utf8');
}

async function runManualFlow() {
  console.log('Manual mode: tidak butuh server callback lokal.');
  console.log('1) Buka link pendek ini:');
  console.log(authUrl);
  console.log('2) Login + Allow. Setelah itu browser biasanya error "This site can\'t be reached" — itu normal.');
  console.log(`3) Copy URL di address bar yang berisi ?code=... (redirect ke ${redirectUri}) lalu paste di sini.`);
  console.log('');

  tryCopyToClipboard(authUrl);
  tryOpenInDefaultBrowser(authUrl);

  const rl = readline.createInterface({ input, output });
  const pasted = await rl.question('Paste redirect URL / code: ');
  rl.close();

  const code = extractCodeFromUserInput(pasted);
  if (!code) {
    console.error('Gagal membaca code. Paste URL lengkap yang ada ?code=...');
    process.exit(1);
  }

  const { tokens } = await oauth2Client.getToken(code);
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    console.error('No refresh_token returned. Coba lagi dan pastikan consent screen muncul (prompt=consent).');
    process.exit(1);
  }

  writeRefreshTokenToEnv({ refreshToken });
  console.log('OK. Refresh token saved to genbi-server/.env.');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/open') {
      res.statusCode = 302;
      res.setHeader('location', authUrl);
      res.end();
      return;
    }

    if (req.url === '/' || req.url === '/help') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(
        [
          'GenBI Google Drive OAuth helper',
          '',
          `Redirect URI (must match exactly): ${redirectUri}`,
          `Open URL (short): ${localOpenUrl}`,
          '',
          'If you see redirect_uri_mismatch:',
          '- Google Cloud Console -> Credentials -> OAuth Client -> add the Redirect URI exactly as shown above.',
          '- OR create a new OAuth Client of type Desktop app and set GDRIVE_OAUTH_CLIENT_ID + GDRIVE_OAUTH_CLIENT_SECRET.',
          '',
        ].join('\n'),
      );
      return;
    }

    if (!req.url?.startsWith('/oauth2/callback')) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const url = new URL(req.url, redirectUri);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.statusCode = 400;
      res.end(`OAuth error: ${error}`);
      return;
    }

    if (!code) {
      res.statusCode = 400;
      res.end('Missing code');
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.statusCode = 500;
      res.end('No refresh_token returned. Try again (it must show a consent screen).');
      return;
    }

    writeRefreshTokenToEnv({ refreshToken });

    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('OK. Refresh token saved to genbi-server/.env. You can close this tab and stop the script.');

    // Shutdown
    setTimeout(() => server.close(() => process.exit(0)), 250);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('Failed to finish OAuth flow. Check terminal logs.');
  }
});

if (isManual) {
  runManualFlow()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  server.listen(PORT, () => {
    console.log('OAuth callback server listening on:', redirectUri);
    console.log('1) Buka link pendek ini di browser (paling aman biar tidak kepotong):');
    console.log(localOpenUrl);
    console.log('   (Link asli, kalau butuh):');
    console.log(authUrl);
    console.log('2) Approve access. It will redirect back and save the refresh token into genbi-server/.env');

    console.log('');
    console.log('Kalau muncul redirect_uri_mismatch: buka http://localhost:' + PORT + '/help');

    const copied = tryCopyToClipboard(localOpenUrl);
    if (copied) console.log('   (Link pendek sudah dicopy ke clipboard)');

    // Try auto-open browser for convenience.
    tryOpenInDefaultBrowser(localOpenUrl);
  });
}
