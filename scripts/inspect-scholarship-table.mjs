import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe('DESCRIBE scholarship_applications');
  console.log('--- DESCRIBE scholarship_applications ---');
  console.table(columns);

  const indexes = await prisma.$queryRawUnsafe('SHOW INDEX FROM scholarship_applications');
  console.log('--- SHOW INDEX FROM scholarship_applications ---');
  console.table(indexes);

  const create = await prisma.$queryRawUnsafe('SHOW CREATE TABLE scholarship_applications');
  console.log('--- SHOW CREATE TABLE scholarship_applications ---');
  console.log(create?.[0]?.['Create Table'] || create);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
