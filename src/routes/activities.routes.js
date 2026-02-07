import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';

const router = Router();

// Get all activities (public)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, divisionId, page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (status) where.status = status;
    if (divisionId) {
      const divId = parseInt(divisionId, 10);
      if (!isNaN(divId)) where.divisionId = divId;
    }
    if (search) {
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }];
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: parseInt(limit),
        include: { division: true },
      }),
      prisma.activity.count({ where }),
    ]);

    // Transform for backward compatibility
    const data = activities.map((a) => ({
      ...a,
      division: a.division?.name || null,
    }));

    res.json({
      data,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  }),
);

// Get single activity
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: { division: true },
    });

    if (!activity || !activity.isActive) {
      throw new HttpError(404, 'Kegiatan tidak ditemukan');
    }

    res.json({
      data: {
        ...activity,
        division: activity.division?.name || null,
      },
    });
  }),
);

// Create activity (admin only)
router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().min(1, 'Judul wajib diisi'),
      description: z.string().optional(),
      divisionId: z.number().int().positive().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      location: z.string().optional(),
      status: z.enum(['DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
      budget: z.number().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    const activity = await prisma.activity.create({
      data: {
        title: body.data.title,
        description: body.data.description,
        divisionId: body.data.divisionId,
        startDate: body.data.startDate ? new Date(body.data.startDate) : null,
        endDate: body.data.endDate ? new Date(body.data.endDate) : null,
        location: body.data.location,
        status: body.data.status || 'PLANNED',
        budget: body.data.budget,
        createdById: req.auth.userId,
      },
      include: { division: true },
    });

    res.status(201).json({
      data: {
        ...activity,
        division: activity.division?.name || null,
      },
    });
  }),
);

// Update activity (admin only)
router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const { title, description, divisionId, startDate, endDate, location, status, budget, isActive } = req.body;

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(divisionId !== undefined && { divisionId: divisionId ? parseInt(divisionId, 10) : null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(location !== undefined && { location }),
        ...(status !== undefined && { status }),
        ...(budget !== undefined && { budget }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { division: true },
    });

    res.json({
      data: {
        ...activity,
        division: activity.division?.name || null,
      },
    });
  }),
);

// Delete activity (soft delete)
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.activity.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Kegiatan berhasil dihapus' });
  }),
);

export default router;
