import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Di monorepo/workspace, backend mungkin dijalankan dari root repo.
// Muat .env lokal backend secara eksplisit agar variabel yang diperlukan (misal GOOGLE_CLIENT_ID)
// tersedia terlepas dari direktori kerja saat ini.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Juga muat default .env (no-op jika sudah dimuat atau variabel sudah diset).
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Host/address untuk bind server. Gunakan '0.0.0.0' untuk menerima koneksi eksternal.
  HOST: z.string().default('0.0.0.0'),

  CORS_ORIGINS: z.string().default(''),

  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  // 15 menit terasa terlalu singkat untuk penggunaan tipikal; refresh token tetap melindungi sesi panjang.
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 6),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),

  // Token berumur pendek untuk URL preview/download file (dapat digunakan tanpa header Authorization)
  FILE_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 5),

  DATABASE_URL: z.string().min(10),

  GDRIVE_FOLDER_ID: z.string().optional().default(''),
  GDRIVE_CLIENT_EMAIL: z.string().optional().default(''),
  GDRIVE_PRIVATE_KEY: z.string().optional().default(''),
  GDRIVE_SERVICE_ACCOUNT_KEY_BASE64: z.string().optional().default(''),
  // Opsional: Domain-Wide Delegation (impersonate user Workspace)
  // Contoh: "admin@yourdomain.com"
  GDRIVE_IMPERSONATE_USER: z.string().optional().default(''),
  // Opsional: Konsem OAuth end-user (bekerja tanpa admin Workspace / Shared Drive)
  // Gunakan akun Google dengan kuota Drive normal.
  GDRIVE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GDRIVE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GDRIVE_OAUTH_REFRESH_TOKEN: z.string().optional().default(''),

  // Opsional: secara otomatis set izin Drive ke "siapa saja yang memiliki link" untuk file yang diupload.
  // PERINGATAN: ini membuat file dapat diakses publik jika seseorang mengetahui linknya.
  GDRIVE_PUBLIC_FILES: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  SEED_ADMIN_EMAIL: z.string().optional().default(''),
  SEED_ADMIN_PASSWORD: z.string().optional().default(''),

  // Batasan Auth
  // List dipisahkan koma, misal "unsika.ac.id,student.unsika.ac.id"
  AUTH_ALLOWED_EMAIL_DOMAIN: z.string().default('unsika.ac.id,student.unsika.ac.id'),
  AUTH_REQUIRE_EMAIL_VERIFIED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),

  // Verifikasi Email
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),

  FRONTEND_CLIENT_BASE_URL: z.string().optional().default(''),

  // Google Sign-In
  // Bisa berupa client ID tunggal atau list dipisahkan koma.
  // Contoh: "xxx.apps.googleusercontent.com,yyy.apps.googleusercontent.com"
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function corsOrigins() {
  const raw = env.CORS_ORIGINS.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
