# Google Drive storage setup (paling cepat tanpa admin)

Target: backend bisa **upload** file ke Google Drive dan simpan `driveFileId` ke database.

Kalau kamu **bukan admin Workspace** dan **tidak punya Shared Drive**, jangan pakai Service Account.
Pakai cara ini: **OAuth end-user consent** (akun Google biasa → punya kuota Drive).

---

## Yang kamu butuhkan (3 menit)

- Akses ke Google Cloud Console (buat OAuth credential)
- 1 akun Google yang akan dipakai menyimpan file (Gmail / akun organisasi biasa)

---

## Step 1 — Buat OAuth Client di Google Cloud

1. Google Cloud Console → pilih Project
2. Enable **Google Drive API**
3. APIs & Services → Credentials → Create Credentials → **OAuth client ID**
4. Application type: **Desktop app**
5. Copy:
   - **Client ID**
   - **Client secret**

Kalau kamu mau **pakai 1 Client ID saja** (reuse yang sudah dipakai untuk login Google / Web client), pastikan di credential itu kamu tambahkan Authorized redirect URI:

- `http://localhost:53682/oauth2/callback`

Kalau muncul error `redirect_uri_mismatch`, berarti redirect URI di credential belum cocok.

Alternatif paling gampang (tanpa edit redirect URI): buat OAuth Client baru tipe **Desktop app** khusus Drive, lalu isi `GDRIVE_OAUTH_CLIENT_ID` + `GDRIVE_OAUTH_CLIENT_SECRET`.

---

## Step 2 — Isi env backend

Di `genbi-server/.env` isi:

- `GOOGLE_CLIENT_ID=...`
- `GDRIVE_OAUTH_CLIENT_SECRET=...`

Catatan:

- Kamu **nggak wajib** isi `GDRIVE_OAUTH_CLIENT_ID`. Kalau kosong, server otomatis pakai `GOOGLE_CLIENT_ID`.
- Kalau `GOOGLE_CLIENT_ID` kamu isi **lebih dari satu** (dipisah koma), Drive OAuth akan pakai **yang pertama**. Kalau kamu butuh pilih yang lain, isi `GDRIVE_OAUTH_CLIENT_ID`.

---

## Step 3 — Generate refresh token (1x saja)

Jalankan:

```bash
node scripts/set-gdrive-oauth-env.mjs
```

Kalau kamu kesulitan buka link / callback server lokal tidak bisa jalan, pakai mode manual:

```bash
node scripts/set-gdrive-oauth-env.mjs --manual
```

Nanti setelah kamu klik Allow, browser biasanya gagal buka `localhost` (normal). Copy URL di address bar yang ada `?code=...` lalu paste ke terminal.

Script akan print URL → buka di browser → login akun Google yang akan menyimpan file → approve.
Kalau URL Google-nya kepanjangan / suka kepotong di terminal, **pakai link pendek lokal** yang dicetak script:

- `http://127.0.0.1:53682/open`

(Biasanya script juga auto-buka browser + copy link pendek ke clipboard di Windows.)
Setelah selesai, script otomatis menyimpan:

- `GDRIVE_OAUTH_REFRESH_TOKEN=...` ke `genbi-server/.env`

---

## Step 4 — Buat folder di Drive + set `GDRIVE_FOLDER_ID`

1. Di Google Drive (akun yang sama), buat folder (mis. `GenBI Uploads`)
2. Copy folder ID dari URL:
   - `https://drive.google.com/drive/folders/<FOLDER_ID>`
3. Isi di `genbi-server/.env`:
   - `GDRIVE_FOLDER_ID=<FOLDER_ID>`

Catatan:

- Folder ini **harus bisa diakses oleh akun yang sama** yang kamu pakai saat generate `GDRIVE_OAUTH_REFRESH_TOKEN`.
  Kalau folder dibuat di akun lain / Shared Drive yang tidak bisa diakses, upload akan gagal (biasanya error Drive: `File not found: <FOLDER_ID>`).
  Solusi: buat folder baru di akun yang sama, atau share folder tersebut ke akun OAuth yang dipakai.

---

## Step 5 — Restart backend + tes

Terminal 1 (nyalakan backend):

```bash
npm run dev
```

Terminal 2 (smoke test):

```bash
node scripts/smoke-drive.mjs http://127.0.0.1:4000
```

Kalau sukses: ada `UPLOAD_OK` dan `DOWNLOAD_OK`.

---

## Catatan penting

Untuk aman: download lewat backend (`/api/v1/files/:id/download`) pakai auth.

Kalau kamu memang butuh URL Drive yang bisa diakses tanpa login, ada 2 opsi:

1. Share manual di Google Drive: file/folder → Share → Anyone with the link (Viewer)

Kalau file sudah terlanjur ke-upload dan kamu tidak mau upload ulang, kamu bisa set public permission untuk file tertentu:

```bash
node scripts/set-drive-public.mjs --driveFileId <DRIVE_FILE_ID>
# atau pakai id di database (FileObject)
node scripts/set-drive-public.mjs --dbId <FILE_OBJECT_ID>
```

2. Otomatis via backend: set env `GDRIVE_PUBLIC_FILES=true` lalu restart backend (akan set permission "anyone with the link" setelah upload)

Catatan: di beberapa akun organisasi, opsi public link bisa diblokir policy admin.
