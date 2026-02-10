import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- USERS TABLE ---');
    const userColumns = await prisma.$queryRawUnsafe('DESCRIBE users');
    console.table(userColumns);

    console.log('--- ROLES TABLE ---');
    const roleColumns = await prisma.$queryRawUnsafe('DESCRIBE roles');
    console.table(roleColumns);

    console.log('--- SAMPLE DATA (USERS) ---');
    const users = await prisma.user.findMany({ take: 5 });
    console.log(JSON.stringify(users, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
