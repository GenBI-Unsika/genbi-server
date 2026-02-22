import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth as authMiddleware, requireAdminAccess as adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get(
  '/roles',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { id: 'asc' },
    });
    res.json({ data: roles });
  }),
);

router.post(
  '/roles',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { name, displayName, description } = req.body;
    const role = await prisma.role.create({
      data: { name, displayName, description },
    });
    res.json({ data: role });
  }),
);

router.patch(
  '/roles/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { displayName, description } = req.body;
    const role = await prisma.role.update({
      where: { id: parseInt(id) },
      data: { displayName, description },
    });
    res.json({ data: role });
  }),
);

router.delete(
  '/roles/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.role.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Role deleted' });
  }),
);

router.get(
  '/faculties',
  asyncHandler(async (req, res) => {
    const faculties = await prisma.faculty.findMany({
      where: req.query.all === 'true' ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        studyPrograms: {
          where: req.query.all === 'true' ? {} : { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json({ data: faculties });
  }),
);

router.post(
  '/faculties',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { code, name, sortOrder, isActive } = req.body;
    const faculty = await prisma.faculty.create({
      data: { code, name, sortOrder: parseInt(sortOrder) || 0, isActive },
    });
    res.json({ data: faculty });
  }),
);

router.patch(
  '/faculties/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { code, name, sortOrder, isActive } = req.body;
    const faculty = await prisma.faculty.update({
      where: { id: parseInt(id) },
      data: { code, name, sortOrder: parseInt(sortOrder) || 0, isActive },
    });
    res.json({ data: faculty });
  }),
);

router.delete(
  '/faculties/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.faculty.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Faculty deleted' });
  }),
);

router.get(
  '/study-programs',
  asyncHandler(async (req, res) => {
    const { all, facultyId } = req.query;

    const where = all === 'true' ? {} : { isActive: true };

    if (facultyId) {
      const parsedId = parseInt(facultyId);
      if (!isNaN(parsedId)) {
        where.facultyId = parsedId;
      }
    }

    const programs = await prisma.studyProgram.findMany({
      where,
      orderBy: [{ facultyId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        faculty: true,
      },
    });

    res.json({ data: programs });
  }),
);

router.post(
  '/study-programs',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { code, name, degree, facultyId, sortOrder, isActive } = req.body;
    const program = await prisma.studyProgram.create({
      data: {
        code,
        name,
        degree,
        facultyId: parseInt(facultyId),
        sortOrder: parseInt(sortOrder) || 0,
        isActive,
      },
    });
    res.json({ data: program });
  }),
);

router.patch(
  '/study-programs/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { code, name, degree, facultyId, sortOrder, isActive } = req.body;

    const program = await prisma.studyProgram.update({
      where: { id: parseInt(id) },
      data: {
        code,
        name,
        degree,
        ...(facultyId ? { facultyId: parseInt(facultyId) } : {}),
        sortOrder: sortOrder !== undefined ? (parseInt(sortOrder) || 0) : undefined,
        isActive,
      },
    });
    res.json({ data: program });
  }),
);

router.delete(
  '/study-programs/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.studyProgram.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Study Program deleted' });
  }),
);

export default router;
