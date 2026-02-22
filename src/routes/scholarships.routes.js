import { Router } from 'express';

import { createScholarshipApplicationSchema, patchApplicationStatusSchema, setRegistrationSchema, scheduleInterviewSchema, patchInterviewStatusSchema, SCHOLARSHIP_DOCUMENTS } from '@genbi/contracts';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess, requireMinRole } from '../middleware/auth.js';
import { isPrismaUniqueConstraintError, isPrismaValueTooLongError } from '../lib/prisma-errors.js';
import { APP_SETTING_KEYS } from '../constants/settings.js';
import { signScholarshipAnnouncementToken } from '../auth/tokens.js';

const router = Router();

const SETTING_KEY_REG_OPEN = APP_SETTING_KEYS.SCHOLARSHIP_REGISTRATION_OPEN;
const SETTING_KEY_BATCH = APP_SETTING_KEYS.SCHOLARSHIP_BATCH;
const SETTING_KEY_PERIOD = APP_SETTING_KEYS.SCHOLARSHIP_PERIOD;
const SETTING_KEY_DOCUMENTS = APP_SETTING_KEYS.SCHOLARSHIP_DOCUMENTS;

/**
 * Get the current scholarship document config.
 * Returns custom config from DB if available, otherwise falls back to hardcoded defaults.
 */
async function getDocumentConfig() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_DOCUMENTS } });
  const docs = row?.value;
  if (Array.isArray(docs) && docs.length > 0) {
    // Validate each doc has at least key + title
    const valid = docs.every((d) => d && typeof d.key === 'string' && typeof d.title === 'string');
    if (valid) return docs;
  }
  return SCHOLARSHIP_DOCUMENTS;
}

/**
 * Get current scholarship period (year + batch).
 * Returns { year: number, batch: number }
 */
async function getCurrentPeriod() {
  const currentYear = new Date().getFullYear();

  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PERIOD } });
  const year = Number(row?.value?.year);
  const batch = Number(row?.value?.batch);
  if (Number.isInteger(year) && year > 2000 && Number.isInteger(batch) && batch > 0) return { year, batch };

  // Race-safe initialization: multiple concurrent requests may try to create the row.
  try {
    await prisma.appSetting.create({
      data: { key: SETTING_KEY_PERIOD, value: { year: currentYear, batch: 1 } },
    });
  } catch (e) {
    // Another request likely created it first.
    if (!isPrismaUniqueConstraintError(e)) throw e;
  }

  const after = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_PERIOD } });
  const afterYear = Number(after?.value?.year);
  const afterBatch = Number(after?.value?.batch);
  return {
    year: Number.isInteger(afterYear) && afterYear > 2000 ? afterYear : currentYear,
    batch: Number.isInteger(afterBatch) && afterBatch > 0 ? afterBatch : 1,
  };
}

/**
 * @deprecated Use getCurrentPeriod() instead
 */
async function getCurrentBatch() {
  const period = await getCurrentPeriod();
  return period.batch;
}

/**
 * Bump to next batch or next year (batch 1) if batch >= 2
 * Returns { year: number, batch: number }
 */
async function bumpPeriod() {
  const current = await getCurrentPeriod();
  let nextYear = current.year;
  let nextBatch = current.batch + 1;

  // If batch > 2, start new year with batch 1
  if (nextBatch > 2) {
    nextYear = current.year + 1;
    nextBatch = 1;
  }

  const row = await prisma.appSetting.upsert({
    where: { key: SETTING_KEY_PERIOD },
    update: { value: { year: nextYear, batch: nextBatch } },
    create: { key: SETTING_KEY_PERIOD, value: { year: nextYear, batch: nextBatch } },
  });
  return {
    year: Number(row?.value?.year) || nextYear,
    batch: Number(row?.value?.batch) || nextBatch,
  };
}

async function bumpBatch() {
  const period = await bumpPeriod();
  return period.batch;
}

