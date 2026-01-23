# GenBI Backend (Express + MySQL)

## Setup

1. Copy `.env.example` -> `.env`
2. Set `CORS_ORIGINS` to your Vite dev URLs
3. Install deps:
   - `cd backend`
   - `npm install`
4. Run:
   - `npm run dev`

Healthcheck: `GET /api/v1/health`

## Auth strategy (planned)

- Access token: JWT (short-lived) returned to client, sent as `Authorization: Bearer <token>`
- Refresh token: stored in httpOnly cookie + hashed in DB; rotated on refresh
- Cookie `SameSite` will be set for SPA use. On localhost, different ports are still same-site; in production prefer the same parent domain.

## Google Drive storage (planned)

- Scholarship documents uploaded by backend to a Drive folder using a Service Account
- File IDs stored in MySQL (store Drive `fileId`, `mimeType`, `size`, and original name)

### Google Drive prerequisites

1. Create a Google Cloud project
2. Enable **Google Drive API**
3. Create a **Service Account** and download its JSON key
4. Create a folder in Google Drive and **share** it with the Service Account email (Editor)
5. Put the folder ID into `GDRIVE_FOLDER_ID`

Security note: keep files private and download via backend proxy.
