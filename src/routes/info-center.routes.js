import { Router } from 'express';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { APP_SETTING_KEYS } from '../constants/settings.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const row = await prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.INFO_CENTER } });
    const value = row?.value && typeof row.value === 'object' ? row.value : { sections: [] };
    res.json({ data: value });
  }),
);

router.put(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { sections } = req.body;
    if (!Array.isArray(sections)) {
      res.status(400);
      throw new Error('Sections must be an array');
    }

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
