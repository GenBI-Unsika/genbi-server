import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { getOrCreateDriveFolderPath, setDriveFilePublicReadable, uploadBufferToDrive, toDriveUploadHttpErrorMessage } from '../src/storage/gdrive.js';

function parseArgs(argv) {
  const args = {
    userId: null,
    dryRun: false,
    limit: null,
    onlyCover: false,
    onlyContent: false,
    replaceContent: true,
    replaceCover: true,
    cacheFile: path.resolve('scripts/wp-media-map.json'),
    wpHostContains: 'wordpress.com/wp-content/uploads',
    coverFolder: 'articles/covers',
    contentFolder: 'articles/photos',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];

    if (t === '--user-id') {
      args.userId = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (t === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (t === '--limit') {
      args.limit = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (t === '--only-cover') {
      args.onlyCover = true;
      args.onlyContent = false;
      continue;
    }

    if (t === '--only-content') {
      args.onlyContent = true;
      args.onlyCover = false;
      continue;
    }

    if (t === '--no-replace-content') {
      args.replaceContent = false;
      continue;
    }

    if (t === '--no-replace-cover') {
      args.replaceCover = false;
      continue;
    }

    if (t === '--cache-file') {
      args.cacheFile = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (t === '--wp-host-contains') {
      args.wpHostContains = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }

    if (t === '--cover-folder') {
      args.coverFolder = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }

    if (t === '--content-folder') {
      args.contentFolder = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }

    if (t === '--help' || t === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    `\nMigrate WordPress media URLs to Drive-backed FileObjects\n\nUsage:\n  npm run migrate:wp-media -- --user-id 48 [options]\n\nRequired:\n  --user-id <number>     FileObject.createdById\n\nOptions:\n  --dry-run              No DB writes, no uploads\n  --limit <n>            Process only first N matching articles\n  --only-cover           Only migrate coverImage\n  --only-content         Only migrate content <img src> URLs\n  --no-replace-cover     Upload only; do not update coverImage\n  --no-replace-content   Upload only; do not rewrite article.content\n  --cache-file <path>    URL mapping cache (default scripts/wp-media-map.json)\n  --cover-folder <path>  Drive subfolder path (default articles/covers)\n  --content-folder <path> Drive subfolder path (default articles/photos)\n\nNotes:\n- Rewrites WordPress URLs that contain: wordpress.com/wp-content/uploads\n- Updates coverImage to /api/v1/files/{id}/public\n- Rewrites <img src> URLs inside HTML content.\n`,
  );
}

async function loadCache(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore
  }
  return { version: 1, createdAt: new Date().toISOString(), map: {} };
}

async function saveCache(filePath, cache) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function safeUrlString(value) {
  if (!value) return '';
  return String(value).trim();
}

function normalizeWpUrl(raw) {
  const s = safeUrlString(raw);
  if (!s) return '';

  try {
    const u = new URL(s);
    // Drop query/hash to dedupe resized variants (e.g. ?w=1024)
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return s;
  }
}

function escapeRegExp(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractWpMediaUrlsFromHtml(html, wpHostContains) {
  const content = String(html || '');
  if (!content) return [];

  // Match any absolute URL containing the WordPress uploads path.
  const escaped = escapeRegExp(wpHostContains);
  // Stop at common terminators so we don't capture CSS tails like ");background...".
  const re = new RegExp(`https?:\\/\\/[^"'\\s>\)]+${escaped}[^"'\\s>\)]+`, 'gi');
  const matches = content.match(re) || [];

  // Preserve original variants (with query params) for replacement; normalize later for uploads.
  return Array.from(new Set(matches));
}

function guessNameFromUrl(url, fallbackBase = 'wp-media') {
  try {
    const u = new URL(url);
    const base = decodeURIComponent(u.pathname.split('/').pop() || '').trim();
    if (base) return base;
  } catch {
    // ignore
  }
  return `${fallbackBase}-${Date.now()}`;
}

async function downloadToBuffer(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'genbi-server-wp-media-migrator/1.0',
      accept: '*/*',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  return { buffer, contentType };
}

async function uploadExternalToFileObject({ prisma, url, userId, folderPath, folderIdCache }) {
  if (!env.GDRIVE_FOLDER_ID) {
    throw new Error('GDRIVE_FOLDER_ID not set. Google Drive storage is not configured.');
  }

  const normalized = normalizeWpUrl(url);
  const { buffer, contentType } = await downloadToBuffer(normalized);

  const fileName = guessNameFromUrl(normalized, 'wp-media');
  const mimeType = contentType || 'application/octet-stream';

  let parentFolderId = env.GDRIVE_FOLDER_ID;
  const folderKey = folderPath || '';
  if (folderKey) {
    if (!folderIdCache.has(folderKey)) {
      const segs = String(folderKey).split('/').filter(Boolean);
      const folderId = segs.length > 0 ? await getOrCreateDriveFolderPath(segs, env.GDRIVE_FOLDER_ID) : env.GDRIVE_FOLDER_ID;
      folderIdCache.set(folderKey, folderId);
    }
    parentFolderId = folderIdCache.get(folderKey);
  }

  let driveFile;
  try {
    driveFile = await uploadBufferToDrive({
      name: fileName,
      mimeType,
      buffer,
      parentFolderId,
    });
  } catch (e) {
    throw new Error(toDriveUploadHttpErrorMessage(e));
  }

  if (env.GDRIVE_PUBLIC_FILES) {
    try {
      await setDriveFilePublicReadable(driveFile.id);
    } catch {
      // ignore; proxy still works
    }
  }

  const created = await prisma.fileObject.create({
    data: {
      createdById: userId,
      driveFileId: driveFile.id,
      name: driveFile.name || fileName,
      mimeType: driveFile.mimeType || mimeType,
      sizeBytes: driveFile.size ? Number(driveFile.size) : buffer.length,
    },
  });

  return {
    fileObjectId: created.id,
    publicUrl: `/api/v1/files/${created.id}/public`,
    driveFileId: driveFile.id,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.userId || !Number.isInteger(args.userId) || args.userId <= 0) {
    // eslint-disable-next-line no-console
    console.error('Missing/invalid --user-id');
    usage();
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({ where: { id: args.userId }, select: { id: true } });
    if (!user) {
      throw new Error(`userId=${args.userId} not found (required as FileObject.createdById)`);
    }

    const cache = await loadCache(args.cacheFile);
    const map = cache.map || (cache.map = {});

    const wp = args.wpHostContains;

    const where = {
      OR: [...(args.onlyContent ? [] : [{ coverImage: { contains: wp } }]), ...(args.onlyCover ? [] : [{ content: { contains: wp } }])],
    };

    const articles = await prisma.article.findMany({
      where,
      select: { id: true, slug: true, title: true, coverImage: true, content: true },
      orderBy: { id: 'asc' },
      take: args.limit || undefined,
    });

    // eslint-disable-next-line no-console
    console.log(`Matched articles: ${articles.length}`);
    // eslint-disable-next-line no-console
    console.log(`Drive configured: ${Boolean(env.GDRIVE_FOLDER_ID)} (publicFiles=${env.GDRIVE_PUBLIC_FILES})`);
    // eslint-disable-next-line no-console
    console.log(`Dry run: ${args.dryRun}`);

    const folderIdCache = new Map();

    let uploadCount = 0;
    let updateCount = 0;
    let replacedUrls = 0;

    for (const a of articles) {
      let nextCover = a.coverImage;
      let nextContent = a.content;

      const plannedReplacements = new Map(); // originalUrl -> newUrl

      if (!args.onlyContent && args.replaceCover) {
        const cover = safeUrlString(a.coverImage);
        if (cover && cover.includes(wp)) {
          const key = normalizeWpUrl(cover);
          if (!map[key]) {
            if (args.dryRun) {
              map[key] = { dryRun: true };
            } else {
              try {
                const uploaded = await uploadExternalToFileObject({
                  prisma,
                  url: key,
                  userId: args.userId,
                  folderPath: args.coverFolder,
                  folderIdCache,
                });
                map[key] = uploaded;
                uploadCount += 1;
              } catch (e) {
                map[key] = { error: String(e?.message || e), failedAt: new Date().toISOString() };
                // eslint-disable-next-line no-console
                console.warn(`Cover upload failed for articleId=${a.id}: ${key} (${map[key].error})`);
              }
            }
          }

          const newUrl = map[key]?.publicUrl;
          if (newUrl) {
            nextCover = newUrl;
            replacedUrls += 1;
          }
        }
      }

      if (!args.onlyCover && args.replaceContent) {
        const urls = extractWpMediaUrlsFromHtml(a.content, wp);
        for (const original of urls) {
          const canonical = normalizeWpUrl(original);
          if (!map[canonical]) {
            if (args.dryRun) {
              map[canonical] = { dryRun: true };
            } else {
              try {
                const uploaded = await uploadExternalToFileObject({
                  prisma,
                  url: canonical,
                  userId: args.userId,
                  folderPath: args.contentFolder,
                  folderIdCache,
                });
                map[canonical] = uploaded;
                uploadCount += 1;
              } catch (e) {
                map[canonical] = { error: String(e?.message || e), failedAt: new Date().toISOString() };
                // eslint-disable-next-line no-console
                console.warn(`Content upload failed for articleId=${a.id}: ${canonical} (${map[canonical].error})`);
              }
            }
          }

          const newUrl = map[canonical]?.publicUrl;
          if (newUrl) plannedReplacements.set(original, newUrl);
        }

        if (plannedReplacements.size > 0 && typeof nextContent === 'string') {
          let updatedHtml = nextContent;
          for (const [from, to] of plannedReplacements.entries()) {
            updatedHtml = updatedHtml.split(from).join(to);
          }
          nextContent = updatedHtml;
          replacedUrls += plannedReplacements.size;
        }
      }

      const coverChanged = nextCover !== a.coverImage;
      const contentChanged = nextContent !== a.content;

      if (!args.dryRun && (coverChanged || contentChanged)) {
        await prisma.article.update({
          where: { id: a.id },
          data: {
            ...(coverChanged ? { coverImage: nextCover } : {}),
            ...(contentChanged ? { content: nextContent } : {}),
          },
        });
        updateCount += 1;
      }

      // eslint-disable-next-line no-console
      console.log(`[${a.id}] ${a.slug} | cover:${coverChanged ? 'updated' : 'ok'} content:${contentChanged ? 'updated' : 'ok'} urls:${plannedReplacements.size}`);

      // Persist cache incrementally for safe resume.
      if (!args.dryRun) {
        await saveCache(args.cacheFile, cache);
      }
    }

    if (!args.dryRun) {
      await saveCache(args.cacheFile, cache);
    }

    // eslint-disable-next-line no-console
    console.log(`Done. uploads=${uploadCount} articlesUpdated=${updateCount} replacements=${replacedUrls}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
