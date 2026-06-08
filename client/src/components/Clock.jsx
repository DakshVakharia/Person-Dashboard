import { useTime } from '../hooks/useTime.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Clock() {
  const now = useTime();

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const day = DAYS[now.getDay()];
  const date = `${day}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  return (
    <div className="clock-widget">
      <div className="clock-time">
        {hh}<span style={{ opacity: now.getSeconds() % 2 === 0 ? 1 : 0.4, transition: 'opacity 0.2s' }}>:</span>{mm}
        <span style={{ fontSize: '28px', color: 'var(--text-secondary)', marginLeft: '6px' }}>{ss}</span>
      </div>
      <div className="clock-date">{date}</div>
    </div>
  );
}
