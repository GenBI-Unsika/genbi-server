import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { env } from '../src/config/env.js';
import { getOrCreateDriveFolderPath, uploadBufferToDrive, setDriveFilePublicReadable, toDriveUploadHttpErrorMessage } from '../src/storage/gdrive.js';

const USER_ID = 48;
const CACHE_PATH = path.resolve('scripts/wp-media-map.json');
const DEFAULT_FOLDER = 'articles/photos';

function sanitizeUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';

  // Common case: CSS like url(https://...jpg);background-position...
  for (const sep of [')', ';', ' ', '\n', '\r', '\t', '"', "'", '>']) {
    const i = s.indexOf(sep);
    if (i !== -1) return s.slice(0, i).replace(/[)\s;"']+$/g, '');
  }

  return s.replace(/[)\s;"']+$/g, '');
}

function normalizeUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';

  try {
    const u = new URL(s);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return s;
  }
}

function guessNameFromUrl(url, fallbackBase = 'wp-media') {
  try {
    const u = new URL(url);
    const base = decodeURIComponent(u.pathname.split('/').pop() || '').trim();
    if (base) return base;
  } catch {
    // ignore
  }

  return `${fallbackBase}-${Date.now()}`;
}

async function downloadToBuffer(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'genbi-server-wp-media-repair/1.0',
      accept: '*/*',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  return { buffer, contentType };
}

async function uploadExternalToFileObject({ prisma, url, userId, folderPath, folderIdCache }) {
  if (!env.GDRIVE_FOLDER_ID) {
    throw new Error('GDRIVE_FOLDER_ID not set');
  }

  const normalized = normalizeUrl(url);
  const { buffer, contentType } = await downloadToBuffer(normalized);
  const fileName = guessNameFromUrl(normalized, 'wp-media');
  const mimeType = contentType || 'application/octet-stream';

  let parentFolderId = env.GDRIVE_FOLDER_ID;
  const folderKey = folderPath || '';
  if (folderKey) {
    if (!folderIdCache.has(folderKey)) {
      const segs = String(folderKey).split('/').filter(Boolean);
      const folderId = segs.length > 0 ? await getOrCreateDriveFolderPath(segs, env.GDRIVE_FOLDER_ID) : env.GDRIVE_FOLDER_ID;
      folderIdCache.set(folderKey, folderId);
    }
    parentFolderId = folderIdCache.get(folderKey);
  }

  let driveFile;
  try {
    driveFile = await uploadBufferToDrive({
      name: fileName,
      mimeType,
      buffer,
      parentFolderId,
    });
  } catch (e) {
    throw new Error(toDriveUploadHttpErrorMessage(e));
  }

  if (env.GDRIVE_PUBLIC_FILES) {
    try {
      await setDriveFilePublicReadable(driveFile.id);
    } catch {
      // ignore
    }
  }

  const created = await prisma.fileObject.create({
    data: {
      createdById: userId,
      driveFileId: driveFile.id,
      name: driveFile.name || fileName,
      mimeType: driveFile.mimeType || mimeType,
      sizeBytes: driveFile.size ? Number(driveFile.size) : buffer.length,
    },
  });

  return {
    fileObjectId: created.id,
    publicUrl: `/api/v1/files/${created.id}/public`,
    driveFileId: driveFile.id,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
  };
}

async function main() {
  const raw = await fs.readFile(CACHE_PATH, 'utf8');
  const cache = JSON.parse(raw);
  cache.map ||= {};

  const failedEntries = Object.entries(cache.map).filter(([, v]) => v && v.error);
  // eslint-disable-next-line no-console
  console.log('failedCount', failedEntries.length);
  if (failedEntries.length === 0) return;

  const prisma = new PrismaClient();
  const folderIdCache = new Map();

  try {
    const user = await prisma.user.findUnique({ where: { id: USER_ID }, select: { id: true } });
    if (!user) throw new Error(`userId=${USER_ID} not found`);

    for (const [badUrl, info] of failedEntries) {
      const cleaned = sanitizeUrl(badUrl);
      const cleanedNorm = normalizeUrl(cleaned);

      // eslint-disable-next-line no-console
      console.log('Repairing:', badUrl);
      // eslint-disable-next-line no-console
      console.log('Cleaned  :', cleanedNorm);

      if (!cleanedNorm.startsWith('http')) {
        cache.map[badUrl] = { ...info, repairError: 'Could not sanitize to a valid URL' };
        continue;
      }

      const existing = cache.map[cleanedNorm];
      if (existing && existing.publicUrl) {
        cache.map[badUrl] = { ...existing, repairedFrom: badUrl, canonical: cleanedNorm };
        delete cache.map[badUrl].error;
        continue;
      }

      try {
        const uploaded = await uploadExternalToFileObject({
          prisma,
          url: cleanedNorm,
          userId: USER_ID,
          folderPath: DEFAULT_FOLDER,
          folderIdCache,
        });

        cache.map[cleanedNorm] = uploaded;
        cache.map[badUrl] = { ...uploaded, repairedFrom: badUrl, canonical: cleanedNorm };
        // eslint-disable-next-line no-console
        console.log('Uploaded :', uploaded.publicUrl);
      } catch (e) {
        cache.map[badUrl] = {
          ...info,
          repairTried: cleanedNorm,
          repairError: String(e?.message || e),
        };
        // eslint-disable-next-line no-console
        console.warn('Repair failed:', cache.map[badUrl].repairError);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log('Cache updated:', CACHE_PATH);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
