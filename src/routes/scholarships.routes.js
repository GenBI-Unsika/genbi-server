import { Router } from 'express';

import { createScholarshipApplicationSchema, patchApplicationStatusSchema, setRegistrationSchema } from '@genbi/contracts';

import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess, requireMinRole } from '../middleware/auth.js';
import { isPrismaUniqueConstraintError } from '../lib/prisma-errors.js';
import { APP_SETTING_KEYS } from '../constants/settings.js';

const router = Router();

const SETTING_KEY_REG_OPEN = APP_SETTING_KEYS.SCHOLARSHIP_REGISTRATION_OPEN;

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

async function getRegistrationOpen() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY_REG_OPEN } });
  const open = Boolean(row?.value?.open);
  return open;
}

router.get(
  '/registration',
  asyncHandler(async (_req, res) => {
    const open = await getRegistrationOpen();
    res.json({ data: { open } });
  }),
);

router.patch(
  '/registration',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const body = setRegistrationSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const row = await prisma.appSetting.upsert({
      where: { key: SETTING_KEY_REG_OPEN },
      update: { value: { open: body.data.open } },
      create: { key: SETTING_KEY_REG_OPEN, value: { open: body.data.open } },
    });

    res.json({ data: { open: Boolean(row?.value?.open) } });
  }),
);

router.post(
  '/applications',
  requireAuth,
  requireMinRole('member'),
  asyncHandler(async (req, res) => {
    const open = await getRegistrationOpen();
    if (!open) throw new HttpError(403, 'Pendaftaran beasiswa sedang ditutup.');

    const body = createScholarshipApplicationSchema.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'Data yang dikirim tidak valid.', body.error.flatten());

    const birthDate = body.data.birth ? new Date(body.data.birth) : null;
    const semester = body.data.semester === '' ? null : Number(body.data.semester);
    const gpa = body.data.gpa === '' ? null : Number(body.data.gpa);
    const age = body.data.age === '' ? null : Number(body.data.age);

    if (birthDate && Number.isNaN(birthDate.getTime())) throw new HttpError(400, 'Tanggal lahir tidak valid.');
    if (semester !== null && (!Number.isInteger(semester) || semester <= 0)) throw new HttpError(400, 'Semester tidak valid.');
    if (gpa !== null && (Number.isNaN(gpa) || gpa < 0 || gpa > 4)) throw new HttpError(400, 'IPK tidak valid.');
    if (age !== null && (!Number.isInteger(age) || age <= 0)) throw new HttpError(400, 'Usia tidak valid.');

    if (!body.data.agree) throw new HttpError(400, 'Wajib menyetujui pernyataan keaslian data.');

    try {
      const created = await prisma.scholarshipApplication.create({
        data: {
          createdById: req.auth.userId,
          submittedAt: new Date(),
          name: body.data.name,
          email: body.data.email,
          birthDate: birthDate || undefined,
          gender: body.data.gender || undefined,
          nik: body.data.nik || undefined,
          phone: body.data.phone || undefined,
          facultyId: body.data.facultyId || undefined,
          studyProgramId: body.data.studyProgramId || undefined,
          npm: body.data.npm,
          semester: semester === null ? undefined : semester,
          gpa: gpa === null ? undefined : gpa,
          age: age === null ? undefined : age,
          knowGenbi: body.data.knowGenbi || undefined,
          knowDesc: body.data.knowDesc || undefined,
          agree: body.data.agree,
          files: body.data.files || undefined,
        },
      });

      res.status(201).json({ data: created });
    } catch (e) {
      if (isPrismaUniqueConstraintError(e)) {
        throw new HttpError(409, 'NPM sudah terdaftar pada pengajuan beasiswa.');
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

    const where = {
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
        faculty: true,
        studyProgram: true,
      },
    });

    res.json({ data: rows });
  }),
);

router.get(
  '/my-application',
  requireAuth,
  requireMinRole('member'),
  asyncHandler(async (req, res) => {
    const row = await prisma.scholarshipApplication.findFirst({
      where: { createdById: req.auth.userId },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({ data: row });
  }),
);

router.get(
  '/applications/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const row = await prisma.scholarshipApplication.findUnique({ where: { id } });
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

export default router;
