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

export default router;
