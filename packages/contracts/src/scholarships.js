import { z } from 'zod';

import { getRequiredScholarshipDocumentKeys, getScholarshipRequiredDocumentsErrorMessage } from './scholarshipDocuments.js';

export const setRegistrationSchema = z.object({
  open: z.boolean(),
});

export const createScholarshipApplicationSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(200),
  email: z.string().email('Format email tidak valid'),
  birth: z.string().min(1, 'Tanggal lahir wajib diisi'),
  gender: z.enum(['Perempuan', 'Laki-laki'], { errorMap: () => ({ message: 'Gender wajib dipilih (Perempuan/Laki-laki)' }) }),
  nik: z
    .string()
    .optional()
    .default('')
    .refine((v) => v === '' || /^\d{16}$/.test(v), { message: 'NIK harus 16 digit angka' }),
  phone: z
    .string()
    .optional()
    .default('')
    .refine((v) => v === '' || /^(08|628)\d{8,13}$/.test(v), { message: 'No. telepon harus diawali 08/628 dan 10-15 digit' }),
  // Accept either integer ID or string name for faculty/studyProgram
  facultyId: z.union([z.number().int().positive(), z.string().min(1)]),
  studyProgramId: z.union([z.number().int().positive(), z.string().min(1)]),
  // Also accept string names (for backward compatibility)
  faculty: z.string().optional().default(''),
  study: z.string().optional().default(''),
  npm: z.string().min(6, 'NPM minimal 6 karakter').max(20, 'NPM maksimal 20 karakter').regex(/^\d+$/, 'NPM hanya boleh berisi angka'),
  semester: z.union([z.string(), z.number()]).refine(
    (v) => {
      if (v === '' || v === undefined || v === null) return true;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 14;
    },
    { message: 'Semester harus antara 1-14' },
  ),
  gpa: z.union([z.string(), z.number()]).refine(
    (v) => {
      if (v === '' || v === undefined || v === null) return true;
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0 && n <= 4;
    },
    { message: 'IPK harus antara 0-4' },
  ),
  age: z.union([z.string(), z.number()]).refine(
    (v) => {
      if (v === '' || v === undefined || v === null) return true;
      const n = Number(v);
      return Number.isInteger(n) && n >= 15 && n <= 40;
    },
    { message: 'Usia harus antara 15-40 tahun' },
  ),

  knowGenbi: z.string().optional().default(''),
  knowDesc: z.string().optional().default(''),

  agree: z.literal(true, { errorMap: () => ({ message: 'Wajib menyetujui pernyataan keaslian data' }) }),

  files: z
    .record(z.string(), z.any())
    .optional()
    .refine(
      (files) => {
        // Basic check: files object must exist and not be empty.
        // Detailed required-doc validation is done at the route level using
        // the dynamic document config from AppSetting (DB), which may differ
        // from the hardcoded defaults.
        if (!files || Object.keys(files).length === 0) return false;
        return true;
      },
      { message: 'Dokumen wajib harus dilengkapi.' },
    ),
});

export const patchApplicationStatusSchema = z.object({
  status: z.string().min(1),
});

export const scheduleInterviewSchema = z.object({
  interviewDate: z.string().min(1, 'Tanggal wawancara wajib diisi'),
  interviewTime: z.string().min(1, 'Waktu wawancara wajib diisi'),
  interviewLocation: z.string().min(1, 'Lokasi/link wawancara wajib diisi'),
});

export const patchInterviewStatusSchema = z.object({
  status: z.string().min(1),
  interviewNotes: z.string().optional().default(''),
});
