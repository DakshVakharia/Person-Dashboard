import { Router } from 'express';
import { db, todayStr, localDateStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseBurn } from '../services/burnParser.js';
import { appEvents } from '../events.js';

const router = Router();

// GET /api/calories?date=YYYY-MM-DD
router.get('/', requireAuth, (req, res) => {
  const date = req.query.date || todayStr();
  const entries = db.prepare('SELECT * FROM calorie_burns WHERE date = ? ORDER BY created_at ASC').all(date);
  const total = entries.reduce((s, r) => s + r.calories, 0);
  res.json({ date, total, entries });
});

// GET /api/calories/week
router.get('/week', requireAuth, (req, res) => {
  const today = new Date();
  const day = today.getDay() || 7; // Sunday -> 7
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

  const entries = db.prepare('SELECT date, calories FROM calorie_burns WHERE date IN (' + dates.map(() => '?').join(',') + ')').all(...dates);
  entries.forEach(e => { dailyTotals[e.date] = (dailyTotals[e.date] || 0) + e.calories; });

  res.json({ week_start: dates[0], dates, dailyTotals });
});

// POST /api/calories — manual log (e.g. from a habit checkbox prompt)
router.post('/', requireAuth, (req, res) => {
  const { activity, calories, date: bodyDate } = req.body;
  const cals = parseFloat(calories);
  if (!activity || !cals || cals <= 0) return res.status(400).json({ error: 'activity and positive calories required' });
  const date = bodyDate || todayStr();
  const info = db.prepare('INSERT INTO calorie_burns (date, activity, calories) VALUES (?, ?, ?)').run(date, activity.trim(), cals);
  appEvents.emit('broadcast', { type: 'calories_burnt_updated', data: { date } });
  res.json({ ok: true, id: info.lastInsertRowid, date, activity, calories: cals });
});

// POST /api/calories/parse — natural language → estimated calories → logged
router.post('/parse', requireAuth, async (req, res) => {
  const { text, date: bodyDate } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const burn = await parseBurn(text);
    const date = bodyDate || todayStr();
    const info = db.prepare('INSERT INTO calorie_burns (date, activity, calories) VALUES (?, ?, ?)')
      .run(date, burn.activity || text, burn.calories || 0);
    appEvents.emit('broadcast', { type: 'calories_burnt_updated', data: { date } });
    res.json({ ok: true, id: info.lastInsertRowid, date, ...burn });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/calories/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM calorie_burns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
