import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

// Get all faculties with their study programs
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

// Get study programs by faculty ID
router.get(
  '/faculties/:facultyId/study-programs',
  asyncHandler(async (req, res) => {
    const { facultyId } = req.params;

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

// Get all study programs (flat list)
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
