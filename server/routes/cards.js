import { Router } from 'express';
import { db, periodKey } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// helper: current value for a card's active period
function currentValue(card) {
  const key = periodKey(card.frequency, new Date());
  const row = db.prepare('SELECT value FROM custom_card_logs WHERE card_id = ? AND period_key = ?').get(card.id, key);
  return { period_key: key, current_value: row?.value || 0 };
}

// GET /api/cards — all active custom cards with current-period value
router.get('/', requireAuth, (req, res) => {
  const cards = db.prepare('SELECT * FROM custom_cards WHERE is_active = 1 ORDER BY id ASC').all();
  res.json(cards.map(c => ({ ...c, ...currentValue(c) })));
});

// POST /api/cards — create
router.post('/', requireAuth, (req, res) => {
  const { title, icon, value_label, unit, viz_mode, frequency, target_value } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const viz = ['ring','bar','line'].includes(viz_mode) ? viz_mode : 'ring';
  const freq = ['daily','weekly','monthly'].includes(frequency) ? frequency : 'daily';
  const info = db.prepare(
    'INSERT INTO custom_cards (title, icon, value_label, unit, viz_mode, frequency, target_value) VALUES (?,?,?,?,?,?,?)'
  ).run(title, icon || '📊', value_label || '', unit || '', viz, freq, Number(target_value) || 1);
  res.json({ id: info.lastInsertRowid });
});

// PUT /api/cards/:id — edit
router.put('/:id', requireAuth, (req, res) => {
  const { title, icon, value_label, unit, viz_mode, frequency, target_value } = req.body;
  db.prepare(`UPDATE custom_cards SET
    title = COALESCE(?, title), icon = COALESCE(?, icon), value_label = COALESCE(?, value_label),
    unit = COALESCE(?, unit), viz_mode = COALESCE(?, viz_mode), frequency = COALESCE(?, frequency),
    target_value = COALESCE(?, target_value) WHERE id = ?`).run(
    title ?? null, icon ?? null, value_label ?? null, unit ?? null,
    viz_mode ?? null, frequency ?? null,
    target_value !== undefined ? Number(target_value) : null, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/cards/:id — soft delete
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE custom_cards SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/cards/:id/log — set absolute value or increment for current period
router.post('/:id/log', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM custom_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  const { value, delta } = req.body;
  const key = periodKey(card.frequency, new Date());
  const existing = db.prepare('SELECT value FROM custom_card_logs WHERE card_id = ? AND period_key = ?').get(card.id, key);
  const newValue = value !== undefined ? Number(value) : (existing?.value || 0) + Number(delta ?? 1);
  db.prepare(`INSERT INTO custom_card_logs (card_id, period_key, value, updated_at)
    VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(card_id, period_key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`)
    .run(card.id, key, newValue, newValue);
  res.json({ ok: true, value: newValue, period_key: key });
});

// GET /api/cards/:id/series?n=7 — last N periods (oldest first) for bar/line viz
router.get('/:id/series', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM custom_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  const n = Math.min(parseInt(req.query.n || '7'), 60);
  // Build the last n period keys ending at the current period
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    if (card.frequency === 'weekly') d.setDate(now.getDate() - i * 7);
    else if (card.frequency === 'monthly') d.setMonth(now.getMonth() - i);
    else d.setDate(now.getDate() - i);
    keys.push(periodKey(card.frequency, d));
  }
  const logs = db.prepare('SELECT period_key, value FROM custom_card_logs WHERE card_id = ?').all(card.id);
  const byKey = Object.fromEntries(logs.map(l => [l.period_key, l.value]));
  const series = keys.map(k => ({ period_key: k, value: byKey[k] || 0 }));
  res.json({ card, series });
});

export default router;
