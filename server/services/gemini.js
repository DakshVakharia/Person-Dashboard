import { GoogleGenerativeAI } from '@google/generative-ai';
import { db, todayStr, getOrCreateRings } from '../db.js';
import { appEvents } from '../events.js';
import * as cal from './googleCalendar.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function broadcast(type, data) {
  appEvents.emit('broadcast', { type, data });
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const toolDefinitions = [
  {
    name: 'update_protein_intake',
    description: 'Update or add to the protein intake for today',
    parameters: {
      type: 'OBJECT',
      properties: {
        grams: { type: 'NUMBER', description: 'Protein in grams' },
        action: { type: 'STRING', enum: ['add', 'set'], description: 'add to total or set absolute value' },
      },
      required: ['grams', 'action'],
    },
  },
  {
    name: 'update_creatine',
    description: 'Mark creatine as taken or not taken today',
    parameters: {
      type: 'OBJECT',
      properties: { taken: { type: 'BOOLEAN' } },
      required: ['taken'],
    },
  },
  {
    name: 'update_workout',
    description: 'Mark workout as completed or not today',
    parameters: {
      type: 'OBJECT',
      properties: { completed: { type: 'BOOLEAN' } },
      required: ['completed'],
    },
  },
  {
    name: 'update_schedule_completion',
    description: 'Set schedule completion percentage for today (0-100)',
    parameters: {
      type: 'OBJECT',
      properties: { percent: { type: 'NUMBER' } },
      required: ['percent'],
    },
  },
  {
    name: 'log_meal',
    description: 'Log a meal with nutritional info.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Meal name/description' },
        calories: { type: 'NUMBER' },
        protein: { type: 'NUMBER', description: 'Protein in grams' },
        carbs: { type: 'NUMBER', description: 'Carbs in grams' },
        fat: { type: 'NUMBER', description: 'Fat in grams' },
        notes: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_meal',
    description: 'Delete a meal log by ID',
    parameters: {
      type: 'OBJECT',
      properties: { meal_id: { type: 'NUMBER' } },
      required: ['meal_id'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder with optional recurrence',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        message: { type: 'STRING' },
        remind_at: { type: 'STRING', description: 'ISO 8601 datetime' },
        recurrence: { type: 'STRING', enum: ['none', 'daily', 'weekly', 'weekdays', 'weekends'] },
        create_calendar_event: { type: 'BOOLEAN' },
      },
      required: ['title', 'remind_at'],
    },
  },
  {
    name: 'snooze_reminder',
    description: 'Snooze an active reminder',
    parameters: {
      type: 'OBJECT',
      properties: {
        reminder_id: { type: 'NUMBER' },
        minutes: { type: 'NUMBER' },
      },
      required: ['reminder_id', 'minutes'],
    },
  },
  {
    name: 'dismiss_reminder',
    description: 'Dismiss/deactivate a reminder',
    parameters: {
      type: 'OBJECT',
      properties: { reminder_id: { type: 'NUMBER' } },
      required: ['reminder_id'],
    },
  },
  {
    name: 'log_weight',
    description: 'Log body weight',
    parameters: {
      type: 'OBJECT',
      properties: {
        weight: { type: 'NUMBER' },
        unit: { type: 'STRING', enum: ['kg', 'lbs'] },
      },
      required: ['weight'],
    },
  },
  {
    name: 'log_workout_set',
    description: 'Log a set for a specific muscle group',
    parameters: {
      type: 'OBJECT',
      properties: {
        muscle_group: { type: 'STRING' }
      },
      required: ['muscle_group'],
    },
  },
  {
    name: 'complete_habit',
    description: 'Mark a habit as complete or incomplete for today',
    parameters: {
      type: 'OBJECT',
      properties: {
        habit_name: { type: 'STRING' },
        completed: { type: 'BOOLEAN' },
      },
      required: ['habit_name', 'completed'],
    },
  },
  {
    name: 'add_habit',
    description: 'Add a new habit to track',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        description: { type: 'STRING' },
        icon: { type: 'STRING', description: 'Emoji icon' },
      },
      required: ['name'],
    },
  },
  {
    name: 'set_intention',
    description: "Save tomorrow's intention",
    parameters: {
      type: 'OBJECT',
      properties: { text: { type: 'STRING' } },
      required: ['text'],
    },
  },
  {
    name: 'update_goal',
    description: 'Update a user goal (protein_goal, calorie_goal, etc.)',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: { type: 'STRING' },
        value: { type: 'STRING' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a Google Calendar event',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        start_time: { type: 'STRING', description: 'ISO 8601' },
        end_time: { type: 'STRING' },
        description: { type: 'STRING' },
        all_day: { type: 'BOOLEAN' },
      },
      required: ['title', 'start_time'],
    },
  },
  {
    name: 'update_calendar_event',
    description: 'Update an existing Google Calendar event by event_id',
    parameters: {
      type: 'OBJECT',
      properties: {
        event_id: { type: 'STRING' },
        title: { type: 'STRING' },
        start_time: { type: 'STRING' },
        end_time: { type: 'STRING' },
        description: { type: 'STRING' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete a Google Calendar event',
    parameters: {
      type: 'OBJECT',
      properties: { event_id: { type: 'STRING' } },
      required: ['event_id'],
    },
  },
  {
    name: 'get_today_summary',
    description: 'Get a full summary of all today\'s data',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'set_access_pin',
    description: 'Set the PIN for accessing the dashboard from other devices',
    parameters: {
      type: 'OBJECT',
      properties: { pin: { type: 'STRING', description: '4-6 digit PIN' } },
      required: ['pin'],
    },
  },
];

// ─── Context Builder ─────────────────────────────────────────────────────────

async function buildContext(user) {
  const today = todayStr();
  const rings = getOrCreateRings(today);
  const meals = db.prepare('SELECT * FROM meals WHERE date = ?').all(today);
  const totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const proteinGoal = parseInt(db.prepare("SELECT value FROM goals WHERE key = 'protein_goal'").get()?.value || '130');
  const calorieGoal = parseInt(db.prepare("SELECT value FROM goals WHERE key = 'calorie_goal'").get()?.value || '2200');
  const habits = db.prepare('SELECT * FROM habits WHERE is_active = 1').all();
  const habitLogs = db.prepare('SELECT * FROM habit_logs WHERE date = ?').all(today);

  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  if (day !== 1) d.setHours(-24 * (day - 1));
  const weekStart = d.toISOString().split('T')[0];
  const workouts = db.prepare('SELECT muscle_group, SUM(sets) as total_sets FROM workout_logs WHERE week_start_date = ? GROUP BY muscle_group').all(weekStart);

  let calendarStr = '';
  if (user) {
    try {
      const events = await cal.listEvents(user, 1);
      calendarStr = events.length
        ? events.map(e => `  - ${e.summary} @ ${e.start?.dateTime || e.start?.date}`).join('\n')
        : '  - No events today';
    } catch {
      calendarStr = '  - (calendar unavailable)';
    }
  }

  return `
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${new Date().toLocaleTimeString()}

RINGS:
  Protein: ${rings.protein_intake}g / ${proteinGoal}g (${Math.round((rings.protein_intake / proteinGoal) * 100)}%)
  Creatine: ${rings.creatine_taken ? 'Taken ✓' : 'Not taken'}
  Workout: ${rings.workout_done ? 'Done ✓' : 'Not done'}
  Schedule: ${rings.schedule_completion}%

NUTRITION (${meals.length} meals):
  Calories: ${Math.round(totalCalories)} / ${calorieGoal} kcal
  Protein: ${Math.round(totalProtein)}g
${meals.map(m => `  - ${m.name}: ${m.calories || '?'}kcal, P:${m.protein || 0}g`).join('\n') || '  - No meals logged'}

HABITS:
${habits.map(h => {
  const log = habitLogs.find(l => l.habit_id === h.id);
  return `  - ${h.icon} ${h.name}: ${log?.completed ? '✓' : '○'}`;
}).join('\n') || '  - None set'}

WORKOUTS THIS WEEK:
${workouts.map(w => `  - ${w.muscle_group}: ${w.total_sets} sets`).join('\n') || '  - None logged'}

TODAY'S CALENDAR:
${calendarStr}`.trim();
}

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function executeTool(name, args, user) {
  const today = todayStr();

  switch (name) {
    case 'update_protein_intake': {
      const rings = getOrCreateRings(today);
      const newVal = args.action === 'add'
        ? rings.protein_intake + args.grams
        : args.grams;
      db.prepare('UPDATE daily_rings SET protein_intake = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
        .run(newVal, today);
      broadcast('rings_updated', db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today));
      return { ok: true, protein_intake: newVal };
    }

    case 'update_creatine': {
      getOrCreateRings(today);
      db.prepare('UPDATE daily_rings SET creatine_taken = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
        .run(args.taken ? 1 : 0, today);
      broadcast('rings_updated', db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today));
      return { ok: true, creatine_taken: args.taken };
    }

    case 'update_workout': {
      getOrCreateRings(today);
      db.prepare('UPDATE daily_rings SET workout_done = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
        .run(args.completed ? 1 : 0, today);
      broadcast('rings_updated', db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today));
      return { ok: true, workout_done: args.completed };
    }

    case 'update_schedule_completion': {
      getOrCreateRings(today);
      const pct = Math.min(100, Math.max(0, args.percent));
      db.prepare('UPDATE daily_rings SET schedule_completion = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
        .run(pct, today);
      broadcast('rings_updated', db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today));
      return { ok: true, schedule_completion: pct };
    }

    case 'log_meal': {
      const info = db.prepare(`
        INSERT INTO meals (date, name, calories, protein, carbs, fat, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(today, args.name, args.calories || 0, args.protein || 0, args.carbs || 0, args.fat || 0, args.notes || null);
      // Auto-update protein ring
      const rings = getOrCreateRings(today);
      if (args.protein) {
        db.prepare('UPDATE daily_rings SET protein_intake = protein_intake + ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?')
          .run(args.protein, today);
        broadcast('rings_updated', db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today));
      }
      broadcast('meals_updated', { date: today });
      return { ok: true, meal_id: info.lastInsertRowid };
    }

    case 'delete_meal': {
      const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(args.meal_id);
      if (!meal) return { error: 'Meal not found' };
      db.prepare('DELETE FROM meals WHERE id = ?').run(args.meal_id);
      if (meal.protein) {
        db.prepare('UPDATE daily_rings SET protein_intake = MAX(0, protein_intake - ?), updated_at = CURRENT_TIMESTAMP WHERE date = ?')
          .run(meal.protein, meal.date);
        broadcast('rings_updated', db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(today));
      }
      broadcast('meals_updated', { date: today });
      return { ok: true };
    }

    case 'set_reminder': {
      const info = db.prepare(`
        INSERT INTO reminders (title, message, remind_at, recurrence, create_calendar_event)
        VALUES (?, ?, ?, ?, ?)
      `).run(args.title, args.message || null, args.remind_at, args.recurrence || 'none', args.create_calendar_event ? 1 : 0);

      if (args.create_calendar_event && user) {
        try {
          const event = await cal.createEvent(user, {
            title: args.title,
            start_time: args.remind_at,
            description: args.message,
          });
          db.prepare('UPDATE reminders SET calendar_event_id = ? WHERE id = ?')
            .run(event.id, info.lastInsertRowid);
        } catch (e) {
          console.error('[Tool] calendar event creation failed:', e.message);
        }
      }
      broadcast('reminders_updated', null);
      return { ok: true, reminder_id: info.lastInsertRowid };
    }

    case 'snooze_reminder': {
      const until = new Date(Date.now() + args.minutes * 60 * 1000).toISOString();
      db.prepare('UPDATE reminders SET snoozed_until = ? WHERE id = ?').run(until, args.reminder_id);
      broadcast('reminder_snoozed', { id: args.reminder_id, until });
      return { ok: true };
    }

    case 'dismiss_reminder': {
      db.prepare('UPDATE reminders SET is_active = 0 WHERE id = ?').run(args.reminder_id);
      broadcast('reminders_updated', null);
      return { ok: true };
    }

    case 'log_weight': {
      db.prepare('INSERT OR REPLACE INTO weight_logs (date, weight, unit) VALUES (?, ?, ?)')
        .run(today, args.weight, args.unit || 'kg');
      broadcast('weight_updated', { date: today, weight: args.weight, unit: args.unit || 'kg' });
      return { ok: true };
    }

    case 'log_workout_set': {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const day = d.getDay() || 7;
      if (day !== 1) d.setHours(-24 * (day - 1));
      const weekStart = d.toISOString().split('T')[0];
      
      db.prepare(`
        INSERT INTO workout_logs (muscle_group, sets, week_start_date, date)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(muscle_group, date) DO UPDATE SET sets = sets + 1, created_at = CURRENT_TIMESTAMP
      `).run(args.muscle_group, weekStart, today);
      broadcast('workouts_updated', { date: today });
      return { ok: true, muscle_group: args.muscle_group };
    }

    case 'complete_habit': {
      const habit = db.prepare("SELECT * FROM habits WHERE LOWER(name) LIKE ? AND is_active = 1")
        .get(`%${args.habit_name.toLowerCase()}%`);
      if (!habit) return { error: `Habit "${args.habit_name}" not found` };
      db.prepare('INSERT OR REPLACE INTO habit_logs (habit_id, date, completed) VALUES (?, ?, ?)')
        .run(habit.id, today, args.completed ? 1 : 0);
      broadcast('habits_updated', { date: today });
      return { ok: true, habit: habit.name, completed: args.completed };
    }

    case 'add_habit': {
      const info = db.prepare('INSERT INTO habits (name, description, icon) VALUES (?, ?, ?)')
        .run(args.name, args.description || null, args.icon || '✓');
      broadcast('habits_updated', { date: today });
      return { ok: true, habit_id: info.lastInsertRowid };
    }

    case 'set_intention': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tStr = tomorrow.toISOString().split('T')[0];
      db.prepare('INSERT OR REPLACE INTO intentions (date, text) VALUES (?, ?)').run(tStr, args.text);
      return { ok: true };
    }

    case 'update_goal': {
      db.prepare('INSERT OR REPLACE INTO goals (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
        .run(args.key, args.value);
      broadcast('goals_updated', { key: args.key, value: args.value });
      return { ok: true };
    }

    case 'create_calendar_event': {
      if (!user) return { error: 'Not authenticated' };
      const event = await cal.createEvent(user, args);
      broadcast('calendar_updated', null);
      return { ok: true, event_id: event.id, link: event.htmlLink };
    }

    case 'update_calendar_event': {
      if (!user) return { error: 'Not authenticated' };
      const event = await cal.updateEvent(user, args);
      broadcast('calendar_updated', null);
      return { ok: true, event_id: event.id };
    }

    case 'delete_calendar_event': {
      if (!user) return { error: 'Not authenticated' };
      await cal.deleteEvent(user, args.event_id);
      broadcast('calendar_updated', null);
      return { ok: true };
    }

    case 'set_access_pin': {
      db.prepare('INSERT OR REPLACE INTO goals (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
        .run('access_pin', String(args.pin));
      return { ok: true, message: `PIN set to ${args.pin}` };
    }

    case 'get_today_summary': {
      const rings = getOrCreateRings(today);
      const meals = db.prepare('SELECT * FROM meals WHERE date = ?').all(today);
      const habits = db.prepare(`
        SELECT h.name, h.icon, COALESCE(hl.completed, 0) as completed
        FROM habits h LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ?
        WHERE h.is_active = 1
      `).all(today);
      const weight = db.prepare('SELECT * FROM weight_logs WHERE date = ? LIMIT 1').get(today);
      const workouts = db.prepare('SELECT muscle_group, sets FROM workout_logs WHERE date = ?').all(today);
      return { rings, meals, habits, weight, workouts, date: today };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main Chat Function ───────────────────────────────────────────────────────

export async function processChat(userMessage, user, imageBase64 = null) {
  const context = await buildContext(user);

  const systemInstruction = `You are the user's personal AI assistant embedded in their smart home dashboard.
Be concise, warm, and action-oriented. Always use tools when data needs to be updated.
When food is mentioned, extract macros and call log_meal automatically without asking.
When times are mentioned for reminders, set them immediately.
When the user says "I weigh X", log_weight immediately.
When the user says "done with X habit" or "took creatine" etc, update appropriately.

CURRENT CONTEXT:
${context}`;

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    systemInstruction,
    tools: [{ functionDeclarations: toolDefinitions }],
  });

  // Load recent chat history
  const historyRows = db.prepare('SELECT role, content FROM chat_history ORDER BY id DESC LIMIT 20').all().reverse();
  const history = historyRows.map(r => ({
    role: r.role,
    parts: [{ text: r.content }],
  }));

  const chat = model.startChat({ history });

  const messageParts = [];
  if (imageBase64) {
    messageParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    messageParts.push({ text: userMessage || 'Analyse this food item. Estimate macros and log the meal.' });
  } else {
    messageParts.push({ text: userMessage });
  }

  let response = await chat.sendMessage(messageParts);
  let iterations = 0;

  while (iterations < 6) {
    const calls = response.response.functionCalls();
    if (!calls || calls.length === 0) break;
    iterations++;

    const functionResults = [];
    for (const call of calls) {
      const result = await executeTool(call.name, call.args, user);
      functionResults.push({
        functionResponse: { name: call.name, response: result },
      });
    }

    response = await chat.sendMessage(functionResults);
  }

  const finalText = response.response.text();

  // Persist to chat history
  db.prepare('INSERT INTO chat_history (role, content) VALUES (?, ?)').run('user', userMessage || '(image)');
  db.prepare('INSERT INTO chat_history (role, content) VALUES (?, ?)').run('model', finalText);

  // Trim history to last 100 messages
  const count = db.prepare('SELECT COUNT(*) as c FROM chat_history').get().c;
  if (count > 100) {
    db.prepare('DELETE FROM chat_history WHERE id IN (SELECT id FROM chat_history ORDER BY id ASC LIMIT ?)').run(count - 100);
  }

  return finalText;
}

// ─── Scheduled Mode Generators ────────────────────────────────────────────────

export async function generateMorningGreeting() {
  const context = await buildContext(null);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
  const result = await model.generateContent(
    `Good morning! Generate a brief, energetic 2-3 sentence morning greeting for the user. Include today's key events from this context and one motivational nudge. Keep it warm and personal.\n\n${context}`
  );
  return result.response.text();
}

export async function generateEveningSummary() {
  const context = await buildContext(null);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
  const result = await model.generateContent(
    `Generate a warm, reflective evening summary for the user. Summarise today's wins (rings, habits, meals) in 3-4 sentences. Ask what they want to focus on tomorrow (their intention). Be encouraging.\n\n${context}`
  );
  return result.response.text();
}

export async function generateWeeklyReport() {
  const context = await buildContext(null);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
  const result = await model.generateContent(
    `Generate a weekly report for the user. Summarise their workouts for the week and any general progress based on the context. Keep it motivating and concise.\n\n${context}`
  );
  return result.response.text();
}
