import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

// DEFAULT DATA FOR CMS-MANAGED CONTENT (used when DB has no data)

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
    photo_profile: 'https://ui-avatars.com/api/?name=Alumni+1&background=random',
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

// CMS-MANAGED PUBLIC ROUTES

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
    const data = setting?.value || defaultScholarshipPage;
    res.json({ data });
  }),
);

// ARTIKEL PUBLIK

router.get(
  '/articles',
  asyncHandler(async (req, res) => {
    const { category, page = 1, limit = 12, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      status: 'PUBLISHED',
    };

    if (category) where.category = category;
    if (search) {
      where.OR = [{ title: { contains: search } }, { excerpt: { contains: search } }];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          category: true,
          tags: true,
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
      category: a.category,
      tags: a.tags,
      date: a.publishedAt,
      author: a.author?.profile?.name || 'GenBI Unsika',
      badge: a.category || 'Artikel',
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

// EVENT PUBLIK (dari kegiatan dengan status akan datang/berlangsung)

router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      isActive: true,
      status: { in: ['PLANNED', 'ONGOING'] },
    };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: 'asc' },
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

// PROGRAM PUBLIK (proker - semua kegiatan selesai)

router.get(
  '/programs',
  asyncHandler(async (req, res) => {
    const { divisionId, page = 1, limit = 12, search } = req.query;
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

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: 'desc' },
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

// TIM PUBLIK

router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { period, divisionId } = req.query;

    const where = { isActive: true };
    if (period) where.period = period;
    if (divisionId) {
      const divId = parseInt(divisionId, 10);
      if (!isNaN(divId)) where.divisionId = divId;
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: [{ period: 'desc' }, { sortOrder: 'asc' }],
      include: {
        division: true,
        user: {
          select: {
            profile: {
              select: { name: true, avatar: true },
            },
          },
        },
      },
    });

    const data = teams.map((t) => ({
      id: t.id,
      name: t.user?.profile?.name || t.name,
      position: t.position,
      division: t.division?.name || null,
      period: t.period,
      image: t.user?.profile?.avatar || t.photo,
      socialMedia: t.socialMedia,
    }));

    res.json({ data });
  }),
);

// DIVISI PUBLIK

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
        color: true,
      },
    });

    res.json({ data: divisions });
  }),
);

export default router;
