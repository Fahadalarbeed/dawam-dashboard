'use client';
import { useState } from 'react';
import {
  FAULT_FIELDS, METER_FIELDS, DAILY_PERIODS, DAILY_METRICS,
} from '../lib/constants';
import { buildFaultDoc, buildMeterDoc, buildDailyDoc } from '../lib/templates';
import { htmlToPdfBlob, sharePdf } from '../lib/pdf';
import { uploadReportPdf, insertReport } from '../lib/reportsApi';

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function FieldInput({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <input
      type={field.type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function ReportModal({ type, currentUser, onClose, onSaved }) {
  const fields = type === 'faults' ? FAULT_FIELDS : type === 'meters' ? METER_FIELDS : null;

  const initial = {};
  if (fields) {
    fields.forEach((f) => {
      if (f.type === 'date') initial[f.key] = todayStr();
      else if (f.type === 'select') initial[f.key] = f.options[0];
      else initial[f.key] = '';
    });
  } else {
    initial.reportDate = todayStr();
    initial.periodKey = 'p1';
    initial.preparedBy = '';
    initial.notes = '';
    initial.metrics = {};
    DAILY_METRICS.forEach((m) => { initial.metrics[m.key] = 0; });
  }

  const [data, setData] = useState(initial);
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  function setField(key, value) {
    setData((d) => ({ ...d, [key]: value }));
  }
  function setMetric(key, value) {
    setData((d) => ({ ...d, metrics: { ...d.metrics, [key]: parseInt(value, 10) || 0 } }));
  }

  const title = type === 'faults' ? 'تقرير عطل' : type === 'meters' ? 'تقرير عداد محروق' : 'التقارير اليومية';

  async function handleSave() {
    setSaving(true);
    setStatus({ text: '', kind: '' });
    try {
      let html, displayName, filenamePrefix, area = null, periodKey = null;

      if (type === 'faults') {
        html = buildFaultDoc(data);
        displayName = `عطل - ${data.area || 'بدون منطقة'} - ${data.faultType || ''}`.trim();
        filenamePrefix = 'تقرير_عطل_';
        area = data.area || null;
      } else if (type === 'meters') {
        html = buildMeterDoc(data);
        displayName = `عداد محروق - ${data.area || 'بدون منطقة'} - ${data.meterNo || ''}`.trim();
        filenamePrefix = 'تقرير_عداد_محروق_';
        area = data.area || null;
      } else {
        const period = DAILY_PERIODS.find((p) => p.key === data.periodKey);
        const dailyData = { ...data, periodLabel: period.label };
        html = buildDailyDoc(dailyData);
        displayName = `تقرير يومي - ${period.label} - ${data.reportDate}`;
        filenamePrefix = 'التقرير_اليومي_' + (data.periodKey === 'p1' ? 'صبح_' : data.periodKey === 'p2' ? 'عصر_' : 'ليل_');
        periodKey = data.periodKey;
      }

      const blob = await htmlToPdfBlob(html, type === 'daily' ? 'l' : 'p');
      const filename = filenamePrefix + (data.reportDate || todayStr()) + '.pdf';

      const id = crypto.randomUUID();
      const pdfPath = await uploadReportPdf(id, type, blob);

      await insertReport({
        id,
        type,
        report_date: data.reportDate || todayStr(),
        area,
        period_key: periodKey,
        data: type === 'daily' ? { ...data, periodLabel: DAILY_PERIODS.find((p) => p.key === data.periodKey).label } : data,
        pdf_path: pdfPath,
        display_name: displayName,
        prepared_by: type === 'faults' ? data.employeeName : data.preparedBy,
        created_by: currentUser?.id || null,
        created_by_email: currentUser?.email || null,
      });

      setSaved({ blob, filename });
      setStatus({ text: 'تم حفظ التقرير بنجاح ✓', kind: 'ok' });
      onSaved && onSaved();
    } catch (e) {
      console.error(e);
      setStatus({ text: 'حدث خطأ أثناء حفظ التقرير: ' + (e?.message || 'خطأ غير معروف'), kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    if (!saved) return;
    const shared = await sharePdf(saved.blob, saved.filename);
    if (!shared) {
      setStatus({
        text: '⚠️ متصفحك ما يدعم المشاركة المباشرة، فتم تنزيل الملف لجهازك بدلاً من ذلك. افتح واتساب يدويًا ← اختر المحادثة ← 📎 إرفاق ← مستند ← اختر الملف من مجلد Downloads.',
        kind: 'error',
      });
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingLeft: 4 }}>
          {fields && fields.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <FieldInput field={f} value={data[f.key]} onChange={(v) => setField(f.key, v)} />
            </div>
          ))}

          {!fields && (
            <>
              <div className="field">
                <label>اسم معد التقرير</label>
                <input type="text" value={data.preparedBy} onChange={(e) => setField('preparedBy', e.target.value)} />
              </div>
              <div className="field">
                <label>التاريخ</label>
                <input type="date" value={data.reportDate} onChange={(e) => setField('reportDate', e.target.value)} />
              </div>
              <div className="field">
                <label>الفترة</label>
                <select value={data.periodKey} onChange={(e) => setField('periodKey', e.target.value)}>
                  {DAILY_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label style={{ color: 'var(--daily)' }}>أرقام الفترة</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DAILY_METRICS.map((m) => (
                    <div key={m.key}>
                      <label style={{ fontSize: 10.5 }}>{m.label}</label>
                      <input type="number" min="0" value={data.metrics[m.key]} onChange={(e) => setMetric(m.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>ملاحظات</label>
                <textarea value={data.notes} onChange={(e) => setField('notes', e.target.value)} />
              </div>
            </>
          )}
        </div>

        {!saved && (
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ التقرير'}
          </button>
        )}

        {status.text && (
          <div style={{ fontSize: 12, marginTop: 10, color: status.kind === 'ok' ? 'var(--transactions)' : 'var(--danger)' }}>
            {status.text}
          </div>
        )}

        {saved && (
          <>
            <button className="btn-whatsapp" onClick={handleShare}>مشاركة عبر واتساب 📄</button>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={onClose}>تم</button>
          </>
        )}
      </div>
    </div>
  );
}
