import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { finalizeUpload } from '../lib/file-utils.js';
import { FOLDER_PROFILE_AVATARS } from '../constants/drive-folders.js';
import { sanitizePublicMember } from '../lib/sanitizer.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ['awardee', 'admin', 'super_admin'] } },
      },
      include: {
        profile: {
          include: {
            division: true,
            faculty: true,
            studyProgram: true,
          },
        },
        role: true,
      },
      orderBy: [{ profile: { sortOrder: 'asc' } }, { profile: { division: { name: 'asc' } } }, { profile: { name: 'asc' } }],
    });

    res.json({ data: users.map(sanitizePublicMember) });
  }),
);

router.get(
  '/admin/all',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: {
        role: { name: { in: ['awardee', 'alumni', 'admin', 'super_admin'] } },
      },
      include: {
        profile: {
          include: {
            division: true,
            faculty: true,
            studyProgram: true,
          },
        },
        role: true,
      },
      orderBy: [{ profile: { sortOrder: 'asc' } }, { profile: { division: { name: 'asc' } } }, { profile: { name: 'asc' } }],
    });
    res.json({ data: users.map(sanitizePublicMember) });
  }),
);

router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      jabatan: z.string().nullable().optional(),
      divisionId: z.number().int().positive(),
      division: z.string().optional(),
      photo: z.string().nullable().optional(),
      photoTempId: z.string().optional(),
      faculty: z.string().nullable().optional(),
      major: z.string().nullable().optional(),
      cohort: z.number().int().nullable().optional(),
      birthDate: z.string().datetime().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      npm: z.string().optional(),
      socials: z.any().nullable().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      role: z.enum(['awardee', 'alumni', 'admin', 'super_admin']).optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data tidak valid', body.error.flatten());

    let divisionId = body.data.divisionId;
    if (!divisionId && body.data.division) {
      const div = await prisma.division.findFirst({
        where: { name: body.data.division },
      });
      if (div) divisionId = div.id;
    }
    if (!divisionId) throw new HttpError(400, 'Divisi wajib dipilih');

    let user = null;
    if (body.data.email) {
      user = await prisma.user.findUnique({ where: { email: body.data.email } });
    }

    if (user) {
      const updateRoleName = body.data.role || 'awardee';
      const updateRoleRecord = await prisma.role.findUnique({ where: { name: updateRoleName } });
      if (!updateRoleRecord) throw new HttpError(400, 'Role tidak valid');

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          roleId: updateRoleRecord.id,
          isActive: body.data.isActive ?? true,
        },
      });
    } else {
      if (!body.data.email) throw new HttpError(400, 'Email wajib diisi untuk anggota baru');

      const email = body.data.email;
      const roleName = body.data.role || 'awardee';
      const roleRecord = await prisma.role.findUnique({ where: { name: roleName } });
      if (!roleRecord) throw new HttpError(400, 'Role tidak valid');

      user = await prisma.user.create({
        data: {
          email,
          passwordHash: '', // Placeholder
          roleId: roleRecord.id, // Use roleId
          isActive: body.data.isActive ?? true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    let photo = body.data.photo;
    if (body.data.photoTempId) {
      const finalized = await finalizeUpload({
        tempId: body.data.photoTempId,
        userId: req.auth.userId,
        folder: FOLDER_PROFILE_AVATARS,
      });
      photo = finalized.publicUrl;
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: body.data.name,
        npm: body.data.npm,
        divisionId,
        jabatan: body.data.jabatan,
        avatar: photo,
        phone: body.data.phone,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
        sortOrder: body.data.sortOrder || 0,
        socials: body.data.socials || undefined,
      },
      update: {
        name: body.data.name,
        npm: body.data.npm,
        divisionId,
        jabatan: body.data.jabatan,
        avatar: photo,
        phone: body.data.phone,
        birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
        sortOrder: body.data.sortOrder || 0,
        socials: body.data.socials || undefined,
      },
    });

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: { include: { division: true, faculty: true, studyProgram: true } },
        role: true,
      },
    });

    res.status(201).json({ data: sanitizePublicMember(fullUser) });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10); // This is userId now
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const schema = z.object({
      name: z.string().min(1).optional(),
      jabatan: z.string().nullable().optional(),
      divisionId: z.number().int().positive().optional(),
      division: z.string().optional(),
      photo: z.string().nullable().optional(),
      photoTempId: z.string().optional(),
      faculty: z.string().nullable().optional(),
      major: z.string().nullable().optional(),
      cohort: z.number().int().nullable().optional(),
      birthDate: z.string().datetime().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      npm: z.string().optional(),
      socials: z.any().nullable().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      role: z.enum(['awardee', 'alumni', 'admin', 'super_admin']).optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data tidak valid', body.error.flatten());

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) throw new HttpError(404, 'User tidak ditemukan');

    let divisionId = body.data.divisionId;
    if (!divisionId && body.data.division) {
      const div = await prisma.division.findFirst({
        where: { name: body.data.division },
      });
      if (div) divisionId = div.id;
    }

    const updateData = {
      email: body.data.email,
      isActive: body.data.isActive,
    };

    if (body.data.role) {
      const roleRecord = await prisma.role.findUnique({ where: { name: body.data.role } });
      if (roleRecord) {
        updateData.roleId = roleRecord.id;
      }
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    let finalPhoto = body.data.photo;
    if (body.data.photoTempId) {
      const finalized = await finalizeUpload({
        tempId: body.data.photoTempId,
        userId: req.auth.userId,
        folder: FOLDER_PROFILE_AVATARS,
      });
      finalPhoto = finalized.publicUrl;
    }

    await prisma.userProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        name: body.data.name,
      },
      update: {
        name: body.data.name,
        npm: body.data.npm,
        divisionId,
        jabatan: body.data.jabatan,
        avatar: finalPhoto,
        phone: body.data.phone,
        birthDate: body.data.birthDate !== undefined ? (body.data.birthDate ? new Date(body.data.birthDate) : null) : undefined,
        sortOrder: body.data.sortOrder,
        socials: body.data.socials,
      },
    });

    const fullUser = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: { include: { division: true, faculty: true, studyProgram: true } },
        role: true,
      },
    });

    res.json({ data: sanitizePublicMember(fullUser) });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const memberRole = await prisma.role.findUnique({ where: { name: 'member' } });
    if (!memberRole) throw new HttpError(500, 'Role member tidak ditemukan');

    await prisma.user.update({
      where: { id },
      data: {
        roleId: memberRole.id,
        isActive: false,
      },
    });

    res.json({ message: 'Anggota berhasil dinonaktifkan (Downgrade ke member biasa)' });
  }),
);

router.get(
  '/users-available',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    res.json({ data: [] });
  }),
);

export default router;
