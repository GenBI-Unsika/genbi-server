import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { z } from 'zod';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import { isPrismaMissingTableError } from '../lib/prisma-errors.js';

const router = Router();

// Publik: ambil semua divisi aktif
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Cek jika model Division ada (migrasi sudah dijalankan)
    if (!prisma?.division?.findMany) {
      return res.json({ data: [] });
    }

    let divisions = [];
    try {
      divisions = await prisma.division.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    } catch (e) {
      // Jika migrasi belum dijalankan, anggap kosong
      if (isPrismaMissingTableError(e)) {
        return res.json({ data: [] });
      }
      throw e;
    }

    res.json({ data: divisions });
  }),
);

// Admin: ambil semua divisi (termasuk yang tidak aktif)
router.get(
  '/admin/all',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    if (!prisma?.division?.findMany) {
      return res.json({ data: [] });
    }

    const divisions = await prisma.division.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json({ data: divisions });
  }),
);

// Publik: ambil divisi berdasarkan key
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    if (!prisma?.division?.findUnique) {
      return res.status(404).json({ error: 'Divisi tidak ditemukan' });
    }

    const division = await prisma.division.findUnique({
      where: { key },
    });

    if (!division) {
      return res.status(404).json({ error: 'Divisi tidak ditemukan' });
    }

    res.json({ data: division });
  }),
);

// Admin: buat divisi
const createSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  gradient: z.string().optional(),
  bgLight: z.string().optional(),
  textColor: z.string().optional(),
  borderColor: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = createSchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    // Cek duplikasi key
    const existing = await prisma.division.findUnique({
      where: { key: body.data.key },
    });
    if (existing) {
      throw new HttpError(400, 'Key divisi sudah digunakan');
    }

    const division = await prisma.division.create({
      data: {
        key: body.data.key,
        name: body.data.name,
        description: body.data.description,
        icon: body.data.icon || '👥',
        gradient: body.data.gradient || 'from-neutral-400 to-neutral-500',
        bgLight: body.data.bgLight || 'bg-neutral-50',
        textColor: body.data.textColor || 'text-neutral-600',
        borderColor: body.data.borderColor || 'border-neutral-200',
        sortOrder: body.data.sortOrder ?? 0,
        isActive: body.data.isActive ?? true,
      },
    });

    res.status(201).json({ data: division });
  }),
);

// Admin: update divisi
const updateSchema = z.object({
  key: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional(),
  gradient: z.string().optional(),
  bgLight: z.string().optional(),
  textColor: z.string().optional(),
  borderColor: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.put(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const body = updateSchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    // Cek jika key diubah dan apakah key baru unik
    if (body.data.key) {
      const existing = await prisma.division.findFirst({
        where: {
          key: body.data.key,
          NOT: { id },
        },
      });
      if (existing) {
        throw new HttpError(400, 'Key divisi sudah digunakan');
      }
    }

    const division = await prisma.division.update({
      where: { id },
      data: body.data,
    });

    res.json({ data: division });
  }),
);

// Admin: hapus divisi
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.division.delete({
      where: { id },
    });

    res.json({ message: 'Divisi berhasil dihapus' });
  }),
);

export default router;
