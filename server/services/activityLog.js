import { db } from '../db.js';
import { appEvents } from '../events.js';

// Records a single user action (button click / log entry) for cowork's weekly reports.
export function logActivity(action, label, details = null) {
  db.prepare('INSERT INTO activity_log (action, label, details) VALUES (?, ?, ?)')
    .run(action, label || null, details ? JSON.stringify(details) : null);
  appEvents.emit('broadcast', { type: 'activity_logged', data: { action, label } });
}
