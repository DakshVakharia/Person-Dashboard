import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';

export default function LogsPage({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const [logsRes, reportsRes] = await Promise.all([
          apiFetch('/api/logs?days=7'),
          apiFetch('/api/logs/reports')
        ]);
        setLogs(logsRes);
        setReports(reportsRes);
      } catch (e) {
        console.error('Failed to fetch logs:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="logs-page" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-color)', zIndex: 1000, overflowY: 'auto', padding: '2rem' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--panel-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}>
        Back to Dashboard
      </button>

      <h2>Weekly Logs & Reports</h2>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '2rem' }}>
        
        {/* Daily Logs Section */}
        <div style={{ flex: '1 1 500px' }}>
          <h3>Past 7 Days</h3>
          {loading ? <p>Loading...</p> : logs.map(day => {
            const protein = Math.round(day.rings.protein_intake || 0);
            const meals = day.meals || [];
            const habits = day.habits || [];
            const totalCals = meals.reduce((sum, m) => sum + (m.calories || 0), 0);

            return (
              <div key={day.date} style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-color)' }}>{day.date}</h4>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                  <span><strong>Protein:</strong> {protein}g</span>
                  <span><strong>Calories:</strong> {totalCals}kcal</span>
                  <span><strong>Workout:</strong> {day.rings.workout_done ? '✅' : '❌'}</span>
                </div>
                {habits.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Habits:</strong> {habits.map(h => `${h.icon} ${h.name} (${h.completed ? '✅' : '❌'})`).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Reports Section */}
        <div style={{ flex: '1 1 300px' }}>
          <h3>Weekly Reports</h3>
          {loading ? <p>Loading...</p> : reports.length === 0 ? <p>No reports generated yet.</p> : reports.map(r => {
            let data = {};
            try { data = JSON.parse(r.report_data); } catch(e) {}
            return (
              <div key={r.id} style={{ background: 'var(--panel-bg)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>{r.week_start} to {r.week_end}</h4>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{data.summary || r.report_data}</p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Workouts: {data.totalWorkouts || 0} | Protein: {data.totalProtein || 0}g
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
