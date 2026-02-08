import path from 'node:path';
import fs from 'node:fs/promises';
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
  const metadata = tempFileMap.get(tempId);
  if (!metadata) return null;


  if (Date.now() > metadata.expiresAt) {
    deleteTempFile(tempId).catch(() => { });
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
  const metadata = tempFileMap.get(tempId);
  if (!metadata) return;

  try {
    await fs.unlink(metadata.filePath);
  } catch {

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
