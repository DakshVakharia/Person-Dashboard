import { useEffect, useState } from 'react';
import { habits } from '../services/api.js';

const SUPPLEMENT_NAMES = ['Morning Serum', 'Evening Serum', 'Creatine', 'Biotin'];

export default function SupplementChecklist() {
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const all = await habits.list();
      const supplements = all.filter(h => SUPPLEMENT_NAMES.includes(h.name));
      // preserve the display order
      const ordered = SUPPLEMENT_NAMES
        .map(name => supplements.find(h => h.name === name))
        .filter(Boolean);
      setItems(ordered);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const toggle = async (habit) => {
    await habits.complete(habit.id, !habit.completed_today);
    await load();
  };

  if (!items.length) return null;

  return (
    <div className="supplement-checklist">
      {items.map(item => (
        <button
          key={item.id}
          className={`supplement-item ${item.completed_today ? 'done' : ''}`}
          onClick={() => toggle(item)}
        >
          <span className="supp-check">{item.completed_today ? '✓' : ''}</span>
          <span className="supp-icon">{item.icon}</span>
          <span className="supp-name">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
