import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

const router = Router();
const SITEMAP_CACHE_SECONDS = 3600;

router.get('/sitemap.xml', async (req, res, next) => {
    try {
        const baseUrl = (env.FRONTEND_CLIENT_BASE_URL || 'https://genbiunsika.web.id').replace(/\/$/, '');

        const articles = await prisma.article.findMany({
            where: { status: 'PUBLISHED', isActive: true },
            select: { slug: true, updatedAt: true, title: true, coverImage: true },
        }).catch(e => { console.error("Prisma error articles:", e); return []; });

        const events = await prisma.event.findMany({
            where: { isActive: true },
            select: { id: true, updatedAt: true },
        }).catch(e => { console.error("Prisma error events:", e); return []; });

        const prokers = await prisma.activity.findMany({
            where: { isActive: true, status: { in: ['PLANNED', 'ONGOING'] } },
            select: { id: true, updatedAt: true },
        }).catch(e => { console.error("Prisma error prokers:", e); return []; });

        const staticPages = [
            { path: '', priority: '1.0', changefreq: 'daily' },
            { path: '/articles', priority: '0.9', changefreq: 'daily' },
            { path: '/events', priority: '0.9', changefreq: 'daily' },
            { path: '/proker', priority: '0.8', changefreq: 'weekly' },
            { path: '/about', priority: '0.7', changefreq: 'monthly' },
            { path: '/scholarship', priority: '0.8', changefreq: 'weekly' },
            { path: '/teams', priority: '0.7', changefreq: 'monthly' },
            { path: '/history', priority: '0.6', changefreq: 'monthly' },
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

        const formatLastmod = (date) => {
            try {
                if (!date) return new Date().toISOString().split('T')[0];
                const d = new Date(date);
                if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
                return d.toISOString().split('T')[0];
            } catch (e) {
                return new Date().toISOString().split('T')[0];
            }
        };

        staticPages.forEach((page) => {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
            xml += `    <lastmod>${formatLastmod()}</lastmod>\n`;
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
            xml += `    <priority>${page.priority}</priority>\n`;
            xml += `  </url>\n`;
        });

        articles.forEach((article) => {
            if (!article.slug) return;
            const cleanSlug = article.slug.replace(/%[0-9a-fA-F]{2}/g, '').replace(/[^\w-]/g, '');
            if (!cleanSlug) return;

            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/articles/${cleanSlug}</loc>\n`;
            xml += `    <lastmod>${formatLastmod(article.updatedAt)}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            if (article.coverImage) {
                const imgUrl = article.coverImage.startsWith('http')
                    ? article.coverImage
                    : `${baseUrl}${article.coverImage.startsWith('/') ? '' : '/'}${article.coverImage}`;

                const escapedTitle = (article.title || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');

                xml += `    <image:image>\n`;
                xml += `      <image:loc>${imgUrl}</image:loc>\n`;
                xml += `      <image:title>${escapedTitle}</image:title>\n`;
                xml += `    </image:image>\n`;
            }
            xml += `  </url>\n`;
        });

        events.forEach((event) => {
            if (!event.id) return;
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/events/${event.id}</loc>\n`;
            xml += `    <lastmod>${formatLastmod(event.updatedAt)}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.7</priority>\n`;
            xml += `  </url>\n`;
        });

        prokers.forEach((proker) => {
            if (!proker.id) return;
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/proker/${proker.id}</loc>\n`;
            xml += `    <lastmod>${formatLastmod(proker.updatedAt)}</lastmod>\n`;
            xml += `    <changefreq>monthly</changefreq>\n`;
            xml += `    <priority>0.6</priority>\n`;
            xml += `  </url>\n`;
        });

        xml += `</urlset>`;

        res.setHeader('Content-Type', 'text/xml');
        res.setHeader('Cache-Control', `public, max-age=${SITEMAP_CACHE_SECONDS}`);
        res.send(xml);
    } catch (error) {
        console.error('CRITICAL_SITEMAP_ERROR:', error);
        next(error);
    }
});

router.get('/robots.txt', (req, res) => {
    const baseUrl = (env.FRONTEND_CLIENT_BASE_URL || 'https://genbiunsika.web.id').replace(/\/$/, '');
    const content = [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
});

export default router;
