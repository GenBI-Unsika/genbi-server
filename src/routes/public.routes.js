import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { APP_SETTING_KEYS } from '../constants/settings.js';
import { HttpError } from '../lib/errors.js';
import { verifyScholarshipAnnouncementToken } from '../auth/tokens.js';
import { sanitizePublicMember } from '../lib/sanitizer.js';

const router = Router();

const defaultHeroAvatars = [
  'https://ui-avatars.com/api/?name=User+1&background=random',
  'https://ui-avatars.com/api/?name=User+2&background=random',
  'https://ui-avatars.com/api/?name=User+3&background=random',
  'https://ui-avatars.com/api/?name=User+4&background=random',
];

const defaultVisionMission = {
  vision: 'Bersinergi mewujudkan komunitas GenBI UNSIKA yang dapat membawa perubahan positif, berkarakter, berintegritas, dan menjadi inspirasi bagi sekitar.',
  missions: [
    {
      subtitle: 'Initiate',
      description: 'Menginisiasi beragam kegiatan yang memberdayakan masyarakat, berfokus pada peningkatan kualitas kesejahteraan dan kebutuhan.',
      iconName: 'Brain',
      accentBg: 'bg-indigo-100',
      accentText: 'text-indigo-700',
    },
    {
      subtitle: 'Act',
      description: 'Membuat program kerja yang menunjukkan kepedulian dan terlibat aktif melalui aksi konkret yang mendukung pemberdayaan sosial.',
      iconName: 'Zap',
      accentBg: 'bg-amber-100',
      accentText: 'text-amber-700',
    },
    {
      subtitle: 'Share',
      description: 'Mendorong eksplorasi dan pengembangan potensi kreatif dan inovatif bagi komunitas.',
      iconName: 'Share2',
      accentBg: 'bg-emerald-100',
      accentText: 'text-emerald-700',
    },
    {
      subtitle: 'Inspire',
      description: 'Membagikan pengalaman inspirasi dan motivasi bagi lingkungan sekitar.',
      iconName: 'Sparkles',
      accentBg: 'bg-fuchsia-100',
      accentText: 'text-fuchsia-700',
    },
  ],
};

const defaultFaqs = [
  {
    question: 'Apa itu GenBI?',
    answer: 'GenBI (Generasi Baru Indonesia) adalah komunitas penerima beasiswa Bank Indonesia yang berkomitmen untuk memberikan kontribusi positif kepada masyarakat.',
  },
  {
    question: 'Bagaimana cara mendaftar beasiswa Bank Indonesia?',
    answer: 'Pendaftaran dilakukan melalui seleksi yang diadakan oleh universitas dan Bank Indonesia. Informasi lebih lanjut dapat dilihat di halaman Beasiswa.',
  },
  {
    question: 'Apa saja syarat untuk mendaftar beasiswa Bank Indonesia?',
    answer: 'Syarat umum meliputi: mahasiswa aktif S1 PTN, IPK minimal 3.00, aktif dalam kegiatan kemahasiswaan, dan memiliki jiwa kepemimpinan.',
  },
];

const defaultTestimonials = [
  {
    name: 'Alumni GenBI',
    role: 'Ketua Umum 2023',
    quote: 'GenBI memberikan pengalaman organisasi yang luar biasa dan kesempatan untuk berkontribusi kepada masyarakat.',
    photo_profile: '',
  },
];

const defaultFooter = {
  description: 'Komunitas penerima beasiswa Bank Indonesia Komisariat Universitas Singaperbangsa Karawang',
  address: 'Universitas Singaperbangsa Karawang Jl. HS. Ronggo Waluyo, Telukjambe Timur, Karawang, Jawa Barat, Indonesia - 41361',
  socialLinks: [
    { type: 'email', label: 'genbiunsika.org@gmail.com', url: 'mailto:genbiunsika.org@gmail.com', icon: 'tabler:mail' },
    { type: 'instagram', label: 'genbi.unsika', url: 'https://instagram.com/genbi.unsika', icon: 'tabler:brand-instagram' },
    { type: 'tiktok', label: 'genbi.unsika', url: 'https://tiktok.com/@genbi.unsika', icon: 'tabler:brand-tiktok' },
    { type: 'youtube', label: 'GenBI Unsika', url: 'https://youtube.com/@GenBIUnsika', icon: 'tabler:brand-youtube' },
  ],
  navLinks: {
    about: [
      { label: 'Tentang Kami', href: '/about' },
      { label: 'Beasiswa', href: '/scholarship' },
      { label: 'Kegiatan', href: '/activities' },
      { label: 'Artikel', href: '/articles' },
    ],
    services: [
      { label: 'Event', href: '/events' },
      { label: 'Proker', href: '/proker' },
      { label: 'Pengalaman Alumni', href: '#testimonials' },
      { label: 'Pertanyaan Umum', href: '#faq' },
      { label: 'Visi Misi', href: '#vision-mission' },
    ],
  },
};

