'use client';
import { buildFaultDoc, buildMeterDoc, buildDailyDoc, DOC_STYLES } from '../lib/templates';

export default function ReportPreviewModal({ report, onClose }) {
  const data = report.data || {};
  const html = report.type === 'meters' ? buildMeterDoc(data)
    : report.type === 'faults' ? buildFaultDoc(data)
    : buildDailyDoc(data);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, overflow: 'auto', padding: 20 }}
    >
      <style>{DOC_STYLES}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 12, padding: 16, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'sticky', top: 0, float: 'left', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', zIndex: 2 }}
        >
          ✕ إغلاق المعاينة
        </button>
        <div style={{ clear: 'both' }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
