'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { searchReports } from '../../lib/reportsApi';
import { groupByDriver, DriverGroupBox, fmtDateTime, todayStr } from '../../components/DriverComplaintCard';
import { playAlertTone } from '../../lib/alertSound';

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
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700 }}>≤ ساعة: {s.within1h}</span>
                          <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700 }}>≤ ساعتين: {s.within2h}</span>
                          <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700 }}>أكثر من ساعتين: {s.over2h}</span>
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

function TrackingMapSection({ locations }) {
  const [show, setShow] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const loadPromiseRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('gmaps_api_key');
    if (saved) setApiKey(saved);
  }, []);

  function loadGoogleMaps(key) {
    if (window.google && window.google.maps) return Promise.resolve();
    if (loadPromiseRef.current) return loadPromiseRef.current;
    loadPromiseRef.current = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('تعذر تحميل خرائط Google — تأكد المفتاح صحيح'));
      document.head.appendChild(script);
    });
    return loadPromiseRef.current;
  }

  async function renderMap() {
    if (!apiKey) {
      setStatus('⚠️ حط مفتاح Google Maps API فوق عشان تشوف الخريطة الفعلية');
      return;
    }
    try {
      setStatus('⏳ جارٍ تحميل الخريطة...');
      await loadGoogleMaps(apiKey);
      const entries = Object.entries(locations);
      const center = entries.length > 0 ? { lat: entries[0][1].lat, lng: entries[0][1].lng } : { lat: 29.3759, lng: 47.9774 };
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, { center, zoom: entries.length > 0 ? 12 : 11 });
      entries.forEach(([driver, loc]) => {
        const marker = new window.google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng }, map: mapInstanceRef.current, title: driver,
          label: { text: driver.slice(0, 2), color: '#fff' },
        });
        const info = new window.google.maps.InfoWindow({
          content: `<div style="font-family:Cairo,sans-serif;direction:rtl;"><b>🚗 ${driver}</b><br>${loc.address}<br><small>${fmtDateTime(loc.timestamp)}</small></div>`,
        });
        marker.addListener('click', () => info.open(mapInstanceRef.current, marker));
      });
      setStatus(entries.length > 0 ? `✓ ${entries.length} سائق متتبّع` : 'لا يوجد تتبع بعد');
    } catch (e) {
      setStatus('✗ ' + e.message);
    }
  }

  useEffect(() => {
    if (show) renderMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, locations]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <button onClick={() => setShow((v) => !v)} className="new-report-btn" style={{
        width: '100%', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid rgba(37,99,235,0.35)',
        borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 22 }}>🗺️</div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>خريطة تتبع السواق</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>آخر موقع ضغط عليه كل سائق</div>
      </button>

      {show && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div className="field" style={{ marginTop: 0 }}>
            <label>مفتاح Google Maps API</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="الصق مفتاح API هنا" />
          </div>
          <button className="btn-primary" onClick={() => { localStorage.setItem('gmaps_api_key', apiKey); renderMap(); }}>
            💾 حفظ المفتاح وتحميل الخريطة
          </button>

          {status && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0' }}>{status}</div>}
          <div ref={mapRef} style={{ width: '100%', height: 400, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', display: apiKey ? 'block' : 'none' }} />

          <div style={{ marginTop: 14 }}>
            {Object.entries(locations).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>لا يوجد تتبع بعد — لما سائق يضغط &quot;خرائط Google&quot; على بلاغ، بيسجّل موقعه هنا تلقائيًا</div>
            ) : (
              Object.entries(locations).map(([driver, loc]) => (
                <div key={driver} className="card" style={{ marginBottom: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--transactions)' }}>🚗 {driver}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtDateTime(loc.timestamp)}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>📍 {loc.address}</div>
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
  const [locations, setLocations] = useState({});

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

  function handleTrack(d) {
    if (!window.google || !window.google.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    const addressText = ['الكويت', d.area || '', d.block ? `قطعة ${d.block}` : '', d.street ? `شارع ${d.street}` : '', d.house ? `منزل ${d.house}` : ''].filter(Boolean).join(' ');
    geocoder.geocode({ address: addressText }, (results, geoStatus) => {
      if (geoStatus === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        setLocations((prev) => ({ ...prev, [d.driver || 'بدون سائق']: { lat: loc.lat(), lng: loc.lng(), address: addressText, timestamp: new Date().toISOString() } }));
      }
    });
  }

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
          <DriverGroupBox key={driver} driver={driver} reports={items} onChanged={loadReports} onTrack={handleTrack} />
        ))
      )}

      <DriverStatsSection reports={reports} />
      <TrackingMapSection locations={locations} />
    </div>
  );
}
