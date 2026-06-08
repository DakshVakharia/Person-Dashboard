import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { db, todayStr } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { processChat } from '../services/gemini.js';
import { appEvents } from '../events.js';
import { logActivity } from '../services/activityLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_, file, cb) => cb(null, `meal-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const date = req.query.date || todayStr();
  const meals = db.prepare('SELECT * FROM meals WHERE date = ? ORDER BY meal_time ASC').all(date);
  res.json(meals);
});

router.post('/', requireAuth, (req, res) => {
  const today = todayStr();
  const { name, calories, protein, carbs, fat, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const info = db.prepare(`
    INSERT INTO meals (date, name, calories, protein, carbs, fat, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(today, name, calories || 0, protein || 0, carbs || 0, fat || 0, notes || null);

  if (protein) {
    db.prepare('UPDATE daily_rings SET protein_intake = protein_intake + ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
      .run(protein, today);
    appEvents.emit('broadcast', { type: 'rings_updated', data: db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today) });
  }
  logActivity('meal_log', `Logged meal "${name}" (${calories || 0} kcal, ${protein || 0}g protein)`, { meal_id: info.lastInsertRowid, date: today, calories, protein, carbs, fat });
  appEvents.emit('broadcast', { type: 'meals_updated', data: { date: today } });
  res.json({ id: info.lastInsertRowid });
});

router.post('/photo', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const imageData = fs.readFileSync(req.file.path);
    const base64 = imageData.toString('base64');
    const reply = await processChat('Analyse this food and log it as a meal.', req.user, base64);
    res.json({ reply, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, calories, protein, carbs, fat, notes } = req.body;
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE meals SET name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, notes = ?
    WHERE id = ?
  `).run(name || meal.name, calories ?? meal.calories, protein ?? meal.protein,
         carbs ?? meal.carbs, fat ?? meal.fat, notes ?? meal.notes, meal.id);

  // Recalc protein for the day
  const today = meal.date;
  const totals = db.prepare('SELECT SUM(protein) as p FROM meals WHERE date = ?').get(today);
  db.prepare('UPDATE daily_rings SET protein_intake = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
    .run(totals.p || 0, today);
  appEvents.emit('broadcast', { type: 'rings_updated', data: db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today) });
  appEvents.emit('broadcast', { type: 'meals_updated', data: { date: today } });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM meals WHERE id = ?').run(meal.id);

  const totals = db.prepare('SELECT SUM(protein) as p FROM meals WHERE date = ?').get(meal.date);
  db.prepare('UPDATE daily_rings SET protein_intake = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
    .run(totals.p || 0, meal.date);
  appEvents.emit('broadcast', { type: 'rings_updated', data: db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(meal.date) });
  appEvents.emit('broadcast', { type: 'meals_updated', data: { date: meal.date } });
  res.json({ ok: true });
});

export default router;
