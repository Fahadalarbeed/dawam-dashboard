'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { searchReports, todaysStats, checkIsAdmin } from '../../lib/reportsApi';
import ShiftLeadCard from '../../components/ShiftLeadCard';
import PendingApprovalSection from '../../components/PendingApprovalSection';
import ReturnedToTechnicianSection from '../../components/ReturnedToTechnicianSection';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const NAV_ITEMS = [
  { key: 'complaints', href: '/complaints', icon: '📢', label: 'البلاغات', color: 'var(--complaints)', bg: 'var(--complaints-bg)' },
  { key: 'reports', href: '/reports', icon: '📄', label: 'التقارير', color: 'var(--transactions)', bg: 'var(--transactions-bg)' },
  { key: 'technicians', href: '/driver-board', icon: '🔧', label: 'لوحة الفنيين', color: 'var(--daily)', bg: 'var(--daily-bg)' },
  { key: 'stats', href: '/stats', icon: '📊', label: 'الإحصائيات', color: 'var(--meters)', bg: 'var(--meters-bg)' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [stats, setStats] = useState({ total: 0, faults: 0, meters: 0 });
  const [complaintCounts, setComplaintCounts] = useState({ active: 0, doneToday: 0 });
  const [clock, setClock] = useState('');
  const [resetCountdown, setResetCountdown] = useState('--:--:--');
  const [resetPct, setResetPct] = useState(0);

  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  // auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setUser(data.session.user);
      setCheckingAuth(false);
      checkIsAdmin(data.session.user.id);
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

    try {
      const rows = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
      const t = todayStr();
      setComplaintCounts({
        active: rows.filter((r) => (r.data?.status || 'active') === 'active').length,
        doneToday: rows.filter((r) => r.data?.status === 'closed' && (r.data?.closedAt || '').slice(0, 10) === t).length,
      });
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!checkingAuth) refreshStats();
  }, [checkingAuth, refreshStats]);

  // clock
  useEffect(() => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    function tick() {
      const now = new Date();
      setClock(`${days[now.getDay()]} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} — ${pad(now.getHours())}:${pad(now.getMinutes())}`);
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      const msLeft = midnight - now;
      const h = Math.floor(msLeft / 3600000);
      const m = Math.floor((msLeft % 3600000) / 60000);
      const s = Math.floor((msLeft % 60000) / 1000);
      setResetCountdown(`${pad(h)}:${pad(m)}:${pad(s)}`);
      const dayMs = 24 * 3600000;
      setResetPct((((dayMs - msLeft) / dayMs) * 100).toFixed(2));
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق...</div>;
  }

  const boxes = [
    { key: 'active', icon: '🟠', value: complaintCounts.active, label: 'البلاغات النشطة', color: 'var(--complaints)', go: '/driver-board' },
    { key: 'done', icon: '✅', value: complaintCounts.doneToday, label: 'البلاغات المنجزة', color: 'var(--transactions)', go: '/driver-board' },
    { key: 'faults', icon: '⚠️', value: stats.faults, label: 'الأعطال اليومية', color: 'var(--faults)', go: '/reports' },
    { key: 'meters', icon: '📟', value: stats.meters, label: 'عدادات محروقة', color: 'var(--meters)', go: '/reports' },
  ];

  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.2px' }}>محافظة الفروانية</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{clock}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleTheme}
            title="تبديل الوضع الليلي/النهاري"
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '50%', width: 38, height: 38, fontSize: 15, cursor: 'pointer', opacity: 0.75 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="icon-nav">
        {NAV_ITEMS.map((item) => (
          <button key={item.key} className="icon-nav-btn" onClick={() => router.push(item.href)}>
            <span className="icon-nav-circle" style={{ background: item.bg, color: item.color }}>{item.icon}</span>
            <span className="icon-nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="home-grid">
        {boxes.map((b) => (
          <div key={b.key} className="home-box" style={{ '--accent': b.color }} onClick={() => router.push(b.go)}>
            <div className="home-box-icon" style={{ color: b.color }}>{b.icon}</div>
            <div className="home-box-value" style={{ color: b.color }}>{b.value}</div>
            <div className="home-box-label">{b.label}</div>
          </div>
        ))}
      </div>

      <ShiftLeadCard />

      <div className="reset-bar-wrap">
        <div className="reset-label">
          تتصفر عند منتصف الليل خلال <b className="mono">{resetCountdown}</b>
        </div>
        <div className="reset-bar-track">
          <div className="reset-bar-fill" style={{ width: `${resetPct}%` }} />
        </div>
      </div>

      <PendingApprovalSection />
      <ReturnedToTechnicianSection />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 22, fontSize: 11.5, color: 'var(--text-muted)' }}>
        <span>{user?.email}</span>
        <button className="btn-secondary" style={{ marginTop: 0 }} onClick={handleSignOut}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
