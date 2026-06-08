import { Router } from 'express';
import { db, todayStr, weekStartStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

function paceToSeconds(pace) {
  if (!pace) return null;
  const [m, s] = String(pace).split(':').map(Number);
  if (Number.isNaN(m)) return null;
  return m * 60 + (s || 0);
}

function secondsToPace(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// This week's runs — bar chart (Mon..Sun) + summary
router.get('/week', requireAuth, (req, res) => {
  const weekStart = weekStartStr();
  const rows = db.prepare('SELECT * FROM runs WHERE week_start_date = ? ORDER BY date ASC').all(weekStart);

  const days = [];
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const run = rows.find(r => r.date === dateStr);
    days.push({ date: dateStr, distance_km: run?.distance_km || 0 });
  }

  const totalDistance = rows.reduce((s, r) => s + r.distance_km, 0);
  res.json({
    week_start: weekStart,
    runs: rows,
    days,
    total_runs: rows.length,
    total_distance_km: Math.round(totalDistance * 10) / 10,
  });
});

// Weekly aggregates for trend chart — last N weeks
router.get('/trend', requireAuth, (req, res) => {
  const weeks = parseInt(req.query.weeks || '24');
  const rows = db.prepare(`
    SELECT week_start_date,
           SUM(distance_km) as distance,
           AVG(CASE WHEN pace IS NOT NULL THEN 1 ELSE NULL END) as has_pace
    FROM runs
    GROUP BY week_start_date
    ORDER BY week_start_date DESC
    LIMIT ?
  `).all(weeks);

  const result = rows.reverse().map(r => {
    const paceRows = db.prepare('SELECT pace FROM runs WHERE week_start_date = ? AND pace IS NOT NULL').all(r.week_start_date);
    const paceSecs = paceRows.map(p => paceToSeconds(p.pace)).filter(s => s != null);
    const avgPaceSec = paceSecs.length ? paceSecs.reduce((a, b) => a + b, 0) / paceSecs.length : null;
    // Rough VO2max proxy derived from average pace, scaled to a believable recreational-runner range
    const vo2 = avgPaceSec
      ? Math.round((55 - Math.min(Math.max(avgPaceSec - 240, 0), 180) / 180 * 17) * 10) / 10
      : null;

    return {
      week_start: r.week_start_date,
      distance_km: Math.round(r.distance * 10) / 10,
      avg_pace_sec: avgPaceSec ? Math.round(avgPaceSec) : null,
      avg_pace: secondsToPace(avgPaceSec),
      vo2max: vo2,
    };
  });

  res.json(result);
});

router.post('/', requireAuth, (req, res) => {
  const { distance_km, pace, cadence, bpm, date } = req.body;
  if (!distance_km) return res.status(400).json({ error: 'distance_km required' });

  const d = date || todayStr();
  const weekStart = weekStartStr(new Date(d));

  const info = db.prepare(`
    INSERT INTO runs (date, week_start_date, distance_km, pace, cadence, bpm)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(d, weekStart, distance_km, pace || null, cadence || null, bpm || null);

  logActivity('run_log', `Logged a ${distance_km}km run${pace ? ` @ ${pace}/km` : ''}`, { run_id: info.lastInsertRowid, date: d, distance_km, pace, cadence, bpm });
  appEvents.emit('broadcast', { type: 'runs_updated', data: { date: d } });
  res.json({ id: info.lastInsertRowid });
});

export default router;
