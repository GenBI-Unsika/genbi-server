import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import { isPrismaMissingTableError } from '../lib/prisma-errors.js';

const router = Router();

const MONTHS = ['oktober', 'november', 'desember', 'januari', 'februari', 'maret', 'april', 'mei', 'juni'];
const MONTH_TO_NUM = { oktober: 10, november: 11, desember: 12, januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6 };
const getMonthName = (num) => ({ 10: 'oktober', 11: 'november', 12: 'desember', 1: 'januari', 2: 'februari', 3: 'maret', 4: 'april', 5: 'mei', 6: 'juni' })[num];

function dateRangeFromQuery({ year, month }) {
  const y = year ? Number.parseInt(String(year), 10) : null;
  const m = month ? Number.parseInt(String(month), 10) : null;

  if (!y || !Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (!m) {
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));
    return { start, end };
  }

  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().int().nonnegative(),
  occurredAt: z.string().datetime().optional(),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  reference: z.string().trim().max(100).optional().or(z.literal('')),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { year } = req.query;
    try {
      const members = await prisma.teamMember.findMany({
        where: { isActive: true },
        include: { division: true },
        orderBy: [{ division: { name: 'asc' } }, { name: 'asc' }],
      });

      const periodPrefix = year || new Date().getFullYear().toString();
      const entries = await prisma.treasuryEntry.findMany({
        where: { period: { startsWith: periodPrefix } },
      });

      const entryMap = new Map();
      entries.forEach((e) => {
        if (!entryMap.has(e.memberId)) entryMap.set(e.memberId, new Map());
        const monthNum = parseInt(e.period.split('-')[1], 10);
        const monthName = getMonthName(monthNum);
        if (monthName) entryMap.get(e.memberId).set(monthName, e.amount);
      });

      const data = members.map((m, idx) => {
        const memberEntries = entryMap.get(m.id) || new Map();
        const row = { id: m.id, no: idx + 1, nama: m.name, jabatan: m.jabatan || m.division?.name };
        MONTHS.forEach((month) => {
          row[month] = memberEntries.get(month) || 0;
        });
        return row;
      });

      res.json({ data });
    } catch (e) {
      if (isPrismaMissingTableError(e)) return res.json({ data: [] });
      throw e;
    }
  }),
);

router.get(
  '/transactions',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { year, month } = req.query;
    const range = dateRangeFromQuery({ year, month });

    const where = range
      ? {
          occurredAt: {
            gte: range.start,
            lt: range.end,
          },
        }
      : {};

    const rows = await prisma.treasuryTransaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { name: true } },
          },
        },
      },
    });

    res.json({ data: rows });
  }),
);

router.get(
  '/transactions/summary',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { year, month } = req.query;
    const range = dateRangeFromQuery({ year, month });
    const where = range
      ? {
          occurredAt: {
            gte: range.start,
            lt: range.end,
          },
        }
      : {};

    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.treasuryTransaction.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.treasuryTransaction.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalIncome = incomeAgg?._sum?.amount || 0;
    const totalExpense = expenseAgg?._sum?.amount || 0;

    res.json({
      data: {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        incomeCount: incomeAgg?._count || 0,
        expenseCount: expenseAgg?._count || 0,
      },
    });
  }),
);

router.post(
  '/transactions',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = transactionSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const occurredAt = body.data.occurredAt ? new Date(body.data.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new HttpError(400, 'Tanggal transaksi tidak valid');

    const row = await prisma.treasuryTransaction.create({
      data: {
        type: body.data.type,
        amount: body.data.amount,
        occurredAt,
        category: body.data.category || null,
        description: body.data.description || null,
        reference: body.data.reference || null,
        createdById: req.auth.userId,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, role: true, profile: { select: { name: true } } },
        },
      },
    });

    res.status(201).json({ data: row });
  }),
);

router.patch(
  '/transactions/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw new HttpError(400, 'ID transaksi tidak valid');

    const body = transactionSchema.partial().safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const data = {
      ...(body.data.type ? { type: body.data.type } : {}),
      ...(body.data.amount !== undefined ? { amount: body.data.amount } : {}),
      ...(body.data.category !== undefined ? { category: body.data.category || null } : {}),
      ...(body.data.description !== undefined ? { description: body.data.description || null } : {}),
      ...(body.data.reference !== undefined ? { reference: body.data.reference || null } : {}),
      ...(body.data.occurredAt ? { occurredAt: new Date(body.data.occurredAt) } : {}),
    };
    if (data.occurredAt && Number.isNaN(data.occurredAt.getTime())) throw new HttpError(400, 'Tanggal transaksi tidak valid');

    const row = await prisma.treasuryTransaction.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, email: true, role: true, profile: { select: { name: true } } } },
      },
    });

    res.json({ data: row });
  }),
);

