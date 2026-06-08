import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { meals } from '../services/api.js';

export default function MealTracker() {
  const { todayMeals, loadMeals } = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [saving, setSaving] = useState(false);

  const totalCals    = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = todayMeals.reduce((s, m) => s + (m.protein  || 0), 0);
  const totalCarbs   = todayMeals.reduce((s, m) => s + (m.carbs    || 0), 0);
  const totalFat     = todayMeals.reduce((s, m) => s + (m.fat      || 0), 0);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await meals.add({ name: form.name, calories: +form.calories||0, protein: +form.protein||0, carbs: +form.carbs||0, fat: +form.fat||0 });
      await loadMeals();
      setForm({ name:'', calories:'', protein:'', carbs:'', fat:'' });
      setAdding(false);
    } finally { setSaving(false); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexShrink: 0 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Nutrition</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding(a => !a)}>{adding ? '✕' : '+'}</button>
      </div>

      <div className="meal-macros">
        <div className="macro-stat calories"><div className="val">{Math.round(totalCals)}</div><div className="lbl">kcal</div></div>
        <div className="macro-stat protein"><div className="val">{Math.round(totalProtein)}g</div><div className="lbl">protein</div></div>
        <div className="macro-stat carbs"><div className="val">{Math.round(totalCarbs)}g</div><div className="lbl">carbs</div></div>
        <div className="macro-stat fat"><div className="val">{Math.round(totalFat)}g</div><div className="lbl">fat</div></div>
      </div>

      {adding && (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'7px', flexShrink: 0 }}>
          <input placeholder="Meal name…" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
            onKeyDown={e => e.key==='Enter' && handleAdd()} autoFocus />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'4px' }}>
            {['calories','protein','carbs','fat'].map(f => (
              <input key={f} type="number" placeholder={f} value={form[f]}
                onChange={e => setForm(p=>({...p,[f]:e.target.value}))}
                style={{ fontSize:'11px', padding:'5px 6px' }} />
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving||!form.name.trim()}>
            {saving ? '…' : 'Log'}
          </button>
        </div>
      )}

      <div className="meal-list">
        {todayMeals.length === 0
          ? <div style={{ color:'var(--text3)', fontSize:'11px', textAlign:'center', paddingTop:'8px' }}>Tell Gemini what you ate</div>
          : todayMeals.map(meal => (
            <div key={meal.id} className="meal-item">
              <span className="name">{meal.name}</span>
              <span className="macros">{meal.calories ? `${Math.round(meal.calories)}cal` : ''}{meal.protein ? ` · ${meal.protein}g P` : ''}</span>
              <span className="del" onClick={async () => { await meals.delete(meal.id); loadMeals(); }}>✕</span>
            </div>
          ))
        }
      </div>
    </>
  );
}
