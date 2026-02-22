import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

// Endpoint Integrasi Google Calendar
// Endpoint ini menyediakan integrasi dengan API Google Calendar.
// Untuk mengaktifkan sepenuhnya, Anda perlu:
// 1. Create a Google Cloud project
// 2. Enable Google Calendar API
// 3. Create OAuth2 credentials or Service Account
// 4. Set variabel environment: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Untuk saat ini, endpoint ini menyediakan struktur yang dapat ditingkatkan nanti.

router.get(
  '/config',
  asyncHandler(async (req, res) => {
    const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    res.json({
      data: {
        isConfigured,
        features: {
          sync: isConfigured,
          export: true,
          import: isConfigured,
        },
      },
    });
  }),
);

// Bikin file jadwalan (.ics) cm buat satu acara aja
router.get(
  '/export/:eventId',
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../db/prisma.js');

    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Event ID tidak valid' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const icsContent = generateICS(event);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
    res.send(icsContent);
  }),
);

// Bikin rmbongan jadwalan (.ics) buat seluruh acara
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../db/prisma.js');

    const events = await prisma.event.findMany({
      where: { isActive: true },
      orderBy: { startDate: 'asc' },
    });

    const icsContent = generateICSMultiple(events);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="genbi-unsika-calendar.ics"');
    res.send(icsContent);
  }),
);

// Nyiptain link sakti nambah acara lari ke G-Calendar lu
router.get(
  '/google-url/:eventId',
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../db/prisma.js');

    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Event ID tidak valid' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const url = generateGoogleCalendarUrl(event);
    res.json({ data: { url } });
  }),
);

// Ngebantu rakit isian file ICS buat sebiji acara
function generateICS(event) {
  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);

  const formatICSDate = (date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GenBI Unsika//Portal GenBI//ID
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${event.id}@genbi-unsika.id
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${escapeICS(event.title)}
DESCRIPTION:${escapeICS(event.description || '')}
LOCATION:${escapeICS(event.location || '')}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

// Ngebantu rakit isian file ICS buat bnyk prt
function generateICSMultiple(events) {
  const eventBlocks = events
    .map((event) => {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);

      const formatICSDate = (date) => {
        return date
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '');
      };

      return `BEGIN:VEVENT
UID:${event.id}@genbi-unsika.id
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${escapeICS(event.title)}
DESCRIPTION:${escapeICS(event.description || '')}
LOCATION:${escapeICS(event.location || '')}
STATUS:CONFIRMED
END:VEVENT`;
    })
    .join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GenBI Unsika//Portal GenBI//ID
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:GenBI Unsika Events
${eventBlocks}
END:VCALENDAR`;
}

function generateGoogleCalendarUrl(event) {
  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);

  const formatGoogleDate = (date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: event.description || '',
    location: event.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Bersihin karakter aneh-aneh sblm disimpen n nt masuk ICS
function escapeICS(text) {
  if (!text) return '';
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export default router;
