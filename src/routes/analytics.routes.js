import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAdminAccess, requireAuth } from '../middleware/auth.js';

const router = Router();

let pageViewsTableReady = false;

async function ensurePageViewsTable() {
  if (pageViewsTableReady) return;

  const ddl = `
    CREATE TABLE IF NOT EXISTS page_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visitor_id VARCHAR(64) NOT NULL,
      path VARCHAR(255) NOT NULL,
      referrer VARCHAR(512) NULL,
      user_agent VARCHAR(512) NULL,
      ip_hash CHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_created_at (created_at),
      INDEX idx_path (path),
      INDEX idx_visitor_id (visitor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await prisma.$executeRawUnsafe(ddl);
  pageViewsTableReady = true;
}

function sha256Hex(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function normalizePath(input) {
  const p = String(input || '/').trim();
  if (!p.startsWith('/')) return '/';
  return p.length > 255 ? p.slice(0, 255) : p;
}

function normalizeOptionalText(input, maxLen) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || '';
}

function toIdLabel(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

router.post(
  '/track',
  asyncHandler(async (req, res) => {
    try {
      await ensurePageViewsTable();
    } catch {
      // Tracking sebisanya aja: kl DB mati, web jgn ikutan modyar.
      const fallbackVisitorId = req?.body?.visitorId ? String(req.body.visitorId) : crypto.randomUUID();
      return res.status(202).json({ data: { visitorId: fallbackVisitorId, tracked: false } });
    }

    const schema = z
      .object({
        path: z.string().min(1).max(300).optional(),
        referrer: z.string().max(1000).optional(),
        visitorId: z.string().min(8).max(64).optional(),
      })
      .strict();

    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new HttpError(400, 'Data tidak valid', parsed.error.flatten());
    }

    const path = normalizePath(parsed.data.path);
    const referrer = normalizeOptionalText(parsed.data.referrer, 512);
    const userAgent = normalizeOptionalText(req.headers['user-agent'], 512);

    const visitorId = parsed.data.visitorId ? String(parsed.data.visitorId) : crypto.randomUUID();
    const ipHash = sha256Hex(getClientIp(req));

    try {
      await prisma.$executeRaw`
        INSERT INTO page_views (visitor_id, path, referrer, user_agent, ip_hash)
        VALUES (${visitorId}, ${path}, ${referrer}, ${userAgent}, ${ipHash})
      `;

      const articleMatch = path.match(/^\/articles\/([^\/\?\#]+)/);
      if (articleMatch && articleMatch[1]) {
        const slug = articleMatch[1];
        await prisma.article.updateMany({
          where: { slug },
          data: { viewCount: { increment: 1 } },
        });
      }
    } catch {
      // Kalo DB nyerah, webnya jalanin trus aja, bodo amat gausah tracking.
      return res.status(202).json({ data: { visitorId, tracked: false } });
    }

    res.status(201).json({ data: { visitorId, tracked: true } });
  }),
);

router.get(
  '/traffic',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    await ensurePageViewsTable();

    const days = clampInt(req.query.days, { min: 1, max: 90, fallback: 10 });

    const today = startOfDay(new Date());
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));

    const rows = await prisma.$queryRaw`
      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS views,
        COUNT(DISTINCT visitor_id) AS visitors
      FROM page_views
      WHERE created_at >= ${from}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;

    const byDay = new Map();
    for (const r of rows || []) {
      const dayDate = r.day instanceof Date ? r.day : new Date(String(r.day));
      const key = toDateKey(dayDate);
      byDay.set(key, {
        views: Number(r.views || 0),
        insights: Number(r.visitors || 0),
      });
    }

    const series = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = toDateKey(d);
      const agg = byDay.get(key) || { views: 0, insights: 0 };
      series.push({ day: toIdLabel(d), views: agg.views, insights: agg.insights });
    }

    // Total untuk rentang yang sama
    const totalsRow = await prisma.$queryRaw`
      SELECT
        COUNT(*) AS views,
        COUNT(DISTINCT visitor_id) AS visitors
      FROM page_views
      WHERE created_at >= ${from}
    `;
    const totals = Array.isArray(totalsRow) && totalsRow[0] ? totalsRow[0] : { views: 0, visitors: 0 };

    res.json({
      data: {
        days,
        from,
        series,
        totals: {
          views: Number(totals.views || 0),
          visitors: Number(totals.visitors || 0),
        },
      },
    });
  }),
);

