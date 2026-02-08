import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate dokumen Word dari template dengan data
 * @param {string} templatePath - Path ke file template
 * @param {object} data - Data untuk mengisi template
 * @returns {Buffer} - Buffer dokumen yang dihasilkan
 */
export async function generateWordDocument(templatePath, data) {
  try {
    // Baca file template
    const content = await fs.readFile(templatePath);
    const zip = new PizZip(content);

    // Buat instance docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '-',
    });

    // Set data template
    doc.render(data);

    // Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return buffer;
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error(`Gagal generate dokumen: ${error.message}`);
  }
}

/**
 * Format tanggal untuk lokal Indonesia
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateIndonesian(date) {
  const d = new Date(date);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Siapkan data dispensasi untuk template
 * @param {object} dispensation - Record dispensasi dari database
 * @returns {object} - Data yang diformat untuk template
 */
export function prepareDispensationData(dispensation) {
  return {
    nama: dispensation.nama || '-',
    npm: dispensation.npm || '-',
    fakultas: dispensation.fakultas || '-',
    prodi: dispensation.prodi || '-',
    kegiatan: dispensation.kegiatan || '-',
    tanggal: formatDateIndonesian(dispensation.tanggal),
    tanggal_surat: formatDateIndonesian(new Date()),
    alasan: dispensation.alasan || '-',
    status: dispensation.status || '-',
  };
}
