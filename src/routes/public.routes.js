import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();


// ARTIKEL PUBLIK


router.get(
  '/articles',
  asyncHandler(async (req, res) => {
    const { category, page = 1, limit = 12, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      status: 'PUBLISHED',
    };

    if (category) where.category = category;
    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }];
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
          publishedAt: true,
          viewCount: true,
          author: {
            select: {
              profile: { select: { name: true, avatar: true } },
            },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);


    const data = articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      image: a.coverImage,
      category: a.category,
      tags: a.tags,
      date: a.publishedAt,
      author: a.author?.profile?.name || 'GenBI Unsika',
      badge: a.category || 'Artikel',
      href: `/articles/${a.slug}`,
    }));

    res.json({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);


// EVENT PUBLIK (dari kegiatan dengan status akan datang/berlangsung)


router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const today = new Date();
    today.setHours(0, 0, 0, 0);


    const where = {
      isActive: true,
      status: { in: ['PLANNED', 'ONGOING'] },
    };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: 'asc' },
        skip,
        take: parseInt(limit),
        include: { division: true },
      }),
      prisma.activity.count({ where }),
    ]);


    const data = activities.map((a) => {
      const startDate = a.startDate ? new Date(a.startDate) : null;
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        image: a.coverImage || null,
        date: startDate ? startDate.toISOString().slice(0, 10) : null,
        time: startDate ? startDate.toTimeString().slice(0, 5) : null,
        location: a.location,
        division: a.division?.name || null,
        status: a.status,
        badge: a.status === 'ONGOING' ? 'Sedang Berlangsung' : 'Akan Datang',
        href: `/events/${a.id}`,
      };
    });

    res.json({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);


// PROGRAM PUBLIK (proker - semua kegiatan selesai)


router.get(
  '/programs',
  asyncHandler(async (req, res) => {
    const { divisionId, page = 1, limit = 12, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
    };

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


    const data = activities.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      image: a.coverImage || null,
      date: a.startDate,
      location: a.location,
      division: a.division?.name || null,
      status: a.status,
      badge: a.division?.name || 'Program Kerja',
      href: `/proker/${a.id}`,
    }));

    res.json({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);


// TIM PUBLIK


router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { period, divisionId } = req.query;

    const where = { isActive: true };
    if (period) where.period = period;
    if (divisionId) {
      const divId = parseInt(divisionId, 10);
      if (!isNaN(divId)) where.divisionId = divId;
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: [{ period: 'desc' }, { sortOrder: 'asc' }],
      include: {
        division: true,
        user: {
          select: {
            profile: {
              select: { name: true, avatar: true },
            },
          },
        },
      },
    });

    const data = teams.map((t) => ({
      id: t.id,
      name: t.user?.profile?.name || t.name,
      position: t.position,
      division: t.division?.name || null,
      period: t.period,
      image: t.user?.profile?.avatar || t.photo,
      socialMedia: t.socialMedia,
    }));

    res.json({ data });
  }),
);


// DIVISI PUBLIK


router.get(
  '/divisions',
  asyncHandler(async (req, res) => {
    const divisions = await prisma.division.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        color: true,
      },
    });

    res.json({ data: divisions });
  }),
);

export default router;
