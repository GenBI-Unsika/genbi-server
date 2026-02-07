import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// In a monorepo/workspace, the backend may be started from the repo root.
// Load the backend-local .env explicitly so required vars (e.g. GOOGLE_CLIENT_ID)
// are available regardless of current working directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also load default .env (no-op if already loaded or variables are already set).
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Host/address to bind the server to. Use '0.0.0.0' to accept external connections.
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
  // 15 minutes feels too short for typical usage; refresh token still protects long sessions.
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

  // Short-lived tokens for file preview/download URLs (usable without Authorization header)
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
  // Optional: Domain-Wide Delegation (impersonate a Workspace user)
  // Example: "admin@yourdomain.com"
  GDRIVE_IMPERSONATE_USER: z.string().optional().default(''),
  // Optional: OAuth end-user consent (works without Workspace admin / Shared Drive)
  // Use a Google account with normal Drive quota.
  GDRIVE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GDRIVE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GDRIVE_OAUTH_REFRESH_TOKEN: z.string().optional().default(''),

  // Optional: automatically set Drive permission to "anyone with the link" for uploaded files.
  // WARNING: this makes files publicly accessible if someone knows the link.
  GDRIVE_PUBLIC_FILES: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  SEED_ADMIN_EMAIL: z.string().optional().default(''),
  SEED_ADMIN_PASSWORD: z.string().optional().default(''),

  // Auth restrictions
  // Comma-separated list, e.g. "unsika.ac.id,student.unsika.ac.id"
  AUTH_ALLOWED_EMAIL_DOMAIN: z.string().default('unsika.ac.id,student.unsika.ac.id'),
  AUTH_REQUIRE_EMAIL_VERIFIED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),

  // Email verification
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
  // Can be a single client ID or a comma-separated list.
  // Example: "xxx.apps.googleusercontent.com,yyy.apps.googleusercontent.com"
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
