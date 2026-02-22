import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { normalizeEmail, assertAllowedEmailDomain } from '../auth/domain.js';
import { hashToken, makeVerifyToken, sendVerifyEmail, verifyExpiresAt } from '../auth/email.js';
import { requireAuth, requireSuperAdmin, requireAdminAccess } from '../middleware/auth.js';
import { finalizeUpload } from '../lib/file-utils.js';
import { FOLDER_PROFILE_AVATARS } from '../constants/drive-folders.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { role, search, page = 1, limit = 20, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (role) {
      where.role = { name: role };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [{ email: { contains: search } }, { profile: { name: { contains: search } } }];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          emailVerifiedAt: true,
          profile: {
            select: {
              name: true,
              avatar: true,
              phone: true,
              npm: true,
              gender: true,
              semester: true,
              studyProgram: {
                select: {
                  id: true,
                  name: true,
                  faculty: { select: { id: true, name: true } },
                },
              },
              division: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.profile?.name || null,
      avatar: u.profile?.avatar || null,
      phone: u.profile?.phone || null,
      npm: u.profile?.npm || null,
      gender: u.profile?.gender || null,
      semester: u.profile?.semester || null,
      studyProgram: u.profile?.studyProgram || null,
      division: u.profile?.division || null,
      role: u.role?.name || 'member',
      isActive: u.isActive,
      emailVerified: !!u.emailVerifiedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.json({
      data,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        emailVerifiedAt: true,
        profile: {
          select: {
            name: true,
            avatar: true,
            phone: true,
            npm: true,
            gender: true,
            birthDate: true,
            semester: true,
            jabatan: true,
            socials: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
            faculty: { select: { id: true, name: true } },
            studyProgram: { select: { id: true, name: true } },
            division: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new HttpError(404, 'User tidak ditemukan');
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.profile?.name || null,
      avatar: user.profile?.avatar || null,
      phone: user.profile?.phone || null,
      npm: user.profile?.npm || null,
      gender: user.profile?.gender || null,
      birthDate: user.profile?.birthDate || null,
      semester: user.profile?.semester || null,

      jabatan: user.profile?.jabatan || null,
      socials: user.profile?.socials || null,
      bankName: user.profile?.bankName || null,
      bankAccountNumber: user.profile?.bankAccountNumber || null,
      bankAccountName: user.profile?.bankAccountName || null,

      facultyId: user.profile?.faculty?.id || null,
      facultyName: user.profile?.faculty?.name || null,
      studyProgramId: user.profile?.studyProgram?.id || null,
      studyProgramName: user.profile?.studyProgram?.name || null,
      divisionId: user.profile?.division?.id || null,
      divisionName: user.profile?.division?.name || null,
      role: user.role?.name || 'member',
      isActive: user.isActive,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }),
);

router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().email('Email tidak valid'),
      password: z.string().min(8, 'Password minimal 8 karakter'),
      name: z.string().min(1, 'Nama wajib diisi'),
      role: z.enum(['super_admin', 'admin', 'awardee', 'alumni', 'user']).default('user'),
      phone: z.string().optional().nullable(),
      npm: z.string().optional().nullable(),
      gender: z.enum(['L', 'P']).optional().nullable(),
      semester: z.number().int().min(1).max(14).optional().nullable(),
      studyProgramId: z.number().int().optional().nullable(),
      divisionId: z.number().int().optional().nullable(),

      birthDate: z.string().optional().nullable(),
      jabatan: z.string().optional().nullable(),
      avatarTempId: z.string().optional(),
      socials: z.any().optional().nullable(),
      bankName: z.string().optional().nullable(),
      bankAccountNumber: z.string().optional().nullable(),
      bankAccountName: z.string().optional().nullable(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    const email = normalizeEmail(body.data.email);
    try {
      assertAllowedEmailDomain(email);
    } catch (err) {
      throw new HttpError(err?.statusCode || 403, err?.message || 'Email tidak diizinkan');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new HttpError(409, 'Email sudah digunakan');
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: body.data.role } });
    if (!roleRecord) throw new HttpError(400, 'Role tidak valid');

    const passwordHash = await bcrypt.hash(body.data.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        roleId: roleRecord.id,
        isActive: true,
        profile: {
          create: {
            name: body.data.name,
            phone: body.data.phone || null,
            npm: body.data.npm || null,
            gender: body.data.gender || null,
            semester: body.data.semester || null,
            studyProgramId: body.data.studyProgramId || null,
            divisionId: body.data.divisionId || null,
            facultyId: body.data.studyProgramId ? (await prisma.studyProgram.findUnique({ where: { id: body.data.studyProgramId }, select: { facultyId: true } }))?.facultyId : null,

            birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
            jabatan: body.data.jabatan || null,
            avatar: body.data.avatarTempId ? (await finalizeUpload({ tempId: body.data.avatarTempId, userId: req.auth.userId, folder: FOLDER_PROFILE_AVATARS })).publicUrl : null,
            socials: body.data.socials || null,
            bankName: body.data.bankName || null,
            bankAccountNumber: body.data.bankAccountNumber || null,
            bankAccountName: body.data.bankAccountName || null,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    const token = makeVerifyToken();
    const tokenHash = hashToken(token);
    const expiresAt = verifyExpiresAt();

    await prisma.emailVerificationToken.upsert({
      where: { userId: user.id },
      update: { tokenHash, expiresAt },
      create: { userId: user.id, tokenHash, expiresAt },
    });

    try {
      await sendVerifyEmail({ toEmail: email, token, expiresAt });
    } catch {
      try {
        await prisma.emailVerificationToken.delete({ where: { userId: user.id } });
      } catch {
        // Sengaja biarin errornya (di-ignore)
      }
      try {
        await prisma.user.delete({ where: { id: user.id } });
      } catch {
        // Sengaja biarin errornya (di-ignore)
      }
      throw new HttpError(500, 'Gagal mengirim email verifikasi. Periksa konfigurasi SMTP.');
    }

    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        name: user.profile?.name,
        phone: user.profile?.phone,
        role: user.role?.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const schema = z.object({
      email: z.string().email().optional(),
      password: z.string().min(8).optional(),
      name: z.string().min(1).optional(),
      role: z.enum(['super_admin', 'admin', 'awardee', 'alumni', 'user']).optional(),
      phone: z.string().optional().nullable(),
      npm: z.string().optional().nullable(),
      gender: z.enum(['L', 'P']).optional().nullable(),
      semester: z.number().int().min(1).max(14).optional().nullable(),
      studyProgramId: z.number().int().optional().nullable(),
      divisionId: z.number().int().optional().nullable(),
      isActive: z.boolean().optional(),

      birthDate: z.string().optional().nullable(),
      jabatan: z.string().optional().nullable(),
      avatar: z.string().optional().nullable(),
      avatarTempId: z.string().optional(),
      socials: z.any().optional().nullable(),
      bankName: z.string().optional().nullable(),
      bankAccountNumber: z.string().optional().nullable(),
      bankAccountName: z.string().optional().nullable(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new HttpError(404, 'User tidak ditemukan');
    }

    if (body.data.email && body.data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.data.email },
      });
      if (emailExists) {
        throw new HttpError(409, 'Email sudah digunakan');
      }
    }

    const userData = {};
    if (body.data.email) userData.email = body.data.email;

    if (body.data.role) {
      const roleRecord = await prisma.role.findUnique({ where: { name: body.data.role } });
      if (!roleRecord) throw new HttpError(400, 'Role tidak valid');
      userData.roleId = roleRecord.id;
    }

    if (body.data.isActive !== undefined) userData.isActive = body.data.isActive;
    if (body.data.password) {
      userData.passwordHash = await bcrypt.hash(body.data.password, 10);
    }

    const profileData = {};
    if (body.data.name) profileData.name = body.data.name;
    if (body.data.phone !== undefined) profileData.phone = body.data.phone || null;
    if (body.data.npm !== undefined) profileData.npm = body.data.npm || null;
    if (body.data.gender !== undefined) profileData.gender = body.data.gender || null;
    if (body.data.semester !== undefined) profileData.semester = body.data.semester || null;

    if (body.data.birthDate !== undefined) profileData.birthDate = body.data.birthDate ? new Date(body.data.birthDate) : null;
    if (body.data.jabatan !== undefined) profileData.jabatan = body.data.jabatan || null;
    if (body.data.socials !== undefined) profileData.socials = body.data.socials || null;
    if (body.data.bankName !== undefined) profileData.bankName = body.data.bankName || null;
    if (body.data.bankAccountNumber !== undefined) profileData.bankAccountNumber = body.data.bankAccountNumber || null;
    if (body.data.bankAccountName !== undefined) profileData.bankAccountName = body.data.bankAccountName || null;

    if (body.data.avatarTempId) {
      const finalized = await finalizeUpload({
        tempId: body.data.avatarTempId,
        userId: req.auth.userId,
        folder: FOLDER_PROFILE_AVATARS,
      });
      profileData.avatar = finalized.publicUrl;
    } else if (body.data.avatar !== undefined) {
      profileData.avatar = body.data.avatar || null;
    }

    if (body.data.studyProgramId !== undefined) {
      profileData.studyProgramId = body.data.studyProgramId || null;
      if (body.data.studyProgramId) {
        const studyProgram = await prisma.studyProgram.findUnique({
          where: { id: body.data.studyProgramId },
          select: { facultyId: true },
        });
        if (studyProgram) {
          profileData.facultyId = studyProgram.facultyId;
        }
      } else {
        profileData.facultyId = null;
      }
    }
    if (body.data.divisionId !== undefined) {
      profileData.divisionId = body.data.divisionId || null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...userData,
        profile:
          Object.keys(profileData).length > 0
            ? {
              upsert: {
                create: profileData,
                update: profileData,
              },
            }
            : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
        profile: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.profile?.name,
        phone: user.profile?.phone,
        role: user.role?.name,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    if (req.auth.userId === id) {
      throw new HttpError(400, 'Tidak dapat menghapus akun sendiri');
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpError(404, 'User tidak ditemukan');
    }

    try {
      await prisma.user.delete({
        where: { id },
      });
      res.json({ message: 'User berhasil dihapus secara permanen' });
    } catch (error) {
      if (error.code === 'P2003') {
        throw new HttpError(400, 'User tidak dapat dihapus karena masih memiliki data terkait (artikel, poin, dll). Silakan ubah status menjadi Nonaktif sebagai gantinya.');
      }
      throw error;
    }
  }),
);

router.post(
  '/:id/restore',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpError(404, 'User tidak ditemukan');
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    res.json({ message: 'User berhasil diaktifkan kembali' });
  }),
);

export default router;
