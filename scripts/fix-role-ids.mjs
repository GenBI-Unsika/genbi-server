/**
 * Fix corrupted role_id values in users table.
 *
 * Bug: Some code paths wrote the role NAME string (e.g. 'awardee', 'member')
 * into the role_id column instead of the integer FK. MySQL silently coerced
 * the string to 0 or used a DEFAULT, resulting in garbage values like
 * timestamps in the role_id column.
 *
 * This script:
 * 1. Loads all roles from the roles table
 * 2. Finds users whose role_id doesn't match any valid role
 * 3. Attempts to infer the correct role from context (team_members → awardee, etc.)
 * 4. Falls back to 'member' role for any that can't be inferred
 *
 * Usage: node scripts/fix-role-ids.mjs [--dry-run]
 */

import { prisma } from '../src/db/prisma.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN MODE (no changes will be made)\n' : '🔧 FIXING role_id values...\n');

  // 1. Get all valid roles
  const roles = await prisma.role.findMany();
  console.log('📋 Valid roles:');
  for (const r of roles) {
    console.log(`   id=${r.id}  name="${r.name}"  displayName="${r.displayName}"`);
  }

  const validRoleIds = new Set(roles.map((r) => r.id));
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  // 2. Get all users with minimal context needed to infer a reasonable role
  // Note: the current schema doesn't have a TeamMember relation; awardee-ness is
  // inferred from profile fields used by the team feature (division/jabatan).
  const users = await prisma.user.findMany({
    include: {
      profile: {
        select: {
          divisionId: true,
          jabatan: true,
        },
      },
    },
  });

  console.log(`\n👥 Total users: ${users.length}`);

  // 3. Find corrupted users
  const corrupted = users.filter((u) => !validRoleIds.has(u.roleId));
  console.log(`❌ Users with invalid role_id: ${corrupted.length}`);

  if (corrupted.length === 0) {
    console.log('\n✅ All role_id values are valid. Nothing to fix!');
    return;
  }

  // 4. Fix each corrupted user
  let fixed = 0;
  for (const user of corrupted) {
    let newRoleId;
    let reason;

    // If profile has team-related fields filled, treat as awardee
    const looksLikeAwardee = Boolean(user.profile?.divisionId) || Boolean(user.profile?.jabatan);

    if (looksLikeAwardee) {
      newRoleId = roleByName['awardee'];
      reason = 'profile has division/jabatan → awardee';
    } else if (user.email?.endsWith('@admin.genbi.unsika.ac.id')) {
      newRoleId = roleByName['admin'];
      reason = 'admin email domain → admin';
    } else {
      newRoleId = roleByName['member'] || roleByName['awardee'];
      reason = 'fallback → member';
    }

    console.log(`\n   User #${user.id} (${user.email})`);
    console.log(`   Current role_id: ${user.roleId} (INVALID)`);
    console.log(`   New role_id: ${newRoleId} (${reason})`);

    if (!DRY_RUN) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: newRoleId },
      });
      fixed++;
    }
  }

  console.log(`\n${DRY_RUN ? '🔍 Would fix' : '✅ Fixed'} ${DRY_RUN ? corrupted.length : fixed} users`);
  if (DRY_RUN) {
    console.log('\nRun without --dry-run to apply fixes.');
  }
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
