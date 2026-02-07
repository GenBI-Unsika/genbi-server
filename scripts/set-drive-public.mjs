// Usage:
//   node scripts/set-drive-public.mjs --driveFileId <DRIVE_FILE_ID>
//   node scripts/set-drive-public.mjs --dbId <FILE_OBJECT_ID>
//
// Purpose:
//   Make an uploaded Google Drive file readable by "anyone with the link" (so
//   https://drive.google.com/uc?export=view&id=<id> can be previewed without login).
//
// Notes:
//   - Requires backend env Google Drive OAuth (or SA) to be configured.
//   - In some org accounts, public sharing may be blocked by admin policy.

import { prisma } from '../src/db/prisma.js';
import { setDriveFilePublicReadable } from '../src/storage/gdrive.js';

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
}

async function main() {
  const driveFileId = readArg('--driveFileId');
  const dbIdRaw = readArg('--dbId');

  let targetDriveFileId = driveFileId;

  if (!targetDriveFileId && dbIdRaw) {
    const dbId = Number(dbIdRaw);
    if (!Number.isFinite(dbId)) {
      console.error('Invalid --dbId (must be a number)');
      process.exit(2);
    }

    const row = await prisma.fileObject.findUnique({ where: { id: dbId }, select: { id: true, driveFileId: true } });
    if (!row) {
      console.error(`FileObject not found for id=${dbId}`);
      process.exit(2);
    }

    targetDriveFileId = row.driveFileId;
  }

  if (!targetDriveFileId) {
    console.error('Missing target file. Provide --driveFileId <id> or --dbId <id>.');
    process.exit(2);
  }

  await setDriveFilePublicReadable(targetDriveFileId);
  console.log('DRIVE_PUBLIC_OK', targetDriveFileId);
  console.log(`Preview URL: https://drive.google.com/uc?export=view&id=${targetDriveFileId}`);
}

main()
  .catch((err) => {
    console.error('DRIVE_PUBLIC_FAILED');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
