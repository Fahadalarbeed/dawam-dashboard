'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { searchReports } from '../../lib/reportsApi';
import { groupByDriver, DriverGroupBox, fmtDateTime, todayStr } from '../../components/DriverComplaintCard';
import { playAlertTone } from '../../lib/alertSound';
import { loadGoogleMaps, getSavedApiKey } from '../../lib/googleMapsLoader';

const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function computeDriverMonthlyStats(closedReports, monthKey) {
  const thisMonth = closedReports.filter((r) => (r.data?.closedAt || '').slice(0, 7) === monthKey);
  const grouped = {};
  thisMonth.forEach((r) => {
    const d = r.data || {};
    const driver = d.driver || 'بدون سائق';
    if (!grouped[driver]) grouped[driver] = { total: 0, within1h: 0, within2h: 0, over2h: 0, items: [] };
    const created = new Date(d.createdAt);
    const closed = new Date(d.closedAt);
    const hours = (closed - created) / 3600000;
    grouped[driver].total++;
    if (hours <= 1) grouped[driver].within1h++;
    else if (hours <= 2) grouped[driver].within2h++;
    else grouped[driver].over2h++;
    grouped[driver].items.push({ ...d, durationHours: hours });
  });
  return grouped;
}

function DriverTimeChart({ within1h, within2h, over2h }) {
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
          labels: ['≤ ساعة', '≤ ساعتين', 'أكثر من ساعتين'],
          datasets: [{
            data: [within1h, within2h, over2h],
            backgroundColor: ['#22C55E', '#F59E0B', '#DC2626'],
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
  }, [within1h, within2h, over2h]);

  return (
    <div style={{ height: 110 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function DriverStatsSection({ reports }) {
  const [show, setShow] = useState(false);
  const [month, setMonth] = useState('');
  const [expandedDriver, setExpandedDriver] = useState(null);

  const closedReports = useMemo(() => (reports || []).filter((r) => r.data?.status === 'closed' && r.data?.closedAt), [reports]);
  const months = useMemo(() => [...new Set(closedReports.map((r) => r.data.closedAt.slice(0, 7)))].sort((a, b) => b.localeCompare(a)), [closedReports]);
  const effectiveMonth = months.includes(month) ? month : (months[0] || '');
  const grouped = useMemo(() => computeDriverMonthlyStats(closedReports, effectiveMonth), [closedReports, effectiveMonth]);
  const driverNames = Object.keys(grouped).sort((a, b) => grouped[b].total - grouped[a].total);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <button onClick={() => setShow((v) => !v)} className="new-report-btn" style={{
        width: '100%', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid rgba(180,83,9,0.35)',
        borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 22 }}>📊</div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>إحصائية السواق الشهرية</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>عدد البلاغات المغلقة ووقت الإغلاق لكل سائق</div>
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
                driverNames.map((driver) => {
                  const s = grouped[driver];
                  const isOpen = expandedDriver === driver;
                  return (
                    <div key={driver} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
                      <div onClick={() => setExpandedDriver(isOpen ? null : driver)} style={{ padding: 14, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--transactions)' }}>🚗 {driver}</div>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--complaints)' }}>{s.total}</div>
                        </div>
                        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                          <DriverTimeChart within1h={s.within1h} within2h={s.within2h} over2h={s.over2h} />
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 14px 14px' }}>
                          {s.items.map((it, i) => {
                            const addr = [it.area, it.block ? `قطعة ${it.block}` : '', it.street ? `شارع ${it.street}` : '', it.house ? `منزل ${it.house}` : ''].filter(Boolean).join(' — ');
                            const durLabel = it.durationHours < 1 ? `${Math.round(it.durationHours * 60)} دقيقة` : `${it.durationHours.toFixed(1)} ساعة`;
                            return (
                              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{addr || 'بدون عنوان'}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                                  <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>🕐 إنشاء: {fmtDateTime(it.createdAt)}</span>
                                  <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>🔒 إغلاق: {fmtDateTime(it.closedAt)}</span>
                                  <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>⏱️ {durLabel}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TrackingMapSection() {
  const [show, setShow] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');
  const [liveLocations, setLiveLocations] = useState({});
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    const saved = getSavedApiKey();
    if (saved) setApiKey(saved);
  }, []);

  const loadLiveLocations = useCallback(async () => {
    const { data, error } = await supabase.from('driver_locations').select('*');
    if (error) { console.error(error); return; }
    const map = {};
    (data || []).forEach((row) => { map[row.driver] = { lat: row.lat, lng: row.lng, updated_at: row.updated_at }; });
    setLiveLocations(map);
  }, []);

  useEffect(() => {
    loadLiveLocations();
    const channel = supabase
      .channel('driver-locations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {
        loadLiveLocations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLiveLocations]);

  async function initMap() {
    if (!apiKey) {
      setStatus('⚠️ حط مفتاح Google Maps API فوق عشان تشوف الخريطة الفعلية');
      return;
    }
    try {
      setStatus('⏳ جارٍ تحميل الخريطة...');
      await loadGoogleMaps(apiKey);
      const entries = Object.entries(liveLocations);
      const center = entries.length > 0 ? { lat: entries[0][1].lat, lng: entries[0][1].lng } : { lat: 29.3759, lng: 47.9774 };
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, { center, zoom: entries.length > 0 ? 12 : 11 });
      updateMarkers();
      setStatus(entries.length > 0 ? `✓ ${entries.length} سائق أونلاين` : 'لا يوجد سواق أونلاين حاليًا');
    } catch (e) {
      setStatus('✗ ' + e.message);
    }
  }

  function updateMarkers() {
    if (!mapInstanceRef.current) return;
    const entries = Object.entries(liveLocations);
    const seen = new Set();
    entries.forEach(([driver, loc]) => {
      seen.add(driver);
      const pos = { lat: loc.lat, lng: loc.lng };
      if (markersRef.current[driver]) {
        markersRef.current[driver].marker.setPosition(pos);
      } else {
        const marker = new window.google.maps.Marker({
          position: pos, map: mapInstanceRef.current, title: driver,
          label: { text: driver.slice(0, 2), color: '#fff' },
        });
        const info = new window.google.maps.InfoWindow({
          content: `<div style="font-family:Cairo,sans-serif;direction:rtl;"><b>🚗 ${driver}</b><br><small>${fmtDateTime(loc.updated_at)}</small></div>`,
        });
        marker.addListener('click', () => info.open(mapInstanceRef.current, marker));
        markersRef.current[driver] = { marker, info };
      }
    });
    Object.keys(markersRef.current).forEach((driver) => {
      if (!seen.has(driver)) {
        markersRef.current[driver].marker.setMap(null);
        delete markersRef.current[driver];
      }
    });
    setStatus(entries.length > 0 ? `✓ ${entries.length} سائق أونلاين` : 'لا يوجد سواق أونلاين حاليًا');
  }

  useEffect(() => {
    if (show && mapInstanceRef.current) updateMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLocations]);

  useEffect(() => {
    if (show && !mapInstanceRef.current) initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <button onClick={() => setShow((v) => !v)} className="new-report-btn" style={{
        width: '100%', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid rgba(37,99,235,0.35)',
        borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 22 }}>🗺️</div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>خريطة تتبع السواق الحيّة</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>موقع كل سائق عنده بلاغ نشط، لحظة بلحظة</div>
      </button>

      {show && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div className="field" style={{ marginTop: 0 }}>
            <label>مفتاح Google Maps API</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="الصق مفتاح API هنا" />
          </div>
          <button className="btn-primary" onClick={() => { localStorage.setItem('gmaps_api_key', apiKey); initMap(); }}>
            💾 حفظ المفتاح وتحميل الخريطة
          </button>

          {status && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0' }}>{status}</div>}
          <div ref={mapRef} style={{ width: '100%', height: 400, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', display: apiKey ? 'block' : 'none' }} />

          <div style={{ marginTop: 14 }}>
            {Object.entries(liveLocations).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>لا يوجد سواق أونلاين — التتبع يشتغل تلقائيًا عند أي سائق عنده بلاغ نشط وفاتح صفحة السواق بجواله</div>
            ) : (
              Object.entries(liveLocations).map(([driver, loc]) => (
                <div key={driver} className="card" style={{ marginBottom: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--transactions)' }}>🚗 {driver}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtDateTime(loc.updated_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DriverBoardInternalPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [reports, setReports] = useState(null);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setCheckingAuth(false);
    });
  }, [router]);

  const loadReports = useCallback(async () => {
    try {
      const data = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
      setReports(data);
    } catch (e) {
      console.error(e);
      setReports([]);
    }
  }, []);

  useEffect(() => { if (!checkingAuth) loadReports(); }, [checkingAuth, loadReports]);

  useEffect(() => {
    if (checkingAuth) return undefined;
    const channel = supabase
      .channel('driver-board-closed-complaints')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: 'type=eq.complaints' }, (payload) => {
        const wasClosed = payload.old?.data?.status === 'closed';
        const isClosed = payload.new?.data?.status === 'closed';
        if (isClosed && !wasClosed) {
          playAlertTone('closed');
          loadReports();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [checkingAuth, loadReports]);

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق...</div>;
  }

  const today = todayStr();
  const active = (reports || []).filter((r) => (r.data?.status || 'active') === 'active');
  const closed = (reports || []).filter((r) => r.data?.status === 'closed' && (r.data?.closedAt || '').slice(0, 10) === today);
  const list = tab === 'active' ? active : closed;
  const grouped = groupByDriver(list);

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '10px 16px' }} onClick={() => router.push('/dashboard')}>
          → رجوع
        </button>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>لوحة السواق (داخلي)</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setTab('active')} style={{
          textAlign: 'center', background: tab === 'active' ? 'var(--complaints-bg)' : 'var(--surface-2)',
          border: `1px solid ${tab === 'active' ? 'var(--complaints)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 8px', cursor: 'pointer',
        }}>
          <div style={{ fontSize: 20 }}>🟠</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>نشط ({active.length})</div>
        </button>
        <button onClick={() => setTab('closed')} style={{
          textAlign: 'center', background: tab === 'closed' ? 'var(--transactions-bg)' : 'var(--surface-2)',
          border: `1px solid ${tab === 'closed' ? 'var(--transactions)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 8px', cursor: 'pointer',
        }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>مغلق اليوم ({closed.length})</div>
        </button>
      </div>

      {!reports ? (
        <div className="card"><div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>جارٍ التحميل...</div></div>
      ) : list.length === 0 ? (
        <div className="card"><div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>لا توجد بلاغات {tab === 'active' ? 'نشطة' : 'مغلقة اليوم'}</div></div>
      ) : (
        grouped.map(([driver, items]) => (
          <DriverGroupBox key={driver} driver={driver} reports={items} onChanged={loadReports} />
        ))
      )}

      <DriverStatsSection reports={reports} />
      <TrackingMapSection />
    </div>
  );
}
