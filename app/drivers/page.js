'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { searchReports } from '../../lib/reportsApi';
import { groupByDriver, DriverGroupBox } from '../../components/DriverComplaintCard';
import { playAlertTone, requestNotificationPermission, showBrowserNotification } from '../../lib/alertSound';

export default function DriversPublicPage() {
  const [reports, setReports] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const loadReportsRef = useRef(null);

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
    const channel = supabase
      .channel('drivers-new-complaints')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports', filter: 'type=eq.complaints' }, (payload) => {
        const d = payload.new?.data || {};
        playAlertTone('new');
        showBrowserNotification('🚨 بلاغ جديد', `السائق: ${d.driver || 'غير محدد'} — ${d.area || ''}`);
        loadReportsRef.current && loadReportsRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function enableSound() {
    await requestNotificationPermission();
    setSoundEnabled(true);
    playAlertTone('new');
  }

  const active = (reports || []).filter((r) => (r.data?.status || 'active') === 'active');
  const grouped = groupByDriver(active);

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>لوحة السواق</h1>
      </header>

      {!soundEnabled && (
        <button className="btn-primary" onClick={enableSound} style={{ marginBottom: 14 }}>
          🔔 تفعيل تنبيهات البلاغات الجديدة
        </button>
      )}

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
