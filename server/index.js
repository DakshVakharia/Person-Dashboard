// env loaded via --env-file=.env flag
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const connectSqlite3 = require('connect-sqlite3');
import { initDB, db } from './db.js';
import { appEvents } from './events.js';

import './services/passport.js';
import authRoutes from './routes/auth.js';
import ringsRoutes from './routes/rings.js';
import mealsRoutes from './routes/meals.js';
import remindersRoutes from './routes/reminders.js';
import weightRoutes from './routes/weight.js';
import habitsRoutes from './routes/habits.js';
import calendarRoutes from './routes/calendar.js';
import goalsRoutes from './routes/goals.js';
import workoutsRoutes from './routes/workouts.js';
import logsRoutes from './routes/logs.js';
import goalTrackerRoutes from './routes/goalTracker.js';
import runsRoutes from './routes/runs.js';
import backupRoutes from './routes/backup.js';
import chatRoutes from './routes/chat.js';
import studyRoutes from './routes/study.js';
import cardsRoutes from './routes/cards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data and uploads dirs exist
['data', 'uploads'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const app = express();
const server = createServer(app);
export const wss = new WebSocketServer({ server });

const SQLiteStore = connectSqlite3(session);

// Trust Cloudflare / reverse proxy so req.secure works correctly
app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'dashboard-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// IP Whitelist Middleware - hardcoded devices only
const allowedIpsStr = process.env.ALLOWED_IPS || '127.0.0.1,::1,::ffff:127.0.0.1';
const ALLOWED_IPS = allowedIpsStr.split(',').map(ip => ip.trim());

app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  if (!ALLOWED_IPS.includes(clientIp)) {
    console.log(`[Security] Blocked unauthorized IP: ${clientIp}`);
    return res.status(403).send('Forbidden: Your IP is not authorized to access this dashboard.');
  }
  next();
});


// Auto-login middleware — single user personal dashboard, no login needed
app.use((req, res, next) => {
  if (req.isAuthenticated()) return next();
  // Only skip auto-login for the actual OAuth flow routes
  if (req.path.startsWith('/api/auth/google')) return next();

  // Ensure a default user exists
  const existing = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!existing) {
    db.prepare(`INSERT OR IGNORE INTO users (google_id, email, name) VALUES ('local', 'local@dashboard', 'Dashboard User')`).run();
  }
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  req.login(user, err => { if (err) return next(err); next(); });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rings', ringsRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/goal-tracker', goalTrackerRoutes);
app.use('/api/runs', runsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/cards', cardsRoutes);

// Serve the new static dashboard front-end (Dashboard.html) — same-origin so
// fetch()/WebSocket calls share the session cookie. Takes priority over the
// old React build's catch-all below.
const dashboardHtmlPath = path.join(__dirname, '../Dashboard.html');
const mobilHtmlPath = path.join(__dirname, '../Dashboard Mobile.html');

const isMobile = (req) => {
  const ua = req.headers['user-agent'] || '';
  return /android|iphone|ipad|ipod|mobile|phone/i.test(ua);
};

if (fs.existsSync(dashboardHtmlPath)) {
  app.get(['/', '/Dashboard.html', '/dashboard'], (req, res) => {
    if (isMobile(req) && fs.existsSync(mobilHtmlPath)) return res.sendFile(mobilHtmlPath);
    res.sendFile(dashboardHtmlPath);
  });
}

// Keep /mobile as explicit override (force mobile view on any device)
if (fs.existsSync(mobilHtmlPath)) {
  app.get(['/mobile', '/mobile.html'], (req, res) => res.sendFile(mobilHtmlPath));
}

// Small standalone "rings" widget — meant to be opened in its own floating,
// always-on-top borderless window (see widget.html for details).
const widgetHtmlPath = path.join(__dirname, '../widget.html');
if (fs.existsSync(widgetHtmlPath)) {
  app.get(['/widget', '/widget.html'], (req, res) => res.sendFile(widgetHtmlPath));
}

// Serve built React app in production
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) =>
    res.sendFile(path.join(clientDist, 'index.html'))
  );
}

// WebSocket — broadcast helper via event bus
wss.on('connection', ws => {
  console.log('[WS] client connected');
  ws.on('close', () => console.log('[WS] client disconnected'));
  ws.on('error', err => console.error('[WS] error', err.message));
});

appEvents.on('broadcast', ({ type, data }) => {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
});

export function broadcast(type, data) {
  appEvents.emit('broadcast', { type, data });
}

// Scheduled jobs
cron.schedule('* * * * *', async () => {
  const { checkReminders } = await import('./services/scheduler.js');
  checkReminders();
});

cron.schedule('0 22 * * *', async () => {
  const { syncDailyWorkoutToCalendar } = await import('./services/scheduler.js');
  syncDailyWorkoutToCalendar();
});

cron.schedule('0 3 * * *', async () => {
  const { backupToDrive } = await import('./services/googleDrive.js');
  backupToDrive().catch(e => console.error('[Backup] Failed:', e.message));
});

const PORT = process.env.PORT || 3001;
initDB();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard server → http://0.0.0.0:${PORT}`);
});
