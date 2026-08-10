'use client';
import { useState } from 'react';
import { COMPLAINT_ACTIONS } from '../lib/constants';
import { updateReportData } from '../lib/reportsApi';

export function pad(n) { return String(n).padStart(2, '0'); }
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function buildMapsUrl(d) {
  const parts = ['الكويت', d.area || '', d.block ? `قطعة ${d.block}` : '', d.street ? `شارع ${d.street}` : '', d.house ? `منزل ${d.house}` : ''].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}
export async function openKuwaitFinder(paci) {
  if (!paci) {
    alert('ما فيه رقم آلي (PACI) مسجّل بهذا البلاغ');
    return;
  }
  try {
    await navigator.clipboard.writeText(paci);
    alert(`✓ تم نسخ الرقم الآلي (${paci})\nالصقه بخانة البحث بموقع Kuwait Finder اللي بيفتح الحين`);
  } catch (e) {
    alert(`الرقم الآلي: ${paci}\n(انسخه يدويًا — تعذر النسخ التلقائي)`);
  }
  window.open('https://gis.paci.gov.kw/Client/', '_blank', 'noopener');
}

export function CloseForm({ report, onClosed, onTrack }) {
  const [action, setAction] = useState(COMPLAINT_ACTIONS[0]);
  const [otherAction, setOtherAction] = useState('');
  const [station, setStation] = useState('');
  const [unitNo, setUnitNo] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleClose() {
    setSaving(true);
    try {
      const finalAction = action === 'أخرى' ? (otherAction || 'أخرى') : action;
      await updateReportData(report.id, {
        status: 'closed',
        action: finalAction,
        station,
        unitNo,
        note: note || '',
        closedAt: new Date().toISOString(),
      });
      onClosed();
    } catch (e) {
      alert('تعذر إغلاق البلاغ: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="field" style={{ marginTop: 0 }}>
        <label>الإجراء</label>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {COMPLAINT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {action === 'أخرى' && (
        <div className="field">
          <label>حدد نوع الإجراء</label>
          <input type="text" value={otherAction} onChange={(e) => setOtherAction(e.target.value)} placeholder="اكتب نوع الإجراء" />
        </div>
      )}
      <div className="field">
        <label>المحطة أو UDS</label>
        <input type="text" value={station} onChange={(e) => setStation(e.target.value)} placeholder="رقم المحطة أو UDS" />
      </div>
      <div className="field">
        <label>اليونت</label>
        <input type="text" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder="رقم اليونت" />
      </div>
      <div className="field">
        <label>ملاحظة (اختياري)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="أي ملاحظة إضافية عن الإغلاق" />
      </div>
      <button className="btn-primary" onClick={handleClose} disabled={saving}>
        {saving ? 'جارٍ الإغلاق...' : '🔒 تأكيد إغلاق البلاغ'}
      </button>
    </div>
  );
}

export function ComplaintCard({ report, onChanged, onTrack }) {
  const [expanded, setExpanded] = useState(false);
  const d = report.data || {};
  const isClosed = d.status === 'closed';
  const addressParts = [d.area, d.block ? `قطعة ${d.block}` : '', d.street ? `شارع ${d.street}` : '', d.house ? `منزل ${d.house}` : ''].filter(Boolean).join(' — ');

  return (
    <div className="card" style={{ marginBottom: 10, borderColor: isClosed ? 'var(--border)' : 'rgba(220,38,38,0.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{addressParts || 'بدون عنوان'}</div>
        <span style={{
          background: isClosed ? 'var(--transactions-bg)' : 'var(--complaints-bg)',
          color: isClosed ? 'var(--transactions)' : 'var(--complaints)',
          borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
        }}>
          {isClosed ? '✅ مغلق' : '🟠 نشط'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
          🕐 الإنشاء: {fmtDateTime(d.createdAt || report.created_at)}
        </span>
        {isClosed && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            🔒 الإغلاق: {fmtDateTime(d.closedAt)}
          </span>
        )}
        {isClosed && d.action && (
          <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
            {d.action}
          </span>
        )}
        {isClosed && d.station && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            المحطة/UDS: {d.station}
          </span>
        )}
        {isClosed && d.unitNo && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            اليونت: {d.unitNo}
          </span>
        )}
        <a
          href={buildMapsUrl(d)} target="_blank" rel="noopener noreferrer"
          onClick={(e) => { e.stopPropagation(); onTrack && onTrack(d); }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, textDecoration: 'none', color: 'var(--transactions)', fontWeight: 700 }}
        >
          📍 خرائط Google
        </a>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openKuwaitFinder(d.paci); }}
          style={{ background: 'var(--complaints-bg)', border: '1px solid var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, color: 'var(--complaints)', fontWeight: 700, cursor: 'pointer' }}
        >
          📍 Kuwait Finder
        </button>
      </div>

      {isClosed && d.note && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '6px 8px' }}>
          📝 {d.note}
        </div>
      )}

      {!isClosed && (
        <>
          <button className="btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'إلغاء' : '🔒 إغلاق البلاغ'}
          </button>
          {expanded && <CloseForm report={report} onClosed={() => { setExpanded(false); onChanged(); }} />}
        </>
      )}
    </div>
  );
}

export function groupByDriver(list) {
  const grouped = {};
  list.forEach((r) => {
    const driver = r.data?.driver || 'بدون سائق';
    if (!grouped[driver]) grouped[driver] = [];
    grouped[driver].push(r);
  });
  return Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
}

export function DriverGroupBox({ driver, reports, onChanged, onTrack }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, cursor: 'pointer' }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--transactions)' }}>🚗 {driver}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 800 }}>{reports.length}</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', transform: open ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>‹</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {reports.map((r) => <ComplaintCard key={r.id} report={r} onChanged={onChanged} onTrack={onTrack} />)}
        </div>
      )}
    </div>
  );
}
