import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess, ADMIN_ROLES } from '../middleware/auth.js';

const router = Router();

// Generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Get all published articles (public)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, page = 1, limit = 10, search, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Only show published articles for public, all for admin
    const where = { isActive: true };

    // Default to PUBLISHED for public access
    if (status) {
      where.status = status;
    } else {
      where.status = 'PUBLISHED';
    }

    if (category) where.category = category;
    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }, { content: { contains: search } }];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          category: true,
          tags: true,
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

// Get single article by slug (public)
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

    // Increment view count
    await prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ data: article });
  }),
);

// Get single article by ID (admin)
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

// Create article (admin only)
router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().min(1, 'Judul wajib diisi'),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      coverImage: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'Data tidak valid', body.error.flatten());
    }

    // Generate unique slug
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
        coverImage: body.data.coverImage,
        category: body.data.category,
        tags: body.data.tags || [],
        status: body.data.status || 'DRAFT',
        authorId: req.auth.userId,
        publishedAt: body.data.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    res.status(201).json({ data: article });
  }),
);

// Update article (admin only)
router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const { title, excerpt, content, coverImage, category, tags, status, isActive } = req.body;

    const currentArticle = await prisma.article.findUnique({ where: { id } });
    if (!currentArticle) {
      throw new HttpError(404, 'Artikel tidak ditemukan');
    }

    // If publishing for first time, set publishedAt
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
        ...(coverImage !== undefined && { coverImage }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(status !== undefined && { status, publishedAt }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ data: article });
  }),
);

// Delete article (soft delete)
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
