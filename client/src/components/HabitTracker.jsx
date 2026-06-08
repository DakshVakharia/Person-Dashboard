import { useApp } from '../context/AppContext.jsx';
import { habits } from '../services/api.js';

export default function HabitTracker() {
  const { habitData, loadHabits } = useApp();

  const toggle = async habit => {
    await habits.complete(habit.id, !habit.completed_today);
    await loadHabits();
  };

  return (
    <>
      <div className="section-title">Habits</div>
      <div className="habit-checklist">
        {habitData.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '14px' }}>No habits — tell Gemini to add one</div>
        ) : (
          habitData.map(habit => (
            <button
              key={habit.id}
              className={`habit-check-row ${habit.completed_today ? 'done' : ''}`}
              onClick={() => toggle(habit)}
            >
              <div className="habit-checkbox">
                {habit.completed_today && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="habit-check-icon">{habit.icon}</span>
              <span className="habit-check-name">{habit.name}</span>
              {habit.streak > 1 && (
                <span className="habit-check-streak">🔥 {habit.streak}</span>
              )}
            </button>
          ))
        )}
      </div>
    </>
  );
}
