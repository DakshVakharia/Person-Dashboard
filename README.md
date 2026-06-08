# Personal Assistant Dashboard

An always-on ambient dashboard for a permanently mounted Android tablet.
**React PWA · Node.js · SQLite · Gemini AI · Google Calendar**

---

## Features

- **Ambient display** — large clock, dark theme, readable from across a room
- **Concentric rings** — schedule completion, protein, creatine, workout
- **Gemini AI chat** — "move gym to 7am", "I ate dal rice", "remind me at 9am daily"
- **Google Calendar** — read/write via natural language or direct
- **Meal tracker** — text or photo (Gemini Vision), full macro tracking, vegetarian-aware
- **Morning mode** (6am) — alarm + AI briefing + yesterday's intention
- **Evening mode** (10pm) — AI day summary + set tomorrow's intention
- **Reminders** — recurring, one-shot, snooze, Google Calendar sync
- **Weight log** — trend graph
- **Habits & streaks** — tap to complete, fire streaks
- **Screen time** — REST endpoint for Android companion app, flags Instagram/Shorts
- **Google Drive backup** — nightly at 2am, keeps last 7 backups

---

## Deployment: Android Tablet via UserLAnd (Ubuntu)

### 1. Install UserLAnd

1. Install **UserLAnd** from the Play Store
2. Open it → tap **Ubuntu** → enter a username and password when prompted
3. Wait for the initial setup to complete (a few minutes)
4. You'll get a terminal prompt inside Ubuntu

---

### 2. Install Node.js 20

UserLAnd's Ubuntu ships an old Node — replace it:

```bash
sudo apt-get update
sudo apt-get install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

---

### 3. Get the project onto the tablet

**Option A — USB (easiest):**
Connect tablet via USB, copy the project folder to `/sdcard/dashboard`, then:
```bash
cp -r /sdcard/dashboard ~/dashboard
```

**Option B — Git:**
```bash
git clone https://github.com/yourusername/dashboard.git ~/dashboard
```

---

### 4. Install dependencies & build

```bash
cd ~/dashboard

# Install all deps
sudo apt-get install -y python3 make g++   # needed to compile better-sqlite3
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Build React app (server will serve it)
npm run build
```

> `better-sqlite3` compiles native code — this step takes a few minutes on tablet hardware. The `python3 make g++` line is required for compilation.

---

### 5. Google Cloud Console setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable **Google Calendar API** and **Google Drive API**
3. Create **OAuth 2.0 credentials** (Web application type)
   - Authorised redirect URI: `http://localhost:3001/api/auth/google/callback`
4. Copy your Client ID and Client Secret

### 6. Gemini API key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create an API key

---

### 7. Create environment file

```bash
nano ~/dashboard/server/.env
```

Paste and fill in your values:

```
PORT=3001
SESSION_SECRET=pick-a-long-random-string-here

GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

GEMINI_API_KEY=xxxx
GEMINI_MODEL=gemini-1.5-flash

CLIENT_URL=http://localhost:3001
```

Save: `Ctrl+O` → Enter → `Ctrl+X`

---

### 8. Test it first

```bash
cd ~/dashboard
node server/index.js
```

Open Chrome on the tablet → `http://localhost:3001` → sign in with Google. If everything works, stop the server (`Ctrl+C`) and set up pm2.

---

### 9. Install pm2 (process manager)

pm2 keeps the server running if it crashes and restarts it on reboot:

```bash
sudo npm install -g pm2
```

---

### 10. Start with pm2

```bash
cd ~/dashboard
mkdir -p logs
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Useful pm2 commands:

```bash
pm2 logs dashboard       # view live logs
pm2 status               # check if running
pm2 restart dashboard    # restart
pm2 stop dashboard       # stop
pm2 delete dashboard     # remove from pm2
```

---

### 11. Auto-start on UserLAnd boot

UserLAnd doesn't run a standard init, so create a startup script:

```bash
nano ~/start-dashboard.sh
```

Paste:
```bash
#!/bin/bash
cd ~/dashboard
pm2 resurrect || pm2 start ecosystem.config.cjs --env production
```

Make it executable:
```bash
chmod +x ~/start-dashboard.sh
```

Then in UserLAnd settings, set this as the startup script, **or** simply run `~/start-dashboard.sh` each time you open UserLAnd. (UserLAnd Pro allows setting a startup command automatically.)

---

### 12. Set up Fully Kiosk Browser (recommended for always-on display)

**Fully Kiosk Browser** is the best option for a permanent ambient display:

1. Install **Fully Kiosk Browser** from the Play Store
2. Open it → enter Start URL: `http://localhost:3001`
3. Settings to configure:
   - **Keep Screen On** → Always
   - **Prevent Sleep** → enabled
   - **Start on Boot** → enabled
   - **Kiosk Mode** → enabled (prevents accidental navigation)
   - **Motion Detection** → can wake screen when you approach
   - **Screensaver / DAYDREAM** → disable

The dashboard will load full-screen automatically every time the tablet boots.

**Free alternative — Chrome PWA:**
1. Open Chrome → go to `http://localhost:3001`
2. Tap the three-dot menu → **Add to Home Screen**
3. Open the installed PWA — it runs in standalone mode
4. Use Android's developer options to keep screen on while charging

---

## Accessing from Other Devices (same WiFi)

Find the tablet's IP:
```bash
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

From your phone or PC on the same network: `http://<tablet-ip>:3001`

---

## Tailscale (access from anywhere)

1. Install Tailscale app on the tablet
2. Sign in — note the Tailscale IP (e.g. `100.x.x.x`)
3. Update `server/.env`:
   ```
   GOOGLE_REDIRECT_URI=http://100.x.x.x:3001/api/auth/google/callback
   CLIENT_URL=http://100.x.x.x:3001
   ```
4. Add `http://100.x.x.x:3001/api/auth/google/callback` to your Google OAuth redirect URIs
5. Rebuild: `npm run build` and restart: `pm2 restart dashboard`

---

## Screen Time Android Companion

Send screen time data via HTTP POST (Tasker, Automate, or a custom app):

```
POST http://localhost:3001/api/screentime
Content-Type: application/json

{
  "date": "2026-05-03",
  "apps": [
    { "app_name": "Instagram", "package_name": "com.instagram.android", "duration_minutes": 45 },
    { "app_name": "Chrome", "package_name": "com.android.chrome", "duration_minutes": 30 }
  ]
}
```

No authentication required on this endpoint.

---

## Gemini Chat Examples

| Say this | Does this |
|----------|-----------|
| `I had dal rice for lunch` | Logs meal + estimates macros |
| `I weigh 74.2kg` | Logs weight |
| `Done with gym` | Marks workout ring + habit |
| `Took creatine` | Marks creatine ring |
| `Move gym to 7am tomorrow` | Updates Google Calendar |
| `Remind me to meditate at 9am every day` | Creates daily reminder |
| `Snooze 10 mins` | Snoozes active reminder |
| `Set my protein goal to 150g` | Updates goal |
| `Add a journaling habit` | Adds to habit tracker |

---

## Data & Backups

- **Database:** `server/data/dashboard.db`
- **Uploads:** `server/uploads/`
- **Logs:** `logs/out.log`, `logs/error.log`
- **Auto-backup:** nightly at 2am to Google Drive → `DashboardBackups/` (keeps last 7)
- **Manual backup:** POST `/api/backup/trigger`

---

## Smart Home Placeholders

Wire up ESP32 blinds/coffee in `server/services/scheduler.js` inside `triggerMorningMode()`:

```js
// await fetch('http://esp32-blinds.local/open')
// await fetch('http://esp32-coffee.local/brew')
```
