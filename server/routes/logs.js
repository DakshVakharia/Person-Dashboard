import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  try {
    const days = parseInt(req.query.days || '7');
    const logs = [];
    
    // Get past N dates
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const rings = db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(dateStr) || { protein_intake: 0, workout_done: 0 };
      const meals = db.prepare('SELECT * FROM meals WHERE date = ?').all(dateStr);
      const habits = db.prepare(`
        SELECT h.name, h.icon, COALESCE(hl.completed, 0) as completed
        FROM habits h LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ?
        WHERE h.is_active = 1
      `).all(dateStr);
      const weight = db.prepare('SELECT * FROM weight_logs WHERE date = ? LIMIT 1').get(dateStr);
      const goals = db.prepare(`
        SELECT g.title, g.period, g.target_value, g.unit, gp.value, gp.completed
        FROM goal_definitions g
        JOIN goal_progress gp ON gp.goal_id = g.id AND gp.period_key = ?
        WHERE g.is_active = 1
      `).all(dateStr);

      logs.push({
        date: dateStr,
        rings,
        meals,
        habits,
        weight,
        goals
      });
    }

    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Raw, timestamped activity feed — what cowork reads to generate weekly reports
router.get('/activity', requireAuth, (req, res) => {
  try {
    const { since, until, action, limit = '500' } = req.query;
    const clauses = [];
    const params = [];

    if (since) { clauses.push('created_at >= ?'); params.push(since); }
    if (until) { clauses.push('created_at <= ?'); params.push(until); }
    if (action) { clauses.push('action = ?'); params.push(action); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ?
    `).all(...params, parseInt(limit));

    res.json(rows.map(r => ({ ...r, details: r.details ? JSON.parse(r.details) : null })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reports', requireAuth, (req, res) => {
  try {
    const reports = db.prepare('SELECT * FROM weekly_reports ORDER BY id DESC LIMIT 10').all();
    res.json(reports);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
