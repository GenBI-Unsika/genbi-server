import crypto from 'crypto';
import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

const VERIFY_TTL_SECONDS = 60 * 60 * 24; // 24h

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter() {
  if (!hasSmtpConfig()) return null;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function verifySmtpReadyOrThrow() {
  if (!hasSmtpConfig()) {
    throw new HttpError(500, 'SMTP belum dikonfigurasi di server.');
  }
}

function minutesFromNow(expiresAt) {
  const ms = expiresAt.getTime() - Date.now();
  return Math.max(1, Math.round(ms / 1000 / 60));
}

function verifyEmailTemplate({ link, expiresAt }) {
  const expiryMinutes = minutesFromNow(expiresAt);

  const subject = 'Verifikasi Email - GenBI Unsika';
  const text = link
    ? `Halo!\n\nKlik link berikut untuk verifikasi email GenBI Unsika (berlaku ${expiryMinutes} menit):\n${link}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.`
    : `Halo!\n\nLink verifikasi belum dikonfigurasi. Hubungi admin.`;

  const html = link
    ? `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
    <h2 style="margin:0 0 12px">Verifikasi Email</h2>
    <p style="margin:0 0 12px">Klik tombol di bawah untuk memverifikasi email Anda di GenBI Unsika.</p>
    <p style="margin:0 0 18px">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px">Verifikasi Email</a>
    </p>
    <p style="margin:0 0 12px;font-size:13px;color:#444">Link ini berlaku sekitar ${expiryMinutes} menit. Jika tombol tidak berfungsi, salin tautan berikut:</p>
    <p style="margin:0 0 12px;font-size:13px;word-break:break-all"><a href="${link}">${link}</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:#666">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
  </div>`
    : `<p>Link verifikasi belum dikonfigurasi. Hubungi admin.</p>`;

  return { subject, text, html };
}

function newsletterSubscribedTemplate({ name }) {
  const subject = 'Berhasil Berlangganan Newsletter - GenBI Unsika';
  const safeName = String(name || '').trim();
  const greeting = safeName ? `Halo, ${safeName}!` : 'Halo!';
  const text = `${greeting}\n\nTerima kasih sudah berlangganan newsletter GenBI Unsika. Kamu akan menerima update artikel, berita GenBI, dan info beasiswa melalui email ini.\n\nJika kamu tidak merasa berlangganan, kamu bisa berhenti berlangganan dari akun yang sama.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
    <h2 style="margin:0 0 12px">Berhasil Berlangganan</h2>
    <p style="margin:0 0 12px">${greeting}</p>
    <p style="margin:0 0 12px">Terima kasih sudah berlangganan newsletter <b>GenBI Unsika</b>.</p>
    <p style="margin:0 0 12px">Kamu akan menerima update artikel, berita GenBI, dan info beasiswa melalui email ini.</p>
    <p style="margin:16px 0 0;font-size:12px;color:#666">Jika kamu tidak merasa berlangganan, kamu bisa berhenti berlangganan dari akun yang sama.</p>
  </div>`;
  return { subject, text, html };
}

export function makeVerifyToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('base64');
}

export function verifyLinkFor(token) {
  const base = (env.FRONTEND_CLIENT_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return '';
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

export function verifyExpiresAt() {
  return new Date(Date.now() + VERIFY_TTL_SECONDS * 1000);
}

export async function sendVerifyEmail({ toEmail, token, expiresAt }) {
  const link = verifyLinkFor(token);
  const from = env.SMTP_FROM || env.SMTP_USER;

  const exp = expiresAt instanceof Date ? expiresAt : verifyExpiresAt();

  if (!hasSmtpConfig()) {
    if (env.NODE_ENV === 'production') {
      throw new HttpError(500, 'SMTP belum dikonfigurasi di server.');
    }

    // dev fallback: log link to server console
    // eslint-disable-next-line no-console

    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.info(`[DEV] Email verification requested for: ${toEmail}`);
      // eslint-disable-next-line no-console
      console.info(`[DEV] Verify token: ${token}`);
      // eslint-disable-next-line no-console
      console.info(`[DEV] Verify link (frontend): ${link || '(FRONTEND_CLIENT_BASE_URL belum diset)'}`);
      // eslint-disable-next-line no-console
      console.info(`[DEV] Alternative verify endpoint: /api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
    }

    return { ok: true, skipped: true, link };
  }

  if (env.NODE_ENV === 'production' && !link) {
    throw new HttpError(500, 'Link verifikasi belum dikonfigurasi di server.');
  }

  verifySmtpReadyOrThrow();

  const transporter = getTransporter();
  if (!transporter) throw new HttpError(500, 'SMTP belum dikonfigurasi di server.');

  const tpl = verifyEmailTemplate({ link, expiresAt: exp });

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });

  return { ok: true, skipped: false, link };
}

export async function sendNewsletterSubscribedEmail({ toEmail, name }) {
  const from = env.SMTP_FROM || env.SMTP_USER;

  if (!hasSmtpConfig()) {
    if (env.NODE_ENV === 'production') {
      throw new HttpError(500, 'SMTP belum dikonfigurasi di server.');
    }
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.info(`[DEV] Newsletter subscribed: ${toEmail} (${String(name || '').trim() || '-'})`);
    }
    return { ok: true, skipped: true };
  }

  verifySmtpReadyOrThrow();
  const transporter = getTransporter();
  if (!transporter) throw new HttpError(500, 'SMTP belum dikonfigurasi di server.');

  const tpl = newsletterSubscribedTemplate({ name });
  await transporter.sendMail({
    from,
    to: toEmail,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });

  return { ok: true, skipped: false };
}
