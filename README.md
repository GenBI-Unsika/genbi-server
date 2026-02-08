# GenBI Server (Backend)

Backend API server untuk GenBI Unsika yang menangani logika bisnis, autentikasi, dan manajemen data.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MySQL/MariaDB
- Google Cloud Console Account (untuk Drive API & OAuth)

### Installation

1.  **Clone & Install Dependencies**
    ```bash
    git clone <repository-url>
    cd genbi-server
    npm install
    ```

2.  **Environment Variables**
    Buat file `.env` berdasarkan `.env.example`:
    ```env
    PORT=4000
    DATABASE_URL=mysql://root:password@localhost:3306/genbi_db
    JWT_ACCESS_SECRET=super_secret_key
    JWT_REFRESH_SECRET=super_secret_refresh_key
    GOOGLE_CLIENT_ID=your_google_client_id
    GDRIVE_FOLDER_ID=your_drive_folder_id
    GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=your_base64_encoded_key
    ```

3.  **Database Setup**
    ```bash
    npx prisma generate
    npx prisma migrate deploy
    npm run seed # Optional: Seed initial data
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Server berjalan di `http://localhost:4000`.

## 🛠️ Tech Stack

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **ORM**: Prisma
-   **Database**: MySQL
-   **Validation**: Zod / Joi (cek `src/middleware/validator`)
-   **Auth**: JWT (Access + Refresh Token), Google OAuth
-   **Storage**: Google Drive API

## 📂 Folder Structure

```
genbi-server/
├── prisma/              # Schema database & migrasi
├── scripts/             # Utility scripts (seeding, admin creation)
├── src/
│   ├── config/          # Konfigurasi (Db, Google, Logging)
│   ├── controllers/     # Logika bisnis (RequestHandler)
│   ├── db/              # Prisma client instance
│   ├── lib/             # Helper libraries (Google Drive, Date Utils)
│   ├── middleware/      # Auth, Error Handling, Validation
│   ├── routes/          # Definisi endpoint API
│   ├── storage/         # Temp folder untuk upload
│   └── server.js        # Entry point aplikasi
├── .env                 # Environment variables
└── package.json         # Dependencies & scripts
```

## 🔄 Integrations & Flow

### 1. Database (MySQL via Prisma)
-   Semua interaksi database menggunakan Prisma Client.
-   Schema didefinisikan di `prisma/schema.prisma`.
-   **Migration**: `npx prisma migrate dev` untuk update schema.

### 2. Google Drive (File Storage)
-   File diupload ke folder temporary server dulu.
-   Service `src/lib/google-drive.js` mengupload ke Google Drive.
-   ID file Drive disimpan di database kolom `driveFileId`.
-   **Setup Guide**: Lihat `../Documentation/GOOGLE-DRIVE-SETUP.md`.

### 3. Authentication Flow
1.  **Login**: User kirim email/pass atau Google Token.
2.  **Token**: Server return `accessToken` (15m) & `refreshToken` (7d).
3.  **Middleware**: `authenticateToken` memvalidasi header `Authorization: Bearer <token>`.
4.  **Refresh**: Endpoint `/auth/refresh` menukar `refreshToken` valid dengan `accessToken` baru.

## 🗺️ File Tour

-   **`src/server.js`**:
    -   Setup Express app.
    -   Mendaftarkan middleware global (CORS, JSON parser).
    -   Mounting routes.
    -   Global error handler.

-   **`src/routes/*.routes.js`**:
    -   Mendefinisikan URL endpoint.
    -   Memetakan HTTP method ke Controller.
    -   Menambahkan middleware auth/validasi per route.

-   **`prisma/schema.prisma`**:
    -   Definisi tabel database (User, UserProfile, Activity, dll).
    -   Definisi relasi antar tabel.

## 📚 Documentation

Dokumentasi lengkap project ini ada di folder `../Documentation/`:
-   [Setup Guide](../Documentation/SETUP-GUIDE.md)
-   [Architecture](../Documentation/ARCHITECTURE.md)
-   [Google Drive Setup](../Documentation/GOOGLE-DRIVE-SETUP.md)
-   [Database Migration](../Documentation/DATABASE-MIGRATION-GUIDE.md)
