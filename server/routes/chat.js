import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { processChat } from '../services/gemini.js';

const router = Router();

router.post('/message', requireAuth, async (req, res) => {
  const { message, image } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'message or image required' });

  try {
    const reply = await processChat(message || '', req.user, image || null);
    res.json({ reply });
  } catch (e) {
    console.error('[Chat] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit || '40');
  const rows = db.prepare('SELECT * FROM chat_history ORDER BY id DESC LIMIT ?').all(limit).reverse();
  res.json(rows);
});

router.delete('/history', requireAuth, (req, res) => {
  db.prepare('DELETE FROM chat_history').run();
  res.json({ ok: true });
});

export default router;
