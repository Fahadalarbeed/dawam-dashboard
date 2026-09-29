'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { listOperations, saveOperations, sendToStore, getLinkedReport } from '../../lib/operationsApi';
import { OPERATIONS_OPTIONS } from '../../lib/operationsOptions';
import { downloadReportPdf } from '../../lib/reportsApi';
import { htmlToPdfBlob, sharePdf } from '../../lib/pdf';
import { buildOperationsDoc } from '../../lib/operationsReport';
import { MATERIAL_BY_ID } from '../../lib/materials';
import { fmtDateTime } from '../../components/DriverComplaintCard';
import MaterialsPicker from '../../components/MaterialsPicker';

// قسم التشغيل
// البلاغات المحوّلة من لوحة الفنيين (اللي فيها تقرير أعطال) — نشطة ومغلقة
// داخل البلاغ: بياناته + سبب التحويل + ملاحظات + خيار + صرف المواد + إرسال للمخزن

function En({ children, style }) {
  return <span className="en-sub" style={style}>{children}</span>;
}

function addressOf(d) {
  return [d.area, d.block ? `قطعة ${d.block}` : '', d.street ? `شارع ${d.street}` : '', d.avenue ? `جادة ${d.avenue}` : '', d.building ? `قسيمة ${d.building}` : '', d.house ? `منزل ${d.house}` : '']
    .filter(Boolean).join(' — ');
}

function searchText(r) {
  const d = r.data || {};
  const o = d.ops || {};
  const mats = (o.materials || []).map((m) => `${MATERIAL_BY_ID[m.itemId]?.label || ''} ${MATERIAL_BY_ID[m.itemId]?.en || ''} ${m.type}`).join(' ');
  return [addressOf(d), d.phone, d.paci, d.driver, d.action, d.station, d.unitNo, d.transNo, d.note, o.reason, o.notes, o.option, mats]
    .filter(Boolean).join(' ').toLowerCase();
}

export default function OperationsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('active');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setCheckingAuth(false);
    });
  }, [router]);

  // الصفحة فاتحة — ونرجّع ثيم المستخدم عند الخروج
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'light');
    return () => { if (prev) html.setAttribute('data-theme', prev); else html.removeAttribute('data-theme'); };
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await listOperations());
    } catch (e) {
      setError(e.message || 'تعذر التحميل');
      setItems([]);
    }
  }, []);

  useEffect(() => { if (!checkingAuth) load(); }, [checkingAuth, load]);

  const counts = useMemo(() => ({
    active: (items || []).filter((r) => r.data?.ops?.status === 'active').length,
    sent: (items || []).filter((r) => r.data?.ops?.status === 'sent').length,
  }), [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items || [])
      .filter((r) => r.data?.ops?.status === tab)
      .filter((r) => !needle || searchText(r).includes(needle));
  }, [items, tab, q]);

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق... / Checking...</div>;
  }

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <style>{CSS}</style>

      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="back-circle" onClick={() => router.push('/dashboard')} title="رجوع / Back">→</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
            قسم التشغيل <En style={{ display: 'inline', fontSize: 13, fontWeight: 600 }}>Operations</En>
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>اضغط على البلاغ عشان يفتح وتعبّي فيه</div>
          <En>Tap a complaint to open and fill it</En>
        </div>
      </header>

      <div className="ops-search">
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث: العنوان، الهاتف، الرقم الآلي، الفني، السبب، المواد... / Search"
        />
      </div>

      <div className="ops-tabs">
        <button className={`ops-tab${tab === 'active' ? ' on' : ''}`} onClick={() => { setTab('active'); setOpenId(null); }}>
          نشطة <span className="mono">({counts.active})</span><En>Active</En>
        </button>
        <button className={`ops-tab${tab === 'sent' ? ' on' : ''}`} onClick={() => { setTab('sent'); setOpenId(null); }}>
          مغلقة <span className="mono">({counts.sent})</span><En>Closed · sent to store</En>
        </button>
      </div>

      {error && <div className="ops-error">⚠️ {error}</div>}
      {items === null && <div className="ops-empty">جارٍ التحميل... / Loading...</div>}
      {items && shown.length === 0 && (
        <div className="ops-empty">
          {q ? 'لا توجد نتائج' : tab === 'active' ? 'لا توجد بلاغات نشطة' : 'لا توجد بلاغات مغلقة'}
          <En style={{ textAlign: 'center' }}>{q ? 'No results' : 'Nothing here yet'}</En>
        </div>
      )}

      {shown.map((r) => {
        const d = r.data || {};
        const o = d.ops || {};
        const sent = o.status === 'sent';
        const isOpen = openId === r.id;
        return (
          <div key={r.id} className={`ops-card${isOpen ? ' open' : ''}`}>
            <button className="ops-card-head" onClick={() => setOpenId(isOpen ? null : r.id)} aria-expanded={isOpen}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{addressOf(d) || 'بدون عنوان'}</div>
                <span className={`ops-pill ${sent ? 'sent' : 'active'}`}>{sent ? 'مغلق · Closed' : 'نشط · Active'}</span>
              </div>
              {d.driver && <div className="ops-muted">🔧 {d.driver}</div>}
              <div className="ops-reason">
                {o.source === 'technician' && <span className="ops-direct">⚡ مباشر من الفني</span>}
                <b>سبب التحويل:</b> {o.reason || '—'}
              </div>
              <div className="ops-meta">
                <span>🕐 {fmtDateTime(o.transferredAt)}</span>
                {o.option && <span>☑️ {o.option}</span>}
                {(o.materials || []).length > 0 && <span>📦 {(o.materials || []).length} مواد / items</span>}
                {sent && <span>🏬 {fmtDateTime(o.sentAt)}</span>}
                <span className="ops-chev" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>⌄</span>
              </div>
            </button>
            {isOpen && <OpsBody report={r} onChanged={load} onSent={() => { setOpenId(null); setTab('sent'); }} />}
          </div>
        );
      })}
    </div>
  );
}

