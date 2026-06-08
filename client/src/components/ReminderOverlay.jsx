import { useApp } from '../context/AppContext.jsx';
import { reminders } from '../services/api.js';

export default function ReminderOverlay() {
  const { activeReminder, setActiveReminder } = useApp();

  if (!activeReminder) return null;

  const handleSnooze = async (mins) => {
    await reminders.snooze(activeReminder.id, mins);
    setActiveReminder(null);
  };

  const handleDismiss = async () => {
    await reminders.dismiss(activeReminder.id);
    setActiveReminder(null);
  };

  return (
    <div className="reminder-overlay" onClick={handleDismiss}>
      <div className="reminder-card" onClick={e => e.stopPropagation()}>
        <div className="icon">🔔</div>
        <h2>{activeReminder.title}</h2>
        {activeReminder.message && <p>{activeReminder.message}</p>}
        <div className="reminder-actions">
          <button className="btn btn-ghost" onClick={() => handleSnooze(10)}>Snooze 10m</button>
          <button className="btn btn-ghost" onClick={() => handleSnooze(30)}>Snooze 30m</button>
          <button className="btn btn-primary" onClick={handleDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