router.delete(
  '/transactions/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw new HttpError(400, 'ID transaksi tidak valid');

    await prisma.treasuryTransaction.delete({ where: { id } });
    res.json({ data: { ok: true } });
  }),
);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    try {
      const result = await prisma.treasuryEntry.aggregate({ _sum: { amount: true }, _count: true });
      const statusCounts = await prisma.treasuryEntry.groupBy({ by: ['status'], _count: true });
      const statusMap = new Map(statusCounts.map((s) => [s.status, s._count]));

      res.json({
        data: {
          totalCollected: result._sum.amount || 0,
          totalEntries: result._count || 0,
          lunas: statusMap.get('LUNAS') || 0,
          belumLunas: statusMap.get('BELUM_LUNAS') || 0,
          sebagian: statusMap.get('SEBAGIAN') || 0,
        },
      });
    } catch (e) {
      if (isPrismaMissingTableError(e)) {
        return res.json({ data: { totalCollected: 0, totalEntries: 0, lunas: 0, belumLunas: 0, sebagian: 0 } });
      }
      throw e;
    }
  }),
);

router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { memberId, period, amount, status, notes } = req.body;
    const memberIdInt = parseInt(memberId, 10);
    if (isNaN(memberIdInt)) throw new HttpError(400, 'Member ID tidak valid');

    const entry = await prisma.treasuryEntry.upsert({
      where: { memberId_period: { memberId: memberIdInt, period } },
      update: { amount: amount || 0, status: status || 'LUNAS', paidAt: new Date(), notes },
      create: { memberId: memberIdInt, period, amount: amount || 0, status: status || 'LUNAS', paidAt: new Date(), notes, recordedById: req.auth?.userId },
    });
    res.status(201).json({ data: entry });
  }),
);

router.put(
  '/member/:memberId',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const memberId = parseInt(req.params.memberId, 10);
    if (isNaN(memberId)) throw new HttpError(400, 'Member ID tidak valid');

    const { year, ...monthData } = req.body;
    const periodYear = year || new Date().getFullYear().toString();

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { division: true },
    });
    if (!member) throw new HttpError(404, 'Anggota tidak ditemukan');

    const updates = [];
    for (const month of MONTHS) {
      if (monthData[month] !== undefined) {
        const monthNum = MONTH_TO_NUM[month];
        const period = `${periodYear}-${String(monthNum).padStart(2, '0')}`;
        const amount = Number(monthData[month]) || 0;

        updates.push(
          prisma.treasuryEntry.upsert({
            where: { memberId_period: { memberId, period } },
            update: { amount, status: amount > 0 ? 'LUNAS' : 'BELUM_LUNAS', paidAt: new Date() },
            create: { memberId, period, amount, status: amount > 0 ? 'LUNAS' : 'BELUM_LUNAS', paidAt: new Date(), recordedById: req.auth?.userId },
          }),
        );
      }
    }

    await Promise.all(updates);

    const entries = await prisma.treasuryEntry.findMany({
      where: { memberId, period: { startsWith: periodYear } },
    });

    const row = { id: memberId, nama: member.name, jabatan: member.jabatan || member.division?.name };
    MONTHS.forEach((m) => {
      row[m] = 0;
    });
    entries.forEach((e) => {
      const monthNum = parseInt(e.period.split('-')[1], 10);
      const monthName = getMonthName(monthNum);
      if (monthName) row[monthName] = e.amount;
    });

    res.json({ data: row });
  }),
);

router.delete(
  '/:memberId/:period',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const memberId = parseInt(req.params.memberId, 10);
    if (isNaN(memberId)) throw new HttpError(400, 'Member ID tidak valid');

    const { period } = req.params;

    const existing = await prisma.treasuryEntry.findUnique({
      where: { memberId_period: { memberId, period } },
    });
    if (!existing) throw new HttpError(404, 'Data kas tidak ditemukan');

    await prisma.treasuryEntry.delete({
      where: { memberId_period: { memberId, period } },
    });

    res.json({ message: 'Data kas berhasil dihapus' });
  }),
);

export default router;
