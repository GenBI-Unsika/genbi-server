
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Admin Users ---');
    const admins = await prisma.user.findMany({
        where: {
            role: {
                name: { in: ['super_admin', 'admin'] }
            }
        },
        include: {
            role: true,
            profile: true
        }
    });

    console.log(`Found ${admins.length} admin users:`);
    admins.forEach(u => {
        console.log(`- ${u.email} (Role: ${u.role?.name}, Active: ${u.isActive}, GoogleSub: ${u.googleSub ? 'YES' : 'NO'})`);
    });
    console.log('-----------------------------');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