function coerceAdministrasiStatus(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Terima nilai enum
  if (['MENUNGGU_VERIFIKASI', 'LOLOS_ADMINISTRASI', 'ADMINISTRASI_DITOLAK'].includes(raw)) return raw;

  const s = raw.toLowerCase();
  if (['menunggu verifikasi', 'menunggu', 'pending', 'wait'].includes(s)) return 'MENUNGGU_VERIFIKASI';
  if (['lolos administrasi', 'lolos', 'accepted', 'accept', 'diterima', 'pass'].includes(s)) return 'LOLOS_ADMINISTRASI';
  if (['administrasi ditolak', 'ditolak', 'rejected', 'reject', 'gagal', 'fail'].includes(s)) return 'ADMINISTRASI_DITOLAK';
  return null;
}

function coerceInterviewStatus(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (['MENUNGGU_JADWAL', 'DIJADWALKAN', 'LOLOS_WAWANCARA', 'GAGAL_WAWANCARA'].includes(raw)) return raw;

  const s = raw.toLowerCase();
  if (['menunggu jadwal', 'belum dijadwalkan', 'belum', 'not_scheduled'].includes(s)) return 'MENUNGGU_JADWAL';
  if (['dijadwalkan', 'scheduled', 'terjadwal'].includes(s)) return 'DIJADWALKAN';
  if (['lolos wawancara', 'lolos', 'lulus', 'pass', 'accepted'].includes(s)) return 'LOLOS_WAWANCARA';
  if (['gagal wawancara', 'wawancara ditolak', 'ditolak', 'gagal', 'fail', 'rejected'].includes(s)) return 'GAGAL_WAWANCARA';
  return null;
}

function scholarshipIsFinal({ administrasiStatus, interviewStatus }) {
  const isPassed = administrasiStatus === 'LOLOS_ADMINISTRASI' && interviewStatus === 'LOLOS_WAWANCARA';
  const isFailed = administrasiStatus === 'ADMINISTRASI_DITOLAK' || interviewStatus === 'GAGAL_WAWANCARA';
  return isPassed || isFailed;
}

async function getRegistrationOpen() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_REG_OPEN } });
  const open = Boolean(row?.value?.open);
  return open;
}

/**
 * Resolve facultyId from either numeric ID or faculty name string.
 * Returns the numeric faculty ID or undefined.
 */
async function resolveFacultyId(facultyIdOrName) {
  if (!facultyIdOrName) return undefined;

  // Already a number
  const num = Number(facultyIdOrName);
  if (!isNaN(num) && Number.isInteger(num) && num > 0) {
    const exists = await prisma.faculty.findUnique({ where: { id: num }, select: { id: true } });
    return exists ? num : undefined;
  }

  // String name — search by name
  const name = String(facultyIdOrName).trim();
  if (!name) return undefined;
  const faculty = await prisma.faculty.findFirst({
    where: { name: { contains: name } },
    select: { id: true },
  });
  return faculty?.id || undefined;
}

/**
 * Resolve studyProgramId from either numeric ID or study program name string.
 * Returns the numeric studyProgram ID or undefined.
 */
async function resolveStudyProgramId(studyProgramIdOrName) {
  if (!studyProgramIdOrName) return undefined;

  const num = Number(studyProgramIdOrName);
  if (!isNaN(num) && Number.isInteger(num) && num > 0) {
    const exists = await prisma.studyProgram.findUnique({ where: { id: num }, select: { id: true } });
    return exists ? num : undefined;
  }

  const name = String(studyProgramIdOrName).trim();
  if (!name) return undefined;
  const sp = await prisma.studyProgram.findFirst({
    where: { name: { contains: name } },
    select: { id: true },
  });
  return sp?.id || undefined;
}

router.get(
  '/registration',
  asyncHandler(async (_req, res) => {
    const open = await getRegistrationOpen();
    const period = await getCurrentPeriod();
    const documents = await getDocumentConfig();
    res.json({
      data: {
        open,
        year: period.year,
        batch: period.batch,
        documents,
        documentsVersion: '2026-02-11',
      },
    });
  }),
);

router.patch(
  '/registration',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = setRegistrationSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    // Admin explicitly sets the period (year+batch). Opening registration should not auto-bump.
    const period = await getCurrentPeriod();

    const row = await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_REG_OPEN },
      update: { value: { open: body.data.open } },
      create: { key: SETTING_KEY_REG_OPEN, value: { open: body.data.open } },
    });

    res.json({ data: { open: Boolean(row?.value?.open), year: period.year, batch: period.batch } });
  }),
);

// ─── Admin: Get / Update scholarship document config ───

