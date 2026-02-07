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
      avatar: z.string().url().nullable().optional(),
      birthDate: z.string().datetime().nullable().optional(),
      gender: z.string().nullable().optional(),
      npm: z.string().nullable().optional(),
      facultyId: z.number().int().positive().nullable().optional(),
      studyProgramId: z.number().int().positive().nullable().optional(),
      semester: z.number().int().min(1).max(14).nullable().optional(),
      phone: z.string().nullable().optional(),
      motivasi: z.string().max(200).nullable().optional(),
      bankName: z.string().max(50).nullable().optional(),
      bankAccountNumber: z.string().max(30).nullable().optional(),
      bankAccountName: z.string().max(100).nullable().optional(),
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
        avatar: body.data.avatar,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
        gender: body.data.gender,
        npm: body.data.npm,
        facultyId: body.data.facultyId,
        studyProgramId: body.data.studyProgramId,
        semester: body.data.semester,
        phone: body.data.phone,
        motivasi: body.data.motivasi,
        bankName: body.data.bankName,
        bankAccountNumber: body.data.bankAccountNumber,
        bankAccountName: body.data.bankAccountName,
      },
      update: {
        name: body.data.name !== undefined ? body.data.name : undefined,
        avatar: body.data.avatar !== undefined ? body.data.avatar : undefined,
        birthDate: body.data.birthDate !== undefined ? (body.data.birthDate ? new Date(body.data.birthDate) : null) : undefined,
        gender: body.data.gender !== undefined ? body.data.gender : undefined,
        npm: body.data.npm !== undefined ? body.data.npm : undefined,
        facultyId: body.data.facultyId !== undefined ? body.data.facultyId : undefined,
        studyProgramId: body.data.studyProgramId !== undefined ? body.data.studyProgramId : undefined,
        semester: body.data.semester !== undefined ? body.data.semester : undefined,
        phone: body.data.phone !== undefined ? body.data.phone : undefined,
        motivasi: body.data.motivasi !== undefined ? body.data.motivasi : undefined,
        bankName: body.data.bankName !== undefined ? body.data.bankName : undefined,
        bankAccountNumber: body.data.bankAccountNumber !== undefined ? body.data.bankAccountNumber : undefined,
        bankAccountName: body.data.bankAccountName !== undefined ? body.data.bankAccountName : undefined,
      },
      include: {
        faculty: true,
        studyProgram: true,
      },
    });

    res.json({ data: profile });
  }),
);

// Get my points (perpointan)
router.get(
  '/points',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Find team member linked to this user (by email or name match)
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { profile: true },
    });

    if (!user) return res.json({ data: { total: 0, breakdown: [], history: [] } });

    // Try to find team member by name
    const memberName = user.profile?.name;
    let teamMember = null;

    if (memberName) {
      teamMember = await prisma.teamMember.findFirst({
        where: { name: { contains: memberName.split(' ')[0] } },
      });
    }

    if (!teamMember) {
      return res.json({ data: { total: 0, breakdown: [], history: [] } });
    }

    // Get points
    const points = await prisma.memberPoint.findMany({
      where: { memberId: teamMember.id },
      orderBy: { awardedAt: 'desc' },
    });

    const total = points.reduce((sum, p) => sum + p.points, 0);

    // Group by category
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

// Get my treasury (uang kas)
router.get(
  '/treasury',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { profile: true },
    });

    if (!user) return res.json({ data: { entries: [], summary: { paid: 0, unpaid: 0 } } });

    const memberName = user.profile?.name;
    let teamMember = null;

    if (memberName) {
      teamMember = await prisma.teamMember.findFirst({
        where: { name: { contains: memberName.split(' ')[0] } },
      });
    }

    if (!teamMember) {
      return res.json({ data: { entries: [], summary: { paid: 0, unpaid: 0 } } });
    }

    const entries = await prisma.treasuryEntry.findMany({
      where: { memberId: teamMember.id },
      orderBy: { period: 'asc' },
    });

    const totalPaid = entries.reduce((sum, e) => sum + e.amount, 0);
    const expectedMonths = 9; // Oktober - Juni
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
