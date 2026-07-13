'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AREA_LIST } from '../../lib/constants';
import { searchReports, todaysStats, checkIsAdmin } from '../../lib/reportsApi';
import ReportModal from '../../components/ReportModal';
import ResultsList from '../../components/ResultsList';
import ShiftLeadCard from '../../components/ShiftLeadCard';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [stats, setStats] = useState({ total: 0, faults: 0, meters: 0 });
  const [clock, setClock] = useState('');
  const [resetCountdown, setResetCountdown] = useState('--:--:--');
  const [resetPct, setResetPct] = useState(0);

  const [modalType, setModalType] = useState(null); // 'faults' | 'meters' | 'daily' | null

  const [period, setPeriod] = useState('daily');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('all');
  const [area, setArea] = useState('all');
  const [results, setResults] = useState(null); // null = not searched yet

  const [toast, setToast] = useState(null); // { text, error }
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const showToast = useCallback((text, isError) => {
    setToast({ text, error: !!isError });
    setTimeout(() => setToast(null), 7000);
  }, []);

  // auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setUser(data.session.user);
      setCheckingAuth(false);
      checkIsAdmin(data.session.user.id).then(setIsAdmin);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const refreshStats = useCallback(async () => {
    try {
      const s = await todaysStats(todayStr());
      setStats(s);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!checkingAuth) refreshStats();
  }, [checkingAuth, refreshStats]);

  // clock + reset countdown
  useEffect(() => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    function tick() {
      const now = new Date();
      setClock(`${days[now.getDay()]} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} — ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      const msLeft = midnight - now;
      const h = Math.floor(msLeft / 3600000), m = Math.floor((msLeft % 3600000) / 60000), s = Math.floor((msLeft % 60000) / 1000);
      setResetCountdown(`${pad(h)}:${pad(m)}:${pad(s)}`);
      const dayMs = 24 * 3600000;
      setResetPct((((dayMs - msLeft) / dayMs) * 100).toFixed(2));
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  function dateRangeFor(p) {
    const now = new Date();
    const end = todayStr();
    if (p === 'daily') return { from: end, to: end };
    if (p === 'weekly') {
      const start = new Date(now); start.setDate(start.getDate() - 6);
      return { from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`, to: end };
    }
    return { from: dateFrom || end, to: dateTo || end };
  }

  async function runSearch() {
    setResults(null);
    try {
      const { from, to } = dateRangeFor(period);
      const data = await searchReports({ from, to, type, area });
      setResults(data);
    } catch (e) {
      showToast('تعذر تنفيذ البحث: ' + e.message, true);
      setResults([]);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق...</div>;
  }

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--transactions)', marginBottom: 8 }}>محافظة مراقبة الفروانية</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--transactions)', boxShadow: '0 0 8px var(--transactions)' }} />
            <span>لوحة العمليات — نظام متابعة الدوام</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>لوحة متابعة الدوام</h1>
          <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{clock}</div>
        </div>
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={toggleTheme} title="تبديل الوضع الليلي/النهاري" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, width: 38, height: 38, fontSize: 17, cursor: 'pointer' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{user?.email}</div>
          <button className="btn-secondary" style={{ marginTop: 0 }} onClick={handleSignOut}>تسجيل الخروج</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <div className="card" style={{ borderColor: 'rgba(79,190,141,0.35)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>عدد المعاملات</div>
          <div className="mono" style={{ fontSize: 34, fontWeight: 800, color: 'var(--transactions)' }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>إجمالي التقارير اليوم</div>
        </div>
        <div className="card" style={{ borderColor: 'rgba(232,163,61,0.35)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>الأعطال اليومية</div>
          <div className="mono" style={{ fontSize: 34, fontWeight: 800, color: 'var(--faults)' }}>{stats.faults}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>تقارير الأعطال اليوم</div>
        </div>
        <div className="card" style={{ borderColor: 'rgba(63,182,216,0.35)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>عداد محروق</div>
          <div className="mono" style={{ fontSize: 34, fontWeight: 800, color: 'var(--meters)' }}>{stats.meters}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>تقارير العدادات اليوم</div>
        </div>
      </div>

      <ShiftLeadCard />

      <div className="card" style={{ padding: '10px 14px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          تتصفر عند منتصف الليل خلال <b className="mono" style={{ color: 'var(--text)' }}>{resetCountdown}</b>
        </div>
        <div style={{ flex: 1, height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${resetPct}%`, background: 'linear-gradient(90deg,var(--transactions),var(--meters))', borderRadius: 3 }} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>تقرير جديد</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setModalType('faults')} style={btnCardStyle('var(--faults)', 'var(--faults-bg)')}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>تقرير عطل</div>
          </button>
          <button onClick={() => setModalType('meters')} style={btnCardStyle('var(--meters)', 'var(--meters-bg)')}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🔌</div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>تقرير عداد محروق</div>
          </button>
          <button onClick={() => setModalType('daily')} style={btnCardStyle('var(--daily)', 'var(--daily-bg)')}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>التقارير اليومية</div>
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>البحث في التقارير</h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['daily', 'يومي'], ['weekly', 'اسبوعي'], ['custom', 'مخصص']].map(([val, label]) => (
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

        <button className="btn-primary" onClick={runSearch}>بحث</button>

        {results !== null && (
          <ResultsList results={results} activeType={type} isAdmin={isAdmin} onChanged={() => { runSearch(); refreshStats(); }} showToast={showToast} />
        )}
      </div>

      {modalType && (
        <ReportModal
          type={modalType}
          currentUser={user}
          onClose={() => setModalType(null)}
          onSaved={refreshStats}
        />
      )}

      {toast && <div className={`toast ${toast.error ? 'error' : 'ok'}`}>{toast.text}</div>}
    </div>
  );
}

function btnCardStyle(accent, accentBg) {
  return {
    flex: 1, minWidth: 150, padding: '16px 12px', borderRadius: 12, border: '1px solid var(--border)',
    background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'center', color: 'var(--text)',
    fontFamily: 'Cairo, sans-serif',
  };
}
