import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { finalizeUpload } from '../lib/file-utils.js';

const router = Router();

// Ambil semua kegiatan (publik)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, divisionId, page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };
    if (status) where.status = status;
    if (divisionId) {
      const divId = parseInt(divisionId, 10);
      if (!isNaN(divId)) where.divisionId = divId;
    }
    if (search) {
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }];
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: parseInt(limit),
        include: { division: true },
      }),
      prisma.activity.count({ where }),
    ]);

    // Transformasi untuk kompatibilitas ke belakang
    const data = activities.map((a) => ({
      ...a,
      division: a.division?.name || null,
    }));

    res.json({
      data,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  }),
);

// Ambil satu kegiatan
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: { division: true },
    });

    if (!activity || !activity.isActive) {
      throw new HttpError(404, 'Kegiatan tidak ditemukan');
    }

    res.json({
      data: {
        ...activity,
        division: activity.division?.name || null,
      },
    });
  }),
);

// Buat kegiatan (hanya admin)
router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const attachmentFileSchema = z.object({
      name: z.string().optional(),
      url: z.string().trim().min(1).max(1000),
      type: z.string().optional(),
      size: z.number().optional(),
    });

    const schema = z.object({
      title: z.string().min(1, 'Judul wajib diisi'),
      description: z.string().optional(),
      coverImage: z.string().trim().max(500).nullable().optional(),
      theme: z.string().max(255).nullable().optional(), // Tema untuk Proker
      publicationDate: z.string().nullable().optional(), // Tanggal publikasi untuk Proker
      benefits: z.array(z.string()).nullable().optional(), // Manfaat kegiatan
      attachments: z
        .object({
          photos: z.array(attachmentFileSchema).optional(),
          documents: z.array(attachmentFileSchema).optional(),
          links: z
            .array(
              z.object({
                label: z.string().optional(),
                url: z.string().trim().min(1).max(1000),
              }),
            )
            .optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      divisionId: z.number().int().positive().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      status: z.enum(['DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
      budget: z.number().nullable().optional(),
      coverImageTempId: z.string().optional(), // New field for staged upload
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    // Process attachments and cover image finalization
    let coverImage = body.data.coverImage;
    if (body.data.coverImageTempId) {
      const finalized = await finalizeUpload({
        tempId: body.data.coverImageTempId,
        userId: req.auth.userId,
        folder: 'activities/covers',
      });
      coverImage = finalized.publicUrl;
    }

    // Handle attachments - they might already be finalized objects or tempIds from earlier
    let attachments = body.data.attachments || null;
    if (attachments) {
      const photos = await Promise.all(
        (attachments.photos || []).map(async (p) => {
          if (p.tempId) {
            const f = await finalizeUpload({ tempId: p.tempId, userId: req.auth.userId, folder: 'activities/photos' });
            return { name: p.name || f.name, url: f.publicUrl, type: f.mimeType, size: f.sizeBytes };
          }
          return p;
        }),
      );
      const documents = await Promise.all(
        (attachments.documents || []).map(async (d) => {
          if (d.tempId) {
            const f = await finalizeUpload({ tempId: d.tempId, userId: req.auth.userId, folder: 'activities/documents' });
            return { name: d.name || f.name, url: f.publicUrl, type: f.mimeType, size: f.sizeBytes };
          }
          return d;
        }),
      );
      attachments = { photos, documents, links: attachments.links || [] };
    }

    const activity = await prisma.activity.create({
      data: {
        title: body.data.title,
        description: body.data.description,
        coverImage: coverImage ?? null,
        theme: body.data.theme ?? null,
        publicationDate: body.data.publicationDate ? new Date(body.data.publicationDate) : null,
        benefits: body.data.benefits ?? null,
        attachments: attachments ?? null,
        divisionId: body.data.divisionId ?? null,
        startDate: body.data.startDate ? new Date(body.data.startDate) : null,
        endDate: body.data.endDate ? new Date(body.data.endDate) : null,
        location: body.data.location ?? null,
        status: body.data.status || 'PLANNED',
        budget: body.data.budget ?? null,
        createdById: req.auth.userId,
      },
      include: { division: true },
    });

    res.status(201).json({
      data: {
        ...activity,
        division: activity.division?.name || null,
      },
    });
  }),
);

// Update kegiatan (hanya admin)
router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const {
      title, description, coverImage, coverImageTempId, theme, publicationDate,
      benefits, attachments, divisionId, startDate, endDate, location, status,
      budget, isActive
    } = req.body;

    let finalCoverImage = coverImage;
    if (coverImageTempId) {
      const finalized = await finalizeUpload({
        tempId: coverImageTempId,
        userId: req.auth.userId,
        folder: 'activities/covers',
      });
      finalCoverImage = finalized.publicUrl;
    }

    let finalAttachments = attachments;
    if (attachments) {
      const photos = await Promise.all(
        (attachments.photos || []).map(async (p) => {
          if (p.tempId) {
            const f = await finalizeUpload({ tempId: p.tempId, userId: req.auth.userId, folder: 'activities/photos' });
            return { name: p.name || f.name, url: f.publicUrl, type: f.mimeType, size: f.sizeBytes };
          }
          return p;
        }),
      );
      const documents = await Promise.all(
        (attachments.documents || []).map(async (d) => {
          if (d.tempId) {
            const f = await finalizeUpload({ tempId: d.tempId, userId: req.auth.userId, folder: 'activities/documents' });
            return { name: d.name || f.name, url: f.publicUrl, type: f.mimeType, size: f.sizeBytes };
          }
          return d;
        }),
      );
      finalAttachments = { photos, documents, links: attachments.links || [] };
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(finalCoverImage !== undefined && { coverImage: finalCoverImage || null }),
        ...(theme !== undefined && { theme: theme || null }),
        ...(publicationDate !== undefined && { publicationDate: publicationDate ? new Date(publicationDate) : null }),
        ...(benefits !== undefined && { benefits: benefits || null }),
        ...(finalAttachments !== undefined && { attachments: finalAttachments || null }),
        ...(divisionId !== undefined && { divisionId: divisionId ? parseInt(divisionId, 10) : null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(location !== undefined && { location: location || null }),
        ...(status !== undefined && { status }),
        ...(budget !== undefined && { budget: budget || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { division: true },
    });

    res.json({
      data: {
        ...activity,
        division: activity.division?.name || null,
      },
    });
  }),
);

// Hapus kegiatan (soft delete)
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.activity.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Kegiatan berhasil dihapus' });
  }),
);

