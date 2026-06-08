import { useApp } from '../context/AppContext.jsx';

const RINGS = [
  { key: 'schedule', label: 'Schedule', color: 'var(--ring-schedule)', r: 43, strokeW: 8 },
  { key: 'protein',  label: 'Protein',  color: 'var(--ring-protein)',   r: 32, strokeW: 8 },
];

const VB = 100;

function Ring({ r, strokeW, color, pct }) {
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, Math.max(0, pct)));
  return (
    <circle cx={VB/2} cy={VB/2} r={r}
      fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
      strokeDasharray={circumference} strokeDashoffset={offset}
      transform={`rotate(-90 ${VB/2} ${VB/2})`}
      style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
  );
}

function TrackRing({ r, strokeW }) {
  return <circle cx={VB/2} cy={VB/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} />;
}

function wrapText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
    if (lines.length === 1) break;
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 2);
}

export default function ConcentricRings() {
  const { todayRings, goalsData, calendarEvents } = useApp();

  const proteinGoal = parseInt(goalsData?.protein_goal || '130');

  const pcts = {
    schedule: (todayRings?.schedule_completion || 0) / 100,
    protein:  Math.min(1, (todayRings?.protein_intake || 0) / proteinGoal),
  };

  // Next upcoming event
  const now = new Date();
  const nextEvent = calendarEvents?.find(e => {
    const start = new Date(e.start?.dateTime || e.start?.date || 0);
    return start >= now;
  });

  const eventTime = nextEvent
    ? (nextEvent.start?.dateTime
        ? new Date(nextEvent.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'All day')
    : null;

  const eventTitle = nextEvent?.summary || null;
  const titleLines = eventTitle ? wrapText(eventTitle, 11) : [];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <div style={{ width: '100%', maxWidth: '380px', aspectRatio: '1' }}>
        <svg viewBox={`0 0 ${VB} ${VB}`} width="100%" height="100%">
          {RINGS.map(ring => <TrackRing key={`t-${ring.key}`} r={ring.r} strokeW={ring.strokeW} />)}
          {RINGS.map(ring => (
            <Ring key={ring.key} r={ring.r} strokeW={ring.strokeW} color={ring.color} pct={pcts[ring.key]} />
          ))}

          {/* Center: next event */}
          {eventTitle ? (
            <>
              <text x={VB/2} y={titleLines.length > 1 ? VB/2 - 8 : VB/2 - 5}
                textAnchor="middle" fill="#6366f1"
                fontSize="6" fontFamily="system-ui" fontWeight="700">
                {eventTime}
              </text>
              {titleLines.map((line, i) => (
                <text key={i} x={VB/2}
                  y={titleLines.length > 1 ? VB/2 + (i === 0 ? 2 : 10) : VB/2 + 5}
                  textAnchor="middle" fill="white"
                  fontSize="5.5" fontFamily="system-ui" fontWeight="500">
                  {line}
                </text>
              ))}
            </>
          ) : (
            <text x={VB/2} y={VB/2 + 3} textAnchor="middle" fill="#3d4756"
              fontSize="6" fontFamily="system-ui">No events</text>
          )}
        </svg>
      </div>

    </div>
  );
}
