// Uses Groq (free) to parse a natural language event description into calendar fields

export async function parseCalendarEvent(description, existingEvents = []) {
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const pad = n => String(n).padStart(2, '0');
  const todayContext = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} (${dayNames[now.getDay()]})`;

  const eventsCtx = existingEvents.length
    ? '\n\nExisting events:\n' + existingEvents.map(ev => {
        const t = ev.start?.dateTime
          ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : 'all-day';
        return `  id="${ev.id}" title="${ev.summary}" time=${t}`;
      }).join('\n')
    : '';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a calendar assistant. Return ONLY this JSON:
{
  "action": "create",
  "event_id": null,
  "title": "clean event title",
  "start_time": "YYYY-MM-DDTHH:MM:00",
  "end_time":   "YYYY-MM-DDTHH:MM:00",
  "all_day":    false,
  "description": ""
}

Rules:
- action must be "create", "update", or "delete"
- For update/delete, set event_id to the matching id from the existing events list; if no match leave null
- For create, event_id is always null
- Use 24-hour time. Do NOT append Z or timezone offset — local time only
- If no end time mentioned, end_time = start_time + 1 hour
- If all-day (no specific time), all_day=true and use "YYYY-MM-DDT00:00:00" for times
- Resolve relative dates ("tomorrow", "next Monday", "this Friday") using the provided current date
- For update, include updated title/start_time/end_time even if only one field changes`,
        },
        {
          role: 'user',
          content: `Today is ${todayContext}.${eventsCtx}\n\nInstruction: ${description}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}