const defaultScholarship = {
  title: 'Beasiswa Bank Indonesia',
  description:
    'Beasiswa Bank Indonesia merupakan beasiswa yang diberikan oleh Bank Indonesia bagi para mahasiswa S1 di berbagai Perguruan Tinggi Negeri (PTN). Para penerima beasiswa juga akan tergabung dalam organisasi bernama Generasi Baru Indonesia (GenBI) dan mendapatkan berbagai pelatihan untuk meningkatkan kompetensi, mengembangkan karakter dan jiwa kepemimpinan mereka.',
  buttonText: 'Daftar Sekarang',
  buttonUrl: '/scholarship/register',
  image: '',
};

const defaultScholarshipPage = {
  title: 'Tertarik Untuk Daftar Beasiswa Bank Indonesia?',
  subtitle: 'Ketahui persyaratan dan dokumen yang dibutuhkan untuk mendaftar beasiswa Bank Indonesia',
  isOpen: true,
  buttonText: 'Daftar Beasiswa',
  closedMessage: 'Pendaftaran sedang ditutup. Pantau informasi selanjutnya ya!',
  requirements: [
    'Mahasiswa aktif S1 Universitas Singaperbangsa Karawang (dibuktikan dengan KTM atau surat keterangan aktif).',
    'Sekurang-kurangnya telah menyelesaikan 40 sks atau berada di semester 4 atau 6.',
    'Memiliki Indeks Prestasi Kumulatif (IPK) minimal 3.00 (skala 4).',
    'Transkrip nilai bertandatangan dan cap Koordinator Program Studi.',
    'Tidak sedang menerima beasiswa dari pihak lain, lembaga, atau instansi lainnya (dibuktikan dengan surat keterangan).',
    'Bersedia berperan aktif, mengelola, dan mengembangkan komunitas GenBI serta berpartisipasi dalam semua kegiatan yang diselenggarakan oleh Bank Indonesia.',
    'Mempunyai pengalaman aktivitas sosial yang berdampak bagi masyarakat.',
    'Prioritas: FISIP, FH, FE, FAPERTA, FASILKOM, FKIP (Pendidikan Matematika).',
    'Non Prioritas: FT, FIKES, FAI, FKIP (selain Pendidikan Matematika).',
    'Maksimal berusia 23 tahun saat ditetapkan sebagai penerima (OAP maksimal 27 tahun).',
  ],
  documents: [
    'Surat pernyataan Beasiswa BI 2024 & Biodata Form A.1 (akses: unsika.link/daftar-beasiswa-bi-unsika-2024)',
    'Scan KTM & KTP yang berlaku.',
    'Transkrip nilai.',
    'Motivation letter (Bahasa Indonesia).',
    'SKTM dari kelurahan/desa atau slip gaji orang tua.',
    'Surat rekomendasi dari 1 tokoh (akademik/non-akademik).',
    'Video pengenalan diri dan motivasi (max 2 menit) upload di IG utama, tag @genbi.unsika.',
  ],
};

router.get(
  '/hero-avatars',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_hero_avatars' } });
    const avatars = setting?.value?.avatars || defaultHeroAvatars;
    res.json({ data: { avatars } });
  }),
);

router.get(
  '/vision-mission',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_vision_mission' } });
    const data = setting?.value || defaultVisionMission;
    res.json({ data });
  }),
);

router.get(
  '/faqs',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_faqs' } });
    const items = setting?.value?.items || defaultFaqs;
    res.json({ data: { items } });
  }),
);

router.get(
  '/testimonials',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_testimonials' } });
    const items = setting?.value?.items || defaultTestimonials;
    res.json({ data: { items } });
  }),
);

router.get(
  '/footer',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_footer' } });
    const data = setting?.value || defaultFooter;
    res.json({ data });
  }),
);

router.get(
  '/scholarship-info',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_scholarship' } });
    const data = setting?.value || defaultScholarship;
    res.json({ data });
  }),
);

router.get(
  '/scholarship-page',
  asyncHandler(async (req, res) => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'cms_scholarship_page' } });
    const regRow = await prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.SCHOLARSHIP_REGISTRATION_OPEN } });
    const open = Boolean(regRow?.value?.open);

    const data = {
      ...(setting?.value || defaultScholarshipPage),
      // Status pendaftaran ditentukan oleh /scholarships/registration (di-handle admin), bukan CMS.
      isOpen: open,
    };

    res.json({ data });
  }),
);

