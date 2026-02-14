import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';

function getServiceAccountFromEnv() {
  if (env.GDRIVE_SERVICE_ACCOUNT_KEY_BASE64) {
    const json = Buffer.from(env.GDRIVE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  if (env.GDRIVE_CLIENT_EMAIL && env.GDRIVE_PRIVATE_KEY) {
    return {
      client_email: env.GDRIVE_CLIENT_EMAIL,
      private_key: env.GDRIVE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  throw new Error('Google Drive credentials not configured');
}

export function getDriveClient() {
  const oauthClientId = (env.GDRIVE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').split(',')[0].trim();

  if (oauthClientId && env.GDRIVE_OAUTH_CLIENT_SECRET && env.GDRIVE_OAUTH_REFRESH_TOKEN) {
    const auth = new google.auth.OAuth2(oauthClientId, env.GDRIVE_OAUTH_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: env.GDRIVE_OAUTH_REFRESH_TOKEN });
    return google.drive({ version: 'v3', auth });
  }

  const sa = getServiceAccountFromEnv();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    subject: env.GDRIVE_IMPERSONATE_USER || undefined,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// ============================================================================
// FOLDER MANAGEMENT - Organized GDrive folder structure
// ============================================================================

// In-memory cache of folder IDs to avoid redundant API calls.
// Map<string, string> where key = "parentId/folderName" and value = folderId
const folderCache = new Map();

/**
 * Find an existing folder by name inside a parent folder, or create it if not found.
 * @param {string} folderName - The name of the folder to find/create
 * @param {string} parentFolderId - The parent folder ID
 * @returns {Promise<string>} The folder ID
 */
export async function getOrCreateDriveFolder(folderName, parentFolderId) {
  const cacheKey = `${parentFolderId}/${folderName}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const drive = getDriveClient();

  // Search for existing folder
  const query = [`name = '${folderName.replace(/'/g, "\\'")}'`, `'${parentFolderId}' in parents`, `mimeType = 'application/vnd.google-apps.folder'`, `trashed = false`].join(' and ');

  const list = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    spaces: 'drive',
    pageSize: 1,
  });

  if (list.data.files?.length > 0) {
    const folderId = list.data.files[0].id;
    folderCache.set(cacheKey, folderId);
    return folderId;
  }

  // Create folder
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    supportsAllDrives: true,
    fields: 'id, name',
  });

  const folderId = created.data.id;
  folderCache.set(cacheKey, folderId);
  return folderId;
}

/**
 * Resolve a nested folder path (e.g. "Beasiswa/Periode-2026/NPM-Nama")
 * creating each segment if it doesn't exist.
 * @param {string[]} pathSegments - Array of folder names from root to leaf
 * @param {string} [rootFolderId] - Starting parent folder (defaults to GDRIVE_FOLDER_ID)
 * @returns {Promise<string>} The deepest folder's ID
 */
export async function getOrCreateDriveFolderPath(pathSegments, rootFolderId = env.GDRIVE_FOLDER_ID) {
  let currentParent = rootFolderId;
  for (const segment of pathSegments) {
    currentParent = await getOrCreateDriveFolder(segment, currentParent);
  }
  return currentParent;
}

/**
 * Build the GDrive folder path segments for a scholarship applicant.
 * Structure: Beasiswa / Periode-{year} / {NPM}-{Nama}
 * @param {{ npm: string, name: string, year?: number }} applicant
 * @returns {string[]}
 */
export function buildScholarshipFolderPath({ npm, name, year }) {
  const y = year || new Date().getFullYear();
  const safeName = (name || 'Unknown')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return ['Beasiswa', `Periode-${y}`, `${npm}-${safeName}`];
}

/**
 * Build folder path for general upload categories.
 * Structure: {category} / optional sub-folders
 * Categories: Artikel, Profil, Dispensasi, Kegiatan, etc.
 * @param {string} category - Top-level folder name
 * @param {string[]} [subFolders] - Additional sub-folder segments
 * @returns {string[]}
 */
export function buildUploadFolderPath(category, subFolders = []) {
  return [category, ...subFolders];
}

function isServiceAccountQuotaError(error) {
  const msg = String(error?.message || '');
  return msg.includes('Service Accounts do not have storage quota');
}

function isOAuthInvalidGrantError(error) {
  const msg = String(error?.message || '');
  const causeMsg = String(error?.cause?.message || '');
  const dataMsg = String(error?.response?.data?.error?.message || '');
  return [msg, causeMsg, dataMsg].some((s) => s.toLowerCase().includes('invalid_grant'));
}

function isDriveParentNotFoundError(error) {
  const causeMsg = String(error?.cause?.message || '');
  const dataMsg = String(error?.response?.data?.error?.message || '');
  const msg = String(error?.message || '');
  return [msg, causeMsg, dataMsg].some((s) => s.toLowerCase().includes('file not found:'));
}

export function toDriveUploadHttpErrorMessage(error) {
  if (isServiceAccountQuotaError(error)) {
    return 'Upload ke Google Drive belum bisa karena Service Account tidak punya kuota. Solusi tercepat tanpa admin: pakai OAuth (akun Google biasa) dan isi refresh token (jalankan: node scripts/set-gdrive-oauth-env.mjs).';
  }

  if (isOAuthInvalidGrantError(error)) {
    return 'OAuth refresh token Google Drive tidak valid / sudah dicabut. Jalankan ulang: node scripts/set-gdrive-oauth-env.mjs (atau --manual), lalu restart backend.';
  }

  if (isDriveParentNotFoundError(error)) {
    return 'Folder Google Drive tidak ditemukan atau akun OAuth tidak punya akses ke folder tersebut. Pastikan GDRIVE_FOLDER_ID adalah folder yang dibuat oleh akun yang sama (atau folder-nya dibagikan ke akun itu), lalu restart backend.';
  }

  return 'Upload gagal. Silakan coba lagi.';
}

export async function uploadBufferToDrive({ name, mimeType, buffer, parentFolderId = env.GDRIVE_FOLDER_ID }) {
  const drive = getDriveClient();

  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(body),
    },
    supportsAllDrives: true,
    fields: 'id,name,mimeType,size',
  });

  return res.data;
}

export async function downloadDriveFileStream(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    {
      responseType: 'stream',
    },
  );
  return res.data;
}

export async function setDriveFilePublicReadable(fileId) {
  const drive = getDriveClient();

  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: {
      type: 'anyone',
      role: 'reader',
    },
  });
}
