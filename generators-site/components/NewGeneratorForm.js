'use client';
import { useEffect, useMemo, useState } from 'react';
import { listActiveGenerators, addGenerator, removeGenerator, generatorDays, GEN_SIZES, INSTALL_REASONS } from '../lib/generatorsApi';
import { getCurrentShiftLetter } from '../lib/shift';
import { AREA_LIST } from '../lib/constants';

// نموذج تركيب / إزالة مولد — نفس فكرة نموذج Jotform بتصميمنا وبيانات الفروانية
// كل تسجيل يظهر على طول بجدول المولدات بالصفحة الرئيسية

const SHIFTS = ['A', 'B', 'C', 'D', 'E'];
const FEEDS = [['station', 'محطة'], ['uds', 'UDS'], ['spur', 'Spur'], ['transformer', 'محول'], ['unit_no', 'اليونت']];

function pad(n) { return String(n).padStart(2, '0'); }
function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local) { return local ? new Date(local).toISOString() : null; }
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const blankGen = () => ({ size: '', no: '', other: false });

// embedded: يفتح كنافذة فوق جدول المولدات بدل صفحة جديدة
export default function NewGeneratorForm({ embedded = false, onClose, onSaved }) {
  const [mode, setMode] = useState('install'); // install | remove
  const [status, setStatus] = useState('running'); // running | standby
  const [genType, setGenType] = useState(''); // LT | HT
  const [done, setDone] = useState(null);

  return (
    <div className={embedded ? 'nf-wrap nf-embed' : 'wrap nf-wrap'}>
      <style>{CSS}</style>
      <header className="nf-head">
        <img src="/logo.png" alt="" />
        <div style={{ flex: 1 }}>
          <h1>مولدات محافظة الفروانية</h1>
          <div className="nf-sub">نموذج تركيب أو إزالة مولد — عبّي البيانات بدقة واضغط إرسال</div>
        </div>
        {embedded && <button className="nf-x" onClick={onClose} aria-label="إغلاق">✕</button>}
      </header>

      {done ? (
        <div className="nf-card nf-done">
          <div className="nf-ok">✓</div>
          <h2>{done === 'install' ? 'تم تسجيل تركيب المولد' : 'تم تسجيل إزالة المولد'}</h2>
          <p>انضاف على طول بجدول المولدات</p>
          <div className="nf-row">
            <button className="nf-btn gold" onClick={() => setDone(null)}>➕ تسجيل جديد</button>
            {embedded
              ? <button className="nf-btn ghost" onClick={onClose}>📋 جدول المولدات</button>
              : <a className="nf-btn ghost" href="/">📋 جدول المولدات</a>}
          </div>
        </div>
      ) : (
        <>
          <div className="nf-card">
            <label className="nf-label">تركيب أو إزالة *</label>
            <div className="nf-big">
              <button className={`inst${mode === 'install' ? ' on' : ''}`} onClick={() => setMode('install')}><b>تركيب</b><small>Install</small></button>
              <button className={`rem${mode === 'remove' ? ' on' : ''}`} onClick={() => setMode('remove')}><b>إزالة</b><small>Remove</small></button>
            </div>
            {mode === 'install' && (
              <>
                <label className="nf-label" style={{ marginTop: 14 }}>حالة المولد *</label>
                <div className="nf-big">
                  <button className={`run${status === 'running' ? ' on' : ''}`} onClick={() => setStatus('running')}><b>شغال</b><small>Running</small></button>
                  <button className={`sb${status === 'standby' ? ' on' : ''}`} onClick={() => setStatus('standby')}><b>ستاند باي</b><small>Stand by</small></button>
                </div>
                <label className="nf-label" style={{ marginTop: 14 }}>نوع المولد *</label>
                <div className="nf-big">
                  <button className={`lt${genType === 'LT' ? ' on' : ''}`} onClick={() => setGenType('LT')}><b className="mono">LT</b></button>
                  <button className={`ht${genType === 'HT' ? ' on' : ''}`} onClick={() => setGenType('HT')}><b className="mono">HT</b></button>
                </div>
              </>
            )}
          </div>
          {mode === 'install'
            ? <InstallForm status={status} genType={genType} onDone={() => { setDone('install'); onSaved?.(); }} />
            : <RemoveForm onDone={() => { setDone('remove'); onSaved?.(); }} />}
        </>
      )}
      {embedded
        ? <button className="nf-foot" onClick={onClose}>← رجوع لجدول المولدات</button>
        : <a className="nf-foot" href="/">← جدول المولدات</a>}
    </div>
  );
}

