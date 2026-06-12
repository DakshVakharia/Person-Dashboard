import { Router } from 'express';
import { db, todayStr, localDateStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

// Counts consecutive completed days ending today, or ending yesterday if today isn't logged yet
function computeStreak(dates, today) {
  let streak = 0;
  const offset = dates[0] === localDateStr(today) ? 0 : 1;
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i - offset);
    if (dates[i] === localDateStr(expected)) streak++;
    else break;
  }
  return streak;
}

router.get('/', requireAuth, (req, res) => {
  const today = req.query.date || todayStr();
  const habits = db.prepare(`
    SELECT h.*, COALESCE(hl.completed, 0) as completed_today
    FROM habits h
    LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ?
    WHERE h.is_active = 1
    ORDER BY h.sort_order ASC, h.id ASC
  `).all(today);
  res.json(habits);
});

router.post('/', requireAuth, (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare('INSERT INTO habits (name, description, icon) VALUES (?, ?, ?)').run(name, description || null, icon || '✓');
  res.json({ id: info.lastInsertRowid });
});

router.patch('/:id/complete', requireAuth, (req, res) => {
  const { completed = true, date } = req.body;
  const today = date || todayStr();
  db.prepare('INSERT OR REPLACE INTO habit_logs (habit_id, date, completed) VALUES (?, ?, ?)')
    .run(req.params.id, today, completed ? 1 : 0);

  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  logActivity('habit_complete', `${completed ? 'Marked' : 'Unmarked'} "${habit?.name}" ${completed ? 'done' : 'not done'}`, { habit_id: Number(req.params.id), date: today, completed: !!completed });

  appEvents.emit('broadcast', { type: 'habits_updated', data: { date: today } });
  res.json({ ok: true });
});

router.get('/:id/streak', requireAuth, (req, res) => {
  const logs = db.prepare(`
    SELECT date, completed FROM habit_logs
    WHERE habit_id = ? AND completed = 1
    ORDER BY date DESC
  `).all(req.params.id);

  const streak = computeStreak(logs.map(l => l.date), new Date());

  res.json({ streak });
});

// Per-habit completion grid for the current week (Mon..Sun) + streaks — for the Habits modal
router.get('/week', requireAuth, (req, res) => {
  const habits = db.prepare('SELECT * FROM habits WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all();
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (day - 1));

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(localDateStr(d));
  }

  const result = habits.map(h => {
    const logs = db.prepare('SELECT date, completed FROM habit_logs WHERE habit_id = ? AND date IN (' + dates.map(() => '?').join(',') + ')').all(h.id, ...dates);
    const byDate = Object.fromEntries(logs.map(l => [l.date, !!l.completed]));
    const days = dates.map(d => byDate[d] || false);

    const streakLogs = db.prepare('SELECT date FROM habit_logs WHERE habit_id = ? AND completed = 1 ORDER BY date DESC').all(h.id);
    const streak = computeStreak(streakLogs.map(l => l.date), today);

    return { ...h, days, dates, streak };
  });

  res.json({ week_start: dates[0], dates, habits: result });
});

router.get('/streaks', requireAuth, (req, res) => {
  const habits = db.prepare('SELECT * FROM habits WHERE is_active = 1').all();
  const today = new Date();

  const result = habits.map(h => {
    const logs = db.prepare(`
      SELECT date FROM habit_logs WHERE habit_id = ? AND completed = 1 ORDER BY date DESC
    `).all(h.id);

    const streak = computeStreak(logs.map(l => l.date), today);

    return { ...h, streak };
  });

  res.json(result);
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, description, icon, is_active } = req.body;
  db.prepare('UPDATE habits SET name = COALESCE(?, name), description = COALESCE(?, description), icon = COALESCE(?, icon), is_active = COALESCE(?, is_active) WHERE id = ?')
    .run(name, description, icon, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE habits SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
