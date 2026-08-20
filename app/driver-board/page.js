'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { searchReports } from '../../lib/reportsApi';
import { groupByDriver, DriverGroupBox, fmtDateTime, todayStr } from '../../components/DriverComplaintCard';
import { playAlertTone } from '../../lib/alertSound';
import { loadGoogleMaps, getSavedApiKey } from '../../lib/googleMapsLoader';

function toLocalDateStr(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function TrackingMapSection() {
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
      setStatus(entries.length > 0 ? `✓ ${entries.length} فني أونلاين` : 'لا يوجد فنيين أونلاين حاليًا');
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
          content: `<div style="font-family:Cairo,sans-serif;direction:rtl;"><b>🔧 ${driver}</b><br><small>${fmtDateTime(loc.updated_at)}</small></div>`,
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
    setStatus(entries.length > 0 ? `✓ ${entries.length} فني أونلاين` : 'لا يوجد فنيين أونلاين حاليًا');
  }

  useEffect(() => {
    if (apiKey && !mapInstanceRef.current) initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLocations]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🗺️ خريطة تتبع الفنيين الحيّة</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>موقع كل فني عنده بلاغ نشط، لحظة بلحظة</div>
        </div>
        {apiKey && (
          <button onClick={() => setApiKey('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }} title="تغيير مفتاح API">
            ⚙️
          </button>
        )}
      </div>

      {!apiKey && (
        <div className="field" style={{ marginTop: 0 }}>
          <label>مفتاح Google Maps API</label>
          <input type="text" defaultValue="" onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = e.target.value.trim();
              if (val) { localStorage.setItem('gmaps_api_key', val); setApiKey(val); }
            }
          }} placeholder="الصق مفتاح API واضغط Enter" />
        </div>
      )}

      {status && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0' }}>{status}</div>}
      <div ref={mapRef} style={{ width: '100%', height: '70vh', minHeight: 480, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', display: apiKey ? 'block' : 'none' }} />

      <div style={{ marginTop: 14 }}>
        {Object.entries(liveLocations).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>لا يوجد فنيين أونلاين — التتبع يشتغل تلقائيًا عند أي فني عنده بلاغ نشط وفاتح صفحة الفنيين بجواله</div>
        ) : (
          Object.entries(liveLocations).map(([driver, loc]) => (
            <div key={driver} className="card" style={{ marginBottom: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--transactions)' }}>🔧 {driver}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{fmtDateTime(loc.updated_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
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
  const closed = (reports || []).filter((r) => r.data?.status === 'closed' && toLocalDateStr(r.data?.closedAt) === today);
  const list = tab === 'active' ? active : closed;
  const grouped = groupByDriver(list);

  return (
    <div className="wrap" style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="back-circle" onClick={() => router.push('/dashboard')} title="رجوع">→</button>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>لوحة الفنيين (داخلي)</h1>
      </header>

      <div className="seg-tabs">
        <button className={`seg-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          <span className="seg-dot" style={{ background: 'var(--complaints)' }} />
          <span className="seg-label">نشط</span>
          <span className="seg-count">{active.length}</span>
        </button>
        <button className={`seg-tab ${tab === 'closed' ? 'active' : ''}`} onClick={() => setTab('closed')}>
          <span className="seg-dot" style={{ background: '#4ADE80' }} />
          <span className="seg-label">مغلق اليوم</span>
          <span className="seg-count">{closed.length}</span>
        </button>
      </div>

      {!reports ? (
        <div className="card"><div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>جارٍ التحميل...</div></div>
      ) : list.length === 0 ? (
        <div className="card"><div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>لا توجد بلاغات {tab === 'active' ? 'نشطة' : 'مغلقة اليوم'}</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
          {grouped.map(([driver, items]) => (
            <DriverGroupBox key={driver} driver={driver} reports={items} onChanged={loadReports} />
          ))}
        </div>
      )}

      <TrackingMapSection />
    </div>
  );
}
