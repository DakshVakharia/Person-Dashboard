const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const auth = {
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

export const rings = {
  today: () => request('/rings/today'),
  update: body => request('/rings/today', { method: 'PATCH', body }),
  history: (days = 7) => request(`/rings/history?days=${days}`),
};

export const meals = {
  list: (date) => request(`/meals${date ? `?date=${date}` : ''}`),
  add: body => request('/meals', { method: 'POST', body }),
  update: (id, body) => request(`/meals/${id}`, { method: 'PUT', body }),
  delete: id => request(`/meals/${id}`, { method: 'DELETE' }),
  photo: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/meals/photo', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  },
};

export const reminders = {
  list: () => request('/reminders'),
  add: body => request('/reminders', { method: 'POST', body }),
  snooze: (id, minutes) => request(`/reminders/${id}/snooze`, { method: 'PATCH', body: { minutes } }),
  dismiss: id => request(`/reminders/${id}/dismiss`, { method: 'PATCH' }),
  delete: id => request(`/reminders/${id}`, { method: 'DELETE' }),
};

export const weight = {
  list: (days = 30) => request(`/weight?days=${days}`),
  add: body => request('/weight', { method: 'POST', body }),
};

export const workouts = {
  list: () => request('/workouts'),
  increment: muscle_group => request('/workouts', { method: 'POST', body: { muscle_group } }),
};

export const habits = {
  list: (date) => request(`/habits${date ? `?date=${date}` : ''}`),
  streaks: () => request('/habits/streaks'),
  complete: (id, completed = true, date) => request(`/habits/${id}/complete`, { method: 'PATCH', body: { completed, date } }),
  add: body => request('/habits', { method: 'POST', body }),
  update: (id, body) => request(`/habits/${id}`, { method: 'PUT', body }),
  delete: id => request(`/habits/${id}`, { method: 'DELETE' }),
};

export const calendar = {
  events: (days = 7) => request(`/calendar/events?days=${days}`),
};

export const goals = {
  all: () => request('/goals'),
  set: (key, value) => request(`/goals/${key}`, { method: 'PUT', body: { value } }),
};

export async function apiFetch(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
