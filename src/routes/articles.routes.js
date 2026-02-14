import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess, ADMIN_ROLES } from '../middleware/auth.js';
import { finalizeUpload, getPublicFileUrl } from '../lib/file-utils.js';
import { FOLDER_ARTICLE_COVERS, FOLDER_ARTICLE_PHOTOS, FOLDER_ARTICLE_DOCUMENTS } from '../constants/drive-folders.js';

const router = Router();

// Generate slug dari judul
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Ambil semua artikel yang dipublikasikan (publik)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, page = 1, limit = 10, search, status, startDate, endDate, sortBy, sortOrder, popularFirst } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter dasar
    const where = { isActive: true };

    // Default ke PUBLISHED untuk akses publik
    if (status) {
      where.status = status;
    } else {
      where.status = 'PUBLISHED';
    }

    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }, { content: { contains: search } }];
    }

    // Filter tanggal
    if (startDate || endDate) {
      where.publishedAt = {};
      if (startDate) where.publishedAt.gte = new Date(startDate);
      if (endDate) where.publishedAt.lte = new Date(endDate);
    }

    // Sorting
    const orderBy = [];

    if (popularFirst === 'true') {
      // Prioritaskan artikel populer (> 50 views)
      // Sayangnya Prisma tidak support CASE WHEN di orderBy, 
      // jadi kita gunakan viewCount desc sebagai proxy atau sort manual di route ini.
      // Kita gunakan viewCount desc dahulu jika popularFirst diminta.
      orderBy.push({ viewCount: 'desc' });
    }

    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      // Default sort
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

    // Filter tanggal
    if (startDate || endDate) {
      where.createdAt = {}; // Admin usually filters by creation date or update date
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Sorting
    const orderBy = [];
    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ updatedAt: 'desc' }); // Order by recently updated for admin
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

// Ambil satu artikel berdasarkan slug (publik)
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

    // Tambah jumlah tampilan
    await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ data: article });
  }),
);

// Ambil satu artikel berdasarkan ID (admin)
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

// Buat artikel (hanya admin)
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
        tempId: z.string().optional(), // Support for staged files
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
      coverImageTempId: z.string().optional(), // NEW: Accept staged cover image
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
      attachments: attachmentsSchema.optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    // Handle staged cover image - finalize if tempId provided
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

    // Handle staged attachment photos
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
            // eslint-disable-next-line no-console
            console.warn('Failed to finalize photo:', e.message);
          }
        } else {
          processedPhotos.push(photo);
        }
      }
      attachments.photos = processedPhotos;
    }

    // Handle staged attachment documents
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
            // eslint-disable-next-line no-console
            console.warn('Failed to finalize document:', e.message);
          }
        } else {
          processedDocs.push(doc);
        }
      }
      attachments.documents = processedDocs;
    }

    // Generate slug unik
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

// Update artikel (hanya admin)
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

    // Handle staged cover image - finalize if tempId provided
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

    // Handle staged attachment photos
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
              // eslint-disable-next-line no-console
              console.warn('Failed to finalize photo:', e.message);
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
              // eslint-disable-next-line no-console
              console.warn('Failed to finalize document:', e.message);
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

// Hapus artikel (soft delete)
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
