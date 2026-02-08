import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { isPrismaMissingTableError } from '../lib/prisma-errors.js';

const router = Router();

// Helper untuk format tanggal
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
};

// Ambil leaderboard dengan aktivitas (publik)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    try {

      const allPoints = await prisma.memberPoint.findMany({
        orderBy: { awardedAt: 'desc' },
      });


      const memberIds = [...new Set(allPoints.map((p) => p.memberId))];


      const members = await prisma.teamMember.findMany({
        where: { id: { in: memberIds } },
        include: { division: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));


      const leaderboardMap = new Map();

      for (const point of allPoints) {
        if (!leaderboardMap.has(point.memberId)) {
          const member = memberMap.get(point.memberId);
          leaderboardMap.set(point.memberId, {
            id: point.memberId,
            name: member?.name || 'Unknown',
            division: member?.division?.name || '-',
            jabatan: member?.jabatan || '-',
            photo: member?.photo,
            points: 0,
            online: 0,
            offline: 0,
            activities: [],
          });
        }

        const entry = leaderboardMap.get(point.memberId);
        entry.points += point.points || 0;


        const type = point.category === 'ONLINE' || point.description?.toLowerCase().includes('online') ? 'online' : 'offline';

        if (type === 'online') {
          entry.online += 1;
        } else {
          entry.offline += 1;
        }

        entry.activities.push({
          id: point.id,
          name: point.description || point.category || 'Aktivitas',
          points: point.points || 0,
          type: type,
          date: formatDate(point.awardedAt),
          category: point.category,
        });
      }


      const data = Array.from(leaderboardMap.values())
        .sort((a, b) => b.points - a.points)
        .map((item, idx) => ({
          ...item,
          rank: idx + 1,

          activities: item.activities.sort((a, b) => new Date(b.date) - new Date(a.date)),
        }));

      res.json({ data });
    } catch (e) {
      if (isPrismaMissingTableError(e)) {
        return res.json({ data: [] });
      }
      throw e;
    }
  }),
);

// Ambil rincian poin berdasarkan kategori
router.get(
  '/breakdown/:memberId',
  asyncHandler(async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId, 10);
      if (isNaN(memberId)) throw new HttpError(400, 'Member ID tidak valid');

      const breakdown = await prisma.memberPoint.groupBy({
        by: ['category'],
        where: { memberId },
        _sum: { points: true },
      });
      const data = breakdown.map((b) => ({ category: b.category, points: b._sum.points || 0 }));
      res.json({ data });
    } catch (e) {
      if (isPrismaMissingTableError(e)) {
        return res.json({ data: [] });
      }
      throw e;
    }
  }),
);

// Tambah poin (perlu admin) - bekerja dengan endpoint /points dari frontend
router.post(
  '/points',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { memberId, name, points, type, date } = req.body;

    const memberIdInt = parseInt(memberId, 10);
    if (isNaN(memberIdInt)) throw new HttpError(400, 'Member ID tidak valid');


    const category = type?.toUpperCase() === 'ONLINE' ? 'KEHADIRAN' : 'KONTRIBUSI';

    const entry = await prisma.memberPoint.create({
      data: {
        memberId: memberIdInt,
        category,
        points: parseInt(points, 10) || 0,
        description: name,
        awardedAt: date ? new Date(date) : new Date(),
        awardedBy: req.auth?.userId,
      },
    });
    res.status(201).json({ data: entry });
  }),
);

// Update record poin (perlu admin)
router.patch(
  '/points/:memberId/:pointId',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const memberId = parseInt(req.params.memberId, 10);
    const pointId = parseInt(req.params.pointId, 10);

    if (isNaN(memberId)) throw new HttpError(400, 'Member ID tidak valid');
    if (isNaN(pointId)) throw new HttpError(400, 'Point ID tidak valid');

    const { name, points, type, date } = req.body;


    const pointRecord = await prisma.memberPoint.findUnique({
      where: { id: pointId },
    });

    if (!pointRecord || pointRecord.memberId !== memberId) {
      return res.status(404).json({ error: 'Point record not found' });
    }

    const category = type?.toUpperCase() === 'ONLINE' ? 'KEHADIRAN' : 'KONTRIBUSI';

    const updated = await prisma.memberPoint.update({
      where: { id: pointRecord.id },
      data: {
        description: name,
        points: parseInt(points, 10) || pointRecord.points,
        category,
        awardedAt: date ? new Date(date) : pointRecord.awardedAt,
      },
    });

    res.json({ data: updated });
  }),
);

// Hapus record poin (perlu admin)
router.delete(
  '/points/:memberId/:pointId',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const memberId = parseInt(req.params.memberId, 10);
    const pointId = parseInt(req.params.pointId, 10);

    if (isNaN(memberId)) throw new HttpError(400, 'Member ID tidak valid');
    if (isNaN(pointId)) throw new HttpError(400, 'Point ID tidak valid');

    // Cari record poin
    const pointRecord = await prisma.memberPoint.findUnique({
      where: { id: pointId },
    });

    if (!pointRecord || pointRecord.memberId !== memberId) {
      return res.status(404).json({ error: 'Point record not found' });
    }

    await prisma.memberPoint.delete({
      where: { id: pointRecord.id },
    });

    res.json({ message: 'Point record deleted' });
  }),
);

// Legacy: Tambah poin (perlu admin)
router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { memberId, category, points, description, eventId } = req.body;

    const memberIdInt = parseInt(memberId, 10);
    if (isNaN(memberIdInt)) throw new HttpError(400, 'Member ID tidak valid');

    const eventIdInt = eventId ? parseInt(eventId, 10) : null;

    const entry = await prisma.memberPoint.create({
      data: {
        memberId: memberIdInt,
        category: category || 'OTHER',
        points: points || 0,
        description,
        eventId: eventIdInt,
        awardedBy: req.auth?.userId,
      },
    });
    res.status(201).json({ data: entry });
  }),
);

export default router;
