import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import { XMLParser } from 'fast-xml-parser';
import { PrismaClient } from '@prisma/client';

function parseArgs(argv) {
  const args = {
    xml: null,
    authorId: null,
    authorEmail: null,
    includePages: false,
    includeDrafts: false,
    updateExisting: false,
    skipExisting: true,
    dryRun: false,
    limit: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--xml') {
      args.xml = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--author-id') {
      args.authorId = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (token === '--author-email') {
      args.authorEmail = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--include-pages') {
      args.includePages = true;
      continue;
    }

    if (token === '--include-drafts') {
      args.includeDrafts = true;
      continue;
    }

    if (token === '--update-existing') {
      args.updateExisting = true;
      args.skipExisting = false;
      continue;
    }

    if (token === '--no-skip-existing') {
      args.skipExisting = false;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--limit') {
      args.limit = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function usage() {
  // Keep it short; this is a CLI utility.
  // eslint-disable-next-line no-console
  console.log(
    `\nWordPress WXR Importer (Articles)\n\nUsage:\n  npm run import:wordpress -- --xml "C:/path/export.xml" --author-email "admin@domain.com" [options]\n\nRequired:\n  --xml <path>\n  --author-id <number> OR --author-email <email>\n\nOptions:\n  --include-pages        Also import wp:post_type=page\n  --include-drafts       Also import non-published posts as DRAFT\n  --dry-run              Parse + show summary only, no DB writes\n  --limit <n>            Import only first N eligible items\n  --update-existing      Update existing records matched by slug\n  --no-skip-existing     Do not skip duplicates (will error unless --update-existing)\n\nNotes:\n- Default behavior: imports only wp posts with status=publish into Article(status=PUBLISHED).\n- coverImage is taken from _thumbnail_id attachment if available, otherwise first <img src=...> inside content.\n`,
  );
}

function pickArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function safeString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function slugify(input) {
  const s = safeString(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return s || 'untitled';
}

function parseWpDate(item) {
  // Prefer GMT if present.
  const gmt = item?.['wp:post_date_gmt'];
  const local = item?.['wp:post_date'];

  const candidate = safeString(gmt || local).trim();
  if (!candidate) return null;

  // Candidate format: "YYYY-MM-DD HH:mm:ss".
  // If it's GMT, treat as UTC.
  const iso = gmt ? `${candidate.replace(' ', 'T')}Z` : `${candidate.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getPostMeta(item, key) {
  const metas = pickArray(item?.['wp:postmeta']);
  for (const meta of metas) {
    if (safeString(meta?.['wp:meta_key']).trim() === key) {
      return meta?.['wp:meta_value'];
    }
  }
  return null;
}

function extractFirstImageUrl(html) {
  const content = safeString(html);
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return null;
  return match[1];
}

function normalizeCoverUrl(url) {
  const s = safeString(url).trim();
  if (!s) return null;
  // WordPress.com often appends ?w=1024 etc. Keep original but strip size-only query if present.
  try {
    const u = new URL(s);
    if (u.searchParams.has('w') && u.searchParams.size === 1) {
      u.search = '';
    }
    return u.toString();
  } catch {
    return s;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.xml) {
    // eslint-disable-next-line no-console
    console.error('Missing --xml');
    usage();
    process.exit(1);
  }

  if (!args.authorId && !args.authorEmail) {
    // eslint-disable-next-line no-console
    console.error('Missing --author-id or --author-email');
    usage();
    process.exit(1);
  }

  const xmlPath = path.resolve(args.xml);
  const xml = await fs.readFile(xmlPath, 'utf8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  });

  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) {
    throw new Error('Invalid WXR: missing rss.channel');
  }

  const items = pickArray(channel.item);
  if (items.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No <item> nodes found. Nothing to import.');
    return;
  }

  // Build attachment map: wp:post_id -> wp:attachment_url
  const attachmentById = new Map();
  for (const it of items) {
    if (safeString(it?.['wp:post_type']).trim() !== 'attachment') continue;
    const id = Number(safeString(it?.['wp:post_id']).trim());
    const url = normalizeCoverUrl(it?.['wp:attachment_url']);
    if (Number.isFinite(id) && url) attachmentById.set(id, url);
  }

  const allowedTypes = new Set(['post']);
  if (args.includePages) allowedTypes.add('page');

  const eligible = [];
  for (const it of items) {
    const type = safeString(it?.['wp:post_type']).trim();
    if (!allowedTypes.has(type)) continue;

    const wpStatus = safeString(it?.['wp:status']).trim();
    const isPublished = wpStatus === 'publish';
    if (!isPublished && !args.includeDrafts) continue;

    eligible.push(it);
  }

  const limited = args.limit ? eligible.slice(0, args.limit) : eligible;

  const prisma = new PrismaClient();

  try {
    let resolvedAuthorId = args.authorId;

    if (!resolvedAuthorId && args.authorEmail) {
      const user = await prisma.user.findUnique({
        where: { email: args.authorEmail },
        select: { id: true },
      });
      if (!user) {
        throw new Error(`No user found for author email: ${args.authorEmail}`);
      }
      resolvedAuthorId = user.id;
    }

    if (resolvedAuthorId) {
      const author = await prisma.user.findUnique({
        where: { id: resolvedAuthorId },
        select: { id: true },
      });
      if (!author) {
        // eslint-disable-next-line no-console
        console.warn(`Warning: authorId=${resolvedAuthorId} not found. Import will continue with authorId=null.`);
        resolvedAuthorId = null;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Resolved authorId: ${resolvedAuthorId ?? 'null'}`);

    // eslint-disable-next-line no-console
    console.log(`Parsed ${items.length} items; eligible to import: ${limited.length}`);
    // eslint-disable-next-line no-console
    console.log(`Attachments indexed: ${attachmentById.size}`);

    if (args.dryRun) {
      // eslint-disable-next-line no-console
      console.log('Dry run: no DB writes.');
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const it of limited) {
      const wpId = Number(safeString(it?.['wp:post_id']).trim());
      const title = safeString(it?.title).trim() || `WP ${wpId || ''}`.trim();
      const wpSlug = safeString(it?.['wp:post_name']).trim();

      const baseSlug = wpSlug || slugify(title);
      let slug = baseSlug;

      const content = safeString(it?.['content:encoded']);
      const excerpt = safeString(it?.['excerpt:encoded']) || null;

      const wpStatus = safeString(it?.['wp:status']).trim();
      const status = wpStatus === 'publish' ? 'PUBLISHED' : 'DRAFT';
      const publishedAt = wpStatus === 'publish' ? parseWpDate(it) : null;

      const thumbnailIdRaw = getPostMeta(it, '_thumbnail_id');
      const thumbnailId = Number(safeString(thumbnailIdRaw).trim());
      const thumbnailUrl = Number.isFinite(thumbnailId) ? attachmentById.get(thumbnailId) : null;

      const firstImg = extractFirstImageUrl(content);
      const coverImage = normalizeCoverUrl(thumbnailUrl || firstImg);

      const categories = pickArray(it?.category).map((c) => {
        const name = typeof c === 'string' ? c : (c?.['#text'] ?? c);
        return {
          domain: c?.domain ?? null,
          nicename: c?.nicename ?? null,
          name: safeString(name).trim(),
        };
      });

      const source = {
        wpId: Number.isFinite(wpId) ? wpId : null,
        wpType: safeString(it?.['wp:post_type']).trim() || null,
        wpStatus: wpStatus || null,
        wpLink: safeString(it?.link).trim() || null,
        wpGuid: safeString(it?.guid).trim() || null,
        wpCreator: safeString(it?.['dc:creator']).trim() || null,
        wpPublishedAt: publishedAt ? publishedAt.toISOString() : null,
        categories,
      };

      // Ensure unique slug.
      if (args.skipExisting || args.updateExisting) {
        const existing = await prisma.article.findUnique({
          where: { slug },
          select: { id: true },
        });

        if (existing && args.updateExisting) {
          await prisma.article.update({
            where: { id: existing.id },
            data: {
              title,
              excerpt,
              content,
              coverImage,
              status,
              publishedAt,
              authorId: resolvedAuthorId,
              attachments: source,
            },
          });
          updated += 1;
          continue;
        }

        if (existing && args.skipExisting) {
          skipped += 1;
          continue;
        }

        if (existing && !args.skipExisting) {
          // Try to avoid a hard failure by suffixing with wpId.
          slug = `${baseSlug}-${wpId || Date.now()}`;
        }
      }

      await prisma.article.create({
        data: {
          title,
          slug,
          excerpt,
          content,
          coverImage,
          attachments: source,
          authorId: resolvedAuthorId,
          status,
          publishedAt,
          isActive: true,
        },
      });

      created += 1;
    }

    // eslint-disable-next-line no-console
    console.log(`Done. created=${created} updated=${updated} skipped=${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
