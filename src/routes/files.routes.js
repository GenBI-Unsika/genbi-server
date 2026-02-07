import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { signFileToken, verifyFileToken } from '../auth/tokens.js';
import { downloadDriveFileStream, setDriveFilePublicReadable, toDriveUploadHttpErrorMessage, uploadBufferToDrive } from '../storage/gdrive.js';

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

    // Public URL (Drive file must be shared publicly for this to work)
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
      // Let error middleware handle if possible
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

export default router;