// ENDPOINT PENDAFTARAN PUBLIK

// Daftar kegiatan (publik - tidak perlu login)
router.post(
  '/:id/registrations',
  asyncHandler(async (req, res) => {
    const activityId = parseInt(req.params.id, 10);
    if (isNaN(activityId)) throw new HttpError(400, 'ID tidak valid');

    // Validasi kegiatan ada dan aktif
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity || !activity.isActive) {
      throw new HttpError(404, 'Kegiatan tidak ditemukan');
    }

    // Validasi body request
    const schema = z.object({
      name: z.string().min(1, 'Nama wajib diisi'),
      email: z.string().email('Format email tidak valid'),
      phone: z.string().optional(),
      institution: z.string().optional(),
      notes: z.string().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    // Cek duplikasi pendaftaran
    const existing = await prisma.activityRegistration.findUnique({
      where: {
        activityId_email: {
          activityId,
          email: body.data.email,
        },
      },
    });

    if (existing) {
      throw new HttpError(409, 'Email sudah terdaftar untuk kegiatan ini');
    }

    // Buat pendaftaran
    const registration = await prisma.activityRegistration.create({
      data: {
        activityId,
        name: body.data.name,
        email: body.data.email,
        phone: body.data.phone || null,
        institution: body.data.institution || null,
        notes: body.data.notes || null,
      },
    });

    res.status(201).json({
      message: 'Pendaftaran berhasil',
      data: registration,
    });
  }),
);

// Ambil data pendaftaran untuk kegiatan (hanya admin)
router.get(
  '/:id/registrations',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const activityId = parseInt(req.params.id, 10);
    if (isNaN(activityId)) throw new HttpError(400, 'ID tidak valid');

    const registrations = await prisma.activityRegistration.findMany({
      where: { activityId },
      orderBy: { registeredAt: 'desc' },
    });

    res.json({ data: registrations });
  }),
);

// Hapus pendaftaran (hanya admin)
router.delete(
  '/:id/registrations/:registrationId',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const activityId = parseInt(req.params.id, 10);
    const registrationId = parseInt(req.params.registrationId, 10);

    if (isNaN(activityId) || isNaN(registrationId)) {
      throw new HttpError(400, 'ID tidak valid');
    }

    await prisma.activityRegistration.delete({
      where: { id: registrationId },
    });

    res.json({ message: 'Pendaftaran berhasil dihapus' });
  }),
);

export default router;
