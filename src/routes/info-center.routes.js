import { Router } from 'express';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';

const router = Router();

// Admin: get Info Center content (stored in AppSetting as JSON)
// Key: info_center
router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const row = await prisma.appSetting.findUnique({ where: { key: 'info_center' } });
    const value = row?.value && typeof row.value === 'object' ? row.value : { sections: [] };
    res.json({ data: value });
  }),
);

export default router;
