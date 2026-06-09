# Personal Dashboard

A full-stack personal productivity dashboard built with Node.js, Express, and SQLite. Designed as a daily driver for tracking health, habits, fitness, and schedule in one place.

## Features

- **Rings** — Daily score tracking calories, protein, and task completion
- **Habit Tracker** — Weekly habit grid with streaks
- **Nutrition** — Meal logging with macros
- **Workouts** — Weekly muscle group tracker
- **Running** — Run logger with pace, cadence, and weekly bar chart
- **Daily Goals** — Custom goal checklist
- **Google Calendar** — Live agenda view synced to your calendar
- **Google Drive Backup** — One-click database backup
- **Mobile Dashboard** — Mobile-first UI served automatically on phones
- **Floating Widget** — Always-on-top rings overlay for desktop

## Tech Stack

- **Backend** — Node.js, Express, SQLite (better-sqlite3), WebSockets
- **Frontend** — Vanilla HTML/CSS/JS, PWA-ready
- **Auth** — Google OAuth2, session-based
- **Integrations** — Google Calendar API, Google Drive API, Gemini AI
- **Real-time** — WebSocket broadcast bus for live UI updates
