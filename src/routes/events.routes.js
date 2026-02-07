import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';

const router = Router();

// Determine event mode (online/offline) based on type and location
const getEventMode = (type, location) => {
  const t = (type || '').toLowerCase();
  // If type explicitly says online or offline
  if (t === 'online') return 'online';
  if (t === 'offline') return 'offline';
  // Check if location looks like an online link
  const loc = (location || '').toLowerCase();
  if (loc.includes('http') || loc.includes('zoom') || loc.includes('meet.google') || loc.includes('teams') || loc.includes('webex')) {
    return 'online';
  }
  // Default to offline for physical events
  return 'offline';
};

// Map event to frontend format
const mapEvent = (e) => {
  // Extract time from startDate
  const startDate = new Date(e.startDate);
  const timeStr = startDate.toTimeString().slice(0, 5); // HH:MM
  const dateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const mode = getEventMode(e.type, e.location);

  return {
    id: e.id,
    title: e.title,
    description: e.description,
    type: e.type?.toLowerCase() || 'other',
    mode, // 'online' or 'offline' - for filtering
    date: dateStr,
    time: e.isAllDay ? null : timeStr,
    startDate: e.startDate,
    endDate: e.endDate,
    location: e.location,
    isAllDay: e.isAllDay,
    color: e.color,
  };
};

// Get all events (public for calendar)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const events = await prisma.event.findMany({
        where: { isActive: true },
        orderBy: { startDate: 'asc' },
      });
      res.json({ data: events.map(mapEvent) });
    } catch (e) {
      if (e?.code === 'P2021' || e?.code === 'P2010') {
        return res.json({ data: [] });
      }
      throw e;
    }
  }),
);

// Get upcoming events
router.get(
  '/upcoming',
  asyncHandler(async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const events = await prisma.event.findMany({
        where: { isActive: true, startDate: { gte: today } },
        orderBy: { startDate: 'asc' },
        take: 10,
      });
      res.json({ data: events.map(mapEvent) });
    } catch (e) {
      if (e?.code === 'P2021' || e?.code === 'P2010') {
        return res.json({ data: [] });
      }
      throw e;
    }
  }),
);

// Create event (admin required)
router.post(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const { title, description, type, startDate, endDate, location, isAllDay, color } = req.body;
    const event = await prisma.event.create({
      data: {
        title,
        description,
        type: type ? type.toUpperCase() : 'OTHER',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location,
        isAllDay: isAllDay || false,
        color,
        createdById: req.auth?.userId,
      },
    });
    res.status(201).json({ data: mapEvent(event) });
  }),
);

// Update event
router.patch(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    const { title, description, type, startDate, endDate, location, isAllDay, color, isActive } = req.body;
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type: type.toUpperCase() }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(location !== undefined && { location }),
        ...(isAllDay !== undefined && { isAllDay }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ data: mapEvent(event) });
  }),
);

// Delete event (soft delete)
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.event.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Event deleted' });
  }),
);

export default router;