router.get(
  '/summary',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    await ensurePageViewsTable();

    const days = clampInt(req.query.days, { min: 1, max: 90, fallback: 10 });
    const today = startOfDay(new Date());
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));

    const [trafficRows, trafficTotalsRow, allTimeRow, prokerRow, eventsRow, articlesRow] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          DATE(created_at) AS day,
          COUNT(*) AS views,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
        WHERE created_at >= ${from}
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS views,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
        WHERE created_at >= ${from}
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS views,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS views,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
        WHERE created_at >= ${from}
          AND path LIKE '/proker%'
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS views,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
        WHERE created_at >= ${from}
          AND path LIKE '/events%'
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS views,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
        WHERE created_at >= ${from}
          AND path LIKE '/articles%'
      `,
    ]);

    const trafficByDay = new Map();
    for (const r of trafficRows || []) {
      const dayDate = r.day instanceof Date ? r.day : new Date(String(r.day));
      const key = toDateKey(dayDate);
      trafficByDay.set(key, {
        views: Number(r.views || 0),
        insights: Number(r.visitors || 0),
      });
    }

    const series = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = toDateKey(d);
      const agg = trafficByDay.get(key) || { views: 0, insights: 0 };
      series.push({ day: toIdLabel(d), views: agg.views, insights: agg.insights });
    }

    const trafficTotals = Array.isArray(trafficTotalsRow) && trafficTotalsRow[0] ? trafficTotalsRow[0] : { views: 0, visitors: 0 };
    const allTime = Array.isArray(allTimeRow) && allTimeRow[0] ? allTimeRow[0] : { views: 0, visitors: 0 };
    const proker = Array.isArray(prokerRow) && prokerRow[0] ? prokerRow[0] : { views: 0, visitors: 0 };
    const events = Array.isArray(eventsRow) && eventsRow[0] ? eventsRow[0] : { views: 0, visitors: 0 };
    const articles = Array.isArray(articlesRow) && articlesRow[0] ? articlesRow[0] : { views: 0, visitors: 0 };

    const [scholarshipApps, activityRegs, articlesCount, eventsCount, activitiesCount, articlesTotalViewsRow, latestArticlesData, topArticlesData] = await Promise.all([
      prisma.scholarshipApplication.count(),
      prisma.activityRegistration.count(),
      prisma.article.count({ where: { isActive: true } }),
      prisma.event.count({ where: { isActive: true } }),
      prisma.activity.count({ where: { isActive: true } }),
      prisma.article.aggregate({
        _sum: { viewCount: true },
        where: { isActive: true },
      }),
      prisma.article.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, viewCount: true, createdAt: true, status: true },
      }),
      prisma.article.findMany({
        where: { isActive: true },
        orderBy: { viewCount: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, viewCount: true, publishedAt: true, status: true },
      }),
    ]);

    const articlesTotalViews = articlesTotalViewsRow._sum.viewCount || 0;

    const latestArticles = latestArticlesData.map(a => ({ ...a, views: a.viewCount }));
    const topArticles = topArticlesData.map(a => ({ ...a, views: a.viewCount }));

    res.json({
      data: {
        range: { days, from },
        traffic: {
          series,
          totals: {
            views: Number(trafficTotals.views || 0),
            visitors: Number(trafficTotals.visitors || 0),
          },
        },
        allTime: {
          views: Number(allTime.views || 0),
          visitors: Number(allTime.visitors || 0),
          articlesTotalViews: Number(articlesTotalViews || 0),
        },
        byPrefix: {
          proker: { views: Number(proker.views || 0), visitors: Number(proker.visitors || 0) },
          events: { views: Number(events.views || 0), visitors: Number(events.visitors || 0) },
          articles: { views: Number(articles.views || 0), visitors: Number(articles.visitors || 0) },
        },
        counts: {
          scholarshipApplications: scholarshipApps,
          articles: articlesCount,
          events: eventsCount,
          activities: activitiesCount,
        },
        latestArticles,
        topArticles,
      },
    });
  }),
);

export default router;
