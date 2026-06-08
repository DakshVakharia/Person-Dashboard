import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { backupToDrive } from '../services/googleDrive.js';

const router = Router();

router.post('/trigger', requireAuth, async (req, res) => {
  try {
    await backupToDrive();
    res.json({ ok: true, message: 'Backup complete' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
