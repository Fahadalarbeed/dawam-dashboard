'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AREA_LIST } from '../../lib/constants';
import { searchReports, todaysStats } from '../../lib/reportsApi';
import ReportModal from '../../components/ReportModal';
import ResultsList from '../../components/ResultsList';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [stats, setStats] = useState({ total: 0, faults: 0, meters: 0 });
  const [clock, setClock] = useState('');
  const [resetCountdown, setResetCountdown] = useState('--:--:--');
  const [resetPct, setResetPct] = useState(0);

  const [modalType, setModalType] = useState(null);

  const [period, setPeriod] = useState('daily');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('all');
  const [area, setArea] = useState('all');
  const [results, setResults] = useState(null);

  const [toast, setToast] = useState(null);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setUser(data.session.user);
      setCheckingAuth(false);
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
