// Central document config for scholarship registration.
// This is the DEFAULT config used as fallback when no custom config is stored in DB.
// The actual config can be managed by admins via the CMS (stored in AppSetting 'scholarship_documents').
// Used by:
// - API validation (createScholarshipApplicationSchema)
// - API registration payload (GET /scholarships/registration)

export const SCHOLARSHIP_DOCUMENTS = [
  { key: 'ktmKtp', title: 'Scan KTP & KTM', desc: 'Dalam 1 file format PDF (Maks 10 MB).', required: true, kind: 'file' },
  { key: 'transkrip', title: 'Transkrip Nilai', desc: 'Bertandatangan dan cap Koordinator Program Studi, format PDF (Maks 10 MB).', required: true, kind: 'file' },
  { key: 'rekomendasi', title: 'Surat Rekomendasi', desc: 'Format PDF (Maks 10 MB).', required: true, kind: 'file' },
  { key: 'suratAktif', title: 'Surat Keterangan Aktif', desc: 'Format PDF (Maks 10 MB).', required: true, kind: 'file' },
  { key: 'sktmSlip', title: 'SKTM / Surat Keterangan Penghasilan / Slip Gaji', desc: 'Format PDF (Maks 10 MB).', required: false, kind: 'file' },
  { key: 'formA1', title: 'Biodata Diri Form A.1', desc: 'Unduh formulir pada link yang tersedia, isi dan unggah kembali dalam format PDF.', required: true, kind: 'file', downloadLink: '' },
  { key: 'suratPernyataan', title: 'Surat Pernyataan Tidak Mendaftar/Menerima Beasiswa Lain', desc: 'Unduh formulir pada link yang tersedia, isi dan unggah kembali dalam format PDF.', required: true, kind: 'file', downloadLink: '' },
  { key: 'portofolio', title: 'Portofolio', desc: 'Dalam 1 file format PDF (Maks 10 MB).', required: false, kind: 'file' },
  { key: 'videoUrl', title: 'Link Video Pengenalan Diri dan Motivasi', desc: 'Tag Instagram @genbi.unsika, akun tidak di-private (Maks 2 menit).', required: true, kind: 'url' },
  { key: 'instagramUrl', title: 'Link Profil Instagram', desc: 'Akun tidak diprivat selama masa seleksi.', required: true, kind: 'url' },
];

export function getRequiredScholarshipDocumentKeys() {
  return SCHOLARSHIP_DOCUMENTS.filter((d) => d && d.required).map((d) => d.key);
}

export function getScholarshipRequiredDocumentsErrorMessage() {
  const requiredTitles = SCHOLARSHIP_DOCUMENTS.filter((d) => d && d.required).map((d) => d.title);
  return `Dokumen wajib harus dilengkapi (${requiredTitles.join(', ')})`;
}
