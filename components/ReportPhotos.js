'use client';
import { useEffect, useState } from 'react';
import { downloadReportPhoto } from '../lib/reportsApi';

export function reportHasPhotos(r) {
  return r.type === 'meters' && (r.data?.meterPhotoPath || r.data?.idCardPhotoPath);
}

function PhotoDisplay({ label, icon, path }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    (async () => {
      try {
        const blob = await downloadReportPhoto(path);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{icon} {label}</label>
      {error ? (
        <div style={{ fontSize: 11, color: 'var(--danger)' }}>تعذر تحميل الصورة</div>
      ) : !url ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>جارٍ التحميل...</div>
      ) : (
        <img src={url} alt={label} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
      )}
    </div>
  );
}

export default function ReportPhotosModal({ report, onClose }) {
  const d = report.data || {};
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, overflow: 'auto', padding: 20 }}
    >
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--surface)', borderRadius: 12, padding: 16, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'sticky', top: 0, float: 'left', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', zIndex: 2 }}
        >
          ✕ إغلاق
        </button>
        <div style={{ clear: 'both' }}>
          <h3 style={{ margin: '0 0 14px' }}>📷 صور التقرير</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {d.meterPhotoPath && <PhotoDisplay label="صورة العداد" icon="📷" path={d.meterPhotoPath} />}
            {d.idCardPhotoPath && <PhotoDisplay label="صورة البطاقة المدنية" icon="🪪" path={d.idCardPhotoPath} />}
          </div>
        </div>
      </div>
    </div>
  );
}
