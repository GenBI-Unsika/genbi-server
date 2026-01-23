import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { TEAM_MEMBERS } from './seed-data/team-members.js';

const prisma = new PrismaClient();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Data fakultas dan program studi Unsika
const FACULTIES_AND_PROGRAMS = [
  {
    code: 'FH',
    name: 'Fakultas Hukum',
    programs: [{ code: 'IH', name: 'Ilmu Hukum', degree: 'S1' }],
  },
  {
    code: 'FE',
    name: 'Fakultas Ekonomi',
    programs: [
      { code: 'MJ', name: 'Manajemen', degree: 'S1' },
      { code: 'AK', name: 'Akuntansi', degree: 'S1' },
      { code: 'AK-D3', name: 'Akuntansi', degree: 'D3' },
    ],
  },
  {
    code: 'FKIP',
    name: 'Fakultas Keguruan dan Ilmu Pendidikan',
    programs: [
      { code: 'PM', name: 'Pendidikan Matematika', degree: 'S1' },
      { code: 'PLS', name: 'Pendidikan Luar Sekolah', degree: 'S1' },
      { code: 'PBSI', name: 'Pendidikan Bahasa & Sastra Indonesia', degree: 'S1' },
      { code: 'PJKR', name: 'Pendidikan Jasmani, Kesehatan & Rekreasi', degree: 'S1' },
      { code: 'PBI', name: 'Pendidikan Bahasa Inggris', degree: 'S1' },
    ],
  },
  {
    code: 'FP',
    name: 'Fakultas Pertanian',
    programs: [
      { code: 'AGT', name: 'Agroteknologi', degree: 'S1' },
      { code: 'AGB', name: 'Agribisnis', degree: 'S1' },
    ],
  },
  {
    code: 'FT',
    name: 'Fakultas Teknik',
    programs: [
      { code: 'TK', name: 'Teknik Kimia', degree: 'S1' },
      { code: 'TE', name: 'Teknik Elektro', degree: 'S1' },
      { code: 'TM', name: 'Teknik Mesin', degree: 'S1' },
      { code: 'TI', name: 'Teknik Industri', degree: 'S1' },
      { code: 'TL', name: 'Teknik Lingkungan', degree: 'S1' },
      { code: 'TM-D3', name: 'Teknik Mesin', degree: 'D3' },
    ],
  },
  {
    code: 'FIKR',
    name: 'Fakultas Ilmu Komputer',
    programs: [
      { code: 'TIF', name: 'Teknik Informatika', degree: 'S1' },
      { code: 'SI', name: 'Sistem Informasi', degree: 'S1' },
    ],
  },
  {
    code: 'FISIP',
    name: 'Fakultas Ilmu Sosial dan Ilmu Politik',
    programs: [
      { code: 'IK', name: 'Ilmu Komunikasi', degree: 'S1' },
      { code: 'IP', name: 'Ilmu Pemerintahan', degree: 'S1' },
      { code: 'HI', name: 'Hubungan Internasional', degree: 'S1' },
    ],
  },
  {
    code: 'FAI',
    name: 'Fakultas Agama Islam',
    programs: [
      { code: 'PAI', name: 'Pendidikan Agama Islam', degree: 'S1' },
      { code: 'MPI', name: 'Manajemen Pendidikan Islam', degree: 'S1' },
      { code: 'PIAUD', name: 'Pendidikan Islam Anak Usia Dini', degree: 'S1' },
    ],
  },
  {
    code: 'FIKES',
    name: 'Fakultas Ilmu Kesehatan',
    programs: [
      { code: 'IKOR', name: 'Ilmu Keolahragaan', degree: 'S1' },
      { code: 'IGZ', name: 'Ilmu Gizi', degree: 'S1' },
      { code: 'FAR', name: 'Farmasi', degree: 'S1' },
      { code: 'KEB-D3', name: 'Kebidanan', degree: 'D3' },
    ],
  },
];

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // 1. Seed admin user
  const adminEmail = required('SEED_ADMIN_EMAIL');
  const adminPassword = required('SEED_ADMIN_PASSWORD');

  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      role: 'admin',
      isActive: true,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: adminEmail.toLowerCase(),
      role: 'admin',
      isActive: true,
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: { create: { name: 'Admin GenBI' } },
    },
  });

  console.log(`✅ Seeded admin user: ${adminUser.email}\n`);

  // 2. Seed faculties and study programs
  console.log('📚 Seeding faculties and study programs...\n');

  for (const [index, facultyData] of FACULTIES_AND_PROGRAMS.entries()) {
    const faculty = await prisma.faculty.upsert({
      where: { code: facultyData.code },
      update: {
        name: facultyData.name,
        sortOrder: index,
        isActive: true,
      },
      create: {
        code: facultyData.code,
        name: facultyData.name,
        sortOrder: index,
        isActive: true,
      },
    });

    console.log(`  ✓ ${faculty.name}`);

    for (const [progIndex, program] of facultyData.programs.entries()) {
      await prisma.studyProgram.upsert({
        where: { code: program.code },
        update: {
          name: program.name,
          degree: program.degree,
          facultyId: faculty.id,
          sortOrder: progIndex,
          isActive: true,
        },
        create: {
          code: program.code,
          name: program.name,
          degree: program.degree,
          facultyId: faculty.id,
          sortOrder: progIndex,
          isActive: true,
        },
      });

      console.log(`    - ${program.name} (${program.degree})`);
    }

    console.log('');
  }

  // 3. Seed team members
  console.log('👥 Seeding team members...\n');

  for (const [index, member] of TEAM_MEMBERS.entries()) {
    await prisma.teamMember.upsert({
      where: {
        name_division: {
          name: member.name,
          division: member.division,
        },
      },
      update: {
        ...member,
        isActive: true,
        sortOrder: index,
      },
      create: {
        ...member,
        isActive: true,
        sortOrder: index,
      },
    });
  }

  console.log(`✅ Seeded ${TEAM_MEMBERS.length} team members\n`);

  console.log('✅ Database seeding completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
