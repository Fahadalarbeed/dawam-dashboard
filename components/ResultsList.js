'use client';
import { useState } from 'react';
import { downloadReportPdf, deleteReport } from '../lib/reportsApi';
import { downloadBlob, sharePdf, mergePdfBlobs } from '../lib/pdf';
import { buildMergedDailyDoc, buildMergedMetersDoc } from '../lib/templates';
import { htmlToPdfBlob } from '../lib/pdf';
import MetricsChart from './MetricsChart';

function fmtDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const badgeLabel = { faults: 'أعطال', meters: 'عدادات', daily: 'يومي' };

export default function ResultsList({ results, activeType, isAdmin, onChanged, showToast }) {
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showChart, setShowChart] = useState(false);

  async function handleOpen(r) {
    try {
      const blob = await downloadReportPdf(r.pdf_path);
      downloadBlob(blob, (r.display_name || r.id) + '.pdf');
    } catch (e) {
      showToast('تعذر فتح التقرير: ' + e.message, true);
    }
  }

  async function handleShare(r) {
    try {
      const blob = await downloadReportPdf(r.pdf_path);
      const shared = await sharePdf(blob, (r.display_name || r.id) + '.pdf');
      if (!shared) {
        showToast('⚠️ متصفحك ما يدعم المشاركة المباشرة، فتم تنزيل الملف بدلاً من ذلك. افتح واتساب يدويًا وأرفقه من مجلد Downloads.', true);
      }
    } catch (e) {
      showToast('تعذر مشاركة التقرير: ' + e.message, true);
    }
  }

  async function handleDelete(r) {
    try {
      await deleteReport(r.id, r.pdf_path);
      showToast('تم حذف التقرير', false);
      onChanged && onChanged();
    } catch (e) {
      showToast('تعذر حذف التقرير: ' + e.message, true);
    } finally {
      setConfirmId(null);
    }
  }

  async function handlePrintAll() {
    setBusy(true);
    try {
      const blobs = [];
      for (const r of results) {
        try { blobs.push(await downloadReportPdf(r.pdf_path)); } catch (e) { /* skip missing */ }
      }
      if (blobs.length === 0) { showToast('تعذر إيجاد ملفات التقارير', true); return; }
      const merged = await mergePdfBlobs(blobs);
      downloadBlob(merged, 'تقارير_مجمعة.pdf');
      showToast(`تم تنزيل ${blobs.length} تقرير كملف واحد`, false);
    } catch (e) {
      showToast('تعذر تجهيز الملف: ' + e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleMergeDaily() {
    setBusy(true);
    try {
      const dailyReports = results.filter((r) => r.type === 'daily');
      const dataList = dailyReports.map((r) => r.data).filter(Boolean);
      if (dataList.length === 0) { showToast('لا توجد بيانات تفصيلية لدمجها', true); return; }
      const html = buildMergedDailyDoc(dataList);
      const blob = await htmlToPdfBlob(html, 'l');
      downloadBlob(blob, 'تقرير_يومي_مدمج.pdf');
      showToast(`تم دمج ${dataList.length} تقرير بملف واحد`, false);
    } catch (e) {
      showToast('تعذر الدمج: ' + e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleMetersSummary() {
    setBusy(true);
    try {
      const meterReports = results.filter((r) => r.type === 'meters');
      const dataList = meterReports.map((r) => r.data).filter(Boolean);
      if (dataList.length === 0) { showToast('لا توجد بيانات تفصيلية لعرضها', true); return; }
      const dates = meterReports.map((r) => r.report_date).sort();
      const from = dates[0];
      const to = dates[dates.length - 1];
      const html = buildMergedMetersDoc(dataList, from, to);
      const blob = await htmlToPdfBlob(html, 'l');
      downloadBlob(blob, 'إحصائية_العدادات_المحروقة.pdf');
      showToast(`تم إنشاء الإحصائية لـ ${dataList.length} تقرير`, false);
    } catch (e) {
      showToast('تعذر إنشاء الإحصائية: ' + e.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{results.length} تقرير</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {activeType === 'daily' && results.filter((r) => r.type === 'daily').length >= 1 && (
            <button className="btn-secondary" style={{ marginTop: 0 }} onClick={() => setShowChart((v) => !v)}>📊 رسم بياني</button>
          )}
          {activeType === 'daily' && results.filter((r) => r.type === 'daily').length > 1 && (
            <button className="btn-secondary" style={{ marginTop: 0 }} disabled={busy} onClick={handleMergeDaily}>🧩 دمج التقارير</button>
          )}
          {activeType === 'meters' && results.filter((r) => r.type === 'meters').length >= 1 && (
            <button className="btn-secondary" style={{ marginTop: 0 }} disabled={busy} onClick={handleMetersSummary}>📊 إحصائية العدادات المحروقة</button>
          )}
          {results.length > 0 && (
            <button className="btn-secondary" style={{ marginTop: 0 }} disabled={busy} onClick={handlePrintAll}>🖨️ طباعة الكل</button>
          )}
        </div>
      </div>

      {showChart && activeType === 'daily' && (
        <MetricsChart
          dataList={results.filter((r) => r.type === 'daily').map((r) => r.data).filter(Boolean)}
          onClose={() => setShowChart(false)}
        />
      )}

      {results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '26px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
          لا توجد تقارير مطابقة لهذا البحث
        </div>
      )}

      {results.map((r) => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8,
        }}>
          <span className={`badge ${r.type}`}>{badgeLabel[r.type]}</span>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => handleOpen(r)}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.display_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="mono">{fmtDate(r.report_date)}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => handleShare(r)} title="مشاركة" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}>📤</button>
            {isAdmin && (
              <button onClick={() => setConfirmId(r.id)} title="حذف" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            )}
          </div>
        </div>
      ))}

      {confirmId && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmId(null); }}>
          <div className="modal" style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 13.5 }}>حذف هذا التقرير؟</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-primary" style={{ marginTop: 0, background: 'var(--danger)', color: '#fff' }}
                onClick={() => hand
