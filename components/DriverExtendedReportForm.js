'use client';
import { useState } from 'react';
import { FAULT_FIELDS, METER_FIELDS } from '../lib/constants';
import { buildFaultDoc, buildMeterDoc } from '../lib/templates';
import { htmlToPdfBlob } from '../lib/pdf';
import { insertReport, uploadReportPdf, updateReportData, uploadReportPhoto } from '../lib/reportsApi';
import { playAlertTone } from '../lib/alertSound';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTimeStr() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SHIFT_BASE_ORDER = ['أ', 'ب', 'ج', 'هـ', 'د'];
const SHIFT_LETTER_MAP = { 'أ': 'A', 'ب': 'B', 'ج': 'C', 'هـ': 'D', 'د': 'E' };
// NOTE: mirrors the rotation logic used by ShiftLeadCard; keep in sync if that logic changes.
function getCurrentShiftLetter() {
  try {
    const epoch = new Date('2024-01-01T00:00:00');
    const now = new Date();
    const daysSince = Math.floor((now - epoch) / 86400000);
    const idx = daysSince % SHIFT_BASE_ORDER.length;
    return SHIFT_LETTER_MAP[SHIFT_BASE_ORDER[idx]] || 'A';
  } catch (e) {
    return 'A';
  }
}

const ACTION_TO_REPORT_TYPE = {
  'عداد محروق': 'meters',
  'عطل كيبل': 'faults',
  'قاعدة محترقة': 'faults',
};

// returns 'yes' | 'no' | 'ask'
export function resolveExtendedReport(action, size) {
  if (action === 'قاعدة محترقة') {
    if (size === '200A' || size === '300A') return 'yes';
    if (size === '100A') return 'ask';
    return 'no';
  }
  return ACTION_TO_REPORT_TYPE[action] ? 'yes' : 'no';
}
export function isExtendedReportAction(action) {
  return Object.prototype.hasOwnProperty.call(ACTION_TO_REPORT_TYPE, action);
}

function buildInitialData(complaintData, action) {
  const reportType = ACTION_TO_REPORT_TYPE[action];
  let fields = (reportType === 'meters' ? METER_FIELDS : FAULT_FIELDS).filter((f) => f.key !== 'complainantName');
  if (reportType === 'meters') fields = fields.filter((f) => f.key !== 'preparedBy');
  const init = {};
  fields.forEach((f) => {
    if (f.key === 'shift') {
      init[f.key] = getCurrentShiftLetter();
    } else if (complaintData[f.key] !== undefined && complaintData[f.key] !== '') {
      init[f.key] = complaintData[f.key];
    } else if (f.type === 'date') {
      init[f.key] = todayStr();
    } else if (f.type === 'time') {
      init[f.key] = nowTimeStr();
    } else if (f.type === 'select') {
      init[f.key] = f.options[0];
    } else {
      init[f.key] = '';
    }
  });
  return { reportType, fields, init };
}

function PhotoField({ label, icon, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>{icon} {label}</label>
      {!value ? (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-2)', border: '2px dashed var(--border)', borderRadius: 14, padding: '20px 10px', cursor: 'pointer', minHeight: 120, textAlign: 'center' }}>
          <div style={{ fontSize: 26 }}>{icon}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>اضغط لالتقاط/رفع صورة</div>
          <input
            type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onChange({ file, previewUrl: reader.result });
              reader.readAsDataURL(file);
            }}
          />
        </label>
      ) : (
        <div style={{ position: 'relative', marginTop: 6 }}>
          <img src={value.previewUrl} alt={label} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', display: 'block' }} />
          <button
            type="button" onClick={() => onChange(null)}
            style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(220,38,38,0.9)', color: '#fff', border: 'none', borderRadius: 20, width: 26, height: 26, fontSize: 13, cursor: 'pointer' }}
          >✕</button>
        </div>
      )}
    </div>
  );
}