router.get(
  '/documents',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (_req, res) => {
    const documents = await getDocumentConfig();
    res.json({ data: { documents } });
  }),
);

router.put(
  '/documents',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { documents } = req.body;
    if (!Array.isArray(documents)) throw new HttpError(400, 'documents harus berupa array.');

    // Validate each document entry
    for (let i = 0; i < documents.length; i++) {
      const d = documents[i];
      if (!d || typeof d.key !== 'string' || !d.key.trim()) {
        throw new HttpError(400, `Dokumen #${i + 1}: key wajib diisi.`);
      }
      if (typeof d.title !== 'string' || !d.title.trim()) {
        throw new HttpError(400, `Dokumen #${i + 1}: title wajib diisi.`);
      }
      if (d.kind && !['file', 'url'].includes(d.kind)) {
        throw new HttpError(400, `Dokumen #${i + 1}: kind harus 'file' atau 'url'.`);
      }
    }

    // Check for duplicate keys
    const keys = documents.map((d) => d.key.trim());
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      throw new HttpError(400, 'Terdapat key dokumen yang duplikat.');
    }

    // Normalize and store
    const normalized = documents.map((d) => ({
      key: String(d.key).trim(),
      title: String(d.title).trim(),
      desc: String(d.desc || '').trim(),
      required: Boolean(d.required),
      kind: d.kind || 'file',
      downloadLink: String(d.downloadLink || '').trim(),
    }));

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_DOCUMENTS },
      update: { value: normalized },
      create: { key: SETTING_KEY_DOCUMENTS, value: normalized },
    });

    res.json({ data: { documents: normalized } });
  }),
);

router.post(
  '/applications',
  requireAuth,
  requireMinRole('member'),
  asyncHandler(async (req, res) => {
    const open = await getRegistrationOpen();
    if (!open) throw new HttpError(403, 'Pendaftaran beasiswa sedang ditutup.');

    const period = await getCurrentPeriod();

    // Enforce: user can only apply once per period (year + batch)
    const existingInPeriod = await prisma.scholarshipApplication.findFirst({
      where: { createdById: req.auth.userId, year: period.year, batch: period.batch },
      select: { id: true },
    });
    if (existingInPeriod) {
      throw new HttpError(409, 'Anda sudah mendaftar beasiswa pada periode ini.');
    }

    const body = createScholarshipApplicationSchema.safeParse(req.body);
    if (!body.success) {
      // Extract the first user-friendly error message from Zod validation
      const flat = body.error.flatten();
      const fieldErrors = Object.values(flat.fieldErrors).flat();
      const formErrors = flat.formErrors || [];
      const firstMsg = fieldErrors[0] || formErrors[0] || 'Data yang dikirim tidak valid.';
      throw new HttpError(400, firstMsg, flat);
    }

    // Additional runtime check: validate required docs against current DB config
    const currentDocs = await getDocumentConfig();
    const requiredKeys = currentDocs.filter((d) => d.required).map((d) => d.key);
    const files = body.data.files || {};
    const missingDocs = requiredKeys.filter((key) => {
      const val = files[key];
      return val === undefined || val === null || val === '';
    });
    if (missingDocs.length > 0) {
      const missingTitles = currentDocs.filter((d) => missingDocs.includes(d.key)).map((d) => d.title);
      throw new HttpError(400, `Dokumen wajib harus dilengkapi (${missingTitles.join(', ')})`);
    }

    const birthDate = body.data.birth ? new Date(body.data.birth) : null;
    const semester = body.data.semester === '' ? null : Number(body.data.semester);
    const gpa = body.data.gpa === '' ? null : Number(body.data.gpa);
    const age = body.data.age === '' ? null : Number(body.data.age);

    if (birthDate && Number.isNaN(birthDate.getTime())) throw new HttpError(400, 'Tanggal lahir tidak valid.');
    if (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 14)) throw new HttpError(400, 'Semester harus antara 1-14.');
    if (gpa !== null && (Number.isNaN(gpa) || gpa < 0 || gpa > 4)) throw new HttpError(400, 'IPK harus antara 0-4.');
    if (age !== null && (!Number.isInteger(age) || age < 15 || age > 40)) throw new HttpError(400, 'Usia harus antara 15-40 tahun.');

    // Resolve faculty and study program IDs
    // Accept: numeric ID via facultyId, OR string name via faculty/facultyId
    const resolvedFacultyId = await resolveFacultyId(body.data.facultyId || body.data.faculty || undefined);
    const resolvedStudyProgramId = await resolveStudyProgramId(body.data.studyProgramId || body.data.study || undefined);

    try {
      const created = await prisma.scholarshipApplication.create({
        data: {
          createdById: req.auth.userId,
          submittedAt: new Date(),
          year: period.year,
          batch: period.batch,
          name: body.data.name,
          email: body.data.email,
          birthDate: birthDate || undefined,
          gender: body.data.gender || undefined,
          nik: body.data.nik || undefined,
          phone: body.data.phone || undefined,
          facultyId: resolvedFacultyId || undefined,
          studyProgramId: resolvedStudyProgramId || undefined,
          npm: body.data.npm,
          semester: semester === null ? undefined : semester,
          gpa: gpa === null ? undefined : gpa,
          age: age === null ? undefined : age,
          knowGenbi: body.data.knowGenbi || undefined,
          knowDesc: body.data.knowDesc || undefined,
          agree: body.data.agree,
          files: body.data.files || undefined,
        },
        include: {
          faculty: true,
          studyProgram: true,
        },
      });

      res.status(201).json({ data: created });
    } catch (e) {
      if (isPrismaUniqueConstraintError(e)) {
        throw new HttpError(409, 'Anda sudah terdaftar pada pengajuan beasiswa untuk periode ini.');
      }
      if (isPrismaValueTooLongError(e)) {
        // Usually means a VARCHAR column is too short for submitted text.
        throw new HttpError(400, 'Teks yang dikirim terlalu panjang untuk disimpan. Coba pendekkan isian deskripsi.');
      }
      throw e;
    }
  }),
);

