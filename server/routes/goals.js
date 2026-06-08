import { Router } from 'express';
import { db, todayStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM goals').all();
  const goals = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(goals);
});

router.put('/:key', requireAuth, (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  db.prepare('INSERT OR REPLACE INTO goals (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
    .run(req.params.key, String(value));
  appEvents.emit('broadcast', { type: 'goals_updated', data: { key: req.params.key, value } });
  res.json({ ok: true });
});

// Intentions
router.get('/intention', requireAuth, (req, res) => {
  const date = req.query.date || todayStr();
  const row = db.prepare('SELECT * FROM intentions WHERE date = ?').get(date);
  res.json(row || null);
});

router.post('/intention', requireAuth, (req, res) => {
  const { text, date } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const d = date || todayStr();
  db.prepare('INSERT OR REPLACE INTO intentions (date, text) VALUES (?, ?)').run(d, text);
  res.json({ ok: true });
});

export default router;
