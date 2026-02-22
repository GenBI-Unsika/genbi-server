import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireAdminAccess } from '../middleware/auth.js';
import { sendNewsletterSubscribedEmail } from '../auth/email.js';

const router = Router();

// POST /subscribers - Subscribe to newsletter (auth only)
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { email, name } = req.body || {};

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { email: true, profile: { select: { name: true } } },
    });
    if (!user) throw new HttpError(401, 'Sesi Anda telah berakhir. Silakan login kembali.');

    const userEmail = String(user.email || '')
      .trim()
      .toLowerCase();
    if (!userEmail) throw new HttpError(400, 'Email akun tidak valid');

    // Anti-penipuan / human error: body.email (jika dikirim) harus sama dengan email login
    if (email !== undefined && email !== null) {
      if (typeof email !== 'string') throw new HttpError(400, 'Format email tidak valid');
      const incoming = email.trim().toLowerCase();
      if (incoming !== userEmail) {
        throw new HttpError(400, 'Email harus sama dengan email akun yang sedang login');
      }
    }

    const displayName = String(name || '').trim() || String(user.profile?.name || '').trim() || null;

    const existing = await prisma.subscriber.findUnique({
      where: { email: userEmail },
    });

    if (existing) {
      if (existing.isActive) {
        throw new HttpError(409, 'Email sudah berlangganan newsletter');
      }
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: displayName || existing.name,
          unsubscribedAt: null,
          subscribedAt: new Date(),
        },
      });

      await sendNewsletterSubscribedEmail({ toEmail: userEmail, name: displayName });
      return res.json({ message: 'Selamat datang kembali! Anda berhasil berlangganan newsletter.' });
    }

    await prisma.subscriber.create({
      data: {
        email: userEmail,
        name: displayName,
      },
    });

    await sendNewsletterSubscribedEmail({ toEmail: userEmail, name: displayName });

    res.status(201).json({ message: 'Terima kasih! Anda berhasil berlangganan newsletter GenBI Unsika.' });
  }),
);

// DELETE /subscribers - Unsubscribe from newsletter (auth only)
router.delete(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { email: true },
    });
    if (!user) throw new HttpError(401, 'Sesi Anda telah berakhir. Silakan login kembali.');
    const emailLower = String(user.email || '')
      .trim()
      .toLowerCase();
    if (!emailLower) throw new HttpError(400, 'Email akun tidak valid');

    const existing = await prisma.subscriber.findUnique({
      where: { email: emailLower },
    });

    if (!existing || !existing.isActive) {
      return res.json({ message: 'Berhasil berhenti berlangganan.' });
    }

    await prisma.subscriber.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
    });

    res.json({ message: 'Anda berhasil berhenti berlangganan newsletter.' });
  }),
);

// GET /subscribers - List subscribers (admin only)
router.get(
  '/',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const activeOnly = req.query.active !== 'false';

    const where = activeOnly ? { isActive: true } : {};

    const [data, total] = await Promise.all([
      prisma.subscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.subscriber.count({ where }),
    ]);

    res.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// DELETE /subscribers/:id - Delete subscriber (admin only)
router.delete(
  '/:id',
  requireAuth,
  requireAdminAccess,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new HttpError(400, 'ID tidak valid');

    await prisma.subscriber.delete({
      where: { id },
    });

    res.json({ message: 'Subscriber berhasil dihapus' });
  }),
);

export default router;
