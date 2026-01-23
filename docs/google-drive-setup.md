# Google Drive storage setup (Service Account)

Goal: backend uploads scholarship documents to Google Drive and stores Drive `fileId` in MySQL.

## 1) Create credentials

1. Google Cloud Console → create/select a project
2. Enable **Google Drive API**
3. IAM & Admin → Service Accounts → Create
4. Keys → Add key → JSON → download

## 2) Prepare a Drive folder

1. Create a folder in your Google Drive (e.g. `GenBI Scholarship Uploads`)
2. Share it with the Service Account email as **Editor**
3. Copy its folder ID from the URL and put into `GDRIVE_FOLDER_ID`

## 3) Configure env

Recommended (avoids newline issues on Windows):

- Base64 encode the whole JSON key and set:
  - `GDRIVE_SERVICE_ACCOUNT_KEY_BASE64=...`

Alternative:

- Set `GDRIVE_CLIENT_EMAIL` and `GDRIVE_PRIVATE_KEY` (ensure newlines are preserved).

## 4) Security recommendations

- Keep the folder/files **not public**
- Download files through the backend (proxy) with admin authorization checks
- Store only metadata + Drive `fileId` in DB

## 5) Folder structure suggestion

Within `GDRIVE_FOLDER_ID`:

- `/scholarship/{applicationId}/...`

(Backend can create subfolders per applicant to keep it organized.)
