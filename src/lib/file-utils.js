/**
 * File utilities for internal finalization of staged uploads
 *
 * This module provides helper functions for the "Stage-then-Commit" upload workflow.
 * Files are first uploaded to temporary storage for preview, then finalized to
 * permanent storage (Google Drive) when the form is submitted.
 */

import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { getTempFile, readTempFile, deleteTempFile } from '../storage/temp-storage.js';
import { uploadBufferToDrive, setDriveFilePublicReadable } from '../storage/gdrive.js';

/**
 * Internal finalize upload - moves a staged file to permanent Google Drive storage
 * This function is meant to be called from route handlers when processing form submissions.
 *
 * @param {Object} params
 * @param {string} params.tempId - The temporary file ID from staging
 * @param {number} params.userId - The user performing the action
 * @param {string} [params.folder] - Optional folder name for organization
 * @returns {Promise<Object>} The created FileObject with public URL
 * @throws {Error} If temp file not found, access denied, or upload fails
 */
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

  // Verify ownership
  if (tempMeta.userId !== userId) {
    throw new Error('Tidak memiliki akses ke file ini');
  }

  const buffer = await readTempFile(tempId);
  if (!buffer) {
    throw new Error('File temporary tidak ditemukan atau sudah expired');
  }

  // Upload to Google Drive
  let driveFile;
  try {
    driveFile = await uploadBufferToDrive({
      name: tempMeta.originalName,
      mimeType: tempMeta.mimeType,
      buffer,
      parentFolderId: env.GDRIVE_FOLDER_ID,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Google Drive upload failed during finalization', e);
    throw new Error('Upload ke Google Drive gagal. Silakan coba lagi.');
  }

  // Create database record
  const created = await prisma.fileObject.create({
    data: {
      createdById: userId,
      driveFileId: driveFile.id,
      name: driveFile.name || tempMeta.originalName,
      mimeType: driveFile.mimeType || tempMeta.mimeType,
      sizeBytes: driveFile.size ? Number(driveFile.size) : tempMeta.size,
      // Note: folder is used for Drive organization but not stored in DB
    },
  });

  // Delete temp file only after successful upload and DB record creation
  await deleteTempFile(tempId);

  // Set file as publicly readable if configured
  if (env.GDRIVE_PUBLIC_FILES) {
    try {
      await setDriveFilePublicReadable(driveFile.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to set Drive file public permission', e);
    }
  }

  return {
    ...created,
    // Public proxy URL - permanent, no token needed
    publicUrl: `/api/v1/files/${created.id}/public`,
    // Legacy direct Drive URL (may have permission issues)
    driveUrl: `https://drive.google.com/uc?export=view&id=${driveFile.id}`,
  };
}

/**
 * Get the public proxy URL for a file
 * @param {number} fileId - The FileObject ID
 * @param {string} [baseUrl] - Optional base URL (defaults to relative path)
 * @returns {string} The public proxy URL
 */
export function getPublicFileUrl(fileId, baseUrl = '') {
  if (!fileId) return '';
  return `${baseUrl}/api/v1/files/${fileId}/public`;
}

/**
 * Check if a URL is a file object public URL
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isPublicFileUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\/api\/v1\/files\/\d+\/public/.test(url);
}

/**
 * Extract file ID from a public file URL
 * @param {string} url - The public file URL
 * @returns {number|null} The file ID or null if not a valid URL
 */
export function extractFileIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/api\/v1\/files\/(\d+)\/public/);
  return match ? parseInt(match[1], 10) : null;
}
