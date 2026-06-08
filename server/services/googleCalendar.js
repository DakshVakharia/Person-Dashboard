import { google } from 'googleapis';
import { db } from '../db.js';

function getAuthClient(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
  });

  // Persist refreshed tokens
  oauth2Client.on('tokens', tokens => {
    if (tokens.access_token) {
      db.prepare('UPDATE users SET access_token = ? WHERE id = ?').run(tokens.access_token, user.id);
    }
    if (tokens.refresh_token) {
      db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(tokens.refresh_token, user.id);
    }
  });

  return oauth2Client;
}

export async function listEvents(user, days = 7, date = null) {
  const auth = getAuthClient(user);
  const calendar = google.calendar({ version: 'v3', auth });

  let start, end;
  if (date) {
    // Single specific day, e.g. '2026-06-08' — local midnight to local midnight
    const [y, m, d] = date.split('-').map(Number);
    start = new Date(y, m - 1, d, 0, 0, 0);
    end = new Date(y, m - 1, d + 1, 0, 0, 0);
  } else {
    const now = new Date();
    // Start from beginning of today so we don't miss events already in progress
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const res = await calendar.events.list({
    calendarId: process.env.DASHBOARD_CALENDAR_ID || user.calendar_id || 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  return res.data.items || [];
}

export async function createEvent(user, { title, start_time, end_time, description, all_day }) {
  const auth = getAuthClient(user);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: title,
    description,
    start: all_day
      ? { date: start_time.split('T')[0] }
      : { dateTime: start_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: all_day
      ? { date: (end_time || start_time).split('T')[0] }
      : { dateTime: end_time || new Date(new Date(start_time).getTime() + 60 * 60 * 1000).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  };

  const res = await calendar.events.insert({
    calendarId: process.env.DASHBOARD_CALENDAR_ID || user.calendar_id || 'primary',
    resource: event,
  });
  return res.data;
}

export async function updateEvent(user, { event_id, title, start_time, end_time, description }) {
  const auth = getAuthClient(user);
  const calendar = google.calendar({ version: 'v3', auth });

  // Fetch existing first
  const existing = await calendar.events.get({
    calendarId: process.env.DASHBOARD_CALENDAR_ID || user.calendar_id || 'primary',
    eventId: event_id,
  });

  const patch = { ...existing.data };
  if (title) patch.summary = title;
  if (description !== undefined) patch.description = description;
  if (start_time) patch.start = { dateTime: start_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  if (end_time) patch.end = { dateTime: end_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };

  const res = await calendar.events.update({
    calendarId: process.env.DASHBOARD_CALENDAR_ID || user.calendar_id || 'primary',
    eventId: event_id,
    resource: patch,
  });
  return res.data;
}

export async function deleteEvent(user, event_id) {
  const auth = getAuthClient(user);
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({
    calendarId: process.env.DASHBOARD_CALENDAR_ID || user.calendar_id || 'primary',
    eventId: event_id,
  });
  return { deleted: true };
}
