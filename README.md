# GenBI Server

Backend API server untuk GenBI Unsika menggunakan Express.js dan Prisma ORM.

## Quick Start

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Berjalan di `http://localhost:4000`

## Environment

Buat `.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=mysql://root:password@localhost:3306/genbi_db

# JWT
JWT_ACCESS_SECRET=your-secret-min-32-chars
JWT_REFRESH_SECRET=your-secret-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175

# Google
GOOGLE_CLIENT_ID=your-google-client-id
GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=base64-encoded-key
GDRIVE_FOLDER_ID=your-folder-id
```

## API Endpoints

| Prefix                  | Description        |
| ----------------------- | ------------------ |
| `/api/v1/auth`          | Authentication     |
| `/api/v1/me`            | User Profile       |
| `/api/v1/users`         | User Management    |
| `/api/v1/activities`    | Activities         |
| `/api/v1/articles`      | Articles           |
| `/api/v1/teams`         | Team Members       |
| `/api/v1/divisions`     | Divisions          |
| `/api/v1/treasury`      | Treasury           |
| `/api/v1/leaderboard`   | Points Leaderboard |
| `/api/v1/dispensations` | Dispensations      |
| `/api/v1/scholarships`  | Scholarships       |
| `/api/v1/site-settings` | CMS Settings       |
| `/api/v1/files`         | File Upload        |

## Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Tech Stack

- Node.js + Express.js
- Prisma ORM
- MySQL/MariaDB
- JWT Authentication
- Google Drive API

## Dokumentasi

Lihat `../Documentation/` untuk dokumentasi lengkap.
