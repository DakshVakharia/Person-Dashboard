import { Router } from 'express';
import { db, todayStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const days = parseInt(req.query.days || '30');
  const rows = db.prepare('SELECT * FROM weight_logs ORDER BY date DESC LIMIT ?').all(days);
  res.json(rows.reverse());
});

router.post('/', requireAuth, (req, res) => {
  const { weight, unit = 'kg', date } = req.body;
  if (!weight) return res.status(400).json({ error: 'weight required' });
  const d = date || todayStr();
  db.prepare('INSERT OR REPLACE INTO weight_logs (date, weight, unit) VALUES (?, ?, ?)').run(d, weight, unit);
  logActivity('weight_log', `Logged weight: ${weight}${unit}`, { date: d, weight, unit });
  appEvents.emit('broadcast', { type: 'weight_updated', data: { date: d, weight, unit } });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM weight_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
