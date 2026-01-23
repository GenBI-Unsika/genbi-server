import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';

function getServiceAccountFromEnv() {
  if (env.GDRIVE_SERVICE_ACCOUNT_KEY_BASE64) {
    const json = Buffer.from(env.GDRIVE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  if (env.GDRIVE_CLIENT_EMAIL && env.GDRIVE_PRIVATE_KEY) {
    return {
      client_email: env.GDRIVE_CLIENT_EMAIL,
      private_key: env.GDRIVE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  throw new Error('Google Drive credentials not configured');
}

export function getDriveClient() {
  const sa = getServiceAccountFromEnv();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export async function uploadBufferToDrive({ name, mimeType, buffer, parentFolderId = env.GDRIVE_FOLDER_ID }) {
  const drive = getDriveClient();

  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(body),
    },
    fields: 'id,name,mimeType,size',
  });

  return res.data;
}

export async function downloadDriveFileStream(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    {
      responseType: 'stream',
    }
  );
  return res.data;
}
