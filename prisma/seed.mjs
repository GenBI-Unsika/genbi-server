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

// Divisions dengan nama yang match dengan team-members.js
const DIVISIONS = [
  {
    key: 'steering-committee',
    name: 'Steering Committee',
    description: 'Pimpinan dan pengarah program GenBI',
    icon: '👑',
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-200',
    sortOrder: 0,
  },
  {
    key: 'divisi-pengembangan-masyarakat',
    name: 'Divisi Pengembangan Masyarakat',
    description: 'Pemberdayaan dan pengembangan masyarakat',
    icon: '🤝',
    gradient: 'from-teal-500 to-emerald-500',
    bgLight: 'bg-teal-50',
    textColor: 'text-teal-600',
    borderColor: 'border-teal-200',
    sortOrder: 1,
  },
  {
    key: 'divisi-komunikasi',
    name: 'Divisi Komunikasi',
    description: 'Konten, humas, dan publikasi',
    icon: '📢',
    gradient: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    sortOrder: 2,
  },
  {
    key: 'divisi-riset-isu',
    name: 'Divisi Riset/Isu',
    description: 'Riset dan kajian isu-isu strategis',
    icon: '🔬',
    gradient: 'from-indigo-500 to-purple-500',
    bgLight: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-200',
    sortOrder: 3,
  },
  {
    key: 'divisi-kewirausahaan',
    name: 'Divisi Kewirausahaan',
    description: 'Dukungan kewirausahaan dan bisnis',
    icon: '💼',
    gradient: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-600',
    borderColor: 'border-rose-200',
    sortOrder: 4,
  },
  {
    key: 'divisi-pendidikan',
    name: 'Divisi Pendidikan',
    description: 'Program edukasi dan mentoring',
    icon: '📚',
    gradient: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    sortOrder: 5,
  },
];

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // 1. Seed admin user
  const adminEmail = required('SEED_ADMIN_EMAIL');
  const adminPassword = required('SEED_ADMIN_PASSWORD');
  const adminRole = process.env.ADMIN_ROLE || 'super_admin';

  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      role: adminRole,
      isActive: true,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: adminEmail.toLowerCase(),
      role: adminRole,
      isActive: true,
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: { create: { name: 'Admin GenBI' } },
    },
  });

  console.log(`✅ Seeded admin user: ${adminUser.email} (role: ${adminRole})\n`);

  // 2. Seed faculties and study programs
  console.log('📚 Seeding faculties and study programs...\n');

  const facultyMap = new Map();

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

    facultyMap.set(faculty.code, faculty.id);
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

  // 3. Seed Divisions FIRST (before team members)
  console.log('🏢 Seeding divisions...\n');

  const divisionMap = new Map();

  for (const division of DIVISIONS) {
    const created = await prisma.division.upsert({
      where: { key: division.key },
      update: {
        ...division,
        isActive: true,
      },
      create: {
        ...division,
        isActive: true,
      },
    });
    divisionMap.set(division.name, created.id);
    console.log(`  ✓ ${division.name} (id: ${created.id})`);
  }

  console.log(`\n✅ Seeded ${DIVISIONS.length} divisions\n`);

  // 4. Seed team members (now with divisionId)
  console.log('👥 Seeding team members...\n');

  let seededCount = 0;
  for (const [index, member] of TEAM_MEMBERS.entries()) {
    // Find division by name
    const divisionId = divisionMap.get(member.division);

    if (!divisionId) {
      console.log(`  ⚠️ Skipping ${member.name}: division "${member.division}" not found`);
      continue;
    }

    // Prepare member data without 'division' field (use divisionId instead)
    const { division: _divisionName, ...memberData } = member;

    // Check if member already exists
    const existing = await prisma.teamMember.findFirst({
      where: {
        name: member.name,
        divisionId: divisionId,
      },
    });

    if (existing) {
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: {
          ...memberData,
          divisionId,
          isActive: true,
          sortOrder: index,
        },
      });
    } else {
      await prisma.teamMember.create({
        data: {
          ...memberData,
          divisionId,
          isActive: true,
          sortOrder: index,
        },
      });
    }
    seededCount++;
  }

  console.log(`✅ Seeded ${seededCount} team members\n`);

  // 5. Seed Events for Calendar
  console.log('📅 Seeding events...\n');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const EVENTS = [
    {
      title: 'Rapat Koordinasi Bulanan',
      description: 'Rapat koordinasi seluruh divisi GenBI Unsika',
      type: 'MEETING',
      startDate: new Date(currentYear, currentMonth, 5, 14, 0),
      location: 'Aula Rektorat Lt. 3',
      color: '#3b82f6',
    },
    {
      title: 'Workshop Public Speaking',
      description: 'Pelatihan public speaking untuk anggota GenBI',
      type: 'WORKSHOP',
      startDate: new Date(currentYear, currentMonth, 12, 9, 0),
      endDate: new Date(currentYear, currentMonth, 12, 16, 0),
      location: 'Gedung FISIP Ruang 201',
      color: '#8b5cf6',
    },
    {
      title: 'Seminar Literasi Keuangan',
      description: 'Seminar edukasi keuangan untuk mahasiswa Unsika',
      type: 'SEMINAR',
      startDate: new Date(currentYear, currentMonth, 18, 8, 30),
      endDate: new Date(currentYear, currentMonth, 18, 12, 0),
      location: 'Auditorium Unsika',
      color: '#10b981',
    },
    {
      title: 'Bakti Sosial Desa Binaan',
      description: 'Kegiatan sosial di Desa Cikampek Selatan',
      type: 'SOCIAL',
      startDate: new Date(currentYear, currentMonth + 1, 8, 7, 0),
      endDate: new Date(currentYear, currentMonth + 1, 8, 15, 0),
      location: 'Desa Cikampek Selatan',
      color: '#f59e0b',
    },
    {
      title: 'Training Leadership',
      description: 'Program pelatihan kepemimpinan untuk pengurus GenBI',
      type: 'TRAINING',
      startDate: new Date(currentYear, currentMonth + 1, 15, 9, 0),
      endDate: new Date(currentYear, currentMonth + 1, 16, 17, 0),
      location: 'Hotel Grand Karawang',
      color: '#ec4899',
    },
    {
      title: 'Rapat Evaluasi Triwulan',
      description: 'Evaluasi program kerja triwulan I',
      type: 'MEETING',
      startDate: new Date(currentYear, currentMonth + 2, 1, 14, 0),
      location: 'Online via Zoom',
      color: '#3b82f6',
    },
  ];

  // Delete existing events and create new ones (since we use auto-increment now)
  await prisma.event.deleteMany({});

  for (const event of EVENTS) {
    await prisma.event.create({
      data: { ...event, isActive: true },
    });
    console.log(`  ✓ ${event.title}`);
  }

  console.log(`\n✅ Seeded ${EVENTS.length} events\n`);

  // 6. Seed MemberPoints for Leaderboard
  console.log('🏆 Seeding member points...\n');

  const teamMembers = await prisma.teamMember.findMany({ where: { isActive: true }, take: 20 });

  const POINT_CATEGORIES = ['KEHADIRAN', 'KONTRIBUSI', 'KEPANITIAAN', 'PRESTASI'];

  // Delete existing points first
  await prisma.memberPoint.deleteMany({});

  for (const member of teamMembers) {
    // Random points per category
    const numEntries = Math.floor(Math.random() * 5) + 2;
    for (let i = 0; i < numEntries; i++) {
      const category = POINT_CATEGORIES[Math.floor(Math.random() * POINT_CATEGORIES.length)];
      const points = Math.floor(Math.random() * 20) + 5;

      await prisma.memberPoint.create({
        data: {
          memberId: member.id,
          awardedById: adminUser.id, // Use admin user as awarder
          category,
          points,
          description: `Poin ${category.toLowerCase()} - ${member.name}`,
          awardedAt: new Date(currentYear, currentMonth - Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1),
        },
      });
    }
  }

  console.log(`✅ Seeded points for ${teamMembers.length} members\n`);

  // 7. Seed Treasury Entries for Rekap Kas
  console.log('💰 Seeding treasury entries...\n');

  const MONTHLY_FEE = 10000; // Rp 10.000 per bulan
  const MONTHS_PERIODS = ['10', '11', '12', '01', '02', '03', '04', '05', '06'];

  // Delete existing treasury entries first
  await prisma.treasuryEntry.deleteMany({});

  for (const member of teamMembers) {
    // Each member pays for some months
    const paidMonths = Math.floor(Math.random() * 6) + 3; // 3-8 months paid

    for (let i = 0; i < paidMonths; i++) {
      const monthStr = MONTHS_PERIODS[i];
      const year = parseInt(monthStr) >= 10 ? currentYear - 1 : currentYear;
      const period = `${year}-${monthStr}`;

      await prisma.treasuryEntry.create({
        data: {
          memberId: member.id,
          recordedById: adminUser.id, // Use admin user as recorder
          period,
          amount: MONTHLY_FEE,
          status: 'LUNAS',
          paidAt: new Date(),
        },
      });
    }
  }

  console.log(`✅ Seeded treasury entries for ${teamMembers.length} members\n`);

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
