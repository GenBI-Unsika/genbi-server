import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Direktori penyimpanan sementara (dibuat otomatis saat startup)
const TEMP_DIR = path.resolve(__dirname, '../../temp-uploads');

// Simpan metadata file sementara (di-memori, kadaluarsa setelah TTL)
const tempFileMap = new Map();

// TTL Default: 30 menit (cukup waktu untuk preview dan submit)
const DEFAULT_TTL_MS = 30 * 60 * 1000;

// Interval pembersihan: setiap 5 menit
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function getMetaPath(tempId) {
  return path.join(TEMP_DIR, `${tempId}.meta.json`);
}

function tryLoadMetadataFromDisk(tempId) {
  try {
    const metaPath = getMetaPath(tempId);
    if (!fsSync.existsSync(metaPath)) return null;

    const raw = fsSync.readFileSync(metaPath, 'utf8');
    const metadata = JSON.parse(raw);

    if (!metadata || metadata.tempId !== tempId) return null;
    if (!metadata.filePath && metadata.filename) {
      metadata.filePath = path.join(TEMP_DIR, metadata.filename);
    }

    return metadata;
  } catch {
    return null;
  }
}

/**
 * Inisialisasi direktori penyimpanan sementara
 */
export async function initTempStorage() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    setInterval(cleanupExpiredFiles, CLEANUP_INTERVAL_MS);
  } catch (err) {
    console.error('[temp-storage] Failed to initialize:', err);
  }
}

/**
 * Hasilkan ID file sementara yang unik
 */
