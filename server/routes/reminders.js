import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const active = req.query.active !== 'false';
  const rows = active
    ? db.prepare('SELECT * FROM reminders WHERE is_active = 1 ORDER BY remind_at ASC').all()
    : db.prepare('SELECT * FROM reminders ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { title, message, remind_at, recurrence, create_calendar_event } = req.body;
  if (!title || !remind_at) return res.status(400).json({ error: 'title and remind_at required' });

  const info = db.prepare(`
    INSERT INTO reminders (title, message, remind_at, recurrence, create_calendar_event)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, message || null, remind_at, recurrence || 'none', create_calendar_event ? 1 : 0);

  appEvents.emit('broadcast', { type: 'reminders_updated', data: null });
  res.json({ id: info.lastInsertRowid });
});

router.patch('/:id/snooze', requireAuth, (req, res) => {
  const { minutes = 10 } = req.body;
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  db.prepare('UPDATE reminders SET snoozed_until = ? WHERE id = ?').run(until, req.params.id);
  logActivity('reminder_snooze', `Snoozed reminder for ${minutes} min`, { id: Number(req.params.id), until });
  appEvents.emit('broadcast', { type: 'reminder_snoozed', data: { id: parseInt(req.params.id), until } });
  res.json({ ok: true, snoozed_until: until });
});

router.patch('/:id/dismiss', requireAuth, (req, res) => {
  db.prepare('UPDATE reminders SET is_active = 0 WHERE id = ?').run(req.params.id);
  logActivity('reminder_dismiss', `Dismissed reminder #${req.params.id}`, { id: Number(req.params.id) });
  appEvents.emit('broadcast', { type: 'reminders_updated', data: null });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  appEvents.emit('broadcast', { type: 'reminders_updated', data: null });
  res.json({ ok: true });
});

export default router;
