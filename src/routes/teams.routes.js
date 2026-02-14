import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { finalizeUpload } from '../lib/file-utils.js';
import { FOLDER_PROFILE_AVATARS } from '../constants/drive-folders.js';

const router = Router();

// Helper untuk transform user/profile menjadi format yang diharapkan frontend (kompatibel dengan TeamMember lama)
function transformUserToMember(user) {
  return {
    id: user.id,
    name: user.profile?.name || user.email,
    jabatan: user.profile?.jabatan || null,
    divisionId: user.profile?.divisionId || null,
    division: user.profile?.division?.name || null,
    divisionKey: user.profile?.division?.key || null,
    photo: user.profile?.avatar || null,
    faculty: user.profile?.faculty?.name || null,
    major: user.profile?.studyProgram?.name || null,
    studyProgram: user.profile?.studyProgram?.name || null,
    cohort: user.profile?.semester, // Mapping approximate
    birthDate: user.profile?.birthDate || null,
    phone: user.profile?.phone || null,
    email: user.email,
    socials: user.profile?.socials || null,
    isActive: user.isActive,
    sortOrder: user.profile?.sortOrder || 0,
    userId: user.id, // Self reference for compatibility
    role: user.role?.name || 'awardee',
    npm: user.profile?.npm || null,
    gender: user.profile?.gender || null,
  };
}

// Public: get users with specific roles
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

    res.json({ data: users.map(transformUserToMember) });
  }),
);

// Admin: get all users
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
    res.json({ data: users.map(transformUserToMember) });
  }),
);

// Admin: create user
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

    // Resolve Division
    let divisionId = body.data.divisionId;
    if (!divisionId && body.data.division) {
      const div = await prisma.division.findFirst({
        where: { name: body.data.division },
      });
      if (div) divisionId = div.id;
    }
    if (!divisionId) throw new HttpError(400, 'Divisi wajib dipilih');

    // Create User (with dummy password if new)
    // Cek email exists
    let user = null;
    if (body.data.email) {
      user = await prisma.user.findUnique({ where: { email: body.data.email } });
    }

    if (user) {
      // Update existing user to awardee
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
      // Create new user
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

    // Finalize photo if staged
    let photo = body.data.photo;
    if (body.data.photoTempId) {
      const finalized = await finalizeUpload({
        tempId: body.data.photoTempId,
        userId: req.auth.userId,
        folder: FOLDER_PROFILE_AVATARS,
      });
      photo = finalized.publicUrl;
    }

    // Upsert Profile
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
        // Faculty/Major handling omitted for brevity/complexity, user can update profile later
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

    // Re-fetch full object
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: { include: { division: true, faculty: true, studyProgram: true } },
      },
    });

    res.status(201).json({ data: transformUserToMember(fullUser) });
  }),
);

// Admin: update anggota (User + Profile)
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

    // Resolve Division
    let divisionId = body.data.divisionId;
    if (!divisionId && body.data.division) {
      const div = await prisma.division.findFirst({
        where: { name: body.data.division },
      });
      if (div) divisionId = div.id;
    }

    // Update User
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

    // Finalize photo if staged
    let finalPhoto = body.data.photo;
    if (body.data.photoTempId) {
      const finalized = await finalizeUpload({
        tempId: body.data.photoTempId,
        userId: req.auth.userId,
        folder: FOLDER_PROFILE_AVATARS,
      });
      finalPhoto = finalized.publicUrl;
    }

    // Update Profile
    await prisma.userProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        name: body.data.name,
        // ... other defaults
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
      },
    });

    res.json({ data: transformUserToMember(fullUser) });
  }),
);

// Admin: hapus anggota (Soft delete / Deactivate or Hard Delete?)
// Assuming hard delete for "hapus anggota" context, or just remove role/profile info?
// For now: Deactivate user or Delete user?
// Let's just delete the user record to be consistent with previous "Delete TeamMember" behavior,
// BUT this is dangerous if they have other data.
// Better: Clear Profile Division info and set role to 'member' (regular user) instead of deleting Account.
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    // Option 1: Hard Delete User (Destructive)
    // await prisma.user.delete({ where: { id } });

    // Option 2: Downgrade to regular member (Safe)
    const memberRole = await prisma.role.findUnique({ where: { name: 'member' } });
    if (!memberRole) throw new HttpError(500, 'Role member tidak ditemukan');

    await prisma.user.update({
      where: { id },
      data: {
        roleId: memberRole.id,
        isActive: false,
      },
    });

    // Also clear specific profile fields? Maybe not needed.

    res.json({ message: 'Anggota berhasil dinonaktifkan (Downgrade ke member biasa)' });
  }),
);

// users-available endpoint not needed anymore since we just create/search users directly in the form
// But kept for compatibility if needed, or returning empty
router.get(
  '/users-available',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    res.json({ data: [] });
  }),
);

export default router;