function OpsBody({ report, onChanged, onSent }) {
  const d = report.data || {};
  const o = d.ops || {};
  const sent = o.status === 'sent';

  const [notes, setNotes] = useState(o.notes || '');
  const [option, setOption] = useState(o.option || '');
  const [materials, setMaterials] = useState(o.materials || []);
  const [busy, setBusy] = useState('');
  const [linked, setLinked] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getLinkedReport(d.linkedReportId).then(setLinked).catch(() => setLinked(null));
  }, [d.linkedReportId]);

  async function openPdf() {
    if (!linked?.pdf_path) return;
    try {
      const blob = await downloadReportPdf(linked.pdf_path);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      alert('تعذر فتح التقرير: ' + e.message);
    }
  }

  async function printReport() {
    setBusy('print');
    try {
      const html = buildOperationsDoc(report, { notes, option, materials });
      const blob = await htmlToPdfBlob(html);
      const name = `تقرير-التشغيل-${(d.area || '').replace(/\s+/g, '-')}-${String(report.id).slice(0, 6)}.pdf`;
      await sharePdf(blob, name);
    } catch (e) {
      alert('تعذر إنشاء التقرير: ' + e.message);
    } finally { setBusy(''); }
  }

  async function save() {
    setBusy('save');
    try {
      await saveOperations(report.id, { notes, option, materials });
      setDirty(false);
      await onChanged();
    } catch (e) {
      alert('تعذر الحفظ: ' + e.message);
    } finally { setBusy(''); }
  }

  async function send() {
    const msg = materials.length
      ? 'إرسال البلاغ للمخزن؟ راح يتسكّر هنا.\nSend to store? It will be closed here.'
      : 'ما فيه مواد مختارة. تبي ترسل للمخزن؟\nNo materials selected. Send anyway?';
    if (!confirm(msg)) return;
    setBusy('send');
    try {
      await sendToStore(report.id, { notes, option, materials });
      await onChanged();
      onSent();
    } catch (e) {
      alert('تعذر الإرسال: ' + e.message);
    } finally { setBusy(''); }
  }

  const rows = [
    ['المنطقة', 'Area', d.area],
    ['القطعة', 'Block', d.block],
    ['الشارع', 'Street', d.street],
    ['الجادة', 'Avenue', d.avenue],
    ['القسيمة', 'Plot', d.building],
    ['المنزل', 'House', d.house],
    ['العنوان', 'Address', addressOf(d)],
    ['الهاتف', 'Phone', d.phone],
    ['الرقم الآلي', 'PACI', d.paci],
    ['الفني', 'Technician', d.driver],
    ['الإنشاء', 'Created', fmtDateTime(d.createdAt || report.created_at)],
    ['الإغلاق', 'Closed', d.closedAt && fmtDateTime(d.closedAt)],
    ['الإجراء', 'Action', d.action],
    ['المحطة / UDS', 'Station', d.station],
    ['اليونت', 'Unit', d.unitNo],
    ['رقم المحول', 'Transformer', d.transNo],
  ].filter(([, , v]) => v);

  return (
    <div className="ops-body">
      <div className="ops-label">📄 بيانات البلاغ<En style={{ display: 'inline', marginInlineStart: 6 }}>Complaint details</En></div>
      <div className="ops-kv">
        {rows.map(([ar, en, v]) => (
          <div key={ar} className="ops-kv-row">
            <span className="ops-k">{ar}<En>{en}</En></span>
            <span className="ops-v">{v}</span>
          </div>
        ))}
      </div>

      {d.note && (
        <>
          <div className="ops-label">ملاحظة الفني<En style={{ display: 'inline', marginInlineStart: 6 }}>Technician note</En></div>
          <div className="ops-note">{d.note}</div>
        </>
      )}

      {linked?.pdf_path && (
        <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={openPdf}>📄 تقرير العطل / Fault report</button>
      )}

      <div className="ops-label">سبب التحويل<En style={{ display: 'inline', marginInlineStart: 6 }}>Transfer reason</En></div>
      <div className="ops-note gold">
        {o.reason || '—'}
        <div className="ops-muted" style={{ marginTop: 4, fontSize: 11 }}>
          {fmtDateTime(o.transferredAt)}{o.transferredBy ? ` — ${o.transferredBy}` : ''}
        </div>
      </div>

      <div className="ops-label"><span className="ops-num">١</span>نوع العمل<En style={{ display: 'inline', marginInlineStart: 6 }}>Options</En></div>
      {sent ? (
        <div className="ops-note">{option || '—'}</div>
      ) : (
        <div className="ops-opts">
          {OPERATIONS_OPTIONS.map((opt) => (
            <button key={opt} className={`ops-opt${option === opt ? ' on' : ''}`} onClick={() => { setOption(option === opt ? '' : opt); setDirty(true); }}>{opt}</button>
          ))}
        </div>
      )}

      <div className="ops-label"><span className="ops-num">٢</span>الملاحظات<En style={{ display: 'inline', marginInlineStart: 6 }}>Notes</En></div>
      {sent ? (
        <div className="ops-note">{notes || '—'}</div>
      ) : (
        <textarea rows={3} value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} placeholder="ملاحظات قسم التشغيل... / Operations notes" />
      )}

      <div className="ops-label"><span className="ops-num">٣</span>المواد<En style={{ display: 'inline', marginInlineStart: 6 }}>Materials</En></div>
      <MaterialsPicker value={materials} onChange={(m) => { setMaterials(m); setDirty(true); }} readOnly={sent} />

      <button className="ops-print" disabled={!!busy} onClick={printReport}>
        {busy === 'print' ? 'جارٍ تجهيز التقرير...' : '🖨️ طباعة التقرير'}
        <En style={{ color: 'inherit', opacity: .8, textAlign: 'center' }}>Print report (PDF)</En>
      </button>

      {sent ? (
        <div className="ops-done">
          ✅ أُرسل للمخزن — {fmtDateTime(o.sentAt)}{o.sentBy ? ` — ${o.sentBy}` : ''}
          <En style={{ color: 'inherit', textAlign: 'center' }}>Sent to store</En>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn-secondary" style={{ flex: 1, marginTop: 0 }} disabled={!!busy || !dirty} onClick={save}>
              {busy === 'save' ? 'جارٍ الحفظ...' : dirty ? '💾 حفظ / Save' : '✓ محفوظ / Saved'}
            </button>
            <button className="ops-send" disabled={!!busy} onClick={send}>
              {busy === 'send' ? 'جارٍ الإرسال...' : '🏬 إرسال للمخزن'}
              <En style={{ color: 'inherit', opacity: .85, textAlign: 'center' }}>Send to store</En>
            </button>
          </div>
          <div className="ops-muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 6 }}>
            يتسكّر البلاغ هنا ويتحوّل للمخزن مع المواد المختارة
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.en-sub { display: block; font-size: 10.5px; font-weight: 500; color: var(--text-muted); direction: ltr; font-family: 'Cairo', sans-serif; }
.ops-search {
  display: flex; align-items: center; gap: 8px; padding: 0 12px; margin-bottom: 12px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
}
.ops-search input { border: none; background: transparent; padding: 12px 0; box-shadow: none; }
.ops-search input:focus { outline: none; box-shadow: none; }
.ops-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }
.ops-tab {
  padding: 10px 6px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface);
  color: var(--text-muted); font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; line-height: 1.3;
}
.ops-tab .en-sub { text-align: center; color: inherit; opacity: .8; }
.ops-tab.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.ops-card {
  margin-bottom: 12px; background: var(--surface); border: 1.5px solid var(--border);
  border-radius: 18px; box-shadow: var(--shadow); overflow: hidden;
}
.ops-card.open { border-color: var(--gold); }
.ops-card-head {
  display: block; width: 100%; text-align: right; padding: 14px; background: none; border: none;
  color: var(--text); font-family: 'Cairo', sans-serif; cursor: pointer;
}
.ops-body { padding: 0 14px 16px; border-top: 1px dashed var(--border); }
.ops-chev { margin-inline-start: auto; font-size: 16px; transition: transform .2s; }
.ops-direct { display: inline-block; background: #FFF1CC; color: #8A5A00; border-radius: 8px; padding: 1px 8px; font-size: 11px; font-weight: 700; margin-inline-end: 6px; }
.ops-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--navy); color: #fff; font-size: 11px; margin-inline-end: 8px; }
.ops-opts { display: flex; flex-wrap: wrap; gap: 6px; }
.ops-opt {
  padding: 8px 14px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--surface);
  color: var(--text); font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer;
}
.ops-opt.on { background: var(--gold); border-color: var(--gold); color: #fff; }
.ops-print {
  width: 100%; margin-top: 16px; padding: 12px; border-radius: 14px; cursor: pointer; line-height: 1.3;
  border: 1.5px solid var(--navy); background: var(--surface); color: var(--navy);
  font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: 700;
}
.ops-print:disabled { opacity: .55; cursor: default; }
.ops-pill { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.ops-pill.active { background: var(--faults-bg); color: var(--gold); }
.ops-pill.sent { background: #E6F4EA; color: #1E7B3A; }
.ops-muted { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.ops-reason { font-size: 12.5px; margin-top: 8px; background: var(--surface-2); border-radius: 10px; padding: 7px 10px; }
.ops-reason b { font-weight: 700; }
.ops-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11.5px; color: var(--text-muted); margin-top: 8px; }
.ops-empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: 28px 10px; }
.ops-error { background: #FDECEA; color: #B3261E; border-radius: 12px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
.ops-label { display: flex; align-items: center; }
.ops-box { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow); }
.ops-kv { display: flex; flex-direction: column; }
.ops-kv-row { display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.ops-kv-row:last-child { border-bottom: none; }
.ops-k { width: 96px; flex-shrink: 0; color: var(--text-muted); font-size: 12px; }
.ops-v { flex: 1; font-weight: 600; word-break: break-word; }
.ops-label { font-size: 13px; font-weight: 700; margin: 16px 0 6px; }
.ops-note { background: var(--surface-2); border-radius: 12px; padding: 10px 12px; font-size: 13px; white-space: pre-wrap; }
.ops-note.gold { background: var(--faults-bg); }
.ops-send {
  flex: 2; padding: 12px; border: none; border-radius: 16px; cursor: pointer;
  background: var(--gold); color: #fff; font-family: 'Cairo', sans-serif; font-size: 16px; font-weight: 800; line-height: 1.3;
  box-shadow: 0 8px 22px rgba(176,141,63,.35);
}
.ops-send:disabled, .btn-secondary:disabled { opacity: .55; cursor: default; }
.ops-done { background: #E6F4EA; color: #1E7B3A; border: 1px solid #B7DEC3; border-radius: 14px; padding: 14px; font-size: 13.5px; font-weight: 700; text-align: center; }
`;
