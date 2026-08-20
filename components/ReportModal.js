'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  FAULT_FIELDS, METER_FIELDS, COMPLAINT_FIELDS, DAILY_PERIODS, DAILY_METRICS, DRIVERS_LIST,
} from '../lib/constants';
import { autoAssignDriver } from '../lib/assignment';
import { getCurrentShiftLetter } from '../lib/shift';
import { buildFaultDoc, buildMeterDoc, buildDailyDoc } from '../lib/templates';
import { htmlToPdfBlob, sharePdf } from '../lib/pdf';
import { uploadReportPdf, insertReport, searchReports } from '../lib/reportsApi';

function mapActionToMetricKey(action) {
  if (!action) return null;
  if (action.startsWith('فيوز منزل')) return 'kitkatFuses';
  if (action.startsWith('فيوز محطة') || action.startsWith('فيوز UDS')) return 'stationFuses';
  if (action.startsWith('عطل كيبل')) return 'lvCables';
  if (action.startsWith('عطل HT') || action.startsWith('محول / UDS') || action.startsWith('محطة طافية')) return 'htFaults';
  if (action.startsWith('قاعدة محترقة')) return 'burntBase';
  if (action.startsWith('عداد محروق')) return 'burntMeters';
  if (action.startsWith('عطل داخلي')) return 'internalReports';
  return null;
}

