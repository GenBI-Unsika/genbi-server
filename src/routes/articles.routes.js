import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess, ADMIN_ROLES } from '../middleware/auth.js';
import { finalizeUpload, getPublicFileUrl } from '../lib/file-utils.js';
import { FOLDER_ARTICLE_COVERS, FOLDER_ARTICLE_PHOTOS, FOLDER_ARTICLE_DOCUMENTS } from '../constants/drive-folders.js';

const router = Router();

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, page = 1, limit = 10, search, status, startDate, endDate, sortBy, sortOrder, popularFirst } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };

    // Setelan awalnya yg udah rilis aja yg disodorin ke publik
    if (status) {
      where.status = status;
    } else {
      where.status = 'PUBLISHED';
    }

    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }, { content: { contains: search } }];
    }

    if (startDate || endDate) {
      where.publishedAt = {};
      if (startDate) where.publishedAt.gte = new Date(startDate);
      if (endDate) where.publishedAt.lte = new Date(endDate);
    }

    const orderBy = [];

    if (popularFirst === 'true') {
      // Sortirin by jumlah klik (viewCount) dl kl nanya yg populer
      orderBy.push({ viewCount: 'desc' });
    }

    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ publishedAt: 'desc' });
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          status: true,
          publishedAt: true,
          viewCount: true,
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { name: true, avatar: true } },
            },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    res.json({
      data: articles,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  }),
);

// Ambil semua artikel untuk admin (termasuk draft)
router.get(
  '/manage',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, status, startDate, endDate, sortBy, sortOrder } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { isActive: true };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }, { content: { contains: search } }];
    }

    if (startDate || endDate) {
      where.createdAt = {}; // Admin biasanya nyari rute dr tgl dibikin / di-update
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orderBy = [];
    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ updatedAt: 'desc' }); // Urutin dr yg paling baru di-utak-atik buat mas admin
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          status: true,
          publishedAt: true,
          viewCount: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              email: true,
              profile: { select: { name: true, avatar: true } },
            },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    res.json({
      data: articles,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  }),
);

router.get(
  '/slug/:slug',
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUnique({
      where: { slug: req.params.slug },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
      },
    });

    if (!article || !article.isActive || article.status !== 'PUBLISHED') {
      throw new HttpError(404, 'Artikel tidak ditemukan');
    }

    await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ data: article });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
      },
    });

    if (!article) {
      throw new HttpError(404, 'Artikel tidak ditemukan');
    }

    res.json({ data: article });
  }),
);

