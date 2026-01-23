import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: {
        profile: {
          include: {
            faculty: true,
            studyProgram: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    res.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  }),
);

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      birthDate: z.string().datetime().nullable().optional(),
      gender: z.string().nullable().optional(),
      npm: z.string().nullable().optional(),
      facultyId: z.string().uuid().nullable().optional(),
      studyProgramId: z.string().uuid().nullable().optional(),
      semester: z.number().int().min(1).max(14).nullable().optional(),
      phone: z.string().nullable().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { profile: true },
    });

    if (!user) throw new HttpError(404, 'User not found');

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: body.data.name,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
        gender: body.data.gender,
        npm: body.data.npm,
        facultyId: body.data.facultyId,
        studyProgramId: body.data.studyProgramId,
        semester: body.data.semester,
        phone: body.data.phone,
      },
      update: {
        name: body.data.name !== undefined ? body.data.name : undefined,
        birthDate: body.data.birthDate !== undefined ? (body.data.birthDate ? new Date(body.data.birthDate) : null) : undefined,
        gender: body.data.gender !== undefined ? body.data.gender : undefined,
        npm: body.data.npm !== undefined ? body.data.npm : undefined,
        facultyId: body.data.facultyId !== undefined ? body.data.facultyId : undefined,
        studyProgramId: body.data.studyProgramId !== undefined ? body.data.studyProgramId : undefined,
        semester: body.data.semester !== undefined ? body.data.semester : undefined,
        phone: body.data.phone !== undefined ? body.data.phone : undefined,
      },
      include: {
        faculty: true,
        studyProgram: true,
      },
    });

    res.json({ data: profile });
  }),
);

export default router;
