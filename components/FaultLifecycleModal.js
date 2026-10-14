'use client';
import { useState } from 'react';
import { STAGES, faultLifecycle } from '../lib/faultLifecycle';
import { addressOfReport, technicianOf, fmtD } from '../lib/reportsSummaryDoc';
import { downloadReportPdf } from '../lib/reportsApi';
import { htmlToPdfBlob, mergePdfBlobs, downloadBlob, sharePdf } from '../lib/pdf';
import { buildOperationsDoc } from '../lib/operationsReport';
import { MATERIAL_BY_ID, TYPE_AR } from '../lib/materials';

// تقرير العطل على آخر مرحلة وصلها: البلاغ ← تقرير الفني ← الاعتماد ← قسم التشغيل ← المخزن

function dt(v) {
  if (!v) return '';
  const d = new Date(v);
  return `${fmtD(v)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const UNIT = { pcs: 'حبة', m: 'م', cm: 'سم', mm: 'مم' };

function KV({ rows }) {
  const list = rows.filter(([, v]) => v);
  if (!list.length) return null;
  return (
    <div className="fl-kv">
      {list.map(([k, v]) => (<div key={k}><span>{k}</span><b>{v}</b></div>))}
    </div>
  );
}

export default function FaultLifecycleModal({ report, complaint, onClose }) {
  const [busy, setBusy] = useState('');
  const d = report.data || {};
  const c = complaint?.data || {};
  const ops = c.ops;
  const life = faultLifecycle(report, complaint);

  async function openPdf() {
    try {
      const blob = await downloadReportPdf(report.pdf_path);
      const url = URL.createObjectURL(blob);
      if (!window.open(url, '_blank')) downloadBlob(blob, (report.display_name || 'تقرير') + '.pdf');
    } catch (e) { alert('تعذر فتح التقرير: ' + e.message); }
  }

  // PDF واحد: تقرير العطل + تقرير قسم التشغيل (إذا وصل له)
  async function makePdf(mode) {
    setBusy(mode);
    try {
      const blobs = [];
      if (report.pdf_path) { try { blobs.push(await downloadReportPdf(report.pdf_path)); } catch { /* skip */ } }
      if (complaint && ops) blobs.push(await htmlToPdfBlob(buildOperationsDoc(complaint)));
      if (!blobs.length) { alert('ما فيه ملف للتقرير'); return; }
      const blob = blobs.length > 1 ? await mergePdfBlobs(blobs) : blobs[0];
      const name = `${report.display_name || 'تقرير عطل'} — ${life.label}.pdf`;
      if (mode === 'share') await sharePdf(blob, name);
      else {
        const url = URL.createObjectURL(blob);
        if (!window.open(url, '_blank')) downloadBlob(blob, name);
      }
    } catch (e) { alert('تعذر تجهيز التقرير: ' + e.message); }
    finally { setBusy(''); }
  }

  const content = {
    complaint: (
      <KV rows={[
        ['العنوان', addressOfReport(c.area ? c : d)],
        ['الهاتف', c.phone],
        ['الفني', c.driver],
        ['الإنشاء', dt(c.createdAt || complaint?.created_at)],
        ['الإغلاق', dt(c.closedAt)],
      ]} />
    ),
    report: (
      <>
        <KV rows={[
          ['التاريخ', fmtD(report.report_date)],
          ['الفني', technicianOf(report)],
          ['نوع العطل', d.faultType],
          ['الإجراء', c.action],
          ['المحطة / UDS', d.station],
          ['رقم المحول', d.transNo],
          ['اليونت', d.unitNo],
        ]} />
        {report.pdf_path && <button className="fl-link" onClick={openPdf}>📄 فتح تقرير العطل PDF</button>}
      </>
    ),
    approval: (
      d.needsRevision
        ? <div>↩️ مُرجَع للفني{d.revisionNote ? ` — ${d.revisionNote}` : ''}</div>
        : d.pendingApproval ? <div>⏳ بانتظار اعتماد المشرف</div> : <div>✅ معتمد</div>
    ),
    ops: ops && (
      <>
        <KV rows={[
          ['التحويل', `${dt(ops.transferredAt)}${ops.source === 'auto' ? ' — تلقائي' : ''}`],
          ['السبب', ops.reason],
          ['نوع العمل', ops.option],
          ['الملاحظات', ops.notes],
        ]} />
        {(ops.materials || []).length > 0 && (
          <div className="fl-mats">
            {ops.materials.map((m) => (
              <div key={`${m.itemId}|${m.type}`}>
                <span>{MATERIAL_BY_ID[m.itemId]?.label || m.itemId} <small className="mono">{m.type}{TYPE_AR[m.type] ? ` — ${TYPE_AR[m.type]}` : ''}</small></span>
                <b className="mono">{m.qty} {UNIT[m.unit] || 'حبة'}</b>
              </div>
            ))}
          </div>
        )}
      </>
    ),
    store: ops?.status === 'sent' && <div>🏬 أُرسل للمخزن — {dt(ops.sentAt)}{ops.sentBy ? ` — ${ops.sentBy}` : ''}</div>,
  };

  return (
    <div className="fl-overlay" onClick={onClose}>
      <div className="fl-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <style>{CSS}</style>
        <div className="fl-grip" />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{addressOfReport(d) || report.display_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>تقرير عطل — {d.faultType || c.action || ''}</div>
          </div>
          <span className="fl-tag" style={{ background: life.bg, color: life.color }}>{life.label}</span>
        </div>

        <div style={{ marginTop: 14 }}>
          {STAGES.map((s) => {
            const st = life.steps[s.key];
            if (st === 'skip') return null;
            const cls = st === 'done' ? 'done' : (st === 'current' || st === 'pending' || st === 'returned') ? 'cur' : 'todo';
            return (
              <div key={s.key} className={`fl-st ${cls}`}>
                <div className="fl-dot">{cls === 'done' ? '✓' : cls === 'cur' ? '⏳' : ''}</div>
                <div className="fl-body">
                  <h4>{s.label}</h4>
                  {cls === 'todo' ? <div className="fl-wait">لم يصل بعد</div> : <div className="fl-box">{content[s.key]}</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn-primary" style={{ marginTop: 0, flex: 2 }} disabled={!!busy} onClick={() => makePdf('print')}>
            {busy === 'print' ? 'جارٍ التجهيز...' : '🖨️ طباعة التقرير لين آخر مرحلة'}
          </button>
          <button className="btn-secondary" style={{ marginTop: 0, flex: 1 }} disabled={!!busy} onClick={() => makePdf('share')}>
            {busy === 'share' ? '...' : '📤 مشاركة'}
          </button>
        </div>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}

const CSS = `
.fl-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; justify-content: center; }
.fl-sheet { width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; background: var(--surface); border-radius: 22px 22px 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px)); }
.fl-grip { width: 42px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 14px; }
.fl-tag { flex-shrink: 0; font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.fl-st { display: flex; gap: 10px; position: relative; padding-bottom: 14px; }
.fl-st:not(:last-child)::before { content: ''; position: absolute; right: 13px; top: 28px; bottom: 0; width: 2px; background: var(--border); }
.fl-st.done:not(:last-child)::before { background: #1E7B3A; }
.fl-dot { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; z-index: 1; background: var(--surface-2); color: var(--text-muted); }
.done .fl-dot { background: #1E7B3A; color: #fff; }
.cur .fl-dot { background: #B08D3F; color: #fff; box-shadow: 0 0 0 4px rgba(176,141,63,.18); }
.fl-body { flex: 1; min-width: 0; }
.fl-body h4 { margin: 3px 0 5px; font-size: 14px; font-weight: 700; }
.todo .fl-body h4 { color: var(--text-muted); }
.fl-wait { font-size: 12px; color: var(--text-muted); opacity: .7; }
.fl-box { background: var(--surface-2); border-radius: 12px; padding: 9px 11px; font-size: 12.5px; line-height: 1.6; }
.cur .fl-box { border: 1px solid rgba(176,141,63,.45); }
.fl-kv div { display: flex; gap: 10px; }
.fl-kv span { width: 82px; flex-shrink: 0; color: var(--text-muted); }
.fl-kv b { font-weight: 600; word-break: break-word; }
.fl-link { margin-top: 6px; background: none; border: none; padding: 0; color: var(--gold); font-family: 'Cairo', sans-serif; font-weight: 700; font-size: 12.5px; cursor: pointer; }
.fl-mats { margin-top: 6px; border-top: 1px dashed var(--border); padding-top: 6px; }
.fl-mats div { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
.fl-mats small { color: var(--text-muted); }
`;
