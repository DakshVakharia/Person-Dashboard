import { Router } from 'express';
import { db, todayStr, weekStartStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const weekStart = weekStartStr();
  const rows = db.prepare('SELECT muscle_group, SUM(sets) as total_sets FROM workout_logs WHERE week_start_date = ? GROUP BY muscle_group').all(weekStart);
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { muscle_group } = req.body;
  if (!muscle_group) return res.status(400).json({ error: 'muscle_group required' });
  
  const date = todayStr();
  const weekStart = weekStartStr();
  
  // Insert or increment sets
  db.prepare(`
    INSERT INTO workout_logs (muscle_group, sets, week_start_date, date)
    VALUES (?, 1, ?, ?)
    ON CONFLICT(muscle_group, date) DO UPDATE SET sets = sets + 1, created_at = CURRENT_TIMESTAMP
  `).run(muscle_group, weekStart, date);

  logActivity('workout_log', `Logged a set for ${muscle_group}`, { muscle_group, date, week_start: weekStart });
  appEvents.emit('broadcast', { type: 'workouts_updated', data: { date } });
  res.json({ ok: true });
});

router.post('/decrement', requireAuth, (req, res) => {
  const { muscle_group } = req.body;
  if (!muscle_group) return res.status(400).json({ error: 'muscle_group required' });

  const date = todayStr();
  const row = db.prepare('SELECT sets FROM workout_logs WHERE muscle_group = ? AND date = ?').get(muscle_group, date);
  if (row && row.sets > 0) {
    db.prepare('UPDATE workout_logs SET sets = sets - 1 WHERE muscle_group = ? AND date = ?').run(muscle_group, date);
    logActivity('workout_log', `Removed a set for ${muscle_group}`, { muscle_group, date });
  }

  appEvents.emit('broadcast', { type: 'workouts_updated', data: { date } });
  res.json({ ok: true });
});

export default router;
