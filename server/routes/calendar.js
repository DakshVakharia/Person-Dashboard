import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as cal from '../services/googleCalendar.js';

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

export default router;
