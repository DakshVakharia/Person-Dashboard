import { Router } from 'express';
import { db, periodKey } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Helper: get all quantities and their current values for a card's active period
function currentValues(card) {
  const key = periodKey(card.frequency, new Date());
  const row = db.prepare('SELECT value FROM custom_card_logs WHERE card_id = ? AND period_key = ?').get(card.id, key);
  let values = {};
  try { values = row?.value ? JSON.parse(row.value) : {}; } catch (e) {}
  const quantities = card.quantities ? JSON.parse(card.quantities) : [];
  return { period_key: key, quantities, current_values: values };
}

// GET /api/cards — all active custom cards with current-period values
router.get('/', requireAuth, (req, res) => {
  const cards = db.prepare('SELECT * FROM custom_cards WHERE is_active = 1 ORDER BY id ASC').all();
  res.json(cards.map(c => ({ ...c, ...currentValues(c) })));
});

// POST /api/cards — create
router.post('/', requireAuth, (req, res) => {
  const { title, icon, value_label, unit, viz_mode, frequency, target_value, quantities } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  // Validate quantities
  let qtys = [];
  if (quantities && Array.isArray(quantities)) {
    qtys = quantities.filter(q => q.name && q.unit).slice(0, 10); // max 10 quantities
  }
  if (qtys.length === 0) {
    // Fallback: if no quantities provided, create one from the legacy value_label/unit
    qtys = [{ name: value_label || 'value', unit: unit || '' }];
  }

  const viz = ['ring','bar','line'].includes(viz_mode) ? viz_mode : 'ring';
  const freq = ['daily','weekly','monthly'].includes(frequency) ? frequency : 'daily';

  const info = db.prepare(
    'INSERT INTO custom_cards (title, icon, value_label, unit, viz_mode, frequency, target_value, quantities) VALUES (?,?,?,?,?,?,?,?)'
  ).run(title, icon || '📊', value_label || '', unit || '', viz, freq, Number(target_value) || 1, JSON.stringify(qtys));

  res.json({ id: info.lastInsertRowid });
});

// PUT /api/cards/:id — edit
router.put('/:id', requireAuth, (req, res) => {
  const { title, icon, value_label, unit, viz_mode, frequency, target_value, quantities } = req.body;

  let qtys = null;
  if (quantities && Array.isArray(quantities)) {
    qtys = quantities.filter(q => q.name && q.unit).slice(0, 10);
    if (qtys.length === 0) qtys = null;
  }

  db.prepare(`UPDATE custom_cards SET
    title = COALESCE(?, title), icon = COALESCE(?, icon), value_label = COALESCE(?, value_label),
    unit = COALESCE(?, unit), viz_mode = COALESCE(?, viz_mode), frequency = COALESCE(?, frequency),
    target_value = COALESCE(?, target_value), quantities = COALESCE(?, quantities)
    WHERE id = ?`).run(
    title ?? null, icon ?? null, value_label ?? null, unit ?? null,
    viz_mode ?? null, frequency ?? null,
    target_value !== undefined ? Number(target_value) : null,
    qtys ? JSON.stringify(qtys) : null,
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE /api/cards/:id — soft delete
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE custom_cards SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/cards/:id/log — log multiple values for current period
router.post('/:id/log', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM custom_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'card not found' });

  const { value, values } = req.body;
  const key = periodKey(card.frequency, new Date());

  // values is an object like {pages: 50, minutes: 30}
  // value is legacy (single number) — convert to {quantity_name: value}
  let newValues = values || {};
  if (value !== undefined && !values) {
    const quantities = card.quantities ? JSON.parse(card.quantities) : [];
    const firstName = quantities[0]?.name || 'value';
    newValues = { [firstName]: Number(value) };
  }

  db.prepare(`INSERT INTO custom_card_logs (card_id, period_key, value, updated_at)
    VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(card_id, period_key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`)
    .run(card.id, key, JSON.stringify(newValues), JSON.stringify(newValues));

  res.json({ ok: true, values: newValues, period_key: key });
});

// GET /api/cards/:id/series?n=7 — last N periods with all values
router.get('/:id/series', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM custom_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'card not found' });

  const n = Math.min(parseInt(req.query.n || '7'), 60);
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    if (card.frequency === 'weekly') d.setDate(now.getDate() - i * 7);
    else if (card.frequency === 'monthly') d.setMonth(now.getMonth() - i);
    else d.setDate(now.getDate() - i);
    keys.push(periodKey(card.frequency, d));
  }

  const logs = db.prepare('SELECT period_key, value FROM custom_card_logs WHERE card_id = ?').all(card.id);
  const byKey = {};
  logs.forEach(l => {
    try { byKey[l.period_key] = JSON.parse(l.value || '{}'); } catch (e) { byKey[l.period_key] = {}; }
  });

  const series = keys.map(k => ({ period_key: k, value: byKey[k] || {} }));
  res.json({ card, series });
});

export default router;
