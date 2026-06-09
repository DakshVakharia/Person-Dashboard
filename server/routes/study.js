import { Router } from 'express';
import { db, todayStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/study?date=YYYY-MM-DD
router.get('/', requireAuth, (req, res) => {
  const date = req.query.date || todayStr();
  const sessions = db.prepare('SELECT * FROM study_sessions WHERE date = ? ORDER BY created_at ASC').all(date);
  const total = sessions.reduce((s, r) => s + r.duration_minutes, 0);
  res.json({ date, total_minutes: total, sessions });
});

// POST /api/study
router.post('/', requireAuth, (req, res) => {
  const { title, hours, minutes } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const duration = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
  if (duration <= 0) return res.status(400).json({ error: 'duration must be > 0' });
  const date = todayStr();
  const info = db.prepare(
    'INSERT INTO study_sessions (date, title, duration_minutes) VALUES (?, ?, ?)'
  ).run(date, title.trim(), duration);
  res.json({ ok: true, id: info.lastInsertRowid, date, title, duration_minutes: duration });
});

// DELETE /api/study/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM study_sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
