import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { rings, meals, habits, weight, workouts, goals, calendar, auth } from '../services/api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [todayRings, setTodayRings] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [habitData, setHabitData] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [workoutData, setWorkoutData] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [goalsData, setGoalsData] = useState({});
  const [activeReminder, setActiveReminder] = useState(null);

  const loadUser = useCallback(async () => {
    try { const { user } = await auth.me(); setUser(user); } catch { setUser(null); }
  }, []);

  const loadRings    = useCallback(async () => { try { setTodayRings(await rings.today()); } catch {} }, []);
  const loadMeals    = useCallback(async () => { try { setTodayMeals(await meals.list()); } catch {} }, []);
  const loadHabits   = useCallback(async () => { try { setHabitData(await habits.streaks()); } catch {} }, []);
  const loadWeight   = useCallback(async () => { try { setWeightData(await weight.list(30)); } catch {} }, []);
  const loadWorkouts = useCallback(async () => { try { setWorkoutData(await workouts.list()); } catch {} }, []);
  const loadCalendar = useCallback(async () => { try { setCalendarEvents(await calendar.events(7)); } catch {} }, []);
  const loadGoals    = useCallback(async () => { try { setGoalsData(await goals.all()); } catch {} }, []);

  const loadAll = useCallback(() => {
    loadRings(); loadMeals(); loadHabits(); loadWeight();
    loadWorkouts(); loadCalendar(); loadGoals();
  }, [loadRings, loadMeals, loadHabits, loadWeight, loadWorkouts, loadCalendar, loadGoals]);

  useEffect(() => { loadUser(); }, [loadUser]);
  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  useEffect(() => {
    const handler = () => { if (!document.hidden) loadAll(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [loadAll]);

  useEffect(() => {
    const id = setInterval(() => { if (user) loadAll(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, loadAll]);

  const handleWebSocketMessage = useCallback(msg => {
    switch (msg.type) {
      case 'rings_updated':    setTodayRings(msg.data); break;
      case 'meals_updated':    loadMeals(); break;
      case 'habits_updated':   loadHabits(); break;
      case 'weight_updated':   loadWeight(); break;
      case 'workouts_updated': loadWorkouts(); break;
      case 'calendar_updated': loadCalendar(); break;
      case 'goals_updated':    loadGoals(); break;
      case 'reminder':
        setActiveReminder(msg.data);
        playAlarm();
        break;
    }
  }, [loadMeals, loadHabits, loadWeight, loadWorkouts, loadCalendar, loadGoals]);

  return (
    <AppContext.Provider value={{
      user, setUser,
      todayRings, loadRings,
      todayMeals, loadMeals,
      habitData, loadHabits,
      weightData,
      workoutData, loadWorkouts,
      calendarEvents, loadCalendar,
      goalsData, loadGoals,
      activeReminder, setActiveReminder,
      loadAll,
      handleWebSocketMessage,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start); osc.stop(start + dur);
    };
    [0, 0.3, 0.6, 0.9, 1.2].forEach((t, i) => playBeep(440 + i * 80, ctx.currentTime + t, 0.25));
  } catch {}
}
