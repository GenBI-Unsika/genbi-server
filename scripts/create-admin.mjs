import bcrypt from 'bcryptjs';

import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import { assertAllowedEmailDomain, normalizeEmail } from '../src/auth/domain.js';

// Valid roles from the new role system
const VALID_ROLES = ['super_admin', 'admin', 'koordinator', 'awardee', 'member', 'alumni'];

function readBool(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(raw).toLowerCase());
}

async function main() {
  const emailRaw = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;
  const roleInput = process.env.ADMIN_ROLE || 'admin';

  if (!emailRaw) {
    console.error('Missing ADMIN_EMAIL env var');
    process.exit(2);
  }
  if (!password || password.length < 8) {
    console.error('Missing ADMIN_PASSWORD env var (min 8 chars)');
    process.exit(2);
  }

  const role = roleInput.toLowerCase();
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid ADMIN_ROLE: ${roleInput}. Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(2);
  }

  const email = normalizeEmail(emailRaw);
  // Important: login endpoints also enforce allowed email domains.
  assertAllowedEmailDomain(email);

  const shouldMarkVerified = readBool('ADMIN_EMAIL_VERIFIED', true) || Boolean(env.AUTH_REQUIRE_EMAIL_VERIFIED);

  const passwordHash = await bcrypt.hash(password, 12);

  // Resolve role name to role ID
  const roleRecord = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRecord) {
    console.error(`Role '${role}' not found in database. Make sure roles are seeded first.`);
    process.exit(2);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      roleId: roleRecord.id,
      isActive: true,
      passwordHash,
      emailVerifiedAt: shouldMarkVerified ? new Date() : undefined,
      profile: name
        ? {
            upsert: {
              create: { name },
              update: { name },
            },
          }
        : undefined,
    },
    create: {
      email,
      passwordHash,
      roleId: roleRecord.id,
      isActive: true,
      emailVerifiedAt: shouldMarkVerified ? new Date() : undefined,
      profile: name ? { create: { name } } : undefined,
    },
    select: { id: true, email: true, roleId: true, role: true, isActive: true, emailVerifiedAt: true },
  });

  console.log('Admin user ready:');
  console.log(user);
  console.log(`\nRole: ${role}`);
  console.log('Valid roles:', VALID_ROLES.join(', '));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
