import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess, ADMIN_ROLES } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { toDriveUploadHttpErrorMessage, uploadBufferToDrive } from '../storage/gdrive.js';
import { generateWordDocument, prepareDispensationData } from '../lib/docx-generator.js';

const router = Router();

// Multer configuration for template upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.docx' && ext !== '.doc') {
      return cb(new Error('Hanya file Word (.doc/.docx) yang diizinkan'));
    }
    cb(null, true);
  },
});

// Get my dispensations
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const dispensations = await prisma.dispensation.findMany({
      where: { userId: req.auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: dispensations });
  }),
);

// Get all dispensations (admin only)
router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status } : {};

    const [dispensations, total] = await Promise.all([
      prisma.dispensation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          user: { include: { profile: true } },
        },
      }),
      prisma.dispensation.count({ where }),
    ]);

    res.json({
      data: dispensations,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  }),
);

// Create dispensation
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      nama: z.string().min(1, 'Nama wajib diisi'),
      npm: z.string().min(1, 'NPM wajib diisi'),
      fakultas: z.string().optional(),
      prodi: z.string().optional(),
      kegiatan: z.string().min(1, 'Nama kegiatan wajib diisi'),
      tanggal: z.string().min(1, 'Tanggal wajib diisi'),
      alasan: z.string().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    const dispensation = await prisma.dispensation.create({
      data: {
        userId: req.auth.userId,
        nama: body.data.nama,
        npm: body.data.npm,
        fakultas: body.data.fakultas,
        prodi: body.data.prodi,
        kegiatan: body.data.kegiatan,
        tanggal: new Date(body.data.tanggal),
        alasan: body.data.alasan,
        status: 'DIAJUKAN',
      },
    });

    res.status(201).json({ data: dispensation });
  }),
);

// Update dispensation status (admin only)
router.patch(
  '/:id/status',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const { status, reviewNotes } = req.body;

    const validStatuses = ['DIAJUKAN', 'DIPROSES', 'DISETUJUI', 'DITOLAK'];
    if (!validStatuses.includes(status)) {
      throw new HttpError(400, 'Status tidak valid');
    }

    const dispensation = await prisma.dispensation.update({
      where: { id },
      data: {
        status,
        reviewNotes,
        reviewedById: req.auth.userId,
        reviewedAt: new Date(),
      },
    });

    res.json({ data: dispensation });
  }),
);

// Update dispensation (owner only, only while still DIAJUKAN)
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const dispensation = await prisma.dispensation.findUnique({ where: { id } });
    if (!dispensation) {
      throw new HttpError(404, 'Dispensasi tidak ditemukan');
    }

    if (dispensation.userId !== req.auth.userId) {
      throw new HttpError(403, 'Forbidden');
    }

    if (dispensation.status !== 'DIAJUKAN') {
      throw new HttpError(400, 'Pengajuan hanya bisa diedit saat status masih DIAJUKAN');
    }

    const schema = z.object({
      kegiatan: z.string().min(1, 'Nama kegiatan wajib diisi').optional(),
      tanggal: z.string().min(1, 'Tanggal wajib diisi').optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    const updated = await prisma.dispensation.update({
      where: { id },
      data: {
        ...(body.data.kegiatan ? { kegiatan: body.data.kegiatan } : {}),
        ...(body.data.tanggal ? { tanggal: new Date(body.data.tanggal) } : {}),
      },
    });

    res.json({ data: updated });
  }),
);

// Delete dispensation (owner or admin)
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const dispensation = await prisma.dispensation.findUnique({ where: { id } });
    if (!dispensation) {
      throw new HttpError(404, 'Dispensasi tidak ditemukan');
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (dispensation.userId !== req.auth.userId && !ADMIN_ROLES.includes(user?.role)) {
      throw new HttpError(403, 'Forbidden');
    }

    await prisma.dispensation.delete({ where: { id } });

    res.json({ message: 'Dispensasi berhasil dihapus' });
  }),
);

// ==================== TEMPLATE MANAGEMENT ====================

// Get active template (admin only)
router.get(
  '/template/active',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const template = await prisma.dispensationTemplate.findFirst({
      where: { isActive: true },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ data: template });
  }),
);

// Upload template (admin only)
router.post(
  '/template/upload',
  requireAuth,
  requireAdminAccess,
  upload.single('template'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'File template wajib diupload');
    }

    if (!env.GDRIVE_FOLDER_ID) throw new HttpError(500, 'Upload belum tersedia. Hubungi admin.');

    // Upload to Google Drive
    let driveFile;
    try {
      driveFile = await uploadBufferToDrive({
        name: `template-dispensasi-${Date.now()}${path.extname(req.file.originalname)}`,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        parentFolderId: env.GDRIVE_FOLDER_ID,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Google Drive upload failed', e);
      throw new HttpError(503, toDriveUploadHttpErrorMessage(e));
    }

    // Deactivate old templates
    await prisma.dispensationTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new template record
    const template = await prisma.dispensationTemplate.create({
      data: {
        fileName: req.file.originalname,
        // Use Drive preview URL for iframe preview on frontend
        fileUrl: `https://drive.google.com/file/d/${driveFile.id}/preview`,
        uploadedBy: req.auth.userId,
        isActive: true,
      },
    });

    res.status(201).json({ data: template, message: 'Template berhasil diupload' });
  }),
);

// Delete template (admin only)
router.delete(
  '/template/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.dispensationTemplate.delete({ where: { id } });

    res.json({ message: 'Template berhasil dihapus' });
  }),
);

// Generate letter for approved dispensation (admin only)
router.post(
  '/:id/generate-letter',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const dispensation = await prisma.dispensation.findUnique({ where: { id } });
    if (!dispensation) {
      throw new HttpError(404, 'Dispensasi tidak ditemukan');
    }

    if (dispensation.status !== 'DISETUJUI') {
      throw new HttpError(400, 'Hanya dispensasi yang disetujui yang bisa digenerate suratnya');
    }

    // Get active template
    const template = await prisma.dispensationTemplate.findFirst({
      where: { isActive: true },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!template) {
      throw new HttpError(400, 'Template surat belum diupload');
    }

    // Download template from Google Drive (temporary implementation)
    // In production, you should download the template file
    // For now, we'll return an error with instructions
    throw new HttpError(500, 'Fitur generate letter memerlukan template file di server. Silakan hubungi administrator.');

    // TODO: Implement actual document generation
    // const templateBuffer = await downloadFromGoogleDrive(template.fileUrl);
    // const data = prepareDispensationData(dispensation);
    // const generatedDoc = await generateWordDocument(templateBuffer, data);
    //
    // const driveFile = await uploadToGoogleDrive({
    //   buffer: generatedDoc,
    //   mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    //   originalname: `surat-dispensasi-${dispensation.npm}-${Date.now()}.docx`,
    //   folder: 'dispensation-letters',
    // });
    //
    // await prisma.dispensation.update({
    //   where: { id },
    //   data: { fileUrl: driveFile.url },
    // });
    //
    // res.json({ data: { fileUrl: driveFile.url }, message: 'Surat berhasil digenerate' });
  }),
);

export default router;
