'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AREA_LIST } from '../../lib/constants';
import { searchReports, checkIsAdmin } from '../../lib/reportsApi';
import ReportModal from '../../components/ReportModal';
import ResultsList from '../../components/ResultsList';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [modalType, setModalType] = useState(null);

  const [period, setPeriod] = useState('daily');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('all');
  const [area, setArea] = useState('all');
  const [block, setBlock] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [meterNo, setMeterNo] = useState('');
  const [house, setHouse] = useState('');
  const [paci, setPaci] = useState('');
  const [results, setResults] = useState(null);
  const [periodStats, setPeriodStats] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, isError) => {
    setToast({ text, error: !!isError });
    setTimeout(() => setToast(null), 7000);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setUser(data.session.user);
      setCheckingAuth(false);
      checkIsAdmin(data.session.user.id).then(setIsAdmin);
    });
  }, [router]);

  function dateRangeFor(p) {
    const now = new Date();
    const end = todayStr();
    if (p === 'all') return { from: '2000-01-01', to: end };
    if (p === 'daily') return { from: end, to: end };
    if (p === 'weekly') {
      const start = new Date(now); start.setDate(start.getDate() - 6);
      return { from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`, to: end };
    }
    return { from: dateFrom || end, to: dateTo || end };
  }

  const runSearch = useCallback(async (overridePeriod, overrideType) => {
    const p = overridePeriod || period;
    const t = overrideType || type;
    setResults(null);
    try {
      const { from, to } = dateRangeFor(p);
      const dateFiltered = await searchReports({ from, to, type: 'all' });
      setPeriodStats({
        all: dateFiltered.length,
        faults: dateFiltered.filter((r) => r.type === 'faults').length,
        meters: dateFiltered.filter((r) => r.type === 'meters').length,
        daily: dateFiltered.filter((r) => r.type === 'daily').length,
      });
      const data = await searchReports({ from, to, type: t, area, block, street, building, house, paci, meterNo });
      setResults(data);
    } catch (e) {
      showToast('تعذر تنفيذ البحث: ' + e.message, true);
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, type, area, block, street, building, house, paci, meterNo, dateFrom, dateTo, showToast]);

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق...</div>;
  }

  return (
    <div className="wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button className="back-circle" onClick={() => router.push('/dashboard')} title="رجوع">→</button>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>التقارير</h1>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>إنشاء تقرير</h2>
        <div className="circle-row">
          <button className="circle-btn faults" onClick={() => setModalType('faults')}>
            <span className="circle-btn-ring">⚡</span>
            <span className="circle-btn-label">تقرير عطل</span>
          </button>
          <button className="circle-btn meters" onClick={() => setModalType('meters')}>
            <span className="circle-btn-ring">🔌</span>
            <span className="circle-btn-label">عداد محروق</span>
          </button>
          <button className="circle-btn daily" onClick={() => setModalType('daily')}>
            <span className="circle-btn-ring">📋</span>
            <span className="circle-btn-label">التقارير اليومية</span>
          </button>
        </div>
      </div>

      <div className="card" id="search-panel">
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>البحث في التقارير</h2>

        {periodStats && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', marginBottom: 14 }}>
            {[['all', 'الإجمالي', 'var(--transactions)'], ['faults', 'الأعطال', 'var(--faults)'], ['meters', 'العدادات', 'var(--meters)']].map(([key, label, color]) => (
              <div key={key} style={{ flex: '1 1 0', minWidth: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                <div className="mono" style={{ fontSize: 19, fontWeight: 700, color }}>{periodStats[key]}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {[['all', 'الكل'], ['daily', 'يومي'], ['weekly', 'اسبوعي'], ['custom', 'مخصص']].map(([val, label]) => (
            <button key={val} className={`chip ${period === val ? 'active' : ''}`} onClick={() => setPeriod(val)}>{label}</button>
          ))}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div className="field" style={{ marginTop: 0 }}><label>من</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div className="field" style={{ marginTop: 0 }}><label>إلى</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          </div>
        )}

        <div className="field">
          <label>نوع التقرير</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {[['all', 'الكل'], ['faults', 'الأعطال'], ['meters', 'العدادات'], ['daily', 'التقارير اليومية']].map(([val, label]) => (
              <button key={val} className={`chip ${type === val ? 'active' : ''}`} onClick={() => setType(val)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>المنطقة</label>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">كل المناطق</option>
            {AREA_LIST.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field"><label>القطعة</label><input type="text" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="بحث بالقطعة" /></div>
          <div className="field"><label>الشارع</label><input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="بحث بالشارع" /></div>
          <div className="field"><label>القسيمة</label><input type="text" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="بحث بالقسيمة" /></div>
          <div className="field"><label>المنزل</label><input type="text" value={house} onChange={(e) => setHouse(e.target.value)} placeholder="بحث بالمنزل" /></div>
          <div className="field"><label>الرقم الآلي (PACI)</label><input type="text" value={paci} onChange={(e) => setPaci(e.target.value)} placeholder="بحث بالرقم الآلي" /></div>
          {type === 'meters' && (
            <div className="field"><label>رقم العداد</label><input type="text" value={meterNo} onChange={(e) => setMeterNo(e.target.value)} placeholder="بحث برقم العداد" /></div>
          )}
        </div>

        <button className="btn-primary" onClick={() => runSearch()}>بحث</button>

        {results !== null && (
          <ResultsList results={results} activeType={type} isAdmin={isAdmin} onChanged={() => runSearch()} showToast={showToast} />
        )}
      </div>

      {modalType && (
        <ReportModal
          type={modalType}
          currentUser={user}
          onClose={() => setModalType(null)}
          onSaved={() => runSearch()}
        />
      )}

      {toast && <div className={`toast ${toast.error ? 'error' : 'ok'}`}>{toast.text}</div>}
    </div>
  );
}