router.get(
  '/applications',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const q = String(req.query?.q || '').trim();
    const status = coerceAdministrasiStatus(req.query?.status);

    // Default to current period for professionalism (year+batch-based openings)
    const currentPeriod = await getCurrentPeriod();
    const yearParam = Number(req.query?.year);
    const batchParam = Number(req.query?.batch);
    const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : currentPeriod.year;
    const batch = Number.isInteger(batchParam) && batchParam > 0 ? batchParam : currentPeriod.batch;

    const where = {
      year,
      batch,
      ...(status ? { administrasiStatus: status } : {}),
      ...(q
        ? {
          OR: [{ name: { contains: q } }, { email: { contains: q } }, { npm: { contains: q } }, { studyProgram: { name: { contains: q } } }, { faculty: { name: { contains: q } } }],
        }
        : {}),
    };

    const rows = await prisma.scholarshipApplication.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 500,
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { avatar: true } },
          },
        },
        faculty: true,
        studyProgram: true,
        interviewReviewedBy: {
          select: { id: true, email: true, profile: { select: { name: true } } },
        },
      },
    });

    res.json({ data: rows });
  }),
);

router.get(
  '/my-application',
  requireAuth,
  requireMinRole('user'),
  asyncHandler(async (req, res) => {
    const currentPeriod = await getCurrentPeriod();

    // Prefer current period application; otherwise fall back to latest historical application
    const include = {
      faculty: true,
      studyProgram: true,
      interviewReviewedBy: {
        select: { id: true, email: true, profile: { select: { name: true } } },
      },
    };

    const current = await prisma.scholarshipApplication.findFirst({
      where: { createdById: req.auth.userId, year: currentPeriod.year, batch: currentPeriod.batch },
      include,
    });

    const row =
      current ||
      (await prisma.scholarshipApplication.findFirst({
        where: { createdById: req.auth.userId },
        orderBy: { submittedAt: 'desc' },
        include,
      }));

    res.json({ data: row });
  }),
);