function scholarshipIsFinal({ administrasiStatus, interviewStatus }) {
  const isPassed = administrasiStatus === 'LOLOS_ADMINISTRASI' && interviewStatus === 'LOLOS_WAWANCARA';
  const isFailed = administrasiStatus === 'ADMINISTRASI_DITOLAK' || interviewStatus === 'GAGAL_WAWANCARA';
  return isPassed || isFailed;
}

// Public: get scholarship announcement data by signed token (for QR/share link)
router.get(
  '/scholarship-announcement',
  asyncHandler(async (req, res) => {
    const token = String(req.query?.t || '').trim();
    if (!token) throw new HttpError(400, 'Token tidak ditemukan');

    let payload;
    try {
      payload = verifyScholarshipAnnouncementToken(token);
    } catch {
      throw new HttpError(401, 'Token tidak valid atau sudah kedaluwarsa');
    }

    const appId = Number(payload?.aid);
    const userId = Number(payload?.sub);
    if (!Number.isInteger(appId) || appId <= 0) throw new HttpError(400, 'Token tidak valid');
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, 'Token tidak valid');

    const app = await prisma.scholarshipApplication.findUnique({
      where: { id: appId },
      include: {
        faculty: true,
        studyProgram: true,
      },
    });
    if (!app) throw new HttpError(404, 'Data beasiswa tidak ditemukan');
    if (app.createdById !== userId) throw new HttpError(403, 'Token tidak memiliki akses');
    if (!scholarshipIsFinal(app)) throw new HttpError(400, 'Pengumuman belum final');

    res.json({
      data: {
        id: app.id,
        name: app.name || '',
        npm: app.npm || '',
        semester: app.semester || '',
        year: app.year,
        batch: app.batch,
        administrasiStatus: app.administrasiStatus,
        interviewStatus: app.interviewStatus,
        interviewLocation: app.interviewLocation || '',
        faculty: app.faculty ? { name: app.faculty.name } : null,
        studyProgram: app.studyProgram ? { name: app.studyProgram.name } : null,
      },
    });
  }),
);