router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const attachmentFile = z
      .object({
        name: z.string().optional(),
        url: z.string().min(1),
        fileId: z.number().int().optional(),
        tempId: z.string().optional(), // Support file yg masih ngungsi di staging
      })
      .passthrough();

    const attachmentsSchema = z
      .object({
        photos: z.array(attachmentFile).optional(),
        documents: z.array(attachmentFile).optional(),
        links: z
          .array(
            z
              .object({
                url: z.string().min(1),
                type: z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough();

    const schema = z.object({
      title: z.string().min(1, 'Judul wajib diisi'),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      coverImage: z.string().nullable().optional(),
      coverImageTempId: z.string().optional(), // BARU: Nangkep cover dr staging upload
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
      attachments: attachmentsSchema.optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    let coverImageUrl = body.data.coverImage;
    if (body.data.coverImageTempId) {
      try {
        const finalizedFile = await finalizeUpload({
          tempId: body.data.coverImageTempId,
          userId: req.auth.userId,
          folder: FOLDER_ARTICLE_COVERS,
        });
        coverImageUrl = finalizedFile.publicUrl;
      } catch (e) {
        throw new HttpError(400, `Gagal memproses cover image: ${e.message}`);
      }
    }

    const attachments = body.data.attachments || {};
    if (attachments.photos && Array.isArray(attachments.photos)) {
      const processedPhotos = [];
      for (const photo of attachments.photos) {
        if (photo.tempId) {
          try {
            const finalizedFile = await finalizeUpload({
              tempId: photo.tempId,
              userId: req.auth.userId,
              folder: FOLDER_ARTICLE_PHOTOS,
            });
            processedPhotos.push({
              name: photo.name || finalizedFile.name,
              url: finalizedFile.publicUrl,
              fileId: finalizedFile.id,
            });
          } catch (e) {
          }
        } else {
          processedPhotos.push(photo);
        }
      }
      attachments.photos = processedPhotos;
    }

    if (attachments.documents && Array.isArray(attachments.documents)) {
      const processedDocs = [];
      for (const doc of attachments.documents) {
        if (doc.tempId) {
          try {
            const finalizedFile = await finalizeUpload({
              tempId: doc.tempId,
              userId: req.auth.userId,
              folder: FOLDER_ARTICLE_DOCUMENTS,
            });
            processedDocs.push({
              name: doc.name || finalizedFile.name,
              url: finalizedFile.publicUrl,
              fileId: finalizedFile.id,
            });
          } catch (e) {
          }
        } else {
          processedDocs.push(doc);
        }
      }
      attachments.documents = processedDocs;
    }

    let slug = generateSlug(body.data.title);
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const article = await prisma.article.create({
      data: {
        title: body.data.title,
        slug,
        excerpt: body.data.excerpt,
        content: body.data.content,
        coverImage: coverImageUrl ?? undefined,
        attachments: Object.keys(attachments).length > 0 ? attachments : undefined,
        status: body.data.status || 'DRAFT',
        authorId: req.auth.userId,
        publishedAt: body.data.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    res.status(201).json({ data: article });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const { title, excerpt, content, coverImage, coverImageTempId, status, isActive, attachments } = req.body;

    const currentArticle = await prisma.article.findUnique({ where: { id } });
    if (!currentArticle) {
      throw new HttpError(404, 'Artikel tidak ditemukan');
    }

    let finalCoverImage = coverImage;
    if (coverImageTempId) {
      try {
        const finalizedFile = await finalizeUpload({
          tempId: coverImageTempId,
          userId: req.auth.userId,
          folder: FOLDER_ARTICLE_COVERS,
        });
        finalCoverImage = finalizedFile.publicUrl;
      } catch (e) {
        throw new HttpError(400, `Gagal memproses cover image: ${e.message}`);
      }
    }

    let processedAttachments = attachments;
    if (attachments) {
      processedAttachments = { ...attachments };

      if (attachments.photos && Array.isArray(attachments.photos)) {
        const processedPhotos = [];
        for (const photo of attachments.photos) {
          if (photo.tempId) {
            try {
              const finalizedFile = await finalizeUpload({
                tempId: photo.tempId,
                userId: req.auth.userId,
                folder: FOLDER_ARTICLE_PHOTOS,
              });
              processedPhotos.push({
                name: photo.name || finalizedFile.name,
                url: finalizedFile.publicUrl,
                fileId: finalizedFile.id,
              });
            } catch (e) {
            }
          } else {
            processedPhotos.push(photo);
          }
        }
        processedAttachments.photos = processedPhotos;
      }

      if (attachments.documents && Array.isArray(attachments.documents)) {
        const processedDocs = [];
        for (const doc of attachments.documents) {
          if (doc.tempId) {
            try {
              const finalizedFile = await finalizeUpload({
                tempId: doc.tempId,
                userId: req.auth.userId,
                folder: FOLDER_ARTICLE_DOCUMENTS,
              });
              processedDocs.push({
                name: doc.name || finalizedFile.name,
                url: finalizedFile.publicUrl,
                fileId: finalizedFile.id,
              });
            } catch (e) {
            }
          } else {
            processedDocs.push(doc);
          }
        }
        processedAttachments.documents = processedDocs;
      }
    }

    // Jika mempublikasikan untuk pertama kali, set publishedAt
    let publishedAt = currentArticle.publishedAt;
    if (status === 'PUBLISHED' && currentArticle.status !== 'PUBLISHED') {
      publishedAt = new Date();
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...((finalCoverImage !== undefined || coverImageTempId) && { coverImage: finalCoverImage }),
        ...(processedAttachments !== undefined && { attachments: processedAttachments }),
        ...(status !== undefined && { status, publishedAt }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ data: article });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.article.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Artikel berhasil dihapus' });
  }),
);

export default router;
