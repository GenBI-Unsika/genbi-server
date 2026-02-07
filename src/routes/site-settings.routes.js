import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { toDriveUploadHttpErrorMessage, uploadBufferToDrive } from '../storage/gdrive.js';

const router = Router();

// Multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for images
  },
  fileFilter: (_req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Hanya file gambar yang diperbolehkan'), false);
    }
  },
});

// Valid CMS setting keys
const CMS_KEYS = ['cms_hero', 'cms_about', 'cms_cta', 'cms_branding'];

// Public: Get a single setting by key (for genbi-client to fetch)
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    // Allow reading CMS settings publicly
    if (!CMS_KEYS.includes(key)) {
      throw new HttpError(400, 'Key tidak valid');
    }

    const row = await prisma.appSetting.findUnique({ where: { key } });

    // Return null value if not found (client will use defaults)
    res.json({
      data: row ? { key: row.key, value: row.value } : { key, value: null },
    });
  }),
);

// Admin: Get all CMS settings at once
router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: CMS_KEYS } },
    });

    // Convert to object for easier consumption
    const settings = {};
    for (const key of CMS_KEYS) {
      const row = rows.find((r) => r.key === key);
      settings[key] = row?.value || null;
    }

    res.json({ data: settings });
  }),
);

// Admin: Update a setting by key
router.patch(
  '/:key',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    if (!CMS_KEYS.includes(key)) {
      throw new HttpError(400, 'Key tidak valid');
    }

    if (value === undefined || value === null) {
      throw new HttpError(400, 'Value tidak boleh kosong');
    }

    // Validate the structure based on key
    const validationError = validateSettingValue(key, value);
    if (validationError) {
      throw new HttpError(400, validationError);
    }

    const row = await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    res.json({ data: { key: row.key, value: row.value } });
  }),
);

// Admin: Upload image for CMS (returns the public URL)
router.post(
  '/upload',
  requireAuth,
  requireAdminAccess,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!env.GDRIVE_FOLDER_ID) {
      throw new HttpError(500, 'Upload belum tersedia. Hubungi admin.');
    }

    const file = req.file;
    if (!file) {
      throw new HttpError(400, 'File tidak ditemukan');
    }

    let driveFile;
    try {
      driveFile = await uploadBufferToDrive({
        name: `cms_${Date.now()}_${file.originalname}`,
        mimeType: file.mimetype,
        buffer: file.buffer,
        parentFolderId: env.GDRIVE_FOLDER_ID,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Google Drive upload failed', e);
      throw new HttpError(503, toDriveUploadHttpErrorMessage(e));
    }

    // Store in FileObject for tracking
    const fileRecord = await prisma.fileObject.create({
      data: {
        createdById: req.auth.userId,
        driveFileId: driveFile.id,
        name: driveFile.name || file.originalname,
        mimeType: driveFile.mimeType || file.mimetype,
        sizeBytes: driveFile.size ? Number(driveFile.size) : file.size,
      },
    });

    // Return the public Google Drive URL
    // Note: File must be shared publicly in Drive for this URL to work
    const publicUrl = `https://drive.google.com/uc?export=view&id=${driveFile.id}`;

    res.status(201).json({
      data: {
        id: fileRecord.id,
        driveFileId: driveFile.id,
        url: publicUrl,
        name: fileRecord.name,
        mimeType: fileRecord.mimeType,
      },
    });
  }),
);

// Admin: Delete a setting by key (reset to default)
router.delete(
  '/:key',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    if (!CMS_KEYS.includes(key)) {
      throw new HttpError(400, 'Key tidak valid');
    }

    await prisma.appSetting.delete({ where: { key } }).catch(() => {
      // Ignore if not found
    });

    res.json({ data: { key, deleted: true } });
  }),
);

/**
 * Validate the value structure based on setting key
 */
function validateSettingValue(key, value) {
  if (typeof value !== 'object' || value === null) {
    return 'Value harus berupa object';
  }

  switch (key) {
    case 'cms_hero':
      // Expected: { title, subtitle, backgroundImage, ctaText, ctaLink }
      if (typeof value.title !== 'string') return 'title harus berupa string';
      if (typeof value.subtitle !== 'string') return 'subtitle harus berupa string';
      break;

    case 'cms_about':
      // Expected: { title, description, image, stats: [{ value, label }] }
      if (typeof value.title !== 'string') return 'title harus berupa string';
      if (typeof value.description !== 'string') return 'description harus berupa string';
      break;

    case 'cms_cta':
      // Expected: { title, description, buttonText, buttonLink }
      if (typeof value.title !== 'string') return 'title harus berupa string';
      if (typeof value.description !== 'string') return 'description harus berupa string';
      break;

    case 'cms_branding':
      // Expected: { siteName, logo, favicon, footerText }
      if (typeof value.siteName !== 'string') return 'siteName harus berupa string';
      break;

    default:
      return 'Key tidak dikenal';
  }

  return null; // Valid
}

export default router;
