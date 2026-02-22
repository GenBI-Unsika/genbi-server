import sharp from 'sharp';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const DEFAULT_QUALITY = 80;

// Kompress buffer gambar kl misal formatnya emg support.
// Ubah ke format WebP, resize kl kegedean, trus di-press abis.
export async function optimizeImage(buffer, mimeType) {
    const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff'];

    if (!supportedMimeTypes.includes(mimeType)) {
        return { buffer, mimeType, extension: '' };
    }

    try {
        const optimizedBuffer = await sharp(buffer)
            .resize(MAX_WIDTH, MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: DEFAULT_QUALITY })
            .toBuffer();

        return {
            buffer: optimizedBuffer,
            mimeType: 'image/webp',
            extension: '.webp',
        };
    } catch (error) {
        console.warn('[image-optimizer] Image optimization failed, falling back to original:', error.message);
        return { buffer, mimeType, extension: '' };
    }
}

// Rapiin nama file biar ekstensinya bener (terutama kl hbs diconvert ke WebP).
// <-- khusus buat file yg udh disulap jd WebP
export function normalizeFilename(originalName, newExtension) {
    if (!newExtension) return originalName;

    const lastDotIndex = originalName.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return `${originalName}${newExtension}`;
    }

    return `${originalName.substring(0, lastDotIndex)}${newExtension}`;
}
