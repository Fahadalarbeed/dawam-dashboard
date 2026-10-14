'use client';
import { useEffect, useState } from 'react';
import { complaintsForReports, faultLifecycle } from '../lib/faultLifecycle';
import { buildReportsSummaryDoc, addressOfReport, technicianOf, fmtD } from '../lib/reportsSummaryDoc';
import { htmlToPdfBlob, downloadBlob, sharePdf } from '../lib/pdf';
import FaultLifecycleModal from './FaultLifecycleModal';

// ملخص الفترة: جدول بكل تقارير النوع المختار (أعطال أو عدادات) + طباعة ومشاركة
export default function ReportsSummary({ reports, kind, from, to, onClose }) {
  const isF = kind === 'faults';
  const [complaints, setComplaints] = useState({});
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!isF) return;
    complaintsForReports(reports).then(setComplaints).catch(() => {});
  }, [reports, isF]);

  const rows = reports.map((r) => ({ report: r, stage: isF ? faultLifecycle(r, complaints[r.id]) : null }));

  async function makePdf(mode) {
    setBusy(mode);
    try {
      const blob = await htmlToPdfBlob(buildReportsSummaryDoc(rows, { kind, from, to }), 'p', 2.5);
      const name = `ملخص-${isF ? 'الأعطال' : 'العدادات'}-${from}-${to}.pdf`;
      if (mode === 'share') await sharePdf(blob, name);
      else {
        const url = URL.createObjectURL(blob);
        if (!window.open(url, '_blank')) downloadBlob(blob, name);
      }
    } catch (e) { alert('تعذر تجهيز الملخص: ' + e.message); }
    finally { setBusy(''); }
  }

  return (
    <div className="framed" style={{ marginTop: 16, padding: 14 }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>
          ملخص {isF ? 'الأعطال' : 'العدادات'} — <span className="mono" style={{ fontWeight: 600 }}>{fmtD(from)} → {fmtD(to)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="rs-count mono">{reports.length}</span>
          <button className="rs-x" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
      </div>

      <div className="rs-tw">
        <table className="rs-table">
          <thead>
            <tr>
              <th>#</th><th>التاريخ</th><th>العنوان</th><th>الفني</th>
              {isF ? <><th>نوع العطل</th><th>المحطة</th><th>آخر مرحلة</th></> : <><th>رقم العداد</th><th>الحجم</th><th>النوع</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="rs-empty">لا توجد تقارير في هذه الفترة</td></tr>}
            {rows.map(({ report: r, stage }, i) => {
              const d = r.data || {};
              return (
                <tr key={r.id} className={isF ? 'click' : ''} onClick={isF ? () => setOpen(r) : undefined}>
                  <td>{i + 1}</td>
                  <td className="mono">{fmtD(r.report_date)}</td>
                  <td className="rs-addr">{addressOfReport(d)}</td>
                  <td>{technicianOf(r)}</td>
                  {isF ? (
                    <>
                      <td>{d.faultType || d.action}</td>
                      <td className="mono">{d.station}</td>
                      <td><span className="rs-tag" style={{ background: stage.bg, color: stage.color }}>{stage.label}</span></td>
                    </>
                  ) : (
                    <>
                      <td className="mono">{d.meterNo}</td>
                      <td className="mono">{d.meterSize}</td>
                      <td>{d.meterType}</td>
                    </>
                  )}
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="tot"><td colSpan={3}>المجموع</td><td colSpan={4} className="mono">{rows.length}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {isF && rows.length > 0 && <div className="rs-hint">اضغط على أي عطل عشان تفتحه على آخر مرحلة وصلها</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn-primary" style={{ marginTop: 0, flex: 1 }} disabled={!!busy || !rows.length} onClick={() => makePdf('print')}>
          {busy === 'print' ? 'جارٍ التجهيز...' : '🖨️ طباعة'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 0, flex: 1 }} disabled={!!busy || !rows.length} onClick={() => makePdf('share')}>
          {busy === 'share' ? '...' : '📤 مشاركة'}
        </button>
      </div>

      {open && <FaultLifecycleModal report={open} complaint={complaints[open.id]} onClose={() => setOpen(null)} />}
    </div>
  );
}

const CSS = `
.rs-count { background: var(--navy); color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 12px; }
.rs-x { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
.rs-tw { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
.rs-table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 12px; }
.rs-table th { background: var(--navy); color: #fff; font-weight: 600; padding: 7px 6px; text-align: right; white-space: nowrap; }
.rs-table td { padding: 7px 6px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.rs-table tr.click { cursor: pointer; }
.rs-table tr.click:hover td { background: var(--surface-2); }
.rs-table tr.tot td { background: var(--surface-2); font-weight: 800; }
.rs-addr { white-space: normal !important; min-width: 170px; }
.rs-tag { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.rs-empty { text-align: center; color: var(--text-muted); padding: 18px !important; }
.rs-hint { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 6px; }
`;
