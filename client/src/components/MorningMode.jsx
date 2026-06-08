import { useApp } from '../context/AppContext.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MorningMode() {
  const { setMode, modeData } = useApp();
  const now = new Date();
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  return (
    <div className="morning-mode">
      <div className="greeting">Good morning ☀️</div>
      <div className="date-str">{dateStr}</div>

      {modeData?.intention && (
        <div className="intention-card">
          <div className="intention-label">Yesterday's Intention</div>
          <div className="intention-text">{modeData.intention}</div>
        </div>
      )}

      {modeData?.greeting ? (
        <div className="ai-text">{modeData.greeting}</div>
      ) : (
        <div className="ai-text pulse" style={{ color: 'var(--text-dim)' }}>Loading your morning briefing...</div>
      )}

      <button className="btn btn-ghost" style={{ marginTop: '8px' }} onClick={() => setMode('normal')}>
        Open Dashboard →
      </button>
    </div>
  );
}
