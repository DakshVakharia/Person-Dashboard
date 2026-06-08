import { useApp } from '../context/AppContext.jsx';
import { workouts } from '../services/api.js';

const MUSCLES = [
  { id: 'quads', name: 'Quads', icon: '🦵' },
  { id: 'hamstrings', name: 'Hamstrings', icon: '🦵' },
  { id: 'calves', name: 'Calves', icon: '🦵' },
  { id: 'shoulders', name: 'Shoulders', icon: '💪' },
  { id: 'biceps', name: 'Biceps', icon: '💪' },
  { id: 'triceps', name: 'Triceps', icon: '💪' },
  { id: 'chest', name: 'Chest', icon: '🦍' },
  { id: 'back', name: 'Back', icon: '🦍' },
  { id: 'abs', name: 'Abs', icon: '🍫' },
];

export default function WorkoutTracker() {
  const { workoutData, loadWorkouts } = useApp();

  const increment = async id => {
    await workouts.increment(id);
    await loadWorkouts();
  };

  const getSets = id => {
    const row = workoutData?.find(w => w.muscle_group === id);
    return row ? row.total_sets : 0;
  };

  return (
    <>
      <div className="section-title">Workout Tracker</div>
      <div className="habit-checklist" style={{ paddingBottom: '20px' }}>
        {MUSCLES.map(muscle => {
          const sets = getSets(muscle.id);
          return (
            <button
              key={muscle.id}
              className={`habit-check-row ${sets > 0 ? 'done' : ''}`}
              onClick={() => increment(muscle.id)}
            >
              <div className="habit-checkbox" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                {sets > 0 ? sets : 0}
              </div>
              <span className="habit-check-icon">{muscle.icon}</span>
              <span className="habit-check-name">{muscle.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
