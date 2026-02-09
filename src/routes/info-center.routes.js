import { Router } from 'express';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { APP_SETTING_KEYS } from '../constants/settings.js';

const router = Router();

// Admin: ambil konten Info Center (disimpan di AppSetting sebagai JSON)
// Key: info_center
router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const row = await prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.INFO_CENTER } });
    const value = row?.value && typeof row.value === 'object' ? row.value : { sections: [] };
    res.json({ data: value });
  }),
);

// Admin: simpan konten Info Center
router.put(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { sections } = req.body;
    // Validasi basic
    if (!Array.isArray(sections)) {
      res.status(400);
      throw new Error('Sections must be an array');
    }

    // Simpan ke AppSetting
    // Kita wrap dalam object { sections: [...] } agar konsisten
    const value = { sections };
    await prisma.appSetting.upsert({
      where: { key: APP_SETTING_KEYS.INFO_CENTER },
      update: { value },
      create: { key: APP_SETTING_KEYS.INFO_CENTER, value },
    });

    res.json({ message: 'Info Center updated', data: value });
  }),
);

export default router;
