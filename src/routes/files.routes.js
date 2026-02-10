import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { signFileToken, verifyFileToken } from '../auth/tokens.js';
import { downloadDriveFileStream, setDriveFilePublicReadable, toDriveUploadHttpErrorMessage, uploadBufferToDrive } from '../storage/gdrive.js';
import { saveTempFile, getTempFileStream, readTempFile, deleteTempFile, getTempFile } from '../storage/temp-storage.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

router.post(
  '/',
  requireAuth,
  requireMinRole('member'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!env.GDRIVE_FOLDER_ID) throw new HttpError(500, 'Upload belum tersedia. Hubungi admin.');

    const file = req.file;
    if (!file) throw new HttpError(400, 'Missing file (multipart field name: file)');

    let driveFile;
    try {
      driveFile = await uploadBufferToDrive({
        name: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
        parentFolderId: env.GDRIVE_FOLDER_ID,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Google Drive upload failed', e);
      throw new HttpError(503, toDriveUploadHttpErrorMessage(e));
    }

    const created = await prisma.fileObject.create({
      data: {
        createdById: req.auth.userId,
        driveFileId: driveFile.id,
        name: driveFile.name || file.originalname,
        mimeType: driveFile.mimeType || file.mimetype,
        sizeBytes: driveFile.size ? Number(driveFile.size) : file.size,
      },
    });

    if (env.GDRIVE_PUBLIC_FILES) {
      try {
        await setDriveFilePublicReadable(driveFile.id);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to set Drive file public permission', e);
      }
    }

    // URL Publik (File Drive harus dibagikan secara publik agar ini berfungsi)
    const publicUrl = `https://drive.google.com/uc?export=view&id=${driveFile.id}`;

    const base = `${req.protocol}://${req.get('host')}`;
    const previewToken = signFileToken({ userId: req.auth.userId, fileObjectId: created.id, disposition: 'inline' });
    const downloadToken = signFileToken({ userId: req.auth.userId, fileObjectId: created.id, disposition: 'attachment' });

    res.status(201).json({
      data: {
        ...created,
        url: publicUrl,
        previewUrl: `${base}/api/v1/files/${created.id}/content?t=${encodeURIComponent(previewToken)}`,
        downloadUrl: `${base}/api/v1/files/${created.id}/content?t=${encodeURIComponent(downloadToken)}`,
        signedUrlExpiresInSeconds: env.FILE_TOKEN_TTL_SECONDS,
      },
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const row = await prisma.fileObject.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, 'File not found');
    res.json({ data: row });
  }),
);

router.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const row = await prisma.fileObject.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, 'File not found');

    let stream;
    try {
      stream = await downloadDriveFileStream(row.driveFileId);
    } catch (e) {
      throw new HttpError(502, `Google Drive download failed: ${e?.message || 'unknown error'}`);
    }
    res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`);
    stream.on('error', () => {
      // Biarkan middleware error menangani jika memungkinkan
      res.destroy();
    });
    stream.pipe(res);
  }),
);

router.get(
  '/:id/link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const row = await prisma.fileObject.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new HttpError(404, 'File not found');

    const previewToken = signFileToken({ userId: req.auth.userId, fileObjectId: id, disposition: 'inline' });
    const downloadToken = signFileToken({ userId: req.auth.userId, fileObjectId: id, disposition: 'attachment' });

    const base = `${req.protocol}://${req.get('host')}`;
    res.json({
      data: {
        previewUrl: `${base}/api/v1/files/${id}/content?t=${encodeURIComponent(previewToken)}`,
        downloadUrl: `${base}/api/v1/files/${id}/content?t=${encodeURIComponent(downloadToken)}`,
        expiresInSeconds: env.FILE_TOKEN_TTL_SECONDS,
      },
    });
  }),
);

