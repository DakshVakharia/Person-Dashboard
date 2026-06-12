import { Router } from 'express';
import { db, todayStr, localDateStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/study?date=YYYY-MM-DD
router.get('/', requireAuth, (req, res) => {
  const date = req.query.date || todayStr();
  const sessions = db.prepare('SELECT * FROM study_sessions WHERE date = ? ORDER BY created_at ASC').all(date);
  const total = sessions.reduce((s, r) => s + r.duration_minutes, 0);
  res.json({ date, total_minutes: total, sessions });
});

// GET /api/study/week
router.get('/week', requireAuth, (req, res) => {
  const today = new Date();
  const day = today.getDay() || 7;  // Sunday = 7
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (day - 1));

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(localDateStr(d));
  }

  const dailyTotals = {};
  dates.forEach(d => { dailyTotals[d] = 0; });

  const sessions = db.prepare('SELECT date, duration_minutes FROM study_sessions WHERE date IN (' + dates.map(() => '?').join(',') + ')').all(...dates);
  sessions.forEach(s => {
    dailyTotals[s.date] = (dailyTotals[s.date] || 0) + s.duration_minutes;
  });

  res.json({ week_start: dates[0], dates, dailyTotals });
});

// POST /api/study
router.post('/', requireAuth, (req, res) => {
  const { title, hours, minutes, date: bodyDate } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const duration = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
  if (duration <= 0) return res.status(400).json({ error: 'duration must be > 0' });
  const date = bodyDate || todayStr();
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