router.get(
  '/my-announcement-token',
  requireAuth,
  requireMinRole('user'),
  asyncHandler(async (req, res) => {
    const currentPeriod = await getCurrentPeriod();

    const app =
      (await prisma.scholarshipApplication.findFirst({
        where: { createdById: req.auth.userId, year: currentPeriod.year, batch: currentPeriod.batch },
        select: { id: true, administrasiStatus: true, interviewStatus: true },
      })) ||
      (await prisma.scholarshipApplication.findFirst({
        where: { createdById: req.auth.userId },
        orderBy: { submittedAt: 'desc' },
        select: { id: true, administrasiStatus: true, interviewStatus: true },
      }));

    if (!app) throw new HttpError(404, 'Data beasiswa tidak ditemukan');
    if (!scholarshipIsFinal(app)) throw new HttpError(400, 'Pengumuman belum final. Link/QR tersedia setelah hasil ditetapkan.');

    const token = signScholarshipAnnouncementToken({ userId: req.auth.userId, appId: app.id });
    res.json({ data: { token } });
  }),
);

router.get(
  '/applications/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const row = await prisma.scholarshipApplication.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { avatar: true } },
          },
        },
        faculty: true,
        studyProgram: true,
        reviewedBy: {
          select: { id: true, email: true, profile: { select: { name: true } } },
        },
        interviewReviewedBy: {
          select: { id: true, email: true, profile: { select: { name: true } } },
        },
      },
    });
    if (!row) throw new HttpError(404, 'Data beasiswa tidak ditemukan');
    res.json({ data: row });
  }),
);

router.patch(
  '/applications/:id/administrasi',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = patchApplicationStatusSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const nextStatus = coerceAdministrasiStatus(body.data.status);
    if (!nextStatus) throw new HttpError(400, 'Status administrasi tidak valid.');

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const updated = await prisma.scholarshipApplication.update({
      where: { id },
      data: {
        administrasiStatus: nextStatus,
        reviewedById: req.auth.userId,
        reviewedAt: new Date(),
      },
    });

    res.json({ data: updated });
  }),
);

// PATCH /applications/:id/interview-schedule — admin sets interview schedule
router.patch(
  '/applications/:id/interview-schedule',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = scheduleInterviewSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data jadwal wawancara tidak valid.', body.error.flatten());

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    // Ensure application exists and is LOLOS_ADMINISTRASI
    const existing = await prisma.scholarshipApplication.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Data beasiswa tidak ditemukan');
    if (existing.administrasiStatus !== 'LOLOS_ADMINISTRASI') {
      throw new HttpError(400, 'Pendaftar harus lolos administrasi sebelum dijadwalkan wawancara.');
    }

    const interviewDate = new Date(body.data.interviewDate);
    if (isNaN(interviewDate.getTime())) throw new HttpError(400, 'Tanggal wawancara tidak valid.');

    const updated = await prisma.scholarshipApplication.update({
      where: { id },
      data: {
        interviewStatus: 'DIJADWALKAN',
        interviewDate,
        interviewTime: body.data.interviewTime,
        interviewLocation: body.data.interviewLocation,
        interviewReviewedById: req.auth.userId,
        interviewReviewedAt: new Date(),
      },
      include: { faculty: true, studyProgram: true },
    });

    res.json({ data: updated });
  }),
);

// PATCH /applications/:id/interview — admin updates interview result
router.patch(
  '/applications/:id/interview',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = patchInterviewStatusSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const nextStatus = coerceInterviewStatus(body.data.status);
    if (!nextStatus) throw new HttpError(400, 'Status wawancara tidak valid.');

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    // Ensure application exists and has been scheduled
    const existing = await prisma.scholarshipApplication.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Data beasiswa tidak ditemukan');
    if (existing.administrasiStatus !== 'LOLOS_ADMINISTRASI') {
      throw new HttpError(400, 'Pendaftar harus lolos administrasi terlebih dahulu.');
    }
    if (nextStatus === 'LOLOS_WAWANCARA' || nextStatus === 'GAGAL_WAWANCARA') {
      if (existing.interviewStatus === 'MENUNGGU_JADWAL') {
        throw new HttpError(400, 'Wawancara belum dijadwalkan. Jadwalkan terlebih dahulu.');
      }
    }

    const updated = await prisma.scholarshipApplication.update({
      where: { id },
      data: {
        interviewStatus: nextStatus,
        interviewNotes: body.data.interviewNotes || existing.interviewNotes || undefined,
        interviewReviewedById: req.auth.userId,
        interviewReviewedAt: new Date(),
      },
      include: { faculty: true, studyProgram: true },
    });

    res.json({ data: updated });
  }),
);

export default router;
