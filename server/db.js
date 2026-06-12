import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'dashboard.db'));

export function initDB() {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT,
      avatar TEXT,
      access_token TEXT,
      refresh_token TEXT,
      calendar_id TEXT DEFAULT 'primary',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_rings (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      protein_intake REAL DEFAULT 0,
      creatine_taken INTEGER DEFAULT 0,
      workout_done INTEGER DEFAULT 0,
      schedule_completion REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      calories REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      meal_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      image_path TEXT
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT,
      remind_at DATETIME NOT NULL,
      recurrence TEXT DEFAULT 'none',
      snoozed_until DATETIME,
      is_active INTEGER DEFAULT 1,
      create_calendar_event INTEGER DEFAULT 0,
      calendar_event_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      weight REAL NOT NULL,
      unit TEXT DEFAULT 'kg',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY,
      muscle_group TEXT NOT NULL,
      sets INTEGER DEFAULT 0,
      week_start_date TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(muscle_group, date)
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '✓',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      UNIQUE(habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS intentions (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS screen_time (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      app_name TEXT NOT NULL,
      package_name TEXT,
      duration_minutes REAL NOT NULL,
      is_flagged INTEGER DEFAULT 0,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      report_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goal_definitions (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('daily','weekly','monthly')),
      target_value REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT '',
      icon TEXT DEFAULT '🎯',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goal_progress (
      id INTEGER PRIMARY KEY,
      goal_id INTEGER NOT NULL,
      period_key TEXT NOT NULL,
      value REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(goal_id, period_key),
      FOREIGN KEY (goal_id) REFERENCES goal_definitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      week_start_date TEXT NOT NULL,
      distance_km REAL NOT NULL,
      pace TEXT,
      cadence INTEGER,
      bpm INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY,
      action TEXT NOT NULL,
      label TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS custom_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      icon TEXT DEFAULT '📊',
      value_label TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      viz_mode TEXT NOT NULL DEFAULT 'ring',
      frequency TEXT NOT NULL DEFAULT 'daily',
      target_value REAL DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS custom_card_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      period_key TEXT NOT NULL,
      value REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(card_id, period_key),
      FOREIGN KEY (card_id) REFERENCES custom_cards(id) ON DELETE CASCADE
    );
  `);

  // Seed default goals
  const defaults = [
    ['protein_goal', '130'],
    ['calorie_goal', '1900'],
    ['weight_unit', 'kg'],
  ];
  const upsertGoal = db.prepare(
    'INSERT OR IGNORE INTO goals (key, value) VALUES (?, ?)'
  );
  defaults.forEach(([k, v]) => upsertGoal.run(k, v));

  // Seed default habits
  const habitCount = db.prepare('SELECT COUNT(*) as c FROM habits').get();
  if (habitCount.c === 0) {
    const insert = db.prepare('INSERT INTO habits (name, icon) VALUES (?, ?)');
    [['Gym', '🏋️'], ['Creatine', '💊'], ['Journaling', '📓'], ['Reading', '📚'], ['Meditation', '🧘']].forEach(
      ([name, icon]) => insert.run(name, icon)
    );
  }

  // Migration: add sort_order to habits for chronological (time-of-day) ordering
  const habitCols = db.prepare("PRAGMA table_info(habits)").all();
  if (!habitCols.some(c => c.name === 'sort_order')) {
    db.exec('ALTER TABLE habits ADD COLUMN sort_order INTEGER DEFAULT 0');
    const order = ['Wake up at 6', 'Meditation', 'Morning Serum', 'Gym', 'Creatine', 'Reading', 'Night Serum', 'Sleep at 11:30'];
    const setOrder = db.prepare('UPDATE habits SET sort_order = ? WHERE name = ?');
    order.forEach((name, i) => setOrder.run(i + 1, name));
    // Any habits not in the list above keep sort_order 0 and will sort first by id
  }

  console.log('Database initialised');
}

// Format a Date using its LOCAL calendar date (not toISOString, which converts
// to UTC first — that's off-by-one near midnight / in timezones ahead of UTC,
// e.g. local midnight Monday in CEST becomes "Sunday 22:00 UTC").
export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return localDateStr(new Date());
}

export function weekStartStr(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7; // Sunday -> 7
  if (day !== 1) date.setDate(date.getDate() - (day - 1)); // back to Monday
  return localDateStr(date);
}

export function monthStr(d = new Date()) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // 'YYYY-MM'
}

// Returns the bucket key a goal's progress should be tracked under for "now"
export function periodKey(period, d = new Date()) {
  if (period === 'weekly') return weekStartStr(d);
  if (period === 'monthly') return monthStr(d);
  return localDateStr(new Date(d)); // daily
}

export function getOrCreateRings(date) {
  const existing = db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(date);
  if (existing) return existing;
  db.prepare('INSERT OR IGNORE INTO daily_rings (date) VALUES (?)').run(date);
  return db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(date);
}
