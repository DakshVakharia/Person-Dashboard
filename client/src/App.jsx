import { AppProvider, useApp } from './context/AppContext.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useTheme } from './hooks/useTheme.js';
import Dashboard from './components/Dashboard.jsx';
import ReminderOverlay from './components/ReminderOverlay.jsx';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="theme-toggle" onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <div className="theme-toggle-knob">
        {theme === 'dark' ? '🌙' : '☀️'}
      </div>
    </button>
  );
}

function AppInner() {
  const { user, activeReminder, handleWebSocketMessage } = useApp();
  useWebSocket(handleWebSocketMessage);

  if (user === undefined) return <div className="loading">Loading...</div>;

  return (
    <>
      <ThemeToggle />
      {activeReminder && <ReminderOverlay />}
      <Dashboard />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
