'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FAULT_FIELDS, METER_FIELDS } from '../lib/constants';
import { buildFaultDoc, buildMeterDoc } from '../lib/templates';
import { htmlToPdfBlob } from '../lib/pdf';
import { updateReportData, uploadReportPdf, uploadReportPhoto, downloadReportPhoto } from '../lib/reportsApi';
import { playAlertTone } from '../lib/alertSound';

function PhotoRefreshField({ label, icon, existingPath, onChange }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(!!existingPath);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    if (existingPath) {
      (async () => {
        try {
          const blob = await downloadReportPhoto(existingPath);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        } catch (e) {
          console.error(e);
        } finally {
          if (!cancelled) setLoadingExisting(false);
        }
      })();
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [existingPath]);

  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>{icon} {label}</label>
      {previewUrl && (
        <img src={previewUrl} alt={label} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', display: 'block', marginBottom: 6 }} />
      )}
      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-2)', border: '2px dashed var(--border)', borderRadius: 14, padding: '14px 10px', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loadingExisting ? 'جارٍ تحميل الصورة الحالية...' : previewUrl ? 'اضغط لاستبدال الصورة' : 'اضغط لالتقاط/رفع صورة'}</div>
        <input
          type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { setPreviewUrl(reader.result); onChange(file); };
            reader.readAsDataURL(file);
          }}
        />
      </label>
    </div>
  );
}

function RevisionEditForm({ report, onDone, onCancel }) {
  const fields = (report.type === 'meters' ? METER_FIELDS : FAULT_FIELDS).filter((f) => f.key !== 'complainantName' && f.key !== 'preparedBy');
  const [data, setData] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.key] = report.data[f.key] !== undefined ? report.data[f.key] : ''; });
    return init;
  });
  const [meterPhotoFile, setMeterPhotoFile] = useState(null);
  const [idCardPhotoFile, setIdCardPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  function setField(key, value) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handleResubmit() {
    setSaving(true);
    try {
      const fullData = { ...report.data, ...data };
      const html = report.type === 'meters' ? buildMeterDoc(fullData) : buildFaultDoc(fullData);
      const blob = await htmlToPdfBlob(html, 'p');
      await uploadReportPdf(report.id, report.type, blob);

      let meterPhotoPath = report.data.meterPhotoPath;
      let idCardPhotoPath = report.data.idCardPhotoPath;
      if (meterPhotoFile) meterPhotoPath = await uploadReportPhoto(report.id, 'meter', meterPhotoFile);
      if (idCardPhotoFile) idCardPhotoPath = await uploadReportPhoto(report.id, 'idcard', idCardPhotoFile);

      await updateReportData(report.id, {
        ...data,
        meterPhotoPath,
        idCardPhotoPath,
        needsRevision: false,
        revisionNote: '',
      });

      playAlertTone('new');
      onDone();
    } catch (e) {
      alert('تعذر إعادة الإرسال: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fields.map((f) => (
          <div key={f.key} className="field" style={{ marginTop: 0 }}>
            <label>{f.label}</label>
            {f.type === 'select' ? (
              <select value={data[f.key]} onChange={(e) => setField(f.key, e.target.value)}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea value={data[f.key]} onChange={(e) => setField(f.key, e.target.value)} />
            ) : (
              <input type={f.type} value={data[f.key]} onChange={(e) => setField(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>

      {report.type === 'meters' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <PhotoRefreshField label="صورة العداد" icon="📷" existingPath={report.data.meterPhotoPath} onChange={setMeterPhotoFile} />
          <PhotoRefreshField label="صورة البطاقة المدنية" icon="🪪" existingPath={report.data.idCardPhotoPath} onChange={setIdCardPhotoFile} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" style={{ marginTop: 0, flex: 1 }} onClick={handleResubmit} disabled={saving}>
          {saving ? 'جارٍ الإرسال...' : '✅ إعادة إرسال للاعتماد'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '0 16px' }} onClick={onCancel} disabled={saving}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default function TechnicianRevisionSection({ driverName }) {
  const [reports, setReports] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const loadRevisions = useCallback(async () => {
    if (!driverName) return;
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .in('type', ['faults', 'meters'])
        .eq('data->>submittedByDriver', driverName)
        .eq('data->>needsRevision', 'true')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (e) {
      console.error(e);
    }
  }, [driverName]);

  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  useEffect(() => {
    if (!driverName) return undefined;
    const channel = supabase
      .channel('technician-revisions')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, (payload) => {
        if (payload.new?.data?.submittedByDriver === driverName) loadRevisions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverName, loadRevisions]);

  if (reports.length === 0) return null;

  return (
    <>
      {reports.map((r) => {
        const d = r.data || {};
        const isMeter = r.type === 'meters';
        return (
          <div key={r.id} className="card" style={{ marginBottom: 10, borderColor: 'rgba(220,38,38,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{isMeter ? '📟 تقرير عداد محروق' : '⚠️ تقرير عطل'} — {d.area || 'بدون منطقة'}</div>
              <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                ↩️ يحتاج تعديل
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{d.block ? `قطعة ${d.block}` : ''} {d.street ? `— شارع ${d.street}` : ''}</div>
            {d.revisionNote && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 8, background: 'rgba(220,38,38,0.08)', borderRadius: 8, padding: '6px 8px' }}>
                ⚠️ سبب الإرجاع: {d.revisionNote}
              </div>
            )}
            {editingId === r.id ? (
              <RevisionEditForm report={r} onDone={() => { setEditingId(null); loadRevisions(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <button className="btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={() => setEditingId(r.id)}>
                ✏️ تعديل وإعادة إرسال
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