router.get(
  '/articles',
  asyncHandler(async (req, res) => {
    const { category, page = 1, limit = 12, search, startDate, endDate, sortBy, sortOrder, popularFirst = 'true' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      status: 'PUBLISHED',
    };

    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }];
    }

    // Filter tanggal
    if (startDate || endDate) {
      where.publishedAt = {};
      if (startDate) where.publishedAt.gte = new Date(startDate);
      if (endDate) where.publishedAt.lte = new Date(endDate);
    }

    // Sorting
    const orderBy = [];
    if (popularFirst === 'true') {
      orderBy.push({ viewCount: 'desc' });
    }

    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ publishedAt: 'desc' });
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          publishedAt: true,
          viewCount: true,
          author: {
            select: {
              profile: { select: { name: true, avatar: true } },
            },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    const data = articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      image: a.coverImage,
      date: a.publishedAt,
      author: a.author?.profile?.name || 'GenBI Unsika',
      badge: 'Artikel',
      href: `/articles/${a.slug}`,
    }));

    res.json({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 12, startDate: filterStartDate, endDate: filterEndDate, sortBy, sortOrder } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      isActive: true,
      status: { in: ['PLANNED', 'ONGOING'] },
    };

    // Filter tanggal
    if (filterStartDate || filterEndDate) {
      where.startDate = {};
      if (filterStartDate) where.startDate.gte = new Date(filterStartDate);
      if (filterEndDate) where.startDate.lte = new Date(filterEndDate);
    }

    // Sorting
    const orderBy = [];
    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ startDate: 'asc' });
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        include: { division: true },
      }),
      prisma.activity.count({ where }),
    ]);

    const data = activities.map((a) => {
      const startDate = a.startDate ? new Date(a.startDate) : null;
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        image: a.coverImage || null,
        date: startDate ? startDate.toISOString().slice(0, 10) : null,
        time: startDate ? startDate.toTimeString().slice(0, 5) : null,
        location: a.location,
        division: a.division?.name || null,
        status: a.status,
        badge: a.status === 'ONGOING' ? 'Sedang Berlangsung' : 'Akan Datang',
        href: `/events/${a.id}`,
      };
    });

    res.json({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

router.get(
  '/programs',
  asyncHandler(async (req, res) => {
    const { divisionId, page = 1, limit = 12, search, startDate: filterStartDate, endDate: filterEndDate, sortBy, sortOrder } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
    };

    if (divisionId) {
      const divId = parseInt(divisionId, 10);
      if (!isNaN(divId)) where.divisionId = divId;
    }

    if (search) {
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }];
    }

    // Filter tanggal
    if (filterStartDate || filterEndDate) {
      where.startDate = {};
      if (filterStartDate) where.startDate.gte = new Date(filterStartDate);
      if (filterEndDate) where.startDate.lte = new Date(filterEndDate);
    }

    // Sorting
    const orderBy = [];
    if (sortBy) {
      orderBy.push({ [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' });
    } else {
      orderBy.push({ startDate: 'desc' });
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        include: { division: true },
      }),
      prisma.activity.count({ where }),
    ]);

    const data = activities.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      image: a.coverImage || null,
      date: a.startDate,
      location: a.location,
      division: a.division?.name || null,
      status: a.status,
      badge: a.division?.name || 'Program Kerja',
      href: `/proker/${a.id}`,
    }));

    res.json({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { divisionId, search } = req.query;

    const where = {
      isActive: true,
      role: { name: { in: ['awardee', 'admin', 'super_admin'] } },
      profile: { isNot: null },
    };

    if (divisionId) {
      where.profile = { divisionId: parseInt(divisionId, 10) };
    }

    if (search) {
      where.profile = {
        ...where.profile,
        OR: [{ name: { contains: search } }, { jabatan: { contains: search } }, { studyProgram: { name: { contains: search } } }],
      };
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        profile: {
          include: {
            division: true,
            faculty: true,
            studyProgram: true,
          },
        },
        role: true,
      },
      orderBy: [{ profile: { sortOrder: 'asc' } }, { profile: { division: { name: 'asc' } } }, { profile: { name: 'asc' } }],
    });

    const data = users.map(sanitizePublicMember);

    res.json({ data });
  }),
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const [articles, activities, members] = await Promise.all([
      // Search Articles
      prisma.article.findMany({
        where: {
          isActive: true,
          status: 'PUBLISHED',
          OR: [{ title: { contains: q } }, { excerpt: { contains: q } }],
        },
        take: 5,
        select: { id: true, title: true, slug: true, coverImage: true },
      }),
      // Search Activities (Events/Proker)
      prisma.activity.findMany({
        where: {
          isActive: true,
          OR: [{ title: { contains: q } }, { description: { contains: q } }],
        },
        take: 5,
        select: { id: true, title: true, coverImage: true, status: true },
      }),
      // Search Members
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { name: { in: ['awardee', 'admin', 'super_admin'] } },
          profile: {
            OR: [{ name: { contains: q } }, { jabatan: { contains: q } }],
          },
        },
        take: 5,
        include: { profile: { select: { name: true, avatar: true, jabatan: true } } },
      }),
    ]);

    const staticPages = [
      { title: 'Beranda', href: '/' },
      { title: 'Tentang Kami', href: '/history' },
      { title: 'Sejarah GenBI', href: '/history' },
      { title: 'Struktur Organisasi (Tim)', href: '/teams' },
      { title: 'Beasiswa Bank Indonesia', href: '/scholarship' },
      { title: 'Pendaftaran Beasiswa', href: '/scholarship/register' },
      { title: 'Event & Kegiatan', href: '/events' },
      { title: 'Program Kerja (Proker)', href: '/proker' },
      { title: 'Artikel & Berita', href: '/articles' },
      { title: 'Login / Masuk', href: '/signin' },
      { title: 'Daftar Akun', href: '/signup' },
    ];

    const matchedPages = staticPages.filter((page) => page.title.toLowerCase().includes(q.toLowerCase()));

    const results = [
      ...matchedPages.map((p) => ({
        id: `page-${p.href}`,
        title: p.title,
        type: 'Menu',
        image: null, // Could add a generic icon if needed, or frontend handles null
        href: p.href,
      })),
      ...articles.map((a) => ({
        id: a.id,
        title: a.title,
        type: 'Artikel',
        image: a.coverImage,
        href: `/articles/${a.slug}`,
      })),
      ...activities.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.status === 'FINISHED' ? 'Program Kerja' : 'Event',
        image: a.coverImage,
        href: a.status === 'FINISHED' ? `/proker/${a.id}` : `/events/${a.id}`,
      })),
      ...members.map((m) => ({
        id: m.id,
        title: m.profile?.name || m.email?.split('@')[0],
        type: m.profile?.jabatan || 'Anggota',
        image: m.profile?.avatar,
        href: `/teams`, // Teams page filters aren't deep-linkable easily yet, but we can point there
      })),
    ];

    res.json({ data: results });
  }),
);

router.get(
  '/divisions',
  asyncHandler(async (req, res) => {
    const divisions = await prisma.division.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        gradient: true,
        textColor: true,
      },
    });

    res.json({ data: divisions });
  }),
);

export default router;
