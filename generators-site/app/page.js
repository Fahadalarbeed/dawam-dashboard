'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listActiveGenerators, searchGenerators, addGenerator, removeGenerator, setGeneratorStatus, updateGenerator,
  generatorDays, subscribeGenerators,
} from '../lib/generatorsApi';
import { getCurrentShiftLetter } from '../lib/shift';
import { AREA_LIST } from '../lib/constants';
import { htmlToPdfBlob, downloadBlob, sharePdf } from '../lib/pdf';
import { buildGeneratorsDoc } from '../lib/generatorsReport';
import { useLang, LangToggle } from '../lib/i18n';
import NewGeneratorForm from '../components/NewGeneratorForm';
import LocationPicker, { mapsUrl } from '../components/LocationPicker';

// مولدات محافظة الفروانية — صفحة عامة بدون تسجيل دخول (قاعدة بيانات منفصلة)
const GEN_SIZES = ['1800', '1250', '1150', '1000', '950', '850', '750', '625', '500', '450', '320', '180', '150'];
const INSTALL_REASONS = ['تخفيف الأحمال', 'عطل بالمحول', 'صيانة', 'كيبل فولتي', 'قطع مبرمج', 'خط مين', 'تقسيم أحمال', 'أخرى'];
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
// مدة التشغيل: من وقت التركيب (أو تاريخ الإيصال) لين الإزالة أو الحين
function runMs(g) {
  const start = g.installed_at ? new Date(g.installed_at) : new Date(`${g.connected_on}T00:00:00+03:00`);
  const end = g.removed_at ? new Date(g.removed_at) : new Date();
  return Math.max(0, end - start);
}
function fmtDur(ms, t = (x, v) => x.replace(/\{(\w+)\}/g, (_, k) => v[k])) {
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const hh = h % 24;
  if (!d) return t('{h} ساعة', { h: hh });
  return hh ? t('{d} يوم و {h} ساعة', { d, h: hh }) : t('{d} يوم', { d });
}
function En({ children, style }) {
  const { en } = useLang();
  if (en) return null;
  return <span className="en-sub" style={style}>{children}</span>;
}

const EMPTY = {
  gen_type: '', status: 'running', area: '', block: '', street: '', plot: '',
  station: '', uds: '', spur: '', transformer: '', unit_no: '',
  gen_count: 1, size_kva: '', gen_no: '', wires: '', shift: '', connected_on: '', notes: '', install_reason: '',
};