function InstallForm({ status, genType, onDone }) {
  const [f, setF] = useState({
    shift: '', request_at: nowLocal(), installed_at: nowLocal(),
    gen_count: 1, status: 'running', gen_type: '', area: '', block: '', street: '', plot: '',
    station: '', uds: '', spur: '', transformer: '', unit_no: '', wires: '', install_reason: '', notes: '', entered_by: '',
  });
  const [gens, setGens] = useState([blankGen()]);
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setF((p) => ({ ...p, shift: p.shift || getCurrentShiftLetter() }));
    try { const n = localStorage.getItem('gen_form_name'); if (n) setF((p) => ({ ...p, entered_by: n })); } catch { /* ignore */ }
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  function setCount(n) {
    setF({ ...f, gen_count: n });
    setGens((prev) => Array.from({ length: n }, (_, i) => prev[i] || blankGen()));
  }
  function setGen(i, patch) { setGens((prev) => prev.map((g, j) => (j === i ? { ...g, ...patch } : g))); }

  const missing = [];
  if (!f.shift) missing.push('النوبة');
  if (!f.request_at) missing.push('وقت طلب التركيب');
  if (!f.installed_at) missing.push('وقت التركيب');
  if (gens.some((g) => !g.size)) missing.push('حجم المولد');
  if (!genType) missing.push('نوع المولد');
  if (!f.area) missing.push('المنطقة');
  if (!f.install_reason || (f.install_reason === 'أخرى' && !other.trim())) missing.push('سبب التركيب');
  if (!f.entered_by.trim()) missing.push('اسم اللي ركّب المولد');

  async function submit() {
    if (missing.length) { setErr('عبّي: ' + missing.join('، ')); return; }
    setSaving(true); setErr('');
    try {
      const clean = (v) => (typeof v === 'string' ? (v.trim() || null) : v);
      const installedIso = toIso(f.installed_at);
      const kw = new Date(new Date(installedIso).getTime() + 3 * 3600000).toISOString().slice(0, 10); // تاريخ الكويت
      const row = {
        source: 'form',
        shift: f.shift,
        request_at: toIso(f.request_at),
        installed_at: installedIso,
        connected_on: kw,
        gen_count: f.gen_count,
        size_kva: gens.map((g) => g.size).join('+'),
        gen_no: gens.some((g) => g.no.trim()) ? gens.map((g) => g.no.trim() || '-').join('+') : null,
        status,
        gen_type: genType,
        area: f.area,
        block: clean(f.block), street: clean(f.street), plot: clean(f.plot),
        station: clean(f.station), uds: clean(f.uds), spur: clean(f.spur), transformer: clean(f.transformer), unit_no: clean(f.unit_no),
        wires: clean(f.wires),
        install_reason: f.install_reason === 'أخرى' ? `أخرى - ${other.trim()}` : f.install_reason,
        notes: clean(f.notes),
        entered_by: clean(f.entered_by),
      };
      await addGenerator(row);
      try { if (f.entered_by.trim()) localStorage.setItem('gen_form_name', f.entered_by.trim()); } catch { /* ignore */ }
      onDone();
    } catch (e) { setErr('تعذر الإرسال: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="nf-card">
        <label className="nf-label">النوبة * <span className="nf-auto">— تلقائي حسب الجدول</span></label>
        <div className="nf-chips">{SHIFTS.map((s) => <button key={s} className={f.shift === s ? 'on' : ''} onClick={() => setF({ ...f, shift: s })}>{s}</button>)}</div>

        <div className="nf-grid" style={{ marginTop: 12 }}>
          <div className="full"><label>التاريخ / وقت طلب التركيب *</label><input type="datetime-local" value={f.request_at} onChange={set('request_at')} /></div>
          <div className="full"><label>وقت التركيب *</label><input type="datetime-local" value={f.installed_at} onChange={set('installed_at')} /></div>
        </div>
      </div>

      <div className="nf-card">
        <label className="nf-label">عدد المولدات *</label>
        <div className="nf-chips">{[1, 2, 3, 4].map((n) => <button key={n} className={f.gen_count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>)}</div>
        {gens.map((g, i) => (
          <div key={i} className="nf-gen">
            <div className="nf-gen-t">المولد {i + 1}</div>
            <label>حجم المولد {i + 1} (kVA) *</label>
            <div className="nf-chips sizes">
              {GEN_SIZES.map((sz) => <button key={sz} className={g.size === sz && !g.other ? 'on' : ''} onClick={() => setGen(i, { size: sz, other: false })}>{sz}</button>)}
              <button className={g.other ? 'on' : ''} onClick={() => setGen(i, { other: true, size: '' })}>أخرى</button>
            </div>
            {g.other && (
              <input style={{ marginTop: 8 }} inputMode="numeric" value={g.size} onChange={(e) => setGen(i, { size: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="اكتب الحجم kVA" />
            )}
            <label style={{ marginTop: 8 }}>رقم المولد {i + 1}</label>
            <input value={g.no} onChange={(e) => setGen(i, { no: e.target.value })} placeholder="رقم المولد" />
          </div>
        ))}
        <div className="nf-grid" style={{ marginTop: 10 }}>
          <div className="full"><label>عدد الوايرات</label><input value={f.wires} onChange={set('wires')} placeholder="مثال: 11" /></div>
        </div>
      </div>

      <div className="nf-card">
        <label className="nf-label">📍 العنوان</label>
        <div className="nf-grid">
          <div className="full">
            <label>المنطقة *</label>
            <select value={f.area} onChange={set('area')}>
              <option value="">— اختر المنطقة —</option>
              {AREA_LIST.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div><label>القطعة</label><input value={f.block} onChange={set('block')} /></div>
          <div><label>الشارع</label><input value={f.street} onChange={set('street')} /></div>
          <div className="full"><label>رقم القسيمة</label><input value={f.plot} onChange={set('plot')} /></div>
        </div>
      </div>

      <div className="nf-card">
        <label className="nf-label">🔌 مصدر التغذية</label>
        <div className="nf-grid">
          {FEEDS.map(([k, label]) => (
            <div key={k} className={k === 'unit_no' ? 'full' : ''}><label>{label}</label><input value={f[k]} onChange={set(k)} /></div>
          ))}
        </div>
      </div>

      <div className="nf-card">
        <label className="nf-label">سبب التركيب *</label>
        <div className="nf-chips">{INSTALL_REASONS.map((r) => <button key={r} className={f.install_reason === r ? 'on' : ''} onClick={() => setF({ ...f, install_reason: r })}>{r}</button>)}</div>
        {f.install_reason === 'أخرى' && <input style={{ marginTop: 8 }} value={other} onChange={(e) => setOther(e.target.value)} placeholder="اكتب السبب" />}
        <div className="nf-grid" style={{ marginTop: 12 }}>
          <div className="full"><label>الملاحظات</label><textarea rows={3} value={f.notes} onChange={set('notes')} /></div>
          <div className="full"><label>اسم اللي ركّب المولد *</label><input value={f.entered_by} onChange={set('entered_by')} placeholder="الاسم" /></div>
        </div>
      </div>

      {err && <div className="nf-err">{err}</div>}
      <button className="nf-submit" disabled={saving} onClick={submit}>{saving ? 'جارٍ الإرسال...' : 'إرسال'}</button>
    </>
  );
}

function RemoveForm({ onDone }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null);
  const [requestAt, setRequestAt] = useState(nowLocal());
  const [removedAt, setRemovedAt] = useState(nowLocal());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    listActiveGenerators().then(setList).catch((e) => setErr(e.message));
    try { const n = localStorage.getItem('gen_remover_name'); if (n) setName(n); } catch { /* ignore */ }
  }, []);

  const shown = useMemo(() => {
    const n = q.trim();
    return (list || []).filter((g) => !n || [g.area, g.block, g.street, g.plot, g.gen_no, g.size_kva, g.station, g.uds].join(' ').includes(n));
  }, [list, q]);

  async function submit() {
    if (!pick) { setErr('اختر المولد'); return; }
    if (!name.trim()) { setErr('اكتب اسم اللي أزال المولد'); return; }
    setSaving(true); setErr('');
    try {
      await removeGenerator(pick.id, name.trim(), { removedAt: toIso(removedAt), requestAt: toIso(requestAt) });
      try { localStorage.setItem('gen_remover_name', name.trim()); } catch { /* ignore */ }
      onDone();
    } catch (e) { setErr('تعذر الإرسال: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="nf-card">
        <label className="nf-label">اختر المولد *</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث: المنطقة، رقم المولد، المحطة..." />
        <div className="nf-list">
          {list === null && <div className="nf-empty">جارٍ التحميل...</div>}
          {list && shown.length === 0 && <div className="nf-empty">لا توجد مولدات</div>}
          {shown.map((g) => (
            <button key={g.id} className={`nf-item${pick?.id === g.id ? ' on' : ''}`} onClick={() => setPick(g)}>
              <span className={`nf-tag ${g.gen_type === 'LT' ? 'lt' : 'ht'}`}>{g.gen_type}</span>
              <span className="nf-item-main">
                <b>{g.area}{g.block ? ` — قطعة ${g.block}` : ''}{g.street ? ` — شارع ${g.street}` : ''}</b>
                <small className="mono">{g.size_kva} kVA{g.gen_no ? ` · رقم ${g.gen_no}` : ''} · {fmtDate(g.connected_on)} · {generatorDays(g)} يوم</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="nf-card">
        <div className="nf-grid">
          <div className="full"><label>التاريخ / وقت طلب الإزالة *</label><input type="datetime-local" value={requestAt} onChange={(e) => setRequestAt(e.target.value)} /></div>
          <div className="full"><label>وقت الإزالة *</label><input type="datetime-local" value={removedAt} onChange={(e) => setRemovedAt(e.target.value)} /></div>
          <div className="full"><label>اسم اللي أزال المولد *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" /></div>
        </div>
      </div>

      {err && <div className="nf-err">{err}</div>}
      <button className="nf-submit rem" disabled={saving} onClick={submit}>{saving ? 'جارٍ الإرسال...' : 'إرسال الإزالة'}</button>
    </>
  );
}

const CSS = `
.nf-wrap { max-width: 620px; padding-bottom: 40px; }
.nf-embed { margin: 0 auto; }
.nf-x { width: 36px; height: 36px; flex: none; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-size: 15px; cursor: pointer; }
button.nf-foot { background: none; border: none; cursor: pointer; font-family: 'Cairo', sans-serif; width: 100%; }
.nf-wrap input, .nf-wrap select, .nf-wrap textarea {
  width: 100%; box-sizing: border-box; background: var(--surface); border: 1px solid var(--border); color: var(--text);
  border-radius: 11px; padding: 11px 13px; font-family: 'Cairo', sans-serif; font-size: 14px; outline: none;
}
.nf-wrap input:focus, .nf-wrap select:focus, .nf-wrap textarea:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(176,141,63,.15); }
.nf-wrap input[type=datetime-local] { direction: ltr; text-align: right; }
.nf-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.nf-head img { width: 52px; height: 52px; object-fit: contain; }
.nf-head h1 { font-size: 20px; font-weight: 800; margin: 0; }
.nf-sub { font-size: 12.5px; color: var(--text-muted); }
.nf-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 14px; margin-bottom: 12px; box-shadow: var(--shadow); }
.nf-label { display: block; font-size: 14px; font-weight: 800; margin-bottom: 8px; }
.nf-auto { font-size: 11.5px; font-weight: 500; color: var(--text-muted); }
.nf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nf-grid .full { grid-column: 1 / -1; }
.nf-grid label, .nf-gen label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 4px; }
.nf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.nf-chips button { min-width: 46px; padding: 9px 13px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text); font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
.nf-chips button.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.nf-chips.sizes button { min-width: 64px; font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; }
.nf-big { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.nf-big button { padding: 12px 6px; border-radius: 14px; border: 2px solid var(--border); background: var(--surface); font-family: 'Cairo', sans-serif; cursor: pointer; color: var(--text); line-height: 1.25; }
.nf-big b { display: block; font-size: 17px; font-weight: 800; }
.nf-big small { font-size: 11px; color: var(--text-muted); }
.nf-big .on small { color: inherit; }
.nf-big .inst.on, .nf-big .run.on { border-color: #1E7B3A; background: #E6F4EA; color: #1E7B3A; }
.nf-big .rem.on { border-color: #B3261E; background: #FDECEA; color: #B3261E; }
.nf-big .sb.on { border-color: #B97F00; background: #FFF1CC; color: #8A5A00; }
.nf-big .lt.on { border-color: #13896A; background: #DDF3EC; color: #13896A; }
.nf-big .ht.on { border-color: #D0592F; background: #FDE7DF; color: #D0592F; }
.nf-gen { border: 1px dashed var(--border); border-radius: 14px; padding: 10px; margin-top: 10px; }
.nf-gen-t { font-size: 12px; font-weight: 800; color: var(--gold); margin-bottom: 6px; }
.nf-list { max-height: 340px; overflow-y: auto; margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.nf-item { display: flex; align-items: center; gap: 10px; text-align: right; padding: 10px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; font-family: 'Cairo', sans-serif; color: var(--text); }
.nf-item.on { border-color: #B3261E; background: #FDF1EF; }
.nf-item-main { display: flex; flex-direction: column; min-width: 0; }
.nf-item-main b { font-size: 13.5px; }
.nf-item-main small { font-size: 11.5px; color: var(--text-muted); }
.nf-tag { flex-shrink: 0; font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.nf-tag.lt { background: #DDF3EC; color: #13896A; } .nf-tag.ht { background: #FDE7DF; color: #D0592F; }
.nf-empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: 14px; }
.nf-err { background: #FDECEA; color: #B3261E; border-radius: 12px; padding: 10px 12px; font-size: 13px; margin-bottom: 10px; }
.nf-submit { width: 100%; border: none; border-radius: 16px; padding: 15px; background: var(--gold); color: #fff; font-family: 'Cairo', sans-serif; font-size: 17px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 22px rgba(176,141,63,.3); }
.nf-submit.rem { background: #B3261E; box-shadow: 0 8px 22px rgba(179,38,30,.25); }
.nf-submit:disabled { opacity: .6; }
.nf-done { text-align: center; padding: 28px 16px; }
.nf-ok { width: 64px; height: 64px; border-radius: 50%; background: #E6F4EA; color: #1E7B3A; font-size: 32px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
.nf-done h2 { font-size: 19px; margin: 0 0 4px; }
.nf-done p { color: var(--text-muted); font-size: 13px; margin: 0 0 16px; }
.nf-row { display: flex; gap: 8px; }
.nf-btn { flex: 1; padding: 12px; border-radius: 12px; font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; cursor: pointer; border: none; }
.nf-btn.gold { background: var(--gold); color: #fff; }
.nf-btn.ghost { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.nf-foot { display: block; text-align: center; margin-top: 14px; font-size: 13px; color: var(--text-muted); text-decoration: none; }
`;
