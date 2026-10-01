'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import {
  listActiveGenerators, searchGenerators, addGenerator, removeGenerator, setGeneratorStatus,
  generatorDays, totalKva,
} from '../../../lib/generatorsApi';

// مولدات محافظة الفروانية — داخل قسم التشغيل
const SHIFTS = ['A', 'B', 'C', 'D', 'E'];
const STATUS = { running: 'شغال', standby: 'ستاند باي' };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function En({ children, style }) {
  return <span className="en-sub" style={style}>{children}</span>;
}

const EMPTY = {
  gen_type: '', status: 'running', area: '', block: '', street: '', plot: '',
  station: '', uds: '', spur: '', transformer: '', unit_no: '',
  gen_count: 1, size_kva: '', gen_no: '', wires: '', shift: '', connected_on: '', notes: '',
};

export default function GeneratorsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | running | standby | LT | HT
  const [showForm, setShowForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState({ by: 'connected', from: '', to: '' });
  const [results, setResults] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setCheckingAuth(false);
    });
  }, [router]);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'light');
    return () => { if (prev) html.setAttribute('data-theme', prev); else html.removeAttribute('data-theme'); };
  }, []);

  const load = useCallback(async () => {
    try { setError(''); setActive(await listActiveGenerators()); }
    catch (e) { setError(e.message || 'تعذر التحميل'); setActive([]); }
  }, []);
  useEffect(() => { if (!checkingAuth) load(); }, [checkingAuth, load]);

  // البحث بالتاريخ
  useEffect(() => {
    if (!showSearch || (!search.from && !search.to)) { setResults(null); return; }
    let cancelled = false;
    searchGenerators(search).then((r) => { if (!cancelled) setResults(r); }).catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, [showSearch, search, active]);

  const summary = useMemo(() => {
    const list = active || [];
    const sum = (f) => list.filter(f).reduce((s, g) => s + (g.gen_count || 1), 0);
    return {
      running: sum((g) => g.status === 'running'),
      standby: sum((g) => g.status === 'standby'),
      LT: sum((g) => g.gen_type === 'LT'),
      HT: sum((g) => g.gen_type === 'HT'),
      days: list.reduce((s, g) => s + generatorDays(g), 0),
    };
  }, [active]);

  const rows = useMemo(() => {
    let list = results || active || [];
    if (filter === 'running' || filter === 'standby') list = list.filter((g) => g.status === filter);
    if (filter === 'LT' || filter === 'HT') list = list.filter((g) => g.gen_type === filter);
    return list;
  }, [results, active, filter]);
  const rowsCount = rows.reduce((s, g) => s + (g.gen_count || 1), 0);

  async function handleRemove(g) {
    if (!confirm(`إزالة المولد ${g.gen_no || ''} — ${g.area}؟\nRemove this generator?`)) return;
    setBusyId(g.id);
    try { await removeGenerator(g.id); await load(); }
    catch (e) { alert('تعذر الإزالة: ' + e.message); }
    finally { setBusyId(null); }
  }
  async function handleToggle(g) {
    setBusyId(g.id);
    try { await setGeneratorStatus(g.id, g.status === 'running' ? 'standby' : 'running'); await load(); }
    catch (e) { alert('تعذر التعديل: ' + e.message); }
    finally { setBusyId(null); }
  }

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق... / Checking...</div>;
  }

  const CARDS = [
    ['running', summary.running, 'المولدات الشغالة', 'Running', '#1E7B3A'],
    ['standby', summary.standby, 'ستاند باي', 'Standby', '#B97F00'],
    ['LT', summary.LT, 'LT — أقل من 1000 kVA', 'Low tension', '#13896A'],
    ['HT', summary.HT, 'HT — 1000 kVA وأكثر', 'High tension', '#D0592F'],
  ];
  const TABS = [['all', 'الكل'], ['running', 'شغال'], ['standby', 'ستاند باي'], ['HT', 'HT'], ['LT', 'LT']];

  return (
    <div className="wrap gen-wrap" style={{ paddingBottom: 40 }}>
      <style>{CSS}</style>

      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="back-circle" onClick={() => router.push('/operations')} title="رجوع / Back">→</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
            مولدات محافظة الفروانية <En style={{ display: 'inline', fontSize: 13, fontWeight: 600 }}>Generators</En>
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>قسم التشغيل — {fmtDate(todayISO())}</div>
        </div>
      </header>

      <div className="gen-sum">
        {CARDS.map(([key, n, ar, en, color]) => (
          <button key={key} className={`gen-card${filter === key ? ' on' : ''}`} style={{ borderTopColor: color }} onClick={() => setFilter(filter === key ? 'all' : key)}>
            <div className="gen-n mono" style={{ color }}>{active ? n : '…'}</div>
            <div className="gen-l">{ar}<En>{en}</En></div>
          </button>
        ))}
        <div className="gen-card wide" style={{ borderTopColor: '#B08D3F' }}>
          <div className="gen-l" style={{ margin: 0 }}>إجمالي أيام التشغيل<En>Total running days</En></div>
          <div className="gen-n mono" style={{ color: '#B08D3F' }}>{active ? summary.days : '…'}</div>
        </div>
      </div>

      <div className="gen-bar">
        <button className="gen-btn gold" onClick={() => setShowForm(true)}>➕ إدخال مولد جديد</button>
        <button className={`gen-btn ghost${showSearch ? ' on' : ''}`} onClick={() => setShowSearch((v) => !v)}>📅 بحث بالتاريخ</button>
      </div>

      {showSearch && (
        <div className="gen-flt">
          <div className="gen-seg">
            <button className={search.by === 'connected' ? 'on' : ''} onClick={() => setSearch({ ...search, by: 'connected' })}>حسب تاريخ الإيصال</button>
            <button className={search.by === 'removed' ? 'on' : ''} onClick={() => setSearch({ ...search, by: 'removed' })}>حسب تاريخ الإزالة</button>
          </div>
          <div className="gen-dr">
            <div><label>من / From</label><input type="date" value={search.from} onChange={(e) => setSearch({ ...search, from: e.target.value })} /></div>
            <div><label>إلى / To</label><input type="date" value={search.to} onChange={(e) => setSearch({ ...search, to: e.target.value })} /></div>
          </div>
          <div className="gen-hint">
            {results ? `نتائج البحث: ${results.length} — تشمل المولدات المُزالة` : 'اختر تاريخ — البحث يشمل المولدات المُزالة'}
            {(search.from || search.to) && <button className="gen-link" onClick={() => setSearch({ ...search, from: '', to: '' })}>مسح</button>}
          </div>
        </div>
      )}

      <div className="gen-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {error && <div className="gen-error">⚠️ {error}</div>}

      <div className="gen-tw">
        <table className="gen-table">
          <thead>
            <tr>
              <th className="grp" rowSpan={2}>م</th>
              <th className="grp" colSpan={4}>العنوان</th>
              <th className="grp" colSpan={5}>مصدر التغذية</th>
              <th className="grp" colSpan={5}>بيانات المولد</th>
              <th className="grp" rowSpan={2}>النوع</th>
              <th className="grp" rowSpan={2}>النوبة</th>
              <th className="grp" rowSpan={2}>التاريخ</th>
              <th className="grp" rowSpan={2}>الأيام</th>
              <th className="grp" rowSpan={2}>ملاحظات</th>
              <th className="grp" rowSpan={2}>إجراء</th>
            </tr>
            <tr>
              <th>المنطقة</th><th>القطعة</th><th>الشارع</th><th>القسيمة</th>
              <th>محطة</th><th>UDS</th><th>Spur</th><th>محول</th><th>اليونت</th>
              <th>العدد</th><th>الحجم kVA</th><th>رقم المولد</th><th>الوايرات</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {active === null && <tr><td colSpan={21} className="gen-empty">جارٍ التحميل...</td></tr>}
            {active !== null && rows.length === 0 && (
              <tr><td colSpan={21} className="gen-empty">{results ? 'لا توجد نتائج' : 'لا توجد مولدات — اضغط "إدخال مولد جديد"'}</td></tr>
            )}
            {rows.map((g, i) => {
              const removed = !!g.removed_at;
              const sb = g.status === 'standby';
              return (
                <tr key={g.id} className={removed ? 'rm' : sb ? 'sb' : ''}>
                  <td>{i + 1}</td>
                  <td>{g.area}</td><td>{g.block}</td><td>{g.street}</td><td>{g.plot}</td>
                  <td className="mono">{g.station}</td><td className="mono">{g.uds}</td><td className="mono">{g.spur}</td>
                  <td className="mono">{g.transformer}</td><td className="mono">{g.unit_no}</td>
                  <td className="mono">{g.gen_count}</td>
                  <td className="mono"><b>{g.size_kva}</b></td>
                  <td className="mono">{g.gen_no}</td><td className="mono">{g.wires}</td>
                  <td><span className={`gen-tag ${sb ? 'st2' : 'st1'}`}>{STATUS[g.status]}</span></td>
                  <td><span className={`gen-tag ${g.gen_type === 'LT' ? 'lt' : 'ht'}`}>{g.gen_type}</span></td>
                  <td><b>{g.shift}</b></td>
                  <td className="mono">{fmtDate(g.connected_on)}</td>
                  <td className="mono"><b>{generatorDays(g)}</b></td>
                  <td className="gen-notes">{g.notes}</td>
                  <td>
                    {removed ? (
                      <span style={{ fontSize: 11 }}>مُزال {fmtDate(g.removed_at)}</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="gen-rm" disabled={busyId === g.id} onClick={() => handleRemove(g)}>🗑️ إزالة المولد</button>
                        <button className="gen-sw" disabled={busyId === g.id} onClick={() => handleToggle(g)}>{sb ? '← شغال' : '← ستاند باي'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="tot">
                <td colSpan={10} style={{ textAlign: 'left' }}>المجموع / Total</td>
                <td className="mono">{rowsCount}</td>
                <td colSpan={10}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="gen-hint" style={{ textAlign: 'center' }}>الجدول يتمرر يمين ويسار · Scroll sideways</div>

      {showForm && <GeneratorForm onClose={() => setShowForm(false)} onSaved={async () => { setShowForm(false); await load(); }} />}
    </div>
  );
}

function GeneratorForm({ onClose, onSaved }) {
  const [f, setF] = useState({ ...EMPTY, connected_on: todayISO() });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const kva = totalKva(f.size_kva);
  const suggested = kva ? (kva >= 1000 ? 'HT' : 'LT') : '';
  const valid = f.gen_type && f.area.trim() && f.connected_on;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? (v.trim() || null) : v]));
      row.gen_count = Math.max(1, parseInt(f.gen_count, 10) || 1);
      await addGenerator(row);
      await onSaved();
    } catch (e) {
      alert('تعذر الحفظ: ' + e.message);
    } finally { setSaving(false); }
  }

  const Field = ({ k, label, en, full, type = 'text', ...rest }) => (
    <div className={full ? 'full' : ''}>
      <label>{label}{en && <span>{en}</span>}</label>
      <input type={type} value={f[k]} onChange={set(k)} {...rest} />
    </div>
  );

  return (
    <div className="gen-overlay" onClick={onClose}>
      <div className="gen-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="gen-grip" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>إدخال مولد جديد<En>New generator</En></div>
          <button className="gen-x" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>

        <div className="gen-fs">
          <h4>⚡ نوع المولد *</h4>
          <div className="gen-big">
            <button className={`lt${f.gen_type === 'LT' ? ' on' : ''}`} onClick={() => setF({ ...f, gen_type: 'LT' })}><b>LT</b><small>أقل من 1000 kVA</small></button>
            <button className={`ht${f.gen_type === 'HT' ? ' on' : ''}`} onClick={() => setF({ ...f, gen_type: 'HT' })}><b>HT</b><small>1000 kVA وأكثر</small></button>
          </div>
          {suggested && f.gen_type && suggested !== f.gen_type && (
            <div className="gen-warn">⚠️ الحجم {f.size_kva} kVA عادة {suggested} — تأكد من الاختيار</div>
          )}
        </div>

        <div className="gen-fs">
          <h4>📶 حالة المولد</h4>
          <div className="gen-big">
            <button className={`run${f.status === 'running' ? ' on' : ''}`} onClick={() => setF({ ...f, status: 'running' })}><b className="t">شغال</b><small>Running</small></button>
            <button className={`sb${f.status === 'standby' ? ' on' : ''}`} onClick={() => setF({ ...f, status: 'standby' })}><b className="t">ستاند باي</b><small>Standby</small></button>
          </div>
        </div>

        <div className="gen-fs">
          <h4>📍 العنوان</h4>
          <div className="gen-fg">
            {Field({ k: 'area', label: 'المنطقة *', en: 'Area', full: true })}
            {Field({ k: 'block', label: 'القطعة', en: 'Block' })}
            {Field({ k: 'street', label: 'الشارع', en: 'Street' })}
            {Field({ k: 'plot', label: 'رقم القسيمة', en: 'Plot', full: true })}
          </div>
        </div>

        <div className="gen-fs">
          <h4>🔌 مصدر التغذية</h4>
          <div className="gen-fg">
            {Field({ k: 'station', label: 'محطة', en: 'S/S' })}
            {Field({ k: 'uds', label: 'UDS' })}
            {Field({ k: 'spur', label: 'Spur' })}
            {Field({ k: 'transformer', label: 'محول', en: 'Transformer' })}
            {Field({ k: 'unit_no', label: 'اليونت', en: 'Unit', full: true })}
          </div>
        </div>

        <div className="gen-fs">
          <h4>⚙️ بيانات المولد</h4>
          <div className="gen-fg">
            {Field({ k: 'gen_count', label: 'عدد المولدات', type: 'number', min: 1, inputMode: 'numeric' })}
            {Field({ k: 'size_kva', label: 'حجم المولد kVA', placeholder: 'مثال: 1800 أو 500+625' })}
            {Field({ k: 'gen_no', label: 'رقم المولد', en: 'Gen. No' })}
            {Field({ k: 'wires', label: 'عدد الوايرات', en: 'Wires' })}
          </div>
        </div>

        <div className="gen-fs">
          <h4>🗓️ النوبة والتاريخ</h4>
          <div className="gen-chips">
            {SHIFTS.map((s) => (
              <button key={s} className={f.shift === s ? 'on' : ''} onClick={() => setF({ ...f, shift: f.shift === s ? '' : s })}>{s}</button>
            ))}
          </div>
          <div className="gen-fg" style={{ marginTop: 8 }}>
            {Field({ k: 'connected_on', label: 'تاريخ الإيصال *', en: 'Connected', type: 'date', full: true })}
            <div className="full">
              <label>ملاحظات<span>Notes</span></label>
              <textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="مثال: تخفيف أحمال" />
            </div>
          </div>
        </div>

        <button className="gen-save" disabled={!valid || saving} onClick={save}>
          {saving ? 'جارٍ الحفظ...' : '💾 حفظ المولد / Save'}
        </button>
        {!valid && <div className="gen-hint" style={{ textAlign: 'center' }}>الخانات المطلوبة: نوع المولد، المنطقة، تاريخ الإيصال</div>}
      </div>
    </div>
  );
}

const CSS = `
.gen-wrap { max-width: 1200px; }
.en-sub { display: block; font-size: 10.5px; font-weight: 500; color: var(--text-muted); direction: ltr; font-family: 'Cairo', sans-serif; }
.gen-sum { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
@media (min-width: 720px) { .gen-sum { grid-template-columns: repeat(5, minmax(0, 1fr)); } .gen-card.wide { grid-column: auto; display: block; } }
.gen-card {
  background: var(--surface); border: 1px solid var(--border); border-top: 4px solid; border-radius: 16px;
  padding: 11px 12px; text-align: right; font-family: 'Cairo', sans-serif; color: var(--text); cursor: pointer; box-shadow: var(--shadow);
}
.gen-card.on { outline: 2px solid var(--navy); }
.gen-card.wide { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; cursor: default; }
.gen-n { font-size: 26px; font-weight: 700; line-height: 1.1; }
.gen-l { font-size: 12.5px; font-weight: 700; margin-top: 2px; }
.gen-bar { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.gen-btn { border: none; border-radius: 12px; padding: 11px 14px; font-family: 'Cairo', sans-serif; font-size: 13.5px; font-weight: 700; cursor: pointer; }
.gen-btn.gold { background: var(--gold); color: #fff; flex: 1; }
.gen-btn.ghost { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.gen-btn.ghost.on { border-color: var(--navy); }
.gen-flt { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 10px; margin-bottom: 10px; }
.gen-seg { display: flex; gap: 4px; margin-bottom: 8px; }
.gen-seg button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-family: 'Cairo', sans-serif; font-size: 12.5px; cursor: pointer; }
.gen-seg button.on { background: var(--gold); border-color: var(--gold); color: #fff; }
.gen-dr { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gen-dr label { font-size: 11px; color: var(--text-muted); }
.gen-hint { font-size: 11.5px; color: var(--text-muted); margin-top: 6px; }
.gen-link { background: none; border: none; color: var(--gold); font-family: 'Cairo', sans-serif; font-weight: 700; cursor: pointer; margin-inline-start: 8px; }
.gen-tabs { display: flex; gap: 6px; margin-bottom: 10px; overflow-x: auto; }
.gen-tabs button { flex: 1; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.gen-tabs button.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.gen-error { background: #FDECEA; color: #B3261E; border-radius: 12px; padding: 10px 12px; font-size: 13px; margin-bottom: 10px; }
.gen-tw { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
.gen-table { border-collapse: collapse; width: 100%; min-width: 1320px; font-size: 12.5px; }
.gen-table th { background: var(--navy); color: #fff; font-weight: 600; padding: 7px 6px; text-align: center; white-space: nowrap; border-left: 1px solid rgba(255,255,255,.15); }
.gen-table th.grp { background: #0E1830; }
.gen-table td { padding: 7px 6px; border-bottom: 1px solid var(--border); border-left: 1px solid var(--surface-2); white-space: nowrap; text-align: center; }
.gen-table tr.sb td { background: #FFFBF0; }
.gen-table tr.rm td { color: var(--text-muted); background: #FAFAF7; }
.gen-table tr.tot td { background: var(--surface-2); font-weight: 700; }
.gen-table b { font-weight: 700; }
.gen-notes { white-space: normal !important; min-width: 140px; text-align: right !important; }
.gen-empty { padding: 22px !important; color: var(--text-muted); }
.gen-tag { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.gen-tag.lt { background: #DDF3EC; color: #13896A; } .gen-tag.ht { background: #FDE7DF; color: #D0592F; }
.gen-tag.st1 { background: #E6F4EA; color: #1E7B3A; } .gen-tag.st2 { background: #FFF1CC; color: #8A5A00; }
.gen-rm { border: 1px solid #E6B3AE; background: #FDF1EF; color: #B3261E; border-radius: 9px; padding: 5px 9px; font-family: 'Cairo', sans-serif; font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.gen-sw { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 9px; padding: 5px 9px; font-family: 'Cairo', sans-serif; font-size: 11.5px; cursor: pointer; white-space: nowrap; }
.gen-rm:disabled, .gen-sw:disabled { opacity: .5; }
.gen-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(22,35,63,.45); display: flex; align-items: flex-end; justify-content: center; }
.gen-sheet { width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; background: var(--surface); border-radius: 22px 22px 0 0; padding: 10px 18px calc(22px + env(safe-area-inset-bottom, 0px)); }
.gen-grip { width: 42px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 14px; }
.gen-x { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
.gen-fs { border: 1px solid var(--border); border-radius: 14px; padding: 10px 12px; margin-top: 10px; }
.gen-fs h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #8A6E2E; }
.gen-fg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gen-fg .full { grid-column: 1 / -1; }
.gen-fg label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; }
.gen-fg label span { color: var(--text-muted); font-weight: 500; font-size: 10.5px; margin-inline-start: 5px; direction: ltr; }
.gen-big { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gen-big button { padding: 11px 6px; border-radius: 14px; border: 2px solid var(--border); background: var(--surface); font-family: 'Cairo', sans-serif; cursor: pointer; color: var(--text); line-height: 1.25; }
.gen-big b { display: block; font-size: 20px; font-weight: 800; }
.gen-big b.t { font-size: 15px; }
.gen-big small { font-size: 11px; color: var(--text-muted); }
.gen-big .lt.on { border-color: #13896A; background: #DDF3EC; color: #13896A; }
.gen-big .ht.on { border-color: #D0592F; background: #FDE7DF; color: #D0592F; }
.gen-big .run.on { border-color: #1E7B3A; background: #E6F4EA; color: #1E7B3A; }
.gen-big .sb.on { border-color: #B97F00; background: #FFF1CC; color: #8A5A00; }
.gen-big .on small { color: inherit; }
.gen-warn { font-size: 11.5px; color: #8A5A00; background: #FFF1CC; border-radius: 10px; padding: 6px 10px; margin-top: 8px; }
.gen-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.gen-chips button { min-width: 44px; padding: 8px 12px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--surface); font-family: 'Cairo', sans-serif; font-size: 13.5px; font-weight: 700; cursor: pointer; color: var(--text); }
.gen-chips button.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.gen-save { width: 100%; margin-top: 14px; border: none; border-radius: 14px; padding: 14px; background: var(--gold); color: #fff; font-family: 'Cairo', sans-serif; font-size: 15px; font-weight: 800; cursor: pointer; }
.gen-save:disabled { opacity: .5; cursor: default; }
`;
