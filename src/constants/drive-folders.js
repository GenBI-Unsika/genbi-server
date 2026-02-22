// BASSIC: Daftar folder Google Drive
// Semua daftar alamat folder upload mendarat disini biar rapi.
// Semua file bakal diurutin cakep di bawah folder akarnya si GDRIVE_FOLDER_ID.
// Susunan foldernya:
// (Ini folder utamanya / Root)
// ├── Artikel/
// │   ├── Covers/          — article cover images
// │   ├── Foto/            — article photo attachments
// │   └── Dokumen/         — article document attachments
// ├── Kegiatan/
// │   ├── Covers/          — activity/proker cover images
// │   ├── Foto/            — activity photo attachments
// │   └── Dokumen/         — activity document attachments
// ├── Profil/
// │   └── Avatar/          — user profile photos, team member photos
// ├── Beasiswa/
// │   └── Periode-{year}/
// │       └── {NPM}-{Nama}/  — per-applicant folder with all their docs
// ├── Dispensasi/
// │   └── Templates/       — generated dispensation PDFs
// ├── CMS/
// │   └── Images/          — site setting images (hero, branding, etc.)
// └── Acara/
// └── {Slug-atau-Nama}/ — per-event uploads (if any)

// Folder GDrive buat nyimpen cover artikel
export const FOLDER_ARTICLE_COVERS = 'Artikel/Covers';

// Folder GDrive buat lampiran foto-foto artikel
export const FOLDER_ARTICLE_PHOTOS = 'Artikel/Foto';

// Folder GDrive buat file dokumen/PDF artikel
export const FOLDER_ARTICLE_DOCUMENTS = 'Artikel/Dokumen';

// Folder GDrive buat cover proker/event
export const FOLDER_ACTIVITY_COVERS = 'Kegiatan/Covers';

// Folder GDrive buat foto-foto kegiatan/proker
export const FOLDER_ACTIVITY_PHOTOS = 'Kegiatan/Foto';

// Folder GDrive buat materi doc/PDF proker
export const FOLDER_ACTIVITY_DOCUMENTS = 'Kegiatan/Dokumen';

// Folder GDrive buat foto profil anak genbi & tim
export const FOLDER_PROFILE_AVATARS = 'Profil/Avatar';

// Folder utama beasiswa
export const FOLDER_SCHOLARSHIP_ROOT = 'Beasiswa';

// Bikin folder spesifik buat tiap pelamar beasiswa.
// Susunan foldernya: Beasiswa / Periode-{year} / {NPM}-{Nama}
export function buildScholarshipFolder({ npm, name, year }) {
  const y = year || new Date().getFullYear();
  const safeName = (name || 'Unknown')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return `${FOLDER_SCHOLARSHIP_ROOT}/Periode-${y}/${npm}-${safeName}`;
}

// Folder GDrive gas pol surat dispensasi
export const FOLDER_DISPENSATION_TEMPLATES = 'Dispensasi/Templates';

// Folder GDrive buat gambar-gambar web CMS
export const FOLDER_CMS_IMAGES = 'CMS/Images';

// Folder utama daftar event
export const FOLDER_EVENT_ROOT = 'Acara';

// Bikin folder spesifik buat tiap acara/event
// Susunan foldernya: Acara / {slug-or-name}
export function buildEventFolder(eventName) {
  const safeName = (eventName || 'Unknown')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
  return `${FOLDER_EVENT_ROOT}/${safeName}`;
}

// Potong-potong path folder jd array biar si fungsi getOrCreateDrive gampang bikinnya.
export function toFolderSegments(folderPath) {
  return String(folderPath || '')
    .split('/')
    .filter(Boolean);
}
