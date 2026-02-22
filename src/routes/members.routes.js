import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';

const router = Router();

router.get(
  '/admin/all',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { role, search, isActive } = req.query;

    const allowedRoles = ['super_admin', 'admin', 'awardee'];

    const where = {};
    if (role) {
      where.role = { name: String(role) };
    } else {
      where.role = { name: { in: allowedRoles } };
    }

    if (isActive !== undefined) {
      where.isActive = String(isActive) === 'true';
    }

    if (search) {
      const q = String(search);
      where.OR = [{ email: { contains: q } }, { profile: { name: { contains: q } } }, { profile: { npm: { contains: q } } }];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        role: true, // Select the relation
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            name: true,
            avatar: true,
            npm: true,
            phone: true,
            faculty: { select: { name: true } },
            studyProgram: { select: { name: true } },
          },
        },
      },
    });

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role?.name || 'member', // Map to string
      isActive: u.isActive,
      createdAt: u.createdAt,
      name: u.profile?.name || null,
      avatar: u.profile?.avatar || null,
      npm: u.profile?.npm || null,
      phone: u.profile?.phone || null,
      faculty: u.profile?.faculty?.name || null,
      studyProgram: u.profile?.studyProgram?.name || null,
    }));

    res.json({ data });
  }),
);

export default router;
