import { Router } from 'express';
import { db, todayStr, getOrCreateRings } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

router.get('/today', requireAuth, (req, res) => {
  const rings = getOrCreateRings(req.query.date || todayStr());
  const goal = db.prepare("SELECT value FROM goals WHERE key = 'protein_goal'").get();
  res.json({ ...rings, protein_goal: parseInt(goal?.value || '130') });
});

router.patch('/today', requireAuth, (req, res) => {
  const today = todayStr();
  getOrCreateRings(today);
  const { protein_intake, creatine_taken, workout_done, schedule_completion } = req.body;

  const fields = [];
  const vals = [];
  if (protein_intake !== undefined) { fields.push('protein_intake = ?'); vals.push(protein_intake); }
  if (creatine_taken !== undefined) { fields.push('creatine_taken = ?'); vals.push(creatine_taken ? 1 : 0); }
  if (workout_done !== undefined) { fields.push('workout_done = ?'); vals.push(workout_done ? 1 : 0); }
  if (schedule_completion !== undefined) { fields.push('schedule_completion = ?'); vals.push(schedule_completion); }

  if (fields.length) {
    db.prepare(`UPDATE daily_rings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE date = ?`)
      .run(...vals, today);
  }

  const updated = db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today);

  if (creatine_taken !== undefined) logActivity('ring_creatine', creatine_taken ? 'Marked creatine taken' : 'Unmarked creatine', { date: today });
  if (workout_done !== undefined) logActivity('ring_workout', workout_done ? 'Marked workout done' : 'Unmarked workout', { date: today });
  if (protein_intake !== undefined) logActivity('ring_protein', `Set protein intake to ${protein_intake}g`, { date: today, protein_intake });
  if (schedule_completion !== undefined) logActivity('ring_schedule', `Set schedule completion to ${schedule_completion}%`, { date: today, schedule_completion });

  appEvents.emit('broadcast', { type: 'rings_updated', data: updated });
  res.json(updated);
});

router.get('/history', requireAuth, (req, res) => {
  const days = parseInt(req.query.days || '7');
  const rows = db.prepare('SELECT * FROM daily_rings ORDER BY date DESC LIMIT ?').all(days);
  res.json(rows);
});

export default router;
