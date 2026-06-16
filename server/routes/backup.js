import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { backupToDrive } from '../services/googleDrive.js';
import { db } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/dashboard.db');

const tmpDir = path.join(__dirname, '../data/tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

const router = Router();

router.post('/trigger', requireAuth, async (req, res) => {
  try {
    await backupToDrive();
    res.json({ ok: true, message: 'Backup complete' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/restore', requireAuth, upload.single('db'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    // Copy uploaded file over the live DB (no db.close — server restart picks it up)
    fs.copyFileSync(req.file.path, DB_PATH);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, message: 'Restored. Restart the server to apply changes.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/download', requireAuth, (req, res) => {
  res.download(DB_PATH, 'dashboard.db');
});

export default router;
