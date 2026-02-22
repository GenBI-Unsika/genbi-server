import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs/promises';
import path from 'path';

// Bikin dokumen ms.Word dr template & data masuk
export async function generateWordDocument(templatePath, data) {
  try {
    const content = await fs.readFile(templatePath);
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '-',
    });

    doc.render(data);

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

// Rapihin tanggal biar format tgl nyusuaikan Indo
export function formatDateIndonesian(date) {
  const d = new Date(date);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Racik data dispensasi sblm disuntik mrk ke dalem template
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