function ExtendedReportInner({ complaint, action, driverName, onSubmitted, onCancel }) {
  const complaintData = complaint.data || {};
  const { reportType, fields, init } = buildInitialData(complaintData, action);
  const [data, setData] = useState(init);
  const [meterPhoto, setMeterPhoto] = useState(null);
  const [idCardPhoto, setIdCardPhoto] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function setField(key, value) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const fullData = { ...data, notes: reportType === 'meters' ? (data.procedure || '') : notes };
      const html = reportType === 'meters' ? buildMeterDoc(fullData) : buildFaultDoc(fullData);
      const blob = await htmlToPdfBlob(html, 'p');
      const id = crypto.randomUUID();
      const pdfPath = await uploadReportPdf(id, reportType, blob);

      let meterPhotoPath, idCardPhotoPath;
      if (meterPhoto?.file) meterPhotoPath = await uploadReportPhoto(id, 'meter', meterPhoto.file);
      if (idCardPhoto?.file) idCardPhotoPath = await uploadReportPhoto(id, 'idcard', idCardPhoto.file);

      await insertReport({
        id,
        type: reportType,
        report_date: data.reportDate || todayStr(),
        area: data.area || null,
        period_key: null,
        data: {
          ...fullData,
          meterPhotoPath: meterPhotoPath || undefined,
          idCardPhotoPath: idCardPhotoPath || undefined,
          pendingApproval: true,
          submittedByDriver: driverName || '',
          sourceComplaintId: complaint.id,
          createdAtComplaint: complaintData.createdAt,
        },
        pdf_path: pdfPath,
        display_name: reportType === 'meters'
          ? `عداد محروق - ${data.area || 'بدون منطقة'} - ${data.meterNo || ''}`.trim()
          : `عطل - ${data.area || 'بدون منطقة'} - ${data.faultType || ''}`.trim(),
        prepared_by: driverName || '',
        created_by: null,
        created_by_email: null,
      });

      await updateReportData(complaint.id, {
        status: 'closed',
        action,
        note: fullData.notes || '',
        closedAt: new Date().toISOString(),
        linkedReportId: id,
        linkedReportType: reportType,
      });

      playAlertTone('new');
      onSubmitted && onSubmitted();
    } catch (e) {
      alert('تعذر إتمام التقرير: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--complaints)', fontWeight: 700, marginBottom: 10 }}>
        📋 إتمام {reportType === 'meters' ? 'تقرير عداد محروق' : 'تقرير عطل'} — راجع وعبّي الباقي
      </div>
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

      {reportType !== 'meters' ? (
        <div className="field">
          <label>ملاحظة</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي ملاحظة إضافية" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <PhotoField label="صورة العداد" icon="📷" value={meterPhoto} onChange={setMeterPhoto} />
          <PhotoField label="صورة البطاقة المدنية" icon="🪪" value={idCardPhoto} onChange={setIdCardPhoto} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn-primary" style={{ marginTop: 0, flex: 1 }} onClick={handleSubmit} disabled={saving}>
          {saving ? 'جارٍ الإرسال...' : '✅ إتمام وإرسال للاعتماد'}
        </button>
        <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '0 16px' }} onClick={onCancel} disabled={saving}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default function DriverExtendedReportForm({ complaint, action, size, driverName, onSubmitted, onCancel }) {
  const resolution = resolveExtendedReport(action, size);
  const [choice, setChoice] = useState(null);

  if (resolution === 'no') return null;

  if (resolution === 'ask' && !choice) {
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1, marginTop: 0 }} onClick={() => onCancel && onCancel()}>🔧 تبديل</button>
          <button type="button" className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={() => setChoice('extended')}>📋 عمل تقرير كامل</button>
        </div>
      </div>
    );
  }

  return <ExtendedReportInner complaint={complaint} action={action} driverName={driverName} onSubmitted={onSubmitted} onCancel={onCancel} />;
}