router.get(
  '/:id/content',
  asyncHandler(async (req, res) => {
    const token = String(req.query?.t || '');
    if (!token) throw new HttpError(401, 'Missing file token');

    let decoded;
    try {
      decoded = verifyFileToken(token);
    } catch {
      throw new HttpError(401, 'Invalid or expired file token');
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const fid = Number(decoded?.fid);
    if (fid !== id) throw new HttpError(403, 'Forbidden');

    const row = await prisma.fileObject.findUnique({
      where: { id },
      select: { id: true, driveFileId: true, name: true, mimeType: true },
    });
    if (!row) throw new HttpError(404, 'File not found');

    let stream;
    try {
      stream = await downloadDriveFileStream(row.driveFileId);
    } catch (e) {
      throw new HttpError(502, `Google Drive download failed: ${e?.message || 'unknown error'}`);
    }

    const disp = decoded?.disp === 'inline' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(row.name)}`);
    stream.on('error', () => {
      res.destroy();
    });
    stream.pipe(res);
  }),
);

// ============================================================================
// PUBLIC PROXY ROUTE - Permanent image serving without token
// ============================================================================
// This route serves files publicly without requiring authentication or tokens.
// Used for displaying images in public pages (articles, profiles, etc.)
// Files are streamed from Google Drive with caching headers for performance.
router.get(
  '/:id/public',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const row = await prisma.fileObject.findUnique({
      where: { id },
      select: { id: true, driveFileId: true, name: true, mimeType: true },
    });
    if (!row) throw new HttpError(404, 'File not found');

    let stream;
    try {
      stream = await downloadDriveFileStream(row.driveFileId);
    } catch (e) {
      throw new HttpError(502, `Google Drive download failed: ${e?.message || 'unknown error'}`);
    }

    // Set caching headers for better performance
    // Cache for 1 hour in browsers, allow CDN caching
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`);
    // Allow cross-origin embedding (for img tags from different origins)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    stream.on('error', () => {
      res.destroy();
    });
    stream.pipe(res);
  }),
);

// Upload file ke temporary storage untuk preview sebelum final submit

router.post(
  '/staging',
  requireAuth,
  requireMinRole('member'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'Missing file (multipart field name: file)');

    const result = await saveTempFile({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      userId: req.auth.userId,
    });

    const base = `${req.protocol}://${req.get('host')}`;

    res.status(201).json({
      data: {
        ...result,
        previewUrl: `${base}/api/v1/files/temp/${result.tempId}`,
        isStaged: true,
      },
    });
  }),
);

// Ambil/preview file sementara
router.get(
  '/temp/:tempId',
  asyncHandler(async (req, res) => {
    const { tempId } = req.params;
    const result = await getTempFileStream(tempId);

    if (!result) {
      throw new HttpError(404, 'File temporary tidak ditemukan atau sudah expired');
    }

    const { stream, metadata } = result;

    res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(metadata.originalName)}`);
    res.setHeader('Cache-Control', 'private, max-age=300'); // cache 5 menit
    // Izinkan preview staged untuk di-embed dari origin lain (berguna saat dev frontend & API beda port).
    // Helmet mungkin menset CORP ke 'same-origin' secara default yang memblokir load <img> cross-origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    stream.on('error', () => {
      res.destroy();
    });
    stream.pipe(res);
  }),
);

// Ambil metadata file sementara
router.get(
  '/temp/:tempId/info',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tempId } = req.params;
    const metadata = getTempFile(tempId);

    if (!metadata) {
      throw new HttpError(404, 'File temporary tidak ditemukan atau sudah expired');
    }

    // Hanya izinkan pemilik melihat metadata
    if (metadata.userId !== req.auth.userId) {
      throw new HttpError(403, 'Tidak memiliki akses ke file ini');
    }

    res.json({
      data: {
        tempId: metadata.tempId,
        name: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        expiresAt: metadata.expiresAt,
      },
    });
  }),
);

// Hapus file sementara
router.delete(
  '/temp/:tempId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tempId } = req.params;
    const metadata = getTempFile(tempId);

    if (!metadata) {
      throw new HttpError(404, 'File temporary tidak ditemukan');
    }

    // Hanya izinkan pemilik untuk menghapus
    if (metadata.userId !== req.auth.userId) {
      throw new HttpError(403, 'Tidak memiliki akses ke file ini');
    }

    await deleteTempFile(tempId);
    res.json({ message: 'File temporary berhasil dihapus' });
  }),
);

// Finalisasi file sementara -> Upload ke Google Drive
router.post(
  '/finalize',
  requireAuth,
  requireMinRole('member'),
  asyncHandler(async (req, res) => {
    const { tempId, folder } = req.body;

    if (!tempId) {
      throw new HttpError(400, 'tempId wajib diisi');
    }

    if (!env.GDRIVE_FOLDER_ID) {
      throw new HttpError(500, 'Upload belum tersedia. Hubungi admin.');
    }

    const tempMeta = getTempFile(tempId);
    if (!tempMeta) {
      throw new HttpError(404, 'File temporary tidak ditemukan atau sudah expired');
    }

    // Hanya izinkan pemilik untuk memfinalisasi
    if (tempMeta.userId !== req.auth.userId) {
      throw new HttpError(403, 'Tidak memiliki akses ke file ini');
    }

    const buffer = await readTempFile(tempId);
    if (!buffer) {
      throw new HttpError(404, 'File temporary tidak ditemukan atau sudah expired');
    }

    const metadata = tempMeta;

    let driveFile;
    try {
      driveFile = await uploadBufferToDrive({
        name: metadata.originalName,
        mimeType: metadata.mimeType,
        buffer,
        parentFolderId: env.GDRIVE_FOLDER_ID,
      });
    } catch (e) {
      console.error('Google Drive upload failed', e);
      throw new HttpError(503, toDriveUploadHttpErrorMessage(e));
    }

    const created = await prisma.fileObject.create({
      data: {
        createdById: req.auth.userId,
        driveFileId: driveFile.id,
        name: driveFile.name || metadata.originalName,
        mimeType: driveFile.mimeType || metadata.mimeType,
        sizeBytes: driveFile.size ? Number(driveFile.size) : metadata.size,
        // Note: folder is for Drive organization only, not stored in DB
      },
    });

    // Hanya hapus setelah sukses di Drive + DB agar user bisa retry jika gagal sementara.
    await deleteTempFile(tempId);

    if (env.GDRIVE_PUBLIC_FILES) {
      try {
        await setDriveFilePublicReadable(driveFile.id);
      } catch (e) {
        console.warn('Failed to set Drive file public permission', e);
      }
    }

    const publicUrl = `https://drive.google.com/uc?export=view&id=${driveFile.id}`;
    const base = `${req.protocol}://${req.get('host')}`;
    const previewToken = signFileToken({ userId: req.auth.userId, fileObjectId: created.id, disposition: 'inline' });
    const downloadToken = signFileToken({ userId: req.auth.userId, fileObjectId: created.id, disposition: 'attachment' });

    res.status(201).json({
      data: {
        ...created,
        url: publicUrl,
        previewUrl: `${base}/api/v1/files/${created.id}/content?t=${encodeURIComponent(previewToken)}`,
        downloadUrl: `${base}/api/v1/files/${created.id}/content?t=${encodeURIComponent(downloadToken)}`,
        signedUrlExpiresInSeconds: env.FILE_TOKEN_TTL_SECONDS,
      },
    });
  }),
);

