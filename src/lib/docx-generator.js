import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate a Word document from a template with data
 * @param {string} templatePath - Path to the template file
 * @param {object} data - Data to fill in the template
 * @returns {Buffer} - Generated document as buffer
 */
export async function generateWordDocument(templatePath, data) {
  try {
    // Read template file
    const content = await fs.readFile(templatePath);
    const zip = new PizZip(content);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '-',
    });

    // Set the template data
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
 * Format date for Indonesian locale
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateIndonesian(date) {
  const d = new Date(date);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Prepare dispensation data for template
 * @param {object} dispensation - Dispensation record from database
 * @returns {object} - Formatted data for template
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
