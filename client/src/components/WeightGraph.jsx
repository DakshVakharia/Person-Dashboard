import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext.jsx';

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'7px', padding:'5px 9px', fontSize:'11px' }}>
      <div style={{ color:'var(--text2)' }}>{payload[0].payload.date}</div>
      <div style={{ color:'var(--text)', fontWeight:'600' }}>{payload[0].value} kg</div>
    </div>
  );
};

export default function WeightGraph() {
  const { weightData } = useApp();

  if (!weightData?.length) return (
    <>
      <div className="section-title">Weight</div>
      <div style={{ color:'var(--text3)', fontSize:'11px', textAlign:'center', paddingTop:'8px' }}>
        Tell Gemini your weight
      </div>
    </>
  );

  const latest = weightData[weightData.length - 1];
  const prev   = weightData.length > 1 ? weightData[weightData.length - 2] : null;
  const diff   = prev ? (latest.weight - prev.weight).toFixed(1) : null;
  const trendColor = diff === null ? 'var(--text2)' : parseFloat(diff) <= 0 ? 'var(--green)' : 'var(--red)';

  const chartData = weightData.slice(-14).map(w => ({ date: w.date.slice(5), weight: w.weight }));
  const weights   = chartData.map(d => d.weight);
  const minW = Math.floor(Math.min(...weights) - 0.5);
  const maxW = Math.ceil(Math.max(...weights)  + 0.5);

  return (
    <>
      <div className="section-title">Weight</div>
      <div className="weight-current">
        <span className="val">{latest.weight}</span>
        <span className="unit">{latest.unit || 'kg'}</span>
        {diff !== null && <span className="trend" style={{ color: trendColor }}>{parseFloat(diff)>0?'+':''}{diff}</span>}
      </div>
      <div className="weight-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top:0, right:4, bottom:0, left:-24 }}>
            <XAxis dataKey="date" tick={{ fontSize:8, fill:'var(--text3)' }} tickLine={false} axisLine={false} />
            <YAxis domain={[minW, maxW]} tick={{ fontSize:8, fill:'var(--text3)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<Tip />} />
            <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={1.5}
              dot={false} activeDot={{ r:3, fill:'var(--accent)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
