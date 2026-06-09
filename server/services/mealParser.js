// Uses Groq (free) to parse a natural language meal description into macros

export async function parseMeal(description) {
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
          content: `You are a nutrition expert. Given a meal description, estimate the macros and return ONLY a JSON object with these fields:
{
  "name": "clean meal name",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams)
}
Be realistic with portions. If no portion is mentioned, assume a normal single serving.`,
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