function getShiftRange(reportDate, periodKey) {
  if (periodKey === 'p1') {
    return { from: new Date(`${reportDate}T07:00:00`), to: new Date(`${reportDate}T15:00:00`) };
  }
  if (periodKey === 'p2') {
    return { from: new Date(`${reportDate}T15:00:00`), to: new Date(`${reportDate}T23:00:00`) };
  }
  const from = new Date(`${reportDate}T23:00:00`);
  const to = new Date(from.getTime() + 8 * 3600000);
  return { from, to };
}

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
  if (field.type === 'autodriver') {
    return <input type="text" value={value ?? ''} readOnly style={{ opacity: 0.75 }} />;
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
  const fields = type === 'faults' ? FAULT_FIELDS : type === 'meters' ? METER_FIELDS : type === 'complaints' ? COMPLAINT_FIELDS : null;

  const userLabel = currentUser?.email || '';
  const initial = {};
  if (fields) {
    fields.forEach((f) => {
      if (f.key === 'shift') initial[f.key] = getCurrentShiftLetter();
      else if (f.key === 'employeeName' || f.key === 'preparedBy') initial[f.key] = userLabel;
      else if (f.type === 'date') initial[f.key] = todayStr();
      else if (f.type === 'select') initial[f.key] = f.options[0];
      else initial[f.key] = '';
    });
  } else {
    initial.reportDate = todayStr();
    initial.periodKey = 'p1';
    initial.preparedBy = userLabel;
    initial.notes = '';
    initial.metrics = {};
    DAILY_METRICS.forEach((m) => { initial.metrics[m.key] = 0; });
  }

  const [data, setData] = useState(initial);
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // { blob, filename }
  const [allComplaints, setAllComplaints] = useState([]);
  const [manualDriver, setManualDriver] = useState('');

  // Current workload is needed to pick a technician, so load it once when a complaint form opens.
  useEffect(() => {
    if (type !== 'complaints') return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
        if (!cancelled) setAllComplaints(rows || []);
      } catch (e) {
        console.error('could not load workload for assignment', e);
      }
    })();
    return () => { cancelled = true; };
  }, [type]);

  const suggestedDriver = type === 'complaints' && data.area
    ? autoAssignDriver(allComplaints, data.area)
    : null;

  function setField(key, value) {
    setData((d) => ({ ...d, [key]: value }));
  }
  function setMetric(key, value) {
    setData((d) => ({ ...d, metrics: { ...d.metrics, [key]: parseInt(value, 10) || 0 } }));
  }

  const [autoFillStatus, setAutoFillStatus] = useState('');

  const autoFillFromClosedComplaints = useCallback(async (reportDate, periodKey) => {
    if (!reportDate || !periodKey) return;
    setAutoFillStatus('⏳ جارٍ التعبئة من البلاغات المسكّرة...');
    try {
      const { from, to } = getShiftRange(reportDate, periodKey);
      const all = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
      const counts = {};
      DAILY_METRICS.forEach((m) => { counts[m.key] = 0; });
      all.forEach((r) => {
        const cd = r.data || {};
        if (cd.status !== 'closed' || !cd.closedAt) return;
        const closedAt = new Date(cd.closedAt);
        if (closedAt < from || closedAt >= to) return;
        counts.complaints += 1;
        const metricKey = mapActionToMetricKey(cd.action);
        if (metricKey) counts[metricKey] += 1;
      });
      setData((d) => ({ ...d, metrics: counts }));
      setAutoFillStatus(`✓ تم التعبئة تلقائيًا من ${counts.complaints} بلاغ مسكّر بهذي الفترة (تقدر تعدّل الأرقام يدويًا لو تبي)`);
    } catch (e) {
      setAutoFillStatus('✗ تعذرت التعبئة التلقائية: ' + e.message);
    }
  }, []);

  useEffect(() => {
    if (type === 'daily' && data.reportDate && data.periodKey) {
      autoFillFromClosedComplaints(data.reportDate, data.periodKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, data.reportDate, data.periodKey]);

  const title = type === 'faults' ? 'تقرير عطل' : type === 'meters' ? 'تقرير عداد محروق' : type === 'complaints' ? 'بلاغ جديد' : 'التقارير اليومية';

  async function handleSave() {
    setSaving(true);
    setStatus({ text: '', kind: '' });
    try {
      if (type === 'complaints') {
        // Manual pick always wins; otherwise the engine assigns, and an empty result
        // means the complaint is queued until a technician frees up.
        const assigned = manualDriver || autoAssignDriver(allComplaints, data.area) || '';
        const displayName = `بلاغ - ${data.area || 'بدون منطقة'} - ${assigned || 'بانتظار التعيين'}`.trim();
        const id = crypto.randomUUID();
        const complaintData = {
          ...data,
          driver: assigned,
          manualAssign: !!manualDriver,
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        await insertReport({
          id,
          type,
          report_date: data.reportDate || todayStr(),
          area: data.area || null,
          period_key: null,
          data: complaintData,
          pdf_path: null,
          display_name: displayName,
          prepared_by: currentUser?.email || '',
          created_by: currentUser?.id || null,
          created_by_email: currentUser?.email || null,
        });
        if (data.driver) {
          fetch('/api/notify-driver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driver: data.driver,
              title: '🚨 بلاغ جديد',
              body: `${data.area || 'بدون منطقة'}${data.block ? ' — قطعة ' + data.block : ''}${data.street ? ' — شارع ' + data.street : ''}`,
            }),
          }).catch((e) => console.error('notify-driver failed', e));
        }
        setSaved({ done: true });
        setStatus({ text: assigned ? 'تم حفظ البلاغ بنجاح ✓' : 'تم حفظ البلاغ — بانتظار توفّر فني ⏳', kind: 'ok' });
        onSaved && onSaved();
        return;
      }

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
          {fields && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {fields.map((f) => (
                <div className="field" key={f.key} style={{ marginTop: 8, gridColumn: f.type === 'autodriver' || f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: 10.5 }}>{f.label}</label>
                  <FieldInput
                    field={f}
                    value={f.type === 'autodriver'
                      ? (manualDriver ? `${manualDriver} (يدوي)` : (suggestedDriver || 'بانتظار توفّر فني ⏳'))
                      : data[f.key]}
                    onChange={(v) => setField(f.key, v)}
                  />
                </div>
              ))}
              {type === 'complaints' && (
                <div className="field" style={{ marginTop: 8, gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 10.5 }}>تعيين فني يدويًا (اختياري)</label>
                  <select value={manualDriver} onChange={(e) => setManualDriver(e.target.value)}>
                    <option value="">— تلقائي —</option>
                    {DRIVERS_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

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
                {autoFillStatus && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{autoFillStatus}</div>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 0, marginBottom: 10, width: '100%' }}
                  onClick={() => autoFillFromClosedComplaints(data.reportDate, data.periodKey)}
                >
                  🔄 إعادة التعبئة من البلاغات المسكّرة
                </button>
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

        {saved && type !== 'complaints' && (
          <>
            <button className="btn-whatsapp" onClick={handleShare}>مشاركة عبر واتساب 📄</button>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={onClose}>تم</button>
          </>
        )}
        {saved && type === 'complaints' && (
          <button className="btn-secondary" style={{ width: '100%' }} onClick={onClose}>تم</button>
        )}
      </div>
    </div>
  );
}
