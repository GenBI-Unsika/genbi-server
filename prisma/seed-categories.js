import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
    { name: 'Beasiswa', slug: 'beasiswa', color: '#10B981' },
    { name: 'Kegiatan Sosial', slug: 'kegiatan-sosial', color: '#F59E0B' },
    { name: 'Workshop', slug: 'workshop', color: '#8B5CF6' },
    { name: 'Seminar', slug: 'seminar', color: '#3B82F6' },
    { name: 'Pengumuman', slug: 'pengumuman', color: '#EF4444' },
    { name: 'Berita Umum', slug: 'berita-umum', color: '#6B7280' },
];

async function seedCategories() {
    console.log('Seeding article categories...');

    for (const cat of categories) {
        await prisma.articleCategory.upsert({
            where: { slug: cat.slug },
            update: {},
            create: cat,
        });
        console.log(`✓ Category: ${cat.name}`);
    }

    console.log('✅ Article categories seeded successfully!');
}

seedCategories()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
