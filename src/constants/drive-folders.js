/**
 * Google Drive Folder Structure Constants
 *
 * Centralized folder path definitions for all file uploads.
 * All files are organized under the root GDRIVE_FOLDER_ID in a structured hierarchy.
 *
 * Structure:
 *   GDRIVE_FOLDER_ID (root)
 *   ├── Artikel/
 *   │   ├── Covers/          — article cover images
 *   │   ├── Foto/            — article photo attachments
 *   │   └── Dokumen/         — article document attachments
 *   ├── Kegiatan/
 *   │   ├── Covers/          — activity/proker cover images
 *   │   ├── Foto/            — activity photo attachments
 *   │   └── Dokumen/         — activity document attachments
 *   ├── Profil/
 *   │   └── Avatar/          — user profile photos, team member photos
 *   ├── Beasiswa/
 *   │   └── Periode-{year}/
 *   │       └── {NPM}-{Nama}/  — per-applicant folder with all their docs
 *   ├── Dispensasi/
 *   │   └── Templates/       — generated dispensation PDFs
 *   ├── CMS/
 *   │   └── Images/          — site setting images (hero, branding, etc.)
 *   └── Acara/
 *       └── {Slug-atau-Nama}/ — per-event uploads (if any)
 */

// ============================================================================
// ARTICLE FOLDERS
// ============================================================================

/** Folder for article cover images */
export const FOLDER_ARTICLE_COVERS = 'Artikel/Covers';

/** Folder for article photo attachments */
export const FOLDER_ARTICLE_PHOTOS = 'Artikel/Foto';

/** Folder for article document attachments */
export const FOLDER_ARTICLE_DOCUMENTS = 'Artikel/Dokumen';

// ============================================================================
// ACTIVITY / PROKER FOLDERS
// ============================================================================

/** Folder for activity/proker cover images */
export const FOLDER_ACTIVITY_COVERS = 'Kegiatan/Covers';

/** Folder for activity/proker photo attachments */
export const FOLDER_ACTIVITY_PHOTOS = 'Kegiatan/Foto';

/** Folder for activity/proker document attachments */
export const FOLDER_ACTIVITY_DOCUMENTS = 'Kegiatan/Dokumen';

// ============================================================================
// PROFILE / AVATAR FOLDERS
// ============================================================================

/** Folder for all user & team member avatars */
export const FOLDER_PROFILE_AVATARS = 'Profil/Avatar';

// ============================================================================
// SCHOLARSHIP FOLDERS
// ============================================================================

/** Top-level scholarship folder */
export const FOLDER_SCHOLARSHIP_ROOT = 'Beasiswa';

/**
 * Build per-applicant scholarship folder path.
 * Structure: Beasiswa / Periode-{year} / {NPM}-{Nama}
 * @param {{ npm: string, name: string, year?: number }} applicant
 * @returns {string} Folder path as slash-separated string
 */
export function buildScholarshipFolder({ npm, name, year }) {
  const y = year || new Date().getFullYear();
  const safeName = (name || 'Unknown')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return `${FOLDER_SCHOLARSHIP_ROOT}/Periode-${y}/${npm}-${safeName}`;
}

// ============================================================================
// DISPENSATION FOLDERS
// ============================================================================

/** Folder for dispensation template/generated PDFs */
export const FOLDER_DISPENSATION_TEMPLATES = 'Dispensasi/Templates';

// ============================================================================
// CMS FOLDERS
// ============================================================================

/** Folder for CMS / site setting images */
export const FOLDER_CMS_IMAGES = 'CMS/Images';

// ============================================================================
// EVENT FOLDERS
// ============================================================================

/** Top-level event folder */
export const FOLDER_EVENT_ROOT = 'Acara';

/**
 * Build per-event folder path.
 * Structure: Acara / {slug-or-name}
 * @param {string} eventName — event title or slug
 * @returns {string} Folder path
 */
export function buildEventFolder(eventName) {
  const safeName = (eventName || 'Unknown')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
  return `${FOLDER_EVENT_ROOT}/${safeName}`;
}

// ============================================================================
// HELPER: Resolve any folder path into an array of segments
// ============================================================================

/**
 * Split a folder path string into segments for getOrCreateDriveFolderPath()
 * @param {string} folderPath — e.g. "Beasiswa/Periode-2026/1234567-Nama"
 * @returns {string[]} — e.g. ["Beasiswa", "Periode-2026", "1234567-Nama"]
 */
export function toFolderSegments(folderPath) {
  return String(folderPath || '')
    .split('/')
    .filter(Boolean);
}
