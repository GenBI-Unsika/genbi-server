import { prisma } from '../src/db/prisma.js';

async function main() {
  // MySQL: expand scholarship_applications.know_desc to TEXT so long descriptions don't fail with Prisma P2000.
  await prisma.$executeRawUnsafe('ALTER TABLE `scholarship_applications` MODIFY `know_desc` TEXT NULL;');

  const rows = await prisma.$queryRawUnsafe(
    `SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'scholarship_applications'
       AND COLUMN_NAME = 'know_desc'
     LIMIT 1;`,
  );

  console.log('Updated column know_desc:', rows?.[0] || rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
