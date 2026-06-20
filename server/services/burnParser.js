// Uses Groq (free) to parse a natural language workout description into estimated calories burnt

export async function parseBurn(description) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a fitness expert. Given a workout/activity description, estimate calories burnt and return ONLY a JSON object with these fields:
{
  "activity": "clean activity name",
  "calories": number
}
Be realistic. If duration or intensity isn't mentioned, assume a typical moderate session.`,
        },
        {
          role: 'user',
          content: description,
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
