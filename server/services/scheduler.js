import { db, todayStr, getOrCreateRings } from '../db.js';
import { appEvents } from '../events.js';
import * as cal from './googleCalendar.js';

function broadcast(type, data) {
  appEvents.emit('broadcast', { type, data });
}

export function checkReminders() {
  const now = new Date();
  const nowStr = now.toISOString();

  const due = db.prepare(`
    SELECT * FROM reminders
    WHERE is_active = 1
      AND (snoozed_until IS NULL OR snoozed_until < ?)
      AND remind_at <= ?
  `).all(nowStr, nowStr);

  for (const reminder of due) {
    broadcast('reminder', {
      id: reminder.id,
      title: reminder.title,
      message: reminder.message,
    });

    if (reminder.recurrence === 'none') {
      db.prepare('UPDATE reminders SET is_active = 0 WHERE id = ?').run(reminder.id);
    } else {
      const next = nextOccurrence(reminder);
      db.prepare('UPDATE reminders SET remind_at = ?, snoozed_until = NULL WHERE id = ?').run(
        next.toISOString(), reminder.id
      );
    }
  }
}

function nextOccurrence(reminder) {
  const base = new Date(reminder.remind_at);
  const now = new Date();
  let next = new Date(base);

  while (next <= now) {
    switch (reminder.recurrence) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'weekdays': {
        next.setDate(next.getDate() + 1);
        while ([0, 6].includes(next.getDay())) next.setDate(next.getDate() + 1);
        break;
      }
      case 'weekends': {
        next.setDate(next.getDate() + 1);
        while (![0, 6].includes(next.getDay())) next.setDate(next.getDate() + 1);
        break;
      }
      default:
        next.setDate(next.getDate() + 1);
    }
  }
  return next;
}

export async function syncDailyWorkoutToCalendar() {
  const today = todayStr();
  const workouts = db.prepare('SELECT muscle_group, sets FROM workout_logs WHERE date = ?').all(today);
  if (workouts.length === 0) return;

  const summary = workouts.map(w => `${w.muscle_group} (${w.sets})`).join(', ');
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user || !user.access_token) return;

  try {
    const now = new Date();
    await cal.createEvent(user, {
      title: `Workout: ${summary}`,
      start_time: now.toISOString(),
      description: 'Daily workout summary auto-logged by Dashboard',
      all_day: true
    });
    console.log('[Scheduler] Synced workout to calendar');
  } catch (e) {
    console.error('[Scheduler] Calendar sync failed:', e.message);
  }
}

