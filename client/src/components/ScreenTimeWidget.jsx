import { useApp } from '../context/AppContext.jsx';

const fmt = m => { const h = Math.floor(m/60), min = Math.round(m%60); return h > 0 ? `${h}h ${min}m` : `${min}m`; };

export default function ScreenTimeWidget() {
  const { screentimeData } = useApp();

  if (!screentimeData || screentimeData.total_minutes === 0) return (
    <div style={{ padding:'10px 12px' }}>
      <div className="section-title">Screen Time</div>
      <div style={{ color:'var(--text3)', fontSize:'11px' }}>No data yet</div>
    </div>
  );

  const { total_minutes, flagged_minutes, apps } = screentimeData;

  return (
    <div style={{ padding:'10px 12px' }}>
      <div className="section-title">Screen Time</div>
      <div className={`screentime-total ${flagged_minutes > 60 ? 'flagged' : ''}`}>
        {fmt(total_minutes)}
        {flagged_minutes > 0 && <span style={{ fontSize:'11px', marginLeft:'6px', color:'var(--red)' }}>({fmt(flagged_minutes)} flagged)</span>}
      </div>
      <div className="screentime-apps" style={{ marginTop:'5px' }}>
        {(apps || []).slice(0,5).map(app => (
          <div key={app.id} className={`st-app ${app.is_flagged ? 'flagged' : ''}`}>
            {app.app_name} {fmt(app.duration_minutes)}
          </div>
        ))}
      </div>
    </div>
  );
}
