'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DRIVERS_LIST } from '../../lib/constants';
import { searchReports } from '../../lib/reportsApi';
import { groupByDriver, DriverGroupBox } from '../../components/DriverComplaintCard';
import { playAlertTone, requestNotificationPermission, showBrowserNotification } from '../../lib/alertSound';
import TechnicianRevisionSection from '../../components/TechnicianRevisionSection';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function DriversPublicPage() {
  const [reports, setReports] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState('');
  const [myName, setMyName] = useState('');
  const [namePicked, setNamePicked] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [trackingOn, setTrackingOn] = useState(false);
  const loadReportsRef = useRef(null);
  const watchIdRef = useRef(null);

  const loadReports = useCallback(async () => {
    try {
      const data = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
      setReports(data);
    } catch (e) {
      console.error(e);
      setReports([]);
    }
  }, []);

  useEffect(() => { loadReportsRef.current = loadReports; }, [loadReports]);
  useEffect(() => { loadReports(); }, [loadReports]);

  useEffect(() => {
    const saved = localStorage.getItem('my_driver_name');
    if (saved) { setMyName(saved); setNamePicked(true); }
    if (localStorage.getItem('tracking_on') === '1') setTrackingOn(true);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('drivers-new-complaints')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports', filter: 'type=eq.complaints' }, (payload) => {
        const d = payload.new?.data || {};
        playAlertTone('new');
        showBrowserNotification('🚨 بلاغ جديد', `الفني: ${d.driver || 'غير محدد'} — ${d.area || ''}`);
        loadReportsRef.current && loadReportsRef.current();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: 'type=eq.complaints' }, () => {
        // a complaint changed status (e.g. closed by staff on the internal board) — refresh so
        // active-complaint counts (and therefore GPS tracking) stay accurate immediately.
        loadReportsRef.current && loadReportsRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('✗ الجهاز/المتصفح ما يدعم إشعارات الدفع (جرّب Chrome بالأندرويد، أو ضيف الصفحة للشاشة الرئيسية لو آيفون)');
      return;
    }
    try {
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('✗ ما وافقت على إذن الإشعارات');
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        });
      }
      const res = await fetch('/api/save-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver: myName, subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPushStatus('✗ تعذر تسجيل التنبيهات: ' + (body.error || res.statusText));
        return;
      }
      setPushStatus('✓ تفعّلت إشعارات البلاغات — بتوصلك حتى لو الصفحة مقفولة');
    } catch (e) {
      setPushStatus('✗ خطأ: ' + e.message);
    }
  }

  async function enableSound() {
    await requestNotificationPermission();
    setSoundEnabled(true);
    playAlertTone('new');
    await subscribeToPush();
  }

  const active = (reports || []).filter((r) => (r.data?.status || 'active') === 'active');
  const grouped = groupByDriver(active);
  const myActiveCount = active.filter((r) => r.data?.driver === myName).length;

  // Live GPS tracking stays on until the technician turns it off, so staff can see
  // idle technicians too and route new complaints to whoever is actually closest.
  useEffect(() => {
    if (!namePicked || !myName || !trackingOn) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('');
      return undefined;
    }
    if (!('geolocation' in navigator)) {
      setGpsStatus('✗ الجهاز ما يدعم تحديد الموقع');
      return undefined;
    }
    if (watchIdRef.current !== null) return undefined; // already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { error } = await supabase.from('driver_locations').upsert({
          driver: myName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated_at: new Date().toISOString(),
        });
        setGpsStatus(error
          ? '✗ فشل إرسال الموقع: ' + error.message
          : '🟢 التتبع شغّال — آخر تحديث ' + new Date().toLocaleTimeString('ar-KW'));
      },
      (err) => { setGpsStatus('✗ تعذر تحديد الموقع: ' + err.message); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [namePicked, myName, trackingOn]);

  async function toggleTracking() {
    const next = !trackingOn;
    setTrackingOn(next);
    localStorage.setItem('tracking_on', next ? '1' : '0');
    if (!next && myName) {
      // remove the pin so staff don't see a stale position
      await supabase.from('driver_locations').delete().eq('driver', myName);
    }
  }

  function pickName(name) {
    setMyName(name);
    setNamePicked(true);
    localStorage.setItem('my_driver_name', name);
  }

  if (!namePicked) {
    return (
      <div className="wrap">
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>لوحة الفنيين</h1>
        </header>
        <div className="card">
          <div className="field" style={{ marginTop: 0 }}>
            <label>من أنت؟ اختر اسمك</label>
            <select onChange={(e) => e.target.value && pickName(e.target.value)} defaultValue="">
              <option value="" disabled>اختر اسمك...</option>
              {DRIVERS_LIST.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            نحتاج نعرف من أنت عشان نقدر نرسل موقعك الحي للوحة الداخلية أثناء ما عندك بلاغ نشط.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>لوحة الفنيين</h1>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>🔧 {myName}</span>
      </header>

      <div className="framed" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>
              {trackingOn ? '📍 التتبع شغّال' : '📍 التتبع متوقف'}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
              {trackingOn ? 'موقعك يوصل للإدارة لتوزيع أقرب بلاغ لك' : 'فعّله عشان توصلك البلاغات القريبة منك'}
            </div>
          </div>
          <button
            onClick={toggleTracking}
            style={{
              flexShrink: 0, border: '1px solid', borderRadius: 999, padding: '8px 16px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
              background: trackingOn ? 'var(--transactions)' : 'transparent',
              borderColor: trackingOn ? 'var(--transactions)' : 'var(--border)',
              color: trackingOn ? '#fff' : 'var(--text-muted)',
            }}
          >
            {trackingOn ? 'إيقاف' : 'تفعيل'}
          </button>
        </div>
        {gpsStatus && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            {gpsStatus}
          </div>
        )}
      </div>

      {!soundEnabled && (
        <button className="btn-primary" onClick={enableSound} style={{ marginBottom: 14 }}>
          🔔 تفعيل تنبيهات البلاغات الجديدة
        </button>
      )}

      {pushStatus && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 14 }}>{pushStatus}</div>
      )}

      <TechnicianRevisionSection driverName={myName} />

      {!reports ? (
        <div className="card"><div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>جارٍ التحميل...</div></div>
      ) : active.length === 0 ? (
        <div className="card"><div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>لا توجد بلاغات نشطة</div></div>
      ) : (
        grouped.map(([driver, list]) => (
          <DriverGroupBox key={driver} driver={driver} reports={list} onChanged={loadReports} />
        ))
      )}
    </div>
  );
}
