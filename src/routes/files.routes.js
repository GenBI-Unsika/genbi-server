import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { downloadDriveFileStream, uploadBufferToDrive } from '../storage/gdrive.js';

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
  requireRole('admin', 'member'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!env.GDRIVE_FOLDER_ID) throw new HttpError(500, 'GDRIVE_FOLDER_ID is not configured');

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
      throw new HttpError(500, `Google Drive upload failed: ${e?.message || 'unknown error'}`);
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

    res.status(201).json({ data: created });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.fileObject.findUnique({ where: { id: req.params.id } });
    if (!row) throw new HttpError(404, 'File not found');
    res.json({ data: row });
  })
);

router.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.fileObject.findUnique({ where: { id: req.params.id } });
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
  })
);

export default router;