export default function GeneratorsPage() {
  const { t } = useLang();
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | running | standby | LT | HT
  const [showForm, setShowForm] = useState(false);
  const [showEntry, setShowEntry] = useState(false); // نافذة تركيب / إزالة
  const [editing, setEditing] = useState(null); // المولد اللي ينعدّل
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState({ by: 'connected', from: '', to: '' });
  const [results, setResults] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [removing, setRemoving] = useState(null);   // المولد اللي ينزال
  const [printing, setPrinting] = useState('');


  const load = useCallback(async () => {
    try { setError(''); setActive(await listActiveGenerators()); }
    catch (e) { setError(e.message || t('تعذر التحميل')); setActive([]); }
  }, []);
  useEffect(() => {
    load();
    // أي تسجيل من النموذج أو من جهاز ثاني يظهر بالجدول على طول
    const off = subscribeGenerators(() => load());
    const t = setInterval(load, 60000);
    return () => { off(); clearInterval(t); };
  }, [load]);

  // نافذة التركيب/الإزالة: نوقف تمرير الصفحة اللي وراها ونسكرها بزر Esc
  useEffect(() => {
    if (!showEntry) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setShowEntry(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [showEntry]);

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
  function inPeriod(ts) {
    if (!ts) return false;
    const d = new Date(new Date(ts).getTime() + 3 * 3600000).toISOString().slice(0, 10);
    return (!search.from || d >= search.from) && (!search.to || d <= search.to);
  }

  async function confirmRemove(name) {
    const g = removing;
    setBusyId(g.id);
    try {
      try { localStorage.setItem('gen_remover_name', name); } catch { /* ignore */ }
      await removeGenerator(g.id, name);
      setRemoving(null);
      await load();
    } catch (e) { alert(t('تعذر الإزالة: ') + e.message); }
    finally { setBusyId(null); }
  }

  // طباعة / مشاركة الجدول الظاهر (بعد الفلتر والبحث)
  async function makePdf(mode) {
    if (!rows.length) { alert(t('ما فيه مولدات بالجدول')); return; }
    setPrinting(mode);
    try {
      const label = { running: 'الشغالة', standby: 'ستاند باي', LT: 'LT', HT: 'HT' }[filter] || '';
      const range = results ? `${search.by === 'removed' ? 'الإزالة' : 'الإيصال'} ${search.from || '…'} → ${search.to || '…'}` : '';
      const blob = await htmlToPdfBlob(buildGeneratorsDoc(rows, { title: [label, range].filter(Boolean).join(' — ') }), 'l', 2);
      const name = `مولدات-الفروانية-${todayISO()}.pdf`;
      if (mode === 'share') await sharePdf(blob, name);
      else {
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (!w) downloadBlob(blob, name);
      }
    } catch (e) { alert(t('تعذر إنشاء الملف: ') + e.message); }
    finally { setPrinting(''); }
  }
  async function handleToggle(g) {
    const toRunning = g.status !== 'running';
    const where = [t(g.area), g.block && `${t('ق')} ${g.block}`, g.street && `${t('ش')} ${g.street}`].filter(Boolean).join(' — ');
    const q = toRunning ? t('متأكد تبي تحوّل المولد من ستاند باي إلى شغال؟') : t('متأكد تبي تحوّل المولد من شغال إلى ستاند باي؟');
    const msg = `${q}\n\n${where}\n${t('الحجم')}: ${g.size_kva || '—'} kVA`;
    if (!window.confirm(msg)) return;
    setBusyId(g.id);
    try { await setGeneratorStatus(g.id, g.status === 'running' ? 'standby' : 'running'); await load(); }
    catch (e) { alert(t('تعذر التعديل: ') + e.message); }
    finally { setBusyId(null); }
  }


  const CARDS = [
    ['running', summary.running, 'المولدات الشغالة', 'Running', '#1E7B3A'],
    ['standby', summary.standby, 'ستاند باي', 'Standby', '#B97F00'],
    ['LT', summary.LT, 'LT', '', '#13896A'],
    ['HT', summary.HT, 'HT', '', '#D0592F'],
  ];
  const TABS = [['all', 'الكل'], ['running', 'شغال'], ['standby', 'ستاند باي'], ['HT', 'HT'], ['LT', 'LT']];

  return (
    <div className="wrap gen-wrap" style={{ paddingBottom: 40 }}>
      <style>{CSS}</style>

      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <img src="/logo.png" alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
            {t("مولدات محافظة الفروانية")} <En style={{ display: 'inline', fontSize: 13, fontWeight: 600 }}>Generators</En>
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('مراقبة الفروانية')} — {fmtDate(todayISO())}</div>
        </div>
        <LangToggle />
      </header>

      <div className="gen-sum">
        {CARDS.map(([key, n, ar, en, color]) => (
          <button key={key} className={`gen-card${filter === key ? ' on' : ''}`} style={{ borderTopColor: color }} onClick={() => setFilter(filter === key ? 'all' : key)}>
            <div className="gen-n mono" style={{ color }}>{active ? n : '…'}</div>
            <div className="gen-l">{t(ar)}{en && <En>{en}</En>}</div>
          </button>
        ))}
        <div className="gen-card wide" style={{ borderTopColor: '#B08D3F' }}>
          <div className="gen-l" style={{ margin: 0 }}>{t("إجمالي أيام التشغيل")}<En>Total running days</En></div>
          <div className="gen-n mono" style={{ color: '#B08D3F' }}>{active ? summary.days : '…'}</div>
        </div>
      </div>

      <div className="gen-bar">
        <button className="gen-btn gold" onClick={() => setShowEntry(true)}>{t("➕ تركيب / إزالة مولد")}</button>
        <button className={`gen-btn ghost${showSearch ? ' on' : ''}`} onClick={() => setShowSearch((v) => !v)}>{t("📅 بحث بالتاريخ")}</button>
        <button className="gen-btn ghost" disabled={!!printing} onClick={() => makePdf('print')}>{printing === 'print' ? '...' : t('🖨️ طباعة')}</button>
        <button className="gen-btn ghost" disabled={!!printing} onClick={() => makePdf('share')}>{printing === 'share' ? '...' : t('📤 مشاركة')}</button>
      </div>

      {showSearch && (
        <div className="gen-flt">
          <div className="gen-seg">
            <button className={search.by === 'connected' ? 'on' : ''} onClick={() => setSearch({ ...search, by: 'connected' })}>{t("حسب تاريخ الإيصال")}</button>
            <button className={search.by === 'removed' ? 'on' : ''} onClick={() => setSearch({ ...search, by: 'removed' })}>{t("حسب تاريخ الإزالة")}</button>
          </div>
          <div className="gen-seg gen-type-seg">
            {[['all', 'الكل'], ['HT', 'HT'], ['LT', 'LT'], ['standby', 'ستاند باي']].map(([k, label]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t(label)}</button>
            ))}
          </div>
          <div className="gen-dr">
            <div><label>{t("من / From")}</label><input type="date" value={search.from} onChange={(e) => setSearch({ ...search, from: e.target.value })} /></div>
            <div><label>{t("إلى / To")}</label><input type="date" value={search.to} onChange={(e) => setSearch({ ...search, to: e.target.value })} /></div>
          </div>
          <div className="gen-hint">
            {results
              ? t('نتائج البحث: {n} مولد — منها {r} مُزال', { n: rowsCount, r: rows.filter((g) => g.removed_at).reduce((s, g) => s + (g.gen_count || 1), 0) })
              : search.by === 'removed'
                ? t('اختر الفترة — يطلع لك المولدات اللي انشالت خلالها')
                : t('اختر الفترة — يطلع لك كل المولدات اللي انركبت خلالها حتى لو انشالت بعدين، مع تاريخ الإزالة')}
            {(search.from || search.to) && <button className="gen-link" onClick={() => setSearch({ ...search, from: '', to: '' })}>{t("مسح")}</button>}
          </div>
        </div>
      )}

      {results && rows.length > 0 && (() => {
        const totalMs = rows.reduce((s, g) => s + runMs(g) * (g.gen_count || 1), 0);
        const kva = rows.reduce((s, g) => s + String(g.size_kva || '').split('+').reduce((a, x) => a + (parseFloat(x) || 0), 0), 0);
        const ht = rows.filter((g) => g.gen_type === 'HT').reduce((s, g) => s + (g.gen_count || 1), 0);
        const lt = rows.filter((g) => g.gen_type === 'LT').reduce((s, g) => s + (g.gen_count || 1), 0);
        const rm = rows.filter((g) => g.removed_at).reduce((s, g) => s + (g.gen_count || 1), 0);
        return (
          <div className="gen-stats">
            <div><span>{t("عدد المولدات")}</span><b className="mono">{rowsCount}</b></div>
            <div><span>HT / LT</span><b className="mono">{ht} / {lt}</b></div>
            <div><span>{t("مُزال")}</span><b className="mono">{rm}</b></div>
            <div><span>{t("مجموع القدرة")}</span><b className="mono">{kva.toLocaleString('en-US')} kVA</b></div>
            <div className="wide"><span>{t("إجمالي وقت التشغيل")}</span><b>{fmtDur(totalMs, t)}</b></div>
            <div className="wide"><span>{t("متوسط التشغيل للمولد")}</span><b>{fmtDur(totalMs / Math.max(1, rowsCount), t)}</b></div>
          </div>
        );
      })()}

      <div className="gen-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t(label)}</button>
        ))}
      </div>

      {error && <div className="gen-error">⚠️ {error}</div>}

      <div className="gen-tw">
        <table className="gen-table">
          <thead>
            <tr>
              <th className="grp" rowSpan={2}>{t("م")}</th>
              <th className="grp" colSpan={5}>{t("العنوان")}</th>
              <th className="grp" colSpan={5}>{t("مصدر التغذية")}</th>
              <th className="grp" colSpan={5}>{t("بيانات المولد")}</th>
              <th className="grp" rowSpan={2}>{t("النوع")}</th>
              <th className="grp" rowSpan={2}>{t("النوبة")}</th>
              <th className="grp" rowSpan={2}>{t("تاريخ التركيب")}</th>
              <th className="grp" rowSpan={2}>{results ? t('مدة التشغيل') : t('الأيام')}</th>
              <th className="grp" rowSpan={2}>{t("سبب التركيب")}</th>
              <th className="grp" rowSpan={2}>{t("ملاحظات")}</th>
              {results && <th className="grp" rowSpan={2}>{t("تاريخ الإزالة")}</th>}
              <th className="grp" rowSpan={2}>{t("إجراء")}</th>
            </tr>
            <tr>
              <th>{t("المنطقة")}</th><th>{t("القطعة")}</th><th>{t("الشارع")}</th><th>{t("القسيمة")}</th><th>{t("اللوكيشن")}</th>
              <th>{t("محطة")}</th><th>UDS</th><th>Spur</th><th>{t("محول")}</th><th>{t("اليونت")}</th>
              <th>{t("العدد")}</th><th>{t("الحجم kVA")}</th><th>{t("رقم المولد")}</th><th>{t("الوايرات")}</th><th>{t("الحالة")}</th>
            </tr>
          </thead>
          <tbody>
            {active === null && <tr><td colSpan={results ? 24 : 23} className="gen-empty">{t("جارٍ التحميل...")}</td></tr>}
            {active !== null && rows.length === 0 && (
              <tr><td colSpan={results ? 24 : 23} className="gen-empty">{results ? t('لا توجد نتائج') : t('لا توجد مولدات — اضغط "تركيب / إزالة مولد"')}</td></tr>
            )}
            {rows.map((g, i) => {
              const removed = !!g.removed_at;
              const sb = g.status === 'standby';
              return (
                <tr key={g.id} className={removed ? 'rm' : sb ? 'sb' : ''}>
                  <td>{i + 1}</td>
                  <td>{t(g.area)}</td><td>{g.block}</td><td>{g.street}</td><td>{t(g.plot)}</td>
                  <td>{g.lat != null && g.lng != null ? <a className="gen-loc" href={mapsUrl(g.lat, g.lng)} target="_blank" rel="noreferrer">{t("📍 خريطة")}</a> : '—'}</td>
                  <td className="mono">{g.station}</td><td className="mono">{g.uds}</td><td className="mono">{g.spur}</td>
                  <td className="mono">{g.transformer}</td><td className="mono">{g.unit_no}</td>
                  <td className="mono">{g.gen_count}</td>
                  <td className="mono"><b>{g.size_kva}</b></td>
                  <td className="mono">{g.gen_no}</td><td className="mono">{g.wires}</td>
                  <td><span className={`gen-tag ${sb ? 'st2' : 'st1'}`}>{t(STATUS[g.status])}</span></td>
                  <td><span className={`gen-tag ${g.gen_type === 'LT' ? 'lt' : 'ht'}`}>{g.gen_type}</span></td>
                  <td><b>{g.shift}</b></td>
                  <td className="mono">{fmtDate(g.connected_on)}{g.installed_at && <><br /><small style={{ color: 'var(--text-muted)' }}>{new Date(g.installed_at).toTimeString().slice(0, 5)}</small></>}{g.entered_by && <><br /><span className="gen-who">👤 {g.entered_by}</span></>}</td>
                  <td className={results ? '' : 'mono'}>{results ? <span className="gen-dur">{fmtDur(runMs(g), t)}</span> : <b>{generatorDays(g)}</b>}</td>
                  <td className="gen-notes"><b>{t(g.install_reason)}</b></td>
                  <td className="gen-notes">{g.notes}</td>
                  {results && (
                    <td>
                      {removed ? (
                        <span className="gen-removed">
                          {fmtDate(g.removed_at)} {new Date(g.removed_at).toTimeString().slice(0, 5)}
                          <br /><span className="gen-who">👤 {g.removed_by || '—'}</span>
                          {inPeriod(g.removed_at) && <><br /><span className="gen-tag rmp">{t("خلال الفترة")}</span></>}
                        </span>
                      ) : <span className="gen-tag st1">{t("ما زال مركّب")}</span>}
                    </td>
                  )}
                  <td>
                    {removed && results ? '—' : removed ? (
                      <span className="gen-removed">
                        {t('مُزال')} {fmtDate(g.removed_at)} <span className="mono">{new Date(g.removed_at).toTimeString().slice(0, 5)}</span>
                        <br />👤 {g.removed_by || g.removed_by_email || '—'}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="gen-ed" disabled={busyId === g.id} onClick={() => setEditing(g)}>{t("✏️ تعديل")}</button>
                        <button className="gen-rm" disabled={busyId === g.id} onClick={() => setRemoving(g)}>{t("🗑️ إزالة المولد")}</button>
                        <button className="gen-sw" disabled={busyId === g.id} onClick={() => handleToggle(g)}>{sb ? t('← شغال') : t('← ستاند باي')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="tot">
                <td colSpan={11} style={{ textAlign: 'left' }}>{t("المجموع / Total")}</td>
                <td className="mono">{rowsCount}</td>
                <td colSpan={results ? 12 : 11}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="gen-hint gen-scroll-hint" style={{ textAlign: 'center' }}>{t("الجدول يتمرر يمين ويسار · Scroll sideways")}</div>

      {showEntry && (
        <div className="gen-entry" onClick={(e) => { if (e.target === e.currentTarget) setShowEntry(false); }}>
          <div className="gen-entry-box">
            <NewGeneratorForm embedded onClose={() => setShowEntry(false)} onSaved={load} />
          </div>
        </div>
      )}
      {removing && <RemoveDialog g={removing} busy={busyId === removing.id} onCancel={() => setRemoving(null)} onConfirm={confirmRemove} />}
      {showForm && <GeneratorForm onClose={() => setShowForm(false)} onSaved={async () => { setShowForm(false); await load(); }} />}
      {editing && <GeneratorForm initial={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function RemoveDialog({ g, busy, onCancel, onConfirm }) {
  const { t } = useLang();
  const [name, setName] = useState(() => { try { return localStorage.getItem('gen_remover_name') || ''; } catch { return ''; } });
  return (
    <div className="gen-overlay" onClick={onCancel}>
      <div className="gen-sheet" onClick={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: 440 }}>
        <div className="gen-grip" />
        <div style={{ fontWeight: 800, fontSize: 17 }}>{t("إزالة المولد")}<En>Remove generator</En></div>
        <div className="gen-rm-info">
          <b>{g.gen_type}</b> — {t(g.area)}{g.block ? ` — ${t('قطعة')} ${g.block}` : ''}{g.gen_no ? ` — ${t('مولد')} ${g.gen_no}` : ''}
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{t('موصول من {d} — {n} يوم', { d: fmtDate(g.connected_on), n: generatorDays(g) })}</div>
        </div>
        <div className="gen-fg">
          <div className="full">
            <label>{t("اسم اللي أزال المولد *")}<span>Removed by</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("الاسم")} autoFocus />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{t('🕐 وقت الإزالة ينحفظ تلقائي —')} {fmtDate(todayISO())} {new Date().toTimeString().slice(0, 5)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="gen-save" style={{ marginTop: 0, background: '#B3261E', flex: 2 }} disabled={busy || !name.trim()} onClick={() => onConfirm(name.trim())}>
            {busy ? t('جارٍ الإزالة...') : t('🗑️ تأكيد الإزالة')}
          </button>
          <button className="gen-btn ghost" style={{ flex: 1 }} onClick={onCancel}>{t("إلغاء")}</button>
        </div>
      </div>
    </div>
  );
}

function GeneratorForm({ initial, onClose, onSaved }) {
  const { t, en } = useLang();
  const isEdit = !!initial;
  const [f, setF] = useState(() => {
    if (!initial) return { ...EMPTY, connected_on: todayISO() };
    const base = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? EMPTY[k]]));
    return { ...base, gen_count: initial.gen_count || 1, size_kva: initial.size_kva || '', entered_by: initial.entered_by || '' };
  });
  const [loc, setLoc] = useState(initial && initial.lat != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [editor, setEditor] = useState(() => { try { return localStorage.getItem('gen_editor_name') || ''; } catch { return ''; } });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // الحجم: مولد واحد ← اختيار واحد، أكثر من مولد ← يتجمّع مثل 500+625
  const sizes = f.size_kva ? String(f.size_kva).split('+') : [];
  function pickSize(sz) {
    const max = Math.max(1, parseInt(f.gen_count, 10) || 1);
    if (max === 1) { setF({ ...f, size_kva: f.size_kva === sz ? '' : sz }); return; }
    const next = sizes.length >= max ? [sz] : [...sizes, sz];
    setF({ ...f, size_kva: next.join('+') });
  }
  // حجم غير موجود بالقائمة
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherSize, setOtherSize] = useState('');
  const customPicked = sizes.filter((x) => !GEN_SIZES.includes(x));
  function addOtherSize() {
    const v = otherSize.trim().replace(/[^0-9.]/g, '');
    if (!v) return;
    pickSize(v);
    setOtherSize('');
    setOtherOpen(false);
  }

  // النوبة والتاريخ تلقائي: النوبة المناوبة الحين + تاريخ اليوم
  const autoShift = getCurrentShiftLetter();
  const autoDate = todayISO();
  const [otherReason, setOtherReason] = useState('');
  // التعديل: سبب مو من القائمة ← "أخرى" + النص
  useEffect(() => {
    if (!initial || !initial.install_reason || INSTALL_REASONS.includes(initial.install_reason)) return;
    setF((p) => ({ ...p, install_reason: 'أخرى' }));
    setOtherReason(String(initial.install_reason).replace(/^أخرى - /, ''));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reasonOk = f.install_reason && (f.install_reason !== 'أخرى' || otherReason.trim());
  const valid = f.gen_type && f.area.trim() && reasonOk && (!isEdit || (editor.trim() && f.shift && f.connected_on));

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? (v.trim() || null) : v]));
      if (f.install_reason === 'أخرى') row.install_reason = `أخرى - ${otherReason.trim()}`;
      row.gen_count = Math.min(10, Math.max(1, parseInt(f.gen_count, 10) || 1));
      if (isEdit) {
        const where = [t(f.area), f.block && `${t('ق')} ${f.block}`].filter(Boolean).join(' — ');
        if (!window.confirm(`${t('متأكد تبي تحفظ التعديل على المولد؟')}\n\n${f.gen_type} — ${where}\n${t('الحجم')}: ${f.size_kva || '—'} kVA`)) { setSaving(false); return; }
        delete row.status; // الحالة تتغير من زر شغال/ستاند باي
        row.lat = loc ? Number(loc.lat.toFixed(7)) : null;
        row.lng = loc ? Number(loc.lng.toFixed(7)) : null;
        try { localStorage.setItem('gen_editor_name', editor.trim()); } catch { /* ignore */ }
        await updateGenerator(initial.id, row, editor.trim());
        await onSaved();
        return;
      }
      row.shift = getCurrentShiftLetter();
      row.connected_on = todayISO();
      await addGenerator(row);
      await onSaved();
    } catch (e) {
      alert(t('تعذر الحفظ: ') + e.message);
    } finally { setSaving(false); }
  }

  const isEn = en;
  const Field = ({ k, label, en, full, type = 'text', ...rest }) => (
    <div className={full ? 'full' : ''}>
      <label>{t(label)}{en && !isEn && <span>{en}</span>}</label>
      <input type={type} value={f[k]} onChange={set(k)} {...rest} />
    </div>
  );

  return (
    <div className="gen-overlay" onClick={onClose}>
      <div className="gen-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="gen-grip" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{isEdit ? <>{t("تعديل بيانات المولد")}<En>Edit generator</En></> : <>{t("إدخال مولد جديد")}<En>New generator</En></>}</div>
          <button className="gen-x" onClick={onClose} aria-label={t("إغلاق")}>✕</button>
        </div>

        <div className="gen-fs">
          <h4>{t("⚡ نوع المولد *")}</h4>
          <div className="gen-big">
            <button className={`lt${f.gen_type === 'LT' ? ' on' : ''}`} onClick={() => setF({ ...f, gen_type: 'LT' })}><b>LT</b></button>
            <button className={`ht${f.gen_type === 'HT' ? ' on' : ''}`} onClick={() => setF({ ...f, gen_type: 'HT' })}><b>HT</b></button>
          </div>
        </div>

        {!isEdit && <div className="gen-fs">
          <h4>{t("📶 حالة المولد")}</h4>
          <div className="gen-big">
            <button className={`run${f.status === 'running' ? ' on' : ''}`} onClick={() => setF({ ...f, status: 'running' })}><b className="t">{t("شغال")}</b><small>Running</small></button>
            <button className={`sb${f.status === 'standby' ? ' on' : ''}`} onClick={() => setF({ ...f, status: 'standby' })}><b className="t">{t("ستاند باي")}</b><small>Standby</small></button>
          </div>
        </div>}

        <div className="gen-fs">
          <h4>{t("📝 سبب التركيب *")}</h4>
          <div className="gen-chips">
            {INSTALL_REASONS.map((r) => (
              <button key={r} type="button" className={f.install_reason === r ? 'on' : ''} onClick={() => setF({ ...f, install_reason: r })}>{t(r)}</button>
            ))}
          </div>
          {f.install_reason === 'أخرى' && (
            <div className="gen-fg" style={{ marginTop: 8 }}>
              <div className="full"><input type="text" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder={t("اكتب السبب")} /></div>
            </div>
          )}
        </div>

        <div className="gen-fs">
          <h4>{t("📍 العنوان")}</h4>
          <div className="gen-fg">
            <div className="full">
              <label>{t("المنطقة *")}<span>Area</span></label>
              <select value={f.area} onChange={set('area')}>
                <option value="">{t("— اختر المنطقة —")}</option>
                {AREA_LIST.map((a) => <option key={a} value={a}>{t(a)}</option>)}
              </select>
            </div>
            {Field({ k: 'block', label: 'القطعة', en: 'Block' })}
            {Field({ k: 'street', label: 'الشارع', en: 'Street' })}
            {Field({ k: 'plot', label: 'رقم القسيمة', en: 'Plot', full: true })}
            {isEdit && <div className="full"><label>{t("اللوكيشن")}<span>Location</span></label><LocationPicker value={loc} onChange={setLoc} /></div>}
          </div>
        </div>

        <div className="gen-fs">
          <h4>{t("🔌 مصدر التغذية")}</h4>
          <div className="gen-fg">
            {Field({ k: 'station', label: 'محطة', en: 'S/S' })}
            {Field({ k: 'uds', label: 'UDS' })}
            {Field({ k: 'spur', label: 'Spur' })}
            {Field({ k: 'transformer', label: 'محول', en: 'Transformer' })}
            {Field({ k: 'unit_no', label: 'اليونت', en: 'Unit', full: true })}
          </div>
        </div>

        <div className="gen-fs">
          <h4>{t("⚙️ بيانات المولد")}</h4>
          <div className="gen-fg">
            {Field({ k: 'gen_count', label: 'عدد المولدات', type: 'number', min: 1, inputMode: 'numeric' })}
            <div className="full">
              <label>{t("حجم المولد kVA")}<span>{Number(f.gen_count) > 1 ? t('اختر {n} أحجام', { n: f.gen_count }) : (en ? '' : 'Size')}</span></label>
              <div className="gen-chips gen-sizes">
                {GEN_SIZES.map((sz) => {
                  const picked = sizes.filter((x) => x === sz).length;
                  return (
                    <button key={sz} type="button" className={picked ? 'on' : ''} onClick={() => pickSize(sz)}>
                      {sz}{picked > 1 ? ` ×${picked}` : ''}
                    </button>
                  );
                })}
                <button type="button" className={customPicked.length || otherOpen ? 'on' : ''} onClick={() => setOtherOpen((v) => !v)}>
                  {customPicked.length ? `${t('أخرى: ')}${customPicked.join('+')}` : t('أخرى')}
                </button>
              </div>
              {otherOpen && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="text" inputMode="numeric" value={otherSize} onChange={(e) => setOtherSize(e.target.value)} placeholder={t("اكتب الحجم kVA")} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOtherSize(); } }} autoFocus />
                  <button type="button" className="gen-btn gold" style={{ flex: '0 0 auto', padding: '0 18px' }} disabled={!otherSize.trim()} onClick={addOtherSize}>{t("إضافة")}</button>
                </div>
              )}
              {Number(f.gen_count) > 1 && sizes.length > 0 && (
                <div className="gen-hint">{t("المختار:")} <b className="mono">{f.size_kva}</b> <button type="button" className="gen-link" onClick={() => setF({ ...f, size_kva: '' })}>{t("مسح")}</button></div>
              )}
            </div>
            {Field({ k: 'gen_no', label: 'رقم المولد', en: 'Gen. No' })}
            {Field({ k: 'wires', label: 'عدد الوايرات', en: 'Wires' })}
          </div>
        </div>

        <div className="gen-fs">
          <h4>{t("🗓️ النوبة والتاريخ")} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11 }}>{t("— تلقائي")}</span></h4>
          {isEdit ? (
            <div className="gen-fg">
              <div className="full">
                <label>{t("النوبة")}<span>Shift</span></label>
                <div className="gen-chips">{['A', 'B', 'C', 'D', 'E'].map((x) => <button key={x} type="button" className={f.shift === x ? 'on' : ''} onClick={() => setF({ ...f, shift: x })}>{x}</button>)}</div>
              </div>
              {Field({ k: 'connected_on', label: 'تاريخ الإيصال', en: 'Date', type: 'date' })}
              {Field({ k: 'entered_by', label: 'اسم اللي ركّب', en: 'Installed by' })}
            </div>
          ) : (
            <div className="gen-auto">
              <div><span>{t("النوبة")}</span><b>{autoShift}</b></div>
              <div><span>{t("تاريخ الإيصال")}</span><b className="mono">{fmtDate(autoDate)}</b></div>
            </div>
          )}
          <div className="gen-fg" style={{ marginTop: 8 }}>
            <div className="full">
              <label>{t("ملاحظات")}<span>Notes</span></label>
              <textarea rows={2} value={f.notes} onChange={set('notes')} placeholder={t("مثال: تخفيف أحمال")} />
            </div>
          </div>
        </div>

        {isEdit && (
          <div className="gen-fs">
            <h4>{t("👤 اسم اللي عدّل *")}</h4>
            <div className="gen-fg"><div className="full"><input type="text" value={editor} onChange={(e) => setEditor(e.target.value)} placeholder={t("اسمك")} /></div></div>
          </div>
        )}
        <button className="gen-save" disabled={!valid || saving} onClick={save}>
          {saving ? t('جارٍ الحفظ...') : isEdit ? t('💾 حفظ التعديل') : t('💾 حفظ المولد / Save')}
        </button>
        {!valid && <div className="gen-hint" style={{ textAlign: 'center' }}>{isEdit ? t('الخانات المطلوبة: نوع المولد، سبب التركيب، المنطقة، النوبة، التاريخ، اسم اللي عدّل') : t('الخانات المطلوبة: نوع المولد، سبب التركيب، المنطقة')}</div>}
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
.gen-auto { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.gen-auto div { background: var(--surface-2); border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; }
.gen-auto span { font-size: 11px; color: var(--text-muted); }
.gen-auto b { font-size: 18px; font-weight: 800; color: var(--navy); }
.gen-removed { font-size: 11px; line-height: 1.5; display: inline-block; text-align: right; }
.gen-rm-info { background: #FDF1EF; border: 1px solid #E6B3AE; border-radius: 12px; padding: 10px 12px; margin: 12px 0 4px; font-size: 13.5px; }
.gen-btn:disabled { opacity: .55; }
.gen-sizes button { min-width: 64px; font-family: 'IBM Plex Mono', monospace; }
.gen-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.gen-chips button { min-width: 44px; padding: 8px 12px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--surface); font-family: 'Cairo', sans-serif; font-size: 13.5px; font-weight: 700; cursor: pointer; color: var(--text); }
.gen-chips button.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.gen-save { width: 100%; margin-top: 14px; border: none; border-radius: 14px; padding: 14px; background: var(--gold); color: #fff; font-family: 'Cairo', sans-serif; font-size: 15px; font-weight: 800; cursor: pointer; }
.gen-save:disabled { opacity: .5; cursor: default; }

.gen-type-seg { margin-top: 8px; }
.gen-tag.rmp { background: #FDECEA; color: #B3261E; }
.gen-entry { position: fixed; inset: 0; z-index: 60; background: rgba(15,22,40,.45); overflow-y: auto; padding: 24px 12px; -webkit-overflow-scrolling: touch; }
.gen-entry-box { max-width: 660px; margin: 0 auto; background: var(--bg); border-radius: 22px; padding: 16px 14px 6px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
@media (max-width: 640px) { .gen-entry { padding: 0; } .gen-entry-box { border-radius: 0; min-height: 100%; } }
.gen-who { font-family: 'Cairo', sans-serif; font-size: 11.5px; font-weight: 700; color: var(--navy); white-space: nowrap; }
.gen-loc { display: inline-block; white-space: nowrap; background: #FDECEA; color: #B3261E; border-radius: 999px; padding: 3px 9px; font-size: 11.5px; font-weight: 700; text-decoration: none; }
.gen-ed { border: 1px solid #B9C7E6; background: #EEF3FC; color: #1B3A78; border-radius: 9px; padding: 5px 9px; font-family: 'Cairo', sans-serif; font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.gen-dur { font-size: 12px; font-weight: 700; color: var(--navy); white-space: nowrap; }
.gen-stats { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-bottom: 10px; }
.gen-stats > div { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; }
.gen-stats span { display: block; font-size: 11.5px; color: var(--text-muted); }
.gen-stats b { font-size: 16px; font-weight: 800; color: var(--navy); }
@media (min-width: 900px) { .gen-stats { grid-template-columns: repeat(6, minmax(0,1fr)); } }
/* الكمبيوتر: الصفحة بعرض الشاشة والجدول كامل بدون تمرير */
@media (min-width: 1100px) {
  .gen-wrap { max-width: 1880px; padding-left: 28px; padding-right: 28px; }
  .gen-n { font-size: 32px; }
  .gen-l { font-size: 14.5px; }
  .gen-btn { font-size: 15px; padding: 13px 18px; }
  .gen-tabs button { font-size: 14.5px; padding: 10px 14px; }
  .gen-tw { overflow-x: visible; }
  .gen-table { min-width: 0; font-size: 13.5px; }
  .gen-table th { font-size: 13px; padding: 8px 3px; white-space: normal; }
  .gen-table td { padding: 8px 3px; white-space: normal; }
  .gen-table td.mono { white-space: nowrap; }
  .gen-notes { min-width: 0; }
  .gen-scroll-hint { display: none; }
  .gen-table td > div { flex-wrap: wrap; justify-content: center; }
  .gen-rm, .gen-sw, .gen-who { white-space: normal; }
  .gen-table td .gen-removed { white-space: normal; }
}
`;
