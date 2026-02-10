import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- ROLES DATA ---');
    const roles = await prisma.role.findMany();
    console.log(JSON.stringify(roles, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
