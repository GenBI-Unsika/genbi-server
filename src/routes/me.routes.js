import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { finalizeUpload } from '../lib/file-utils.js';
import { FOLDER_PROFILE_AVATARS } from '../constants/drive-folders.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: {
        role: true,
        profile: {
          include: {
            faculty: true,
            studyProgram: true,
            division: true,
          },
        },
      },
    });

    if (!user) return res.status(401).json({ error: { message: 'User not found (session invalid)' } });

    res.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role?.name || 'awardee',
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
      avatar: z.string().url().nullable().optional(),
      avatarTempId: z.string().optional(), // NEW: Support staged avatar upload
      birthDate: z.string().datetime().nullable().optional(),
      gender: z.string().nullable().optional(),
      npm: z.string().nullable().optional(),
      facultyId: z.number().int().positive().nullable().optional(),
      studyProgramId: z.number().int().positive().nullable().optional(),
      semester: z.number().int().min(1).max(14).nullable().optional(),
      divisionId: z.number().int().nullable().optional(),
      jabatan: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      socials: z.any().nullable().optional(),
      bankName: z.string().max(50).nullable().optional(),
      bankAccountNumber: z.string().max(30).nullable().optional(),
      bankAccountName: z.string().max(100).nullable().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    // Handle staged avatar upload - finalize if tempId provided
    let finalAvatar = body.data.avatar;
    if (body.data.avatarTempId) {
      try {
        const finalizedFile = await finalizeUpload({
          tempId: body.data.avatarTempId,
          userId: req.auth.userId,
          folder: FOLDER_PROFILE_AVATARS,
        });
        finalAvatar = finalizedFile.publicUrl;
      } catch (e) {
        throw new HttpError(400, `Gagal memproses avatar: ${e.message}`);
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { profile: true },
    });

    if (!user) throw new HttpError(404, 'User not found');

    // Determine the avatar value to use
    const avatarValue = body.data.avatarTempId ? finalAvatar : body.data.avatar !== undefined ? body.data.avatar : undefined;

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: body.data.name,
        avatar: avatarValue,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
        gender: body.data.gender,
        npm: body.data.npm,
        facultyId: body.data.facultyId,
        studyProgramId: body.data.studyProgramId,
        semester: body.data.semester,
        divisionId: body.data.divisionId,
        jabatan: body.data.jabatan,
        phone: body.data.phone,
        socials: body.data.socials,
        bankName: body.data.bankName,
        bankAccountNumber: body.data.bankAccountNumber,
        bankAccountName: body.data.bankAccountName,
      },
      update: {
        name: body.data.name !== undefined ? body.data.name : undefined,
        avatar: avatarValue,
        birthDate: body.data.birthDate !== undefined ? (body.data.birthDate ? new Date(body.data.birthDate) : null) : undefined,
        gender: body.data.gender !== undefined ? body.data.gender : undefined,
        npm: body.data.npm !== undefined ? body.data.npm : undefined,
        facultyId: body.data.facultyId !== undefined ? body.data.facultyId : undefined,
        studyProgramId: body.data.studyProgramId !== undefined ? body.data.studyProgramId : undefined,
        semester: body.data.semester !== undefined ? body.data.semester : undefined,
        divisionId: body.data.divisionId !== undefined ? body.data.divisionId : undefined,
        jabatan: body.data.jabatan !== undefined ? body.data.jabatan : undefined,
        phone: body.data.phone !== undefined ? body.data.phone : undefined,
        socials: body.data.socials !== undefined ? body.data.socials : undefined,
        bankName: body.data.bankName !== undefined ? body.data.bankName : undefined,
        bankAccountNumber: body.data.bankAccountNumber !== undefined ? body.data.bankAccountNumber : undefined,
        bankAccountName: body.data.bankAccountName !== undefined ? body.data.bankAccountName : undefined,
      },
      include: {
        faculty: true,
        studyProgram: true,
        division: true,
      },
    });

    res.json({ data: profile });
  }),
);

// Ambil event yang pernah diikutiku (via MemberPoint)
router.get(
  '/events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    // We determine attended events by looking at MemberPoint records tagged with an eventId
    const attendanceRecords = await prisma.memberPoint.findMany({
      where: {
        userId,
        eventId: { not: null },
      },
      orderBy: { awardedAt: 'desc' },
    });

    const eventIds = [...new Set(attendanceRecords.map(r => r.eventId))];

    const attendedEvents = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: {
        id: true,
        title: true,
        location: true,
        startDate: true,
        endDate: true,
      },
    });

    // Create a map for quick lookup
    const eventMap = new Map(attendedEvents.map(e => [e.id, e]));

    const items = attendanceRecords
      .map((record) => {
        const evt = eventMap.get(record.eventId);
        if (!evt) return null;

        return {
          id: evt.id,
          title: evt.title,
          location: evt.location || 'Online/TBA',
          date: evt.startDate.toISOString(),
          status: 'Hadir',
          statusColor: 'bg-emerald-100 text-emerald-800',
        };
      })
      .filter(Boolean);

    res.json({ data: { items } });
  }),
);

// Ambil poin saya (perpointan)
router.get(
  '/points',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    const points = await prisma.memberPoint.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
    });

    if (!points.length) {
      return res.json({ data: { total: 0, breakdown: [], history: [] } });
    }

    const total = points.reduce((sum, p) => sum + p.points, 0);

    const breakdownMap = {};
    points.forEach((p) => {
      if (!breakdownMap[p.category]) breakdownMap[p.category] = 0;
      breakdownMap[p.category] += p.points;
    });

    const breakdown = Object.entries(breakdownMap).map(([category, pts]) => ({ category, points: pts }));

    res.json({
      data: {
        total,
        breakdown,
        history: points.map((p) => ({
          id: p.id,
          category: p.category,
          points: p.points,
          description: p.description,
          date: p.awardedAt,
        })),
      },
    });
  }),
);

// Ambil uang kas saya
router.get(
  '/treasury',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    const entries = await prisma.treasuryEntry.findMany({
      where: { userId },
      orderBy: { period: 'asc' },
    });

    if (!entries.length) {
      return res.json({ data: { entries: [], summary: { paid: 0, unpaid: 0 } } });
    }

    const totalPaid = entries.reduce((sum, e) => sum + e.amount, 0);
    const expectedMonths = 9;
    const monthlyFee = 10000;
    const expectedTotal = expectedMonths * monthlyFee;

    res.json({
      data: {
        entries: entries.map((e) => ({
          id: e.id,
          period: e.period,
          amount: e.amount,
          status: e.status,
          paidAt: e.paidAt,
        })),
        summary: {
          paid: totalPaid,
          unpaid: expectedTotal - totalPaid,
          monthsPaid: entries.length,
          monthsUnpaid: expectedMonths - entries.length,
        },
      },
    });
  }),
);

export default router;
