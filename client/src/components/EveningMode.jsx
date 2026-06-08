import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { goals } from '../services/api.js';

export default function EveningMode() {
  const { setMode, modeData } = useApp();
  const [intention, setIntention] = useState('');
  const [saved, setSaved] = useState(false);

  const saveIntention = async () => {
    if (!intention.trim()) return;
    await goals.setIntention(intention.trim());
    setSaved(true);
    setTimeout(() => setMode('normal'), 2000);
  };

  return (
    <div className="evening-mode">
      <div className="title">Good evening 🌙</div>

      {modeData?.summary ? (
        <div className="ai-summary">{modeData.summary}</div>
      ) : (
        <div className="ai-summary pulse" style={{ color: 'var(--text-dim)' }}>Generating your day summary...</div>
      )}

      {!saved ? (
        <>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            What's your intention for tomorrow?
          </div>
          <div className="intention-input-row">
            <input
              value={intention}
              onChange={e => setIntention(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveIntention()}
              placeholder="Tomorrow I will..."
              autoFocus
            />
            <button className="btn btn-primary" onClick={saveIntention} disabled={!intention.trim()}>
              Save
            </button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: '18px', color: 'var(--green)', marginBottom: '16px' }}>
          ✓ Intention saved. Sleep well.
        </div>
      )}

      <button
        className="btn btn-ghost"
        style={{ marginTop: '32px', opacity: 0.5 }}
        onClick={() => setMode('normal')}
      >
        Back to Dashboard
      </button>
    </div>
  );
}
