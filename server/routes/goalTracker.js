import { Router } from 'express';
import { db, periodKey } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

function withProgress(goal, key) {
  const progress = db.prepare('SELECT * FROM goal_progress WHERE goal_id = ? AND period_key = ?').get(goal.id, key);
  return {
    ...goal,
    period_key: key,
    value: progress?.value || 0,
    completed: !!progress?.completed,
  };
}

// List active goals with their progress for the current period (today/this week/this month)
router.get('/', requireAuth, (req, res) => {
  const goals = db.prepare('SELECT * FROM goal_definitions WHERE is_active = 1 ORDER BY period, id').all();
  let now = new Date();
  if (req.query.date) {
    const [y, m, d] = req.query.date.split('-').map(Number);
    now = new Date(y, m - 1, d);
  }
  res.json(goals.map(g => withProgress(g, periodKey(g.period, now))));
});

router.post('/', requireAuth, (req, res) => {
  const { title, period, target_value, unit, icon } = req.body;
  if (!title || !['daily', 'weekly', 'monthly'].includes(period)) {
    return res.status(400).json({ error: 'title and valid period (daily|weekly|monthly) required' });
  }
  const info = db.prepare(`
    INSERT INTO goal_definitions (title, period, target_value, unit, icon)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, period, target_value ?? 1, unit || '', icon || '🎯');

  logActivity('goal_created', `Created ${period} goal "${title}"`, { goal_id: info.lastInsertRowid });
  appEvents.emit('broadcast', { type: 'goal_tracker_updated', data: null });
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requireAuth, (req, res) => {
  const { title, period, target_value, unit, icon, is_active } = req.body;
  db.prepare(`
    UPDATE goal_definitions SET
      title = COALESCE(?, title),
      period = COALESCE(?, period),
      target_value = COALESCE(?, target_value),
      unit = COALESCE(?, unit),
      icon = COALESCE(?, icon),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    title ?? null,
    period ?? null,
    target_value ?? null,
    unit ?? null,
    icon ?? null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    req.params.id
  );
  appEvents.emit('broadcast', { type: 'goal_tracker_updated', data: null });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE goal_definitions SET is_active = 0 WHERE id = ?').run(req.params.id);
  appEvents.emit('broadcast', { type: 'goal_tracker_updated', data: null });
  res.json({ ok: true });
});

// Log progress toward a goal for the current period — increments by default, or sets an absolute value
router.post('/:id/progress', requireAuth, (req, res) => {
  const goal = db.prepare('SELECT * FROM goal_definitions WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'goal not found' });

  const { delta, value, date } = req.body;
  let when = new Date();
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    when = new Date(y, m - 1, d);
  }
  const key = periodKey(goal.period, when);
  const existing = db.prepare('SELECT * FROM goal_progress WHERE goal_id = ? AND period_key = ?').get(goal.id, key);

  const newValue = value !== undefined ? Number(value) : (existing?.value || 0) + Number(delta ?? 1);
  const completed = newValue >= goal.target_value ? 1 : 0;

  db.prepare(`
    INSERT INTO goal_progress (goal_id, period_key, value, completed, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(goal_id, period_key) DO UPDATE SET value = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
  `).run(goal.id, key, newValue, completed, newValue, completed);

  logActivity('goal_progress', `${goal.title}: ${newValue}${goal.unit ? ' ' + goal.unit : ''} / ${goal.target_value}${goal.unit ? ' ' + goal.unit : ''}`, {
    goal_id: goal.id, period_key: key, value: newValue, completed: !!completed
  });
  appEvents.emit('broadcast', { type: 'goal_tracker_updated', data: { goal_id: goal.id, period_key: key } });
  res.json({ ok: true, value: newValue, completed: !!completed });
});

// History of progress entries for a goal (most recent first)
router.get('/:id/history', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit || '12');
  const rows = db.prepare(`
    SELECT * FROM goal_progress WHERE goal_id = ? ORDER BY period_key DESC LIMIT ?
  `).all(req.params.id, limit);
  res.json(rows);
});

export default router;
