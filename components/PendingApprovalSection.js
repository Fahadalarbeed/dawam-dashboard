'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FAULT_FIELDS, METER_FIELDS } from '../lib/constants';
import { updateReportData, downloadReportPdf, downloadReportPhoto } from '../lib/reportsApi';
import { downloadBlob, sharePdf } from '../lib/pdf';
import { playAlertTone } from '../lib/alertSound';

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function PreviewModal({ report, onClose, onSaved }) {
  const fields = (report.type === 'meters' ? METER_FIELDS : FAULT_FIELDS).filter((f) => f.key !== 'complainantName');
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.key] = report.data[f.key] !== undefined ? report.data[f.key] : ''; });
    return init;
  });

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    try {
      await updateReportData(report.id, values);
      onSaved && onSaved({ ...report, data: { ...report.data, ...values } });
      alert('✓ تم حفظ التعديلات');
      onClose();
    } catch (e) {
      alert('تعذر حفظ التعديلات: ' + e.message);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, overflow: 'auto', padding: 20 }}
    >
      <div style={{ maxWidth: 700, margin: '0 auto', background: 'var(--surface)', borderRadius: 12, padding: 16, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'sticky', top: 0, float: 'left', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', zIndex: 2 }}
        >
          ✕ إغلاق المعاينة
        </button>
        <div style={{ clear: 'both' }}>
          <h3 style={{ margin: '0 0 6px' }}>{report.type === 'meters' ? '📟 تقرير عداد محروق' : '⚠️ تقرير عطل'} — تعديل قبل الاعتماد</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            🕐 وقت البلاغ: {fmtDateTime(report.data.createdAtComplaint || report.created_at)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {fields.map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={values[f.key]} onChange={(e) => setField(f.key, e.target.value)} style={{ width: '100%' }}>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={values[f.key]} onChange={(e) => setField(f.key, e.target.value)} style={{ width: '100%', minHeight: 60 }} />
                ) : (
                  <input type={f.type} value={values[f.key]} onChange={(e) => setField(f.key, e.target.value)} style={{ width: '100%' }} />
                )}
              </div>
            ))}
          </div>
          {report.type === 'meters' && (report.data.meterPhotoPath || report.data.idCardPhotoPath) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              {report.data.meterPhotoPath && (
                <PhotoDisplay label="صورة العداد" icon="📷" path={report.data.meterPhotoPath} />
              )}
              {report.data.idCardPhotoPath && (
                <PhotoDisplay label="صورة البطاقة المدنية" icon="🪪" path={report.data.idCardPhotoPath} />
              )}
            </div>
          )}
          <button
            onClick={handleSave}
            style={{ marginTop: 16, width: '100%', padding: 10, background: 'var(--transactions)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            💾 حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendingApprovalSection() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [previewReport, setPreviewReport] = useState(null);

  const loadPending = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .in('type', ['faults', 'meters'])
        .eq('data->>pendingApproval', 'true')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPending(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  useEffect(() => {
    const channel = supabase
      .channel('pending-approval-reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        if ((payload.new?.type === 'faults' || payload.new?.type === 'meters') && payload.new?.data?.pendingApproval) {
          playAlertTone('new');
          loadPending();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPending]);

  async function handleApproveAndShare(report) {
    setBusyId(report.id);
    try {
      const blob = await downloadReportPdf(report.pdf_path);
      const filename = (report.display_name || 'تقرير') + '.pdf';
      const shared = await sharePdf(blob, filename);
      if (!shared) downloadBlob(blob, filename);
      // do the status update after attempting the share, so the network round-trip
      // doesn't eat into the browser's short "user activation" window for navigator.share()
      await updateReportData(report.id, { pendingApproval: false });
      setPending((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      alert('تعذر الاعتماد أو المشاركة: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(report) {
    setBusyId(report.id);
    try {
      await updateReportData(report.id, { pendingApproval: false });
      setPending((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      alert('تعذر الإخفاء: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading || pending.length === 0) return null;

  return (
    <>
      <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(220,38,38,0.4)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--danger)' }}>
          ⏳ تقارير من الفنيين بانتظار الاعتماد ({pending.length})
        </h2>
        {pending.map((r) => {
          const d = r.data || {};
          const isMeter = r.type === 'meters';
          return (
            <div key={r.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{isMeter ? '📟 تقرير عداد محروق' : '⚠️ تقرير عطل'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{d.area || ''} {d.block ? `— قطعة ${d.block}` : ''} {d.street ? `— شارع ${d.street}` : ''}</div>
                </div>
                <span style={{ background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  🔧 {d.submittedByDriver || 'غير معروف'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>🕐 {fmtDateTime(r.created_at)}</span>
                {isMeter && d.meterNo && <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>رقم العداد: {d.meterNo}</span>}
                {!isMeter && d.faultType && <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5 }}>{d.faultType}</span>}
              </div>
              {d.notes && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, background: 'var(--surface)', borderRadius: 8, padding: '6px 8px' }}>
                  📝 {d.notes}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '0 14px' }} onClick={() => setPreviewReport(r)} disabled={busyId === r.id}>
                  👁️ معاينة
                </button>
                <button className="btn-primary" style={{ marginTop: 0, flex: 1 }} onClick={() => handleApproveAndShare(r)} disabled={busyId === r.id}>
                  {busyId === r.id ? 'جارٍ...' : '✅ اعتماد ومشاركة واتساب'}
                </button>
                <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '0 14px' }} onClick={() => handleDismiss(r)} disabled={busyId === r.id}>
                  إخفاء
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {previewReport && (
        <PreviewModal
          report={previewReport}
          onClose={() => setPreviewReport(null)}
          onSaved={(updated) => {
            setPending((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
        />
      )}
    </>
  );
}
