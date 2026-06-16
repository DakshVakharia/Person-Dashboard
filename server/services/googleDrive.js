import { google } from 'googleapis';
import { db } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/dashboard.db');

function getUser() {
  return db.prepare('SELECT * FROM users LIMIT 1').get();
}

function getAuthClient(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
  });
  oauth2Client.on('tokens', tokens => {
    if (tokens.access_token)
      db.prepare('UPDATE users SET access_token = ? WHERE id = ?').run(tokens.access_token, user.id);
  });
  return oauth2Client;
}

export async function backupToDrive() {
  const user = getUser();
  if (!user) return console.log('[Backup] No user found, skipping');

  const auth = getAuthClient(user);
  const drive = google.drive({ version: 'v3', auth });

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `dashboard-backup-${dateStr}.db`;

  // Check if backup folder exists; create if not
  let folderId = null;
  const folderSearch = await drive.files.list({
    q: "name='DashboardBackups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id)',
  });
  if (folderSearch.data.files.length > 0) {
    folderId = folderSearch.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: { name: 'DashboardBackups', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = folder.data.id;
  }

  const fileMetadata = { name: fileName, parents: [folderId] };
  const media = { mimeType: 'application/octet-stream', body: fs.createReadStream(DB_PATH) };

  await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
  console.log(`[Backup] Uploaded ${fileName} to Google Drive`);

  // Keep only last 7 backups
  const files = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'dashboard-backup' and trashed=false`,
    orderBy: 'createdTime desc',
    fields: 'files(id, name)',
  });

  const toDelete = files.data.files.slice(7);
  for (const f of toDelete) {
    await drive.files.delete({ fileId: f.id });
    console.log(`[Backup] Pruned old backup: ${f.name}`);
  }
}

export async function restoreFromDrive() {
  const user = getUser();
  if (!user) throw new Error('No user found');

  const auth = getAuthClient(user);
  const drive = google.drive({ version: 'v3', auth });

  // Find the DashboardBackups folder
  const folderSearch = await drive.files.list({
    q: "name='DashboardBackups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id)',
  });
  if (!folderSearch.data.files.length) throw new Error('No DashboardBackups folder found on Drive');
  const folderId = folderSearch.data.files[0].id;

  // Get the latest backup file
  const fileList = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'dashboard-backup' and trashed=false`,
    orderBy: 'createdTime desc',
    fields: 'files(id, name)',
    pageSize: 1,
  });
  if (!fileList.data.files.length) throw new Error('No backup files found in DashboardBackups');
  const latest = fileList.data.files[0];
  console.log(`[Restore] Downloading ${latest.name} from Drive`);

  const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
  const DB_PATH = path.join(__dirname2, '../data/dashboard.db');
  const tmpPath = DB_PATH + '.tmp';

  const dest = fs.createWriteStream(tmpPath);
  const response = await drive.files.get({ fileId: latest.id, alt: 'media' }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    response.data.pipe(dest);
    dest.on('finish', resolve);
    dest.on('error', reject);
  });

  fs.copyFileSync(tmpPath, DB_PATH);
  fs.unlinkSync(tmpPath);
  console.log(`[Restore] Restored ${latest.name}`);
  return latest.name;
}
