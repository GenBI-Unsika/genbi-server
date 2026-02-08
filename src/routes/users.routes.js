import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { role, search, page = 1, limit = 20, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (role) {
      where.role = role;
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
      role: u.role,
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
  requireSuperAdmin,
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
            facultyId: true,
            studyProgramId: true,
            npm: true,
            gender: true,
            birthDate: true,
            semester: true,
          },
        },
      },
    });

    if (!user) {
      throw new HttpError(404, 'User tidak ditemukan');
    }

    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.profile?.name || null,
        avatar: user.profile?.avatar || null,
        phone: user.profile?.phone || null,
        role: user.role,
        isActive: user.isActive,
        emailVerified: !!user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: user.profile,
      },
    });
  }),
);

router.post(
  '/',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().email('Email tidak valid'),
      password: z.string().min(8, 'Password minimal 8 karakter'),
      name: z.string().min(1, 'Nama wajib diisi'),
      role: z.enum(['super_admin', 'admin', 'koordinator', 'awardee', 'member', 'alumni']).default('admin'),
      phone: z.string().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: body.data.email },
    });

    if (existingUser) {
      throw new HttpError(409, 'Email sudah digunakan');
    }

    const passwordHash = await bcrypt.hash(body.data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        passwordHash,
        role: body.data.role,
        isActive: true,
        profile: {
          create: {
            name: body.data.name,
            phone: body.data.phone || null,
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

    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        name: user.profile?.name,
        phone: user.profile?.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const schema = z.object({
      email: z.string().email().optional(),
      password: z.string().min(8).optional(),
      name: z.string().min(1).optional(),
      role: z.enum(['super_admin', 'admin', 'koordinator', 'awardee', 'member', 'alumni']).optional(),
      phone: z.string().optional(),
      isActive: z.boolean().optional(),
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
    if (body.data.role) userData.role = body.data.role;
    if (body.data.isActive !== undefined) userData.isActive = body.data.isActive;
    if (body.data.password) {
      userData.passwordHash = await bcrypt.hash(body.data.password, 10);
    }

    const profileData = {};
    if (body.data.name) profileData.name = body.data.name;
    if (body.data.phone !== undefined) profileData.phone = body.data.phone || null;

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
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireSuperAdmin,
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

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'User berhasil dinonaktifkan' });
  }),
);

router.post(
  '/:id/restore',
  requireAuth,
  requireSuperAdmin,
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
