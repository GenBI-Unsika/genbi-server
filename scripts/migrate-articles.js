import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { uploadBufferToDrive, setDriveFilePublicReadable, getOrCreateDriveFolderPath } from '../src/storage/gdrive.js';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();
const XML_PATH = path.join(process.cwd(), 'wordpress-export.xml');

// Helper to convert WordPress excerpt/content CDATA
function cleanHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html.replace(/<!--[\s\S]*?-->/g, '').trim();
}

async function migrate() {
    console.log('--- Starting Article Migration ---');

    if (!fs.existsSync(XML_PATH)) {
        console.error(`XML file not found at ${XML_PATH}`);
        process.exit(1);
    }

    const xmlData = fs.readFileSync(XML_PATH, 'utf-8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        cdataPropName: '__cdata',
        format: true,
    });

    const parsed = parser.parse(xmlData);
    const channel = parsed?.rss?.channel;
    if (!channel || !channel.item) {
        console.error('Invalid WordPress XML export format.');
        process.exit(1);
    }

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];

    // 1. Parse all items into categories
    const attachments = new Map(); // post_id -> attachment item
    const posts = [];

    for (const item of items) {
        let postType = item['wp:post_type'];
        if (postType && postType['__cdata']) postType = postType['__cdata'];

        const postId = Number(item['wp:post_id']);

        if (postType === 'attachment') {
            attachments.set(postId, item);
        } else if (postType === 'post') {
            posts.push(item);
        }
    }

    console.log(`Found ${posts.length} posts and ${attachments.size} attachments.`);

    // Ensure 'Articles' drive folder exists
    let articlesFolderId = env.GDRIVE_FOLDER_ID;
    if (articlesFolderId) {
        try {
            articlesFolderId = await getOrCreateDriveFolderPath(['Articles'], env.GDRIVE_FOLDER_ID);
            console.log(`Using Drive Folder ID for Articles: ${articlesFolderId}`);
        } catch (e) {
            console.warn('Failed to resolve Articles folder, falling back to root GDRIVE_FOLDER_ID', e.message);
        }
    } else {
        console.warn('WARNING: No GDRIVE_FOLDER_ID set in .env! Cannot upload images.');
    }

    // 2. Process each post
    let successCount = 0;
    let failCount = 0;

    // We need an admin user to be the author
    const adminUser = await prisma.user.findFirst({
        select: { id: true }
    });
    const defaultAuthorId = adminUser?.id || null;

    // Helper to extract value whether it has CDATA wrapper or not
    const getVal = (field) => {
        if (!field) return '';
        if (typeof field === 'object' && field['__cdata']) return field['__cdata'];
        if (typeof field === 'object' && field['#text']) return field['#text'];
        if (typeof field === 'string' || typeof field === 'number') return String(field);
        return '';
    };

    for (const post of posts) {
        const postId = post['wp:post_id'];
        const title = getVal(post.title) || 'Untitled';
        let slug = getVal(post['wp:post_name']) || `post-${postId}`;
        const pubDate = new Date(post.pubDate);
        const content = cleanHtml(getVal(post['content:encoded']));
        const excerpt = cleanHtml(getVal(post['excerpt:encoded']));
        const status = getVal(post['wp:status']) === 'publish' ? 'PUBLISHED' : 'DRAFT';

        console.log(`\nProcessing Article: "${title}"`);

        // Ensure unique slug
        let uniqueSlug = slug;
        let counter = 1;
        while (await prisma.article.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }

        // Try to find the thumbnail ID from postmeta
        let thumbnailId = null;
        let coverImageUrl = null;

        const metaArray = Array.isArray(post['wp:postmeta']) ? post['wp:postmeta'] : [post['wp:postmeta']];
        for (const meta of metaArray) {
            if (meta && meta['wp:meta_key'] === '_thumbnail_id') {
                thumbnailId = Number(meta['wp:meta_value']);
                break;
            }
        }

        // If thumbnail exists, download and upload it
        let fileObjectId = null;
        if (thumbnailId && attachments.has(thumbnailId)) {
            const att = attachments.get(thumbnailId);
            const url = att['wp:attachment_url'];
            const fileName = att.title || `cover-${postId}.jpg`;

            console.log(`  -> Downloading thumbnail from ${url}`);
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                const mimeType = response.headers['content-type'] || 'image/jpeg';

                if (articlesFolderId) {
                    console.log(`  -> Uploading to Google Drive...`);
                    const driveFile = await uploadBufferToDrive({
                        name: fileName,
                        mimeType,
                        buffer,
                        parentFolderId: articlesFolderId
                    });

                    if (env.GDRIVE_PUBLIC_FILES) {
                        await setDriveFilePublicReadable(driveFile.id);
                    }

                    // Create FileObject in DB
                    const createdFile = await prisma.fileObject.create({
                        data: {
                            createdById: defaultAuthorId,
                            driveFileId: driveFile.id,
                            name: driveFile.name || fileName,
                            mimeType: driveFile.mimeType || mimeType,
                            sizeBytes: buffer.length,
                        }
                    });

                    fileObjectId = createdFile.id;
                    coverImageUrl = `/api/v1/files/${fileObjectId}/public`;
                    console.log(`  -> Saved FileObject ID: ${fileObjectId}`);
                }
            } catch (err) {
                console.error(`  -> Failed to download/upload image: ${err.message}`);
            }
        } else {
            console.log(`  -> No thumbnail found for this post.`);
        }

        // Insert article into DB
        try {
            const rawPostDate = getVal(post['wp:post_date']);
            const createdAtDate = rawPostDate && rawPostDate !== '0000-00-00 00:00:00' ? new Date(rawPostDate) : (pubDate && !isNaN(pubDate) ? pubDate : new Date());

            await prisma.article.create({
                data: {
                    title,
                    slug: uniqueSlug,
                    excerpt: excerpt || content.substring(0, 150) + '...',
                    content,
                    coverImage: coverImageUrl,
                    status,
                    publishedAt: status === 'PUBLISHED' && !isNaN(pubDate) ? pubDate : null,
                    authorId: defaultAuthorId,
                    createdAt: createdAtDate,
                }
            });
            successCount++;
            console.log(`  -> Automatically migrated Article ✅`);
        } catch (err) {
            failCount++;
            console.error(`  -> Failed to insert article into DB: ${err.message}`);
        }
    }

    console.log(`\n--- Migration completed! Success: ${successCount}, Failed: ${failCount} ---`);
}

migrate()
    .catch(e => {
        console.error('Migration crashed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
