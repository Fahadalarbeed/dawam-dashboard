'use client';
import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { fmtDateTime } from './DriverComplaintCard';

const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function speedScoreFor(hours) {
  if (hours <= 1) return 100;
  if (hours <= 2) return 75;
  if (hours <= 3) return 50;
  return 25;
}

function computeDriverRating(stats) {
  const avgSpeedScore = stats.totalSpeedScore / stats.total;
  const VOLUME_TARGET = 20; // complaints/month considered "full marks" for volume
  const volumeScore = Math.min(100, (stats.total / VOLUME_TARGET) * 100);
  const rating = avgSpeedScore * 0.8 + volumeScore * 0.2;
  return { rating: Math.round(rating), avgSpeedScore: Math.round(avgSpeedScore), avgHours: stats.totalHours / stats.total };
}

function computeDriverMonthlyStats(closedReports, monthKey) {
  const thisMonth = closedReports.filter((r) => (r.data?.closedAt || '').slice(0, 7) === monthKey);
  const grouped = {};
  thisMonth.forEach((r) => {
    const d = r.data || {};
    const driver = d.driver || 'بدون فني';
    if (!grouped[driver]) grouped[driver] = { total: 0, within1h: 0, within2h: 0, within3h: 0, over3h: 0, items: [], byArea: {}, totalSpeedScore: 0, totalHours: 0 };
    const created = new Date(d.createdAt);
    const closed = new Date(d.closedAt);
    const hours = (closed - created) / 3600000;
    grouped[driver].total++;
    grouped[driver].totalHours += hours;
    grouped[driver].totalSpeedScore += speedScoreFor(hours);
    if (hours <= 1) grouped[driver].within1h++;
    else if (hours <= 2) grouped[driver].within2h++;
    else if (hours <= 3) grouped[driver].within3h++;
    else grouped[driver].over3h++;
    grouped[driver].items.push({ ...d, durationHours: hours });
    const area = d.area || 'بدون منطقة';
    if (!grouped[driver].byArea[area]) grouped[driver].byArea[area] = { count: 0, totalHours: 0 };
    grouped[driver].byArea[area].count++;
    grouped[driver].byArea[area].totalHours += hours;
  });
  return grouped;
}

