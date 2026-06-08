import { useApp } from '../context/AppContext.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function formatTime(dt) {
  if (!dt) return '';
  if (dt.length === 10) return 'All day';
  const d = new Date(dt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isToday(dateStr) {
  const today = new Date();
  const d = new Date(dateStr);
  return d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
}

function isTomorrow(dateStr) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(dateStr);
  return d.getFullYear() === tomorrow.getFullYear()
    && d.getMonth() === tomorrow.getMonth()
    && d.getDate() === tomorrow.getDate();
}

function isPast(dateTimeStr) {
  if (!dateTimeStr || dateTimeStr.length === 10) return false;
  return new Date(dateTimeStr) < new Date();
}

export default function CalendarView() {
  const { calendarEvents, loadCalendar } = useApp();

  const now = new Date();
  const todayLabel = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  const todayEvents = calendarEvents
    .filter(e => {
      const start = e.start?.dateTime || e.start?.date;
      return start && isToday(start);
    })
    .sort((a, b) => {
      const ta = new Date(a.start?.dateTime || a.start?.date).getTime();
      const tb = new Date(b.start?.dateTime || b.start?.date).getTime();
      return ta - tb;
    });

  const tomorrowEvents = calendarEvents
    .filter(e => {
      const start = e.start?.dateTime || e.start?.date;
      return start && isTomorrow(start);
    })
    .sort((a, b) => {
      const ta = new Date(a.start?.dateTime || a.start?.date).getTime();
      const tb = new Date(b.start?.dateTime || b.start?.date).getTime();
      return ta - tb;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 18px 12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '18px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text2)' }}>
            Today
          </div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', marginTop: '2px' }}>
            {todayLabel}
          </div>
        </div>
        <button
          onClick={loadCalendar}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '18px', padding: '4px', lineHeight: 1 }}
          title="Refresh"
        >↺</button>
      </div>

      {/* Today's events */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        {todayEvents.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '15px', paddingTop: '12px', textAlign: 'center' }}>
            Nothing scheduled today
          </div>
        ) : (
          todayEvents.map(evt => {
            const startDt = evt.start?.dateTime || evt.start?.date;
            const endDt = evt.end?.dateTime || evt.end?.date;
            const past = isPast(startDt);
            return (
              <div key={evt.id} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: '10px',
                background: past ? 'transparent' : 'var(--panel-hover)',
                borderLeft: `3px solid ${past ? 'var(--text3)' : 'var(--accent)'}`,
                opacity: past ? 0.45 : 1,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ color: 'var(--text2)', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '48px', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(startDt)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: past ? 'var(--text2)' : 'var(--text)', fontWeight: 500, fontSize: '15px', lineHeight: 1.35 }}>
                    {evt.summary || 'Untitled'}
                  </div>
                  {evt.location && (
                    <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {evt.location}
                    </div>
                  )}
                  {endDt && endDt !== startDt && (
                    <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '2px' }}>
                      until {formatTime(endDt)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Tomorrow section — shown if space allows */}
        {tomorrowEvents.length > 0 && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', padding: '10px 0 4px' }}>
              Tomorrow
            </div>
            {tomorrowEvents.map(evt => {
              const startDt = evt.start?.dateTime || evt.start?.date;
              const endDt = evt.end?.dateTime || evt.end?.date;
              return (
                <div key={evt.id} style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  padding: '9px 12px', borderRadius: '10px',
                  background: 'var(--panel)',
                  borderLeft: '3px solid var(--text3)',
                  opacity: 0.7,
                }}>
                  <div style={{ color: 'var(--text2)', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '48px', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(startDt)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 500, fontSize: '14px', lineHeight: 1.35 }}>
                      {evt.summary || 'Untitled'}
                    </div>
                    {endDt && endDt !== startDt && (
                      <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '2px' }}>
                        until {formatTime(endDt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
