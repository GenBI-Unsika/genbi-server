// Kumpulan perkakas file buat mindahin file dr staging ke tmpt aslinya.
// Modul ini nyediain fungsi pembantu buat alur upload "Taruh dlu, baru resminya ntar".
// File-file dicemplungin ke tmpt sementara dlu buat dicek/preview, baru deh ntar kl ok,
// dikirim permanen ke Google Drive pas user neken tombol Submit.

import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { getTempFile, readTempFile, deleteTempFile } from '../storage/temp-storage.js';
import { uploadBufferToDrive, setDriveFilePublicReadable, getOrCreateDriveFolderPath } from '../storage/gdrive.js';

// Fungsi sakti pindahan: nge-move file ngungsi ke folder tetap Google Drive.
// Fungsi ini wajib dipanggil pas route lg sibuk ngurusin data form masuk.
// @throws {Error} If temp file not found, access denied, or upload fails
export async function finalizeUpload({ tempId, userId, folder }) {
  if (!tempId) {
    throw new Error('tempId is required');
  }

  if (!env.GDRIVE_FOLDER_ID) {
    throw new Error('Upload belum tersedia. Hubungi admin.');
  }

  const tempMeta = getTempFile(tempId);
  if (!tempMeta) {
    throw new Error('File temporary tidak ditemukan atau sudah expired');
  }

  if (tempMeta.userId !== userId) {
    throw new Error('Tidak memiliki akses ke file ini');
  }

  const buffer = await readTempFile(tempId);
  if (!buffer) {
    throw new Error('File temporary tidak ditemukan atau sudah expired');
  }

  let targetFolderId = env.GDRIVE_FOLDER_ID;
  if (folder) {
    try {
      const segments = String(folder).split('/').filter(Boolean);
      if (segments.length > 0) {
        targetFolderId = await getOrCreateDriveFolderPath(segments, env.GDRIVE_FOLDER_ID);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
    }
  }

  let driveFile;
  try {
    driveFile = await uploadBufferToDrive({
      name: tempMeta.originalName,
      mimeType: tempMeta.mimeType,
      buffer,
      parentFolderId: targetFolderId,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Google Drive upload failed during finalization', e);
    throw new Error('Upload ke Google Drive gagal. Silakan coba lagi.');
  }

  const created = await prisma.fileObject.create({
    data: {
      createdById: userId,
      driveFileId: driveFile.id,
      name: driveFile.name || tempMeta.originalName,
      mimeType: driveFile.mimeType || tempMeta.mimeType,
      sizeBytes: driveFile.size ? Number(driveFile.size) : tempMeta.size,
    },
  });

  await deleteTempFile(tempId);

  if (env.GDRIVE_PUBLIC_FILES) {
    try {
      await setDriveFilePublicReadable(driveFile.id);
    } catch (e) {
      // eslint-disable-next-line no-console
    }
  }

  return {
    ...created,
    publicUrl: `/api/v1/files/${created.id}/public`,
    driveUrl: `https://drive.google.com/uc?export=view&id=${driveFile.id}`,
  };
}

// Bikin URL public (bisa diakses sp aja) dr file ID.
export function getPublicFileUrl(fileId, baseUrl = '') {
  if (!fileId) return '';
  return `${baseUrl}/api/v1/files/${fileId}/public`;
}

// Cek validasi: ini beneran URL file public atau bkn?
export function isPublicFileUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\/api\/v1\/files\/\d+\/public/.test(url);
}

// Sedot ID file asli dari dalem URL public td.
export function extractFileIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/api\/v1\/files\/(\d+)\/public/);
  return match ? parseInt(match[1], 10) : null;
}
