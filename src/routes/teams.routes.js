import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';

const router = Router();

// Helper to transform member with division name for backward compatibility
function transformMember(member) {
  return {
    ...member,
    division: member.division?.name || null,
    divisionKey: member.division?.key || null,
  };
}

// Public: get all active team members
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    if (!prisma?.teamMember?.findMany) {
      return res.json({ data: [] });
    }

    let members = [];
    try {
      members = await prisma.teamMember.findMany({
        where: { isActive: true },
        include: { division: true },
        orderBy: [{ sortOrder: 'asc' }, { division: { name: 'asc' } }, { name: 'asc' }],
      });
    } catch (e) {
      if (e?.code === 'P2021') {
        return res.json({ data: [] });
      }
      throw e;
    }

    res.json({ data: members.map(transformMember) });
  }),
);

// Admin: get all team members (including inactive)
router.get(
  '/admin/all',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const members = await prisma.teamMember.findMany({
      include: { division: true },
      orderBy: [{ sortOrder: 'asc' }, { division: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json({ data: members.map(transformMember) });
  }),
);

// Admin: create team member
router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      jabatan: z.string().nullable().optional(),
      divisionId: z.number().int().positive(),
      // Also accept division name for backward compatibility
      division: z.string().optional(),
      photo: z.string().nullable().optional(),
      motivasi: z.string().nullable().optional(),
      cerita: z.string().nullable().optional(),
      faculty: z.string().nullable().optional(),
      major: z.string().nullable().optional(),
      cohort: z.number().int().nullable().optional(),
      birthDate: z.string().datetime().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      socials: z.any().nullable().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data tidak valid', body.error.flatten());

    // If divisionId not provided but division name is, look up the division
    let divisionId = body.data.divisionId;
    if (!divisionId && body.data.division) {
      const div = await prisma.division.findFirst({
        where: { name: body.data.division },
      });
      if (!div) throw new HttpError(400, 'Divisi tidak ditemukan');
      divisionId = div.id;
    }

    if (!divisionId) throw new HttpError(400, 'Divisi wajib dipilih');

    const member = await prisma.teamMember.create({
      data: {
        name: body.data.name,
        jabatan: body.data.jabatan,
        divisionId,
        photo: body.data.photo,
        motivasi: body.data.motivasi,
        cerita: body.data.cerita,
        faculty: body.data.faculty,
        major: body.data.major,
        cohort: body.data.cohort,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
        phone: body.data.phone,
        email: body.data.email,
        socials: body.data.socials,
        isActive: body.data.isActive ?? true,
        sortOrder: body.data.sortOrder ?? 0,
      },
      include: { division: true },
    });

    res.status(201).json({ data: transformMember(member) });
  }),
);

// Admin: update team member
router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const schema = z.object({
      name: z.string().min(1).optional(),
      jabatan: z.string().nullable().optional(),
      divisionId: z.number().int().positive().optional(),
      division: z.string().optional(), // backward compatibility
      photo: z.string().nullable().optional(),
      motivasi: z.string().nullable().optional(),
      cerita: z.string().nullable().optional(),
      faculty: z.string().nullable().optional(),
      major: z.string().nullable().optional(),
      cohort: z.number().int().nullable().optional(),
      birthDate: z.string().datetime().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      socials: z.any().nullable().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data tidak valid', body.error.flatten());

    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Anggota tidak ditemukan');

    // Handle division lookup for backward compatibility
    let divisionId = body.data.divisionId;
    if (!divisionId && body.data.division) {
      const div = await prisma.division.findFirst({
        where: { name: body.data.division },
      });
      if (div) divisionId = div.id;
    }

    const member = await prisma.teamMember.update({
      where: { id },
      data: {
        name: body.data.name,
        jabatan: body.data.jabatan,
        divisionId: divisionId,
        photo: body.data.photo,
        motivasi: body.data.motivasi,
        cerita: body.data.cerita,
        faculty: body.data.faculty,
        major: body.data.major,
        cohort: body.data.cohort,
        birthDate: body.data.birthDate !== undefined ? (body.data.birthDate ? new Date(body.data.birthDate) : null) : undefined,
        phone: body.data.phone,
        email: body.data.email,
        socials: body.data.socials,
        isActive: body.data.isActive,
        sortOrder: body.data.sortOrder,
      },
      include: { division: true },
    });

    res.json({ data: transformMember(member) });
  }),
);

// Admin: delete team member
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Anggota tidak ditemukan');

    await prisma.teamMember.delete({ where: { id } });

    res.json({ message: 'Anggota berhasil dihapus' });
  }),
);

export default router;
