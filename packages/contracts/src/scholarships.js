import { z } from 'zod';

export const setRegistrationSchema = z.object({
  open: z.boolean(),
});

export const createScholarshipApplicationSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  birth: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  nik: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  facultyId: z.string().uuid().optional().nullable(),
  studyProgramId: z.string().uuid().optional().nullable(),
  npm: z.string().min(6).max(20),
  semester: z.union([z.string(), z.number()]).optional().default(''),
  gpa: z.union([z.string(), z.number()]).optional().default(''),
  age: z.union([z.string(), z.number()]).optional().default(''),

  knowGenbi: z.string().optional().default(''),
  knowDesc: z.string().optional().default(''),

  agree: z.boolean().default(false),

  files: z.record(z.string(), z.any()).optional(),
});

export const patchApplicationStatusSchema = z.object({
  status: z.string().min(1),
});