// Finalisasi massal beberapa file sementara
router.post(
  '/finalize-bulk',
  requireAuth,
  requireMinRole('member'),
  asyncHandler(async (req, res) => {
    const { files } = req.body; // Array dari { tempId, folder? }

    if (!Array.isArray(files) || files.length === 0) {
      throw new HttpError(400, 'files array wajib diisi');
    }

    if (!env.GDRIVE_FOLDER_ID) {
      throw new HttpError(500, 'Upload belum tersedia. Hubungi admin.');
    }

    const results = [];
    const errors = [];

    for (const item of files) {
      try {
        const tempMeta = getTempFile(item.tempId);
        if (!tempMeta) {
          errors.push({ tempId: item.tempId, error: 'File tidak ditemukan atau sudah expired' });
          continue;
        }

        if (tempMeta.userId !== req.auth.userId) {
          errors.push({ tempId: item.tempId, error: 'Tidak memiliki akses' });
          continue;
        }

        const buffer = await readTempFile(item.tempId);
        if (!buffer) {
          errors.push({ tempId: item.tempId, error: 'File tidak ditemukan atau sudah expired' });
          continue;
        }

        const metadata = tempMeta;

        const driveFile = await uploadBufferToDrive({
          name: metadata.originalName,
          mimeType: metadata.mimeType,
          buffer,
          parentFolderId: env.GDRIVE_FOLDER_ID,
        });

        const created = await prisma.fileObject.create({
          data: {
            createdById: req.auth.userId,
            driveFileId: driveFile.id,
            name: driveFile.name || metadata.originalName,
            mimeType: driveFile.mimeType || metadata.mimeType,
            sizeBytes: driveFile.size ? Number(driveFile.size) : metadata.size,
            // Note: folder is for Drive organization only, not stored in DB
          },
        });

        await deleteTempFile(item.tempId);

        if (env.GDRIVE_PUBLIC_FILES) {
          try {
            await setDriveFilePublicReadable(driveFile.id);
          } catch {
            // Abaikan error permission untuk bulk
          }
        }

        const publicUrl = `https://drive.google.com/uc?export=view&id=${driveFile.id}`;
        const base = `${req.protocol}://${req.get('host')}`;
        const previewToken = signFileToken({ userId: req.auth.userId, fileObjectId: created.id, disposition: 'inline' });

        results.push({
          tempId: item.tempId,
          fileId: created.id,
          url: publicUrl,
          previewUrl: `${base}/api/v1/files/${created.id}/content?t=${encodeURIComponent(previewToken)}`,
          name: created.name,
        });
      } catch (e) {
        errors.push({ tempId: item.tempId, error: e.message || 'Upload failed' });
      }
    }

    res.status(201).json({
      data: {
        uploaded: results,
        errors,
        totalSuccess: results.length,
        totalErrors: errors.length,
      },
    });
  }),
);

export default router;
