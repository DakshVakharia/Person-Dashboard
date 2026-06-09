import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as cal from '../services/googleCalendar.js';
import { parseCalendarEvent } from '../services/calendarParser.js';

const router = Router();

router.get('/events', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days || '7');
    const events = await cal.listEvents(req.user, days, req.query.date || null);
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/events', requireAuth, async (req, res) => {
  try {
    const event = await cal.createEvent(req.user, req.body);
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/events/:id', requireAuth, async (req, res) => {
  try {
    const event = await cal.updateEvent(req.user, { ...req.body, event_id: req.params.id });
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    await cal.deleteEvent(req.user, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/calendar/parse — natural language → create / update / delete
router.post('/parse', requireAuth, async (req, res) => {
  const { text, events } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const parsed = await parseCalendarEvent(text, events || []);
    if (parsed.action === 'delete' && parsed.event_id) {
      await cal.deleteEvent(req.user, parsed.event_id);
      return res.json({ ok: true, action: 'delete' });
    }
    if (parsed.action === 'update' && parsed.event_id) {
      const event = await cal.updateEvent(req.user, { ...parsed, event_id: parsed.event_id });
      return res.json({ ok: true, action: 'update', event });
    }
    const event = await cal.createEvent(req.user, parsed);
    res.json({ ok: true, action: 'create', event });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
