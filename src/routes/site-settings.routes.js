import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { toDriveUploadHttpErrorMessage, uploadBufferToDrive, getOrCreateDriveFolderPath } from '../storage/gdrive.js';
import { CMS_SETTING_KEYS } from '../constants/settings.js';
import { FOLDER_CMS_IMAGES, toFolderSegments } from '../constants/drive-folders.js';

const router = Router();

// Multer untuk upload gambar
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Hanya file gambar yang diperbolehkan'), false);
    }
  },
});

const CMS_KEYS = CMS_SETTING_KEYS;

// Publik: Ambil setting tunggal berdasarkan key (untuk diambil genbi-client)
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    if (!CMS_KEYS.includes(key)) {
      throw new HttpError(400, 'Key tidak valid');
    }

    const row = await prisma.appSetting.findUnique({ where: { key } });

    res.json({
      data: row ? { key: row.key, value: row.value } : { key, value: null },
    });
  }),
);

router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: CMS_KEYS } },
    });

    const settings = {};
    for (const key of CMS_KEYS) {
      const row = rows.find((r) => r.key === key);
      settings[key] = row?.value || null;
    }

    res.json({ data: settings });
  }),
);

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

// Admin: Upload gambar untuk CMS (mengembalikan URL publik)
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

    let targetFolderId = env.GDRIVE_FOLDER_ID;
    try {
      targetFolderId = await getOrCreateDriveFolderPath(toFolderSegments(FOLDER_CMS_IMAGES), env.GDRIVE_FOLDER_ID);
    } catch {
      /* fall back to root */
    }

    let driveFile;
    try {
      driveFile = await uploadBufferToDrive({
        name: `cms_${Date.now()}_${file.originalname}`,
        mimeType: file.mimetype,
        buffer: file.buffer,
        parentFolderId: targetFolderId,
      });
    } catch (e) {
      throw new HttpError(503, toDriveUploadHttpErrorMessage(e));
    }

    const fileRecord = await prisma.fileObject.create({
      data: {
        createdById: req.auth.userId,
        driveFileId: driveFile.id,
        name: driveFile.name || file.originalname,
        mimeType: driveFile.mimeType || file.mimetype,
        sizeBytes: driveFile.size ? Number(driveFile.size) : file.size,
      },
    });

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

router.delete(
  '/:key',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    if (!CMS_KEYS.includes(key)) {
      throw new HttpError(400, 'Key tidak valid');
    }

    await prisma.appSetting.delete({ where: { key } }).catch(() => { });

    res.json({ data: { key, deleted: true } });
  }),
);

// Validasi struktur value berdasarkan key setting
function validateSettingValue(key, value) {
  if (typeof value !== 'object' || value === null) {
    return 'Value harus berupa object';
  }

  switch (key) {
    case 'cms_hero':
      if (value.headline !== undefined && typeof value.headline !== 'string') return 'headline harus berupa string';
      if (value.subheadline !== undefined && typeof value.subheadline !== 'string') return 'subheadline harus berupa string';
      break;

    case 'cms_about':
      if (value.title !== undefined && typeof value.title !== 'string') return 'title harus berupa string';
      if (value.description !== undefined && typeof value.description !== 'string') return 'description harus berupa string';
      break;

    case 'cms_history':
      if (value.title !== undefined && typeof value.title !== 'string') return 'title harus berupa string';
      if (value.subtitle !== undefined && typeof value.subtitle !== 'string') return 'subtitle harus berupa string';
      if (value.image !== undefined && typeof value.image !== 'string') return 'image harus berupa string';
      if (value.body !== undefined && typeof value.body !== 'string') return 'body harus berupa string';
      break;

    case 'cms_cta':
      if (value.text !== undefined && typeof value.text !== 'string') return 'text harus berupa string';
      if (value.buttonText !== undefined && typeof value.buttonText !== 'string') return 'buttonText harus berupa string';
      break;

    case 'cms_branding':
      if (value.siteName !== undefined && typeof value.siteName !== 'string') return 'siteName harus berupa string';
      break;

    case 'cms_vision_mission':
      if (value.vision !== undefined && typeof value.vision !== 'string') return 'vision harus berupa string';
      if (value.missions !== undefined && !Array.isArray(value.missions)) return 'missions harus berupa array';
      break;

    case 'cms_faqs':
      if (value.items !== undefined && !Array.isArray(value.items)) return 'items harus berupa array';
      break;

    case 'cms_testimonials':
      if (value.items !== undefined && !Array.isArray(value.items)) return 'items harus berupa array';
      break;

    case 'cms_footer':
      if (value.description !== undefined && typeof value.description !== 'string') return 'description harus berupa string';
      if (value.address !== undefined && typeof value.address !== 'string') return 'address harus berupa string';
      if (value.socialLinks !== undefined && !Array.isArray(value.socialLinks)) return 'socialLinks harus berupa array';
      break;

    case 'cms_scholarship':
      if (value.title !== undefined && typeof value.title !== 'string') return 'title harus berupa string';
      if (value.description !== undefined && typeof value.description !== 'string') return 'description harus berupa string';
      break;

    case 'cms_hero_avatars':
      if (value.avatars !== undefined && !Array.isArray(value.avatars)) return 'avatars harus berupa array';
      break;

    case 'cms_scholarship_page':
      if (value.title !== undefined && typeof value.title !== 'string') return 'title harus berupa string';
      if (value.subtitle !== undefined && typeof value.subtitle !== 'string') return 'subtitle harus berupa string';
      if (value.requirements !== undefined && !Array.isArray(value.requirements)) return 'requirements harus berupa array';
      if (value.documents !== undefined && !Array.isArray(value.documents)) return 'documents harus berupa array';
      if (value.isOpen !== undefined && typeof value.isOpen !== 'boolean') return 'isOpen harus berupa boolean';
      break;

    default:
      break;
  }

  return null; // Valid
}

export default router;
