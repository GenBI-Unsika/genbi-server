import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';

const router = Router();

// Ambil semua fakultas dengan program studinya
router.get(
  '/faculties',
  asyncHandler(async (req, res) => {
    const faculties = await prisma.faculty.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        studyPrograms: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            degree: true,
          },
        },
      },
    });

    res.json({ data: faculties });
  }),
);

// Ambil program studi berdasarkan ID fakultas
router.get(
  '/faculties/:facultyId/study-programs',
  asyncHandler(async (req, res) => {
    const facultyId = parseInt(req.params.facultyId, 10);
    if (isNaN(facultyId)) throw new HttpError(400, 'Faculty ID tidak valid');

    const programs = await prisma.studyProgram.findMany({
      where: {
        facultyId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        degree: true,
      },
    });

    res.json({ data: programs });
  }),
);

// Ambil semua program studi (list datar)
router.get(
  '/study-programs',
  asyncHandler(async (req, res) => {
    const programs = await prisma.studyProgram.findMany({
      where: { isActive: true },
      orderBy: [{ facultyId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        faculty: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    res.json({ data: programs });
  }),
);

export default router;