function generateTempId() {
  return `temp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Simpan file ke penyimpanan sementara
 * @param {Object} params
 * @param {Buffer} params.buffer - Buffer file
 * @param {string} params.originalName - Nama file asli
 * @param {string} params.mimeType - Tipe MIME
 * @param {number} params.userId - User yang mengupload
 * @param {number} [params.ttlMs] - Waktu hidup (TTL) dalam milidetik
 * @returns {Promise<Object>} Metadata file sementara
 */
export async function saveTempFile({ buffer, originalName, mimeType, userId, ttlMs = DEFAULT_TTL_MS }) {
  const tempId = generateTempId();
  const ext = path.extname(originalName) || '';
  const filename = `${tempId}${ext}`;
  const filePath = path.join(TEMP_DIR, filename);

  await fs.writeFile(filePath, buffer);

  const metadata = {
    tempId,
    filename,
    filePath,
    originalName,
    mimeType,
    size: buffer.length,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };

  tempFileMap.set(tempId, metadata);

  // Persist metadata so temp files still work after server restarts
  try {
    await fs.writeFile(getMetaPath(tempId), JSON.stringify(metadata), 'utf8');
  } catch (e) {
    // Non-fatal, but will cause temp file to be lost on restart.
    console.warn('[temp-storage] Failed to persist metadata:', e?.message || e);
  }

  return {
    tempId,
    name: originalName,
    mimeType,
    size: buffer.length,
    previewUrl: `/api/v1/files/temp/${tempId}`,
    expiresAt: metadata.expiresAt,
  };
}

/**
 * Dapatkan metadata file sementara
 * @param {string} tempId
 * @returns {Object|null}
 */
export function getTempFile(tempId) {
  let metadata = tempFileMap.get(tempId);
  if (!metadata) {
    metadata = tryLoadMetadataFromDisk(tempId);
    if (metadata) {
      tempFileMap.set(tempId, metadata);
    }
  }

  if (!metadata) return null;

  if (Date.now() > metadata.expiresAt) {
    deleteTempFile(tempId).catch(() => {});
    return null;
  }

  // File missing on disk -> treat as expired/not found
  if (metadata.filePath && !fsSync.existsSync(metadata.filePath)) {
    deleteTempFile(tempId).catch(() => {});
    return null;
  }

  return metadata;
}

/**
 * Baca buffer file sementara
 * @param {string} tempId
 * @returns {Promise<Buffer|null>}
 */
export async function readTempFile(tempId) {
  const metadata = getTempFile(tempId);
  if (!metadata) return null;

  try {
    return await fs.readFile(metadata.filePath);
  } catch {
    return null;
  }
}

/**
 * Hapus file sementara
 * @param {string} tempId
 */
export async function deleteTempFile(tempId) {
  const metadata = tempFileMap.get(tempId) || tryLoadMetadataFromDisk(tempId);
  const metaPath = getMetaPath(tempId);

  if (metadata?.filePath) {
    try {
      await fs.unlink(metadata.filePath);
    } catch {
      // ignore
    }
  } else {
    // best-effort cleanup if metadata is missing
    try {
      const entries = await fs.readdir(TEMP_DIR);
      const candidates = entries.filter((name) => name.startsWith(tempId) && !name.endsWith('.meta.json'));
      await Promise.all(candidates.map((name) => fs.unlink(path.join(TEMP_DIR, name)).catch(() => {})));
    } catch {
      // ignore
    }
  }

  try {
    await fs.unlink(metaPath);
  } catch {
    // ignore
  }

  tempFileMap.delete(tempId);
}

/**
 * Dapatkan stream file sementara untuk disajikan
 * @param {string} tempId
 * @returns {Promise<{stream: ReadStream, metadata: Object}|null>}
 */
export async function getTempFileStream(tempId) {
  const metadata = getTempFile(tempId);
  if (!metadata) return null;

  const { createReadStream } = await import('node:fs');
  const stream = createReadStream(metadata.filePath);

  return { stream, metadata };
}

/**
 * Konsumsi file sementara (dapatkan buffer dan hapus)
 * Digunakan saat finalisasi upload ke Drive
 * @param {string} tempId
 * @returns {Promise<{buffer: Buffer, metadata: Object}|null>}
 */
export async function consumeTempFile(tempId) {
  const metadata = getTempFile(tempId);
  if (!metadata) return null;

  try {
    const buffer = await fs.readFile(metadata.filePath);
    await deleteTempFile(tempId);
    return { buffer, metadata };
  } catch {
    return null;
  }
}

/**
 * Bersihkan file sementara yang kadaluarsa
 */
async function cleanupExpiredFiles() {
  const now = Date.now();
  const expiredIds = [];

  for (const [tempId, metadata] of tempFileMap) {
    if (now > metadata.expiresAt) {
      expiredIds.push(tempId);
    }
  }

  for (const tempId of expiredIds) {
    await deleteTempFile(tempId);
  }

  // Also scan persisted metadata on disk (handles server restarts)
  try {
    const entries = await fs.readdir(TEMP_DIR);
    const metaFiles = entries.filter((name) => name.endsWith('.meta.json'));
    for (const metaFile of metaFiles) {
      try {
        const metaPath = path.join(TEMP_DIR, metaFile);
        const raw = await fs.readFile(metaPath, 'utf8');
        const metadata = JSON.parse(raw);
        const tempId = metadata?.tempId;
        if (!tempId) continue;
        if (now > metadata.expiresAt) {
          await deleteTempFile(tempId);
        }
      } catch {
        // ignore broken meta
      }
    }
  } catch {
    // ignore
  }

  if (expiredIds.length > 0) {
  }
}

/**
 * Dapatkan semua file sementara untuk user (untuk pembersihan saat logout dll)
 * @param {number} userId
 * @returns {string[]} Array tempId
 */
export function getUserTempFiles(userId) {
  const tempIds = [];
  for (const [tempId, metadata] of tempFileMap) {
    if (metadata.userId === userId) {
      tempIds.push(tempId);
    }
  }
  return tempIds;
}

/**
 * Hapus semua file sementara untuk user
 * @param {number} userId
 */
export async function deleteUserTempFiles(userId) {
  const tempIds = getUserTempFiles(userId);
  await Promise.all(tempIds.map(deleteTempFile));
}

export { TEMP_DIR };