function DriverTimeChart({ within1h, within2h, within3h, over3h }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } = await import('chart.js');
      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
      if (destroyed || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['≤ ساعة', '≤ ساعتين', '≤ ٣ ساعات', 'أكثر من ٣'],
          datasets: [{
            data: [within1h, within2h, within3h, over3h],
            backgroundColor: ['#22C55E', '#84CC16', '#F59E0B', '#DC2626'],
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { family: 'Cairo', size: 10.5 } } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
          },
        },
      });
    })();
    return () => { destroyed = true; if (chartRef.current) chartRef.current.destroy(); };
  }, [within1h, within2h, within3h, over3h]);

  return (
    <div style={{ height: 110 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function DriverStatsSection({ reports }) {
  const [show, setShow] = useState(false);
  const [month, setMonth] = useState('');
  const [expandedDriver, setExpandedDriver] = useState(null);

  const closedReports = useMemo(() => (reports || []).filter((r) => r.data?.status === 'closed' && r.data?.closedAt), [reports]);
  const months = useMemo(() => [...new Set(closedReports.map((r) => r.data.closedAt.slice(0, 7)))].sort((a, b) => b.localeCompare(a)), [closedReports]);
  const effectiveMonth = months.includes(month) ? month : (months[0] || '');
  const grouped = useMemo(() => computeDriverMonthlyStats(closedReports, effectiveMonth), [closedReports, effectiveMonth]);
  const driverNames = Object.keys(grouped).sort((a, b) => computeDriverRating(grouped[b]).rating - computeDriverRating(grouped[a]).rating);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <button onClick={() => setShow((v) => !v)} style={{
        width: '100%', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid rgba(180,83,9,0.35)',
        borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 22 }}>📊</div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>إحصائية الفنيين الشهرية</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>عدد البلاغات المغلقة ووقت الإغلاق لكل فني</div>
      </button>

      {show && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {months.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>لا توجد بلاغات مغلقة بعد</div>
          ) : (
            <>
              <div className="field" style={{ marginTop: 0 }}>
                <label>اختر الشهر</label>
                <select value={effectiveMonth} onChange={(e) => { setMonth(e.target.value); setExpandedDriver(null); }}>
                  {months.map((m) => {
                    const [y, mo] = m.split('-');
                    return <option key={m} value={m}>{ARABIC_MONTHS[parseInt(mo, 10) - 1]} {y}</option>;
                  })}
                </select>
              </div>

              {driverNames.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>لا توجد بلاغات مغلقة بهذا الشهر</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10.5, color: 'var(--text-muted)' }}>الفني</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 10.5, color: 'var(--text-muted)' }}>البلاغات</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 10.5, color: 'var(--text-muted)' }}>متوسط الإصلاح</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 10.5, color: 'var(--text-muted)' }}>النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverNames.map((driver) => {
                        const s = grouped[driver];
                        const { rating, avgHours } = computeDriverRating(s);
                        const avgLabelTop = avgHours < 1 ? `${Math.round(avgHours * 60)} د` : `${avgHours.toFixed(1)} س`;
                        const ratingColor = rating >= 80 ? '#22C55E' : rating >= 60 ? '#F59E0B' : '#DC2626';
                        const isOpen = expandedDriver === driver;
                        return (
                          <Fragment key={driver}>
                            <tr
                              onClick={() => setExpandedDriver(isOpen ? null : driver)}
                              style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isOpen ? 'var(--surface-2)' : 'transparent' }}
                            >
                              <td style={{ padding: '10px 6px', fontWeight: 700, color: 'var(--transactions)' }}>🔧 {driver}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center' }} className="mono">{s.total}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center' }} className="mono">{avgLabelTop}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, color: ratingColor }} className="mono">{rating}٪</td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={4} style={{ padding: '12px 6px', background: 'var(--surface-2)' }}>
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <DriverTimeChart within1h={s.within1h} within2h={s.within2h} within3h={s.within3h} over3h={s.over3h} />
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, marginTop: 10, marginBottom: 4 }}>حسب المنطقة:</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {Object.entries(s.byArea).sort((a, b) => b[1].count - a[1].count).map(([area, info]) => {
                                        const areaAvgHours = info.totalHours / info.count;
                                        const areaAvgLabel = areaAvgHours < 1 ? `${Math.round(areaAvgHours * 60)} د` : `${areaAvgHours.toFixed(1)} س`;
                                        return (
                                          <div key={area} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 8px', fontSize: 10.5 }}>
                                            <span style={{ fontWeight: 700, color: 'var(--transactions)' }}>📍 {area}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{info.count} بلاغ — متوسط ⏱️ {areaAvgLabel}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div style={{ marginTop: 10 }}>
                                      {s.items.map((it, i) => {
                                        const addr = [it.block ? `قطعة ${it.block}` : '', it.street ? `شارع ${it.street}` : '', it.avenue ? `جادة ${it.avenue}` : '', it.building ? `قسيمة ${it.building}` : '', it.house ? `منزل ${it.house}` : ''].filter(Boolean).join(' — ');
                                        const durLabel = it.durationHours < 1 ? `${Math.round(it.durationHours * 60)} دقيقة` : `${it.durationHours.toFixed(1)} ساعة`;
                                        return (
                                          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700 }}>{addr || 'بدون عنوان'}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                                              <span style={{ background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>📍 {it.area || 'بدون منطقة'}</span>
                                              <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>🕐 إنشاء: {fmtDateTime(it.createdAt)}</span>
                                              <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>🔒 إغلاق: {fmtDateTime(it.closedAt)}</span>
                                              <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>⏱️ {durLabel}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
