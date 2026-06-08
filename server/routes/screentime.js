import { Router } from 'express';
import { db, todayStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';

const router = Router();

const FLAGGED_APPS = [
  'com.instagram.android',
  'com.google.android.youtube',
  'com.zhiliaoapp.musically', // TikTok
  'com.ss.android.ugc.trill',
  'com.snapchat.android',
];

const FLAGGED_KEYWORDS = ['instagram', 'youtube', 'tiktok', 'shorts', 'snapchat'];

function isFlagged(appName, packageName) {
  const name = (appName || '').toLowerCase();
  const pkg = (packageName || '').toLowerCase();
  return FLAGGED_APPS.includes(pkg) || FLAGGED_KEYWORDS.some(k => name.includes(k) || pkg.includes(k));
}

// POST /api/screentime — called by Android companion app
router.post('/', (req, res) => {
  const { date, apps } = req.body;
  if (!apps || !Array.isArray(apps)) return res.status(400).json({ error: 'apps array required' });

  const d = date || todayStr();
  const insert = db.prepare(`
    INSERT INTO screen_time (date, app_name, package_name, duration_minutes, is_flagged)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Clear existing records for this date first (idempotent)
  db.prepare('DELETE FROM screen_time WHERE date = ?').run(d);

  const insertMany = db.transaction(appList => {
    for (const app of appList) {
      const flagged = isFlagged(app.app_name, app.package_name);
      insert.run(d, app.app_name, app.package_name || null, app.duration_minutes || 0, flagged ? 1 : 0);
    }
  });
  insertMany(apps);

  appEvents.emit('broadcast', { type: 'screentime_updated', data: { date: d } });
  res.json({ ok: true, count: apps.length });
});

router.get('/', requireAuth, (req, res) => {
  const date = req.query.date || todayStr();
  const rows = db.prepare('SELECT * FROM screen_time WHERE date = ? ORDER BY duration_minutes DESC').all(date);
  const total = rows.reduce((s, r) => s + r.duration_minutes, 0);
  const flaggedTotal = rows.filter(r => r.is_flagged).reduce((s, r) => s + r.duration_minutes, 0);
  res.json({ date, total_minutes: total, flagged_minutes: flaggedTotal, apps: rows });
});

router.get('/summary', requireAuth, (req, res) => {
  const days = parseInt(req.query.days || '7');
  const rows = db.prepare(`
    SELECT date, SUM(duration_minutes) as total,
    SUM(CASE WHEN is_flagged = 1 THEN duration_minutes ELSE 0 END) as flagged
    FROM screen_time
    GROUP BY date
    ORDER BY date DESC
    LIMIT ?
  `).all(days);
  res.json(rows);
});

export default router;
