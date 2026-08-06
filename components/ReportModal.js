'use client';
import { useState, useRef } from 'react';
import {
  FAULT_FIELDS, METER_FIELDS, COMPLAINT_FIELDS, DAILY_PERIODS, DAILY_METRICS, AREA_LIST, COMPLAINT_ACTIONS,
} from '../lib/constants';
import { buildFaultDoc, buildMeterDoc, buildDailyDoc } from '../lib/templates';
import { htmlToPdfBlob, sharePdf } from '../lib/pdf';
import { uploadReportPdf, insertReport } from '../lib/reportsApi';

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const LABEL_MAP = [
  ['area', ['المنطقة', 'منطقة']],
  ['block', ['القطعة', 'قطعة']],
  ['street', ['الشارع', 'شارع']],
  ['house', ['المنزل', 'منزل', 'بيت']],
  ['paci', ['الرقم الآلي', 'الرقم الالي', 'باسي', 'PACI', 'paci']],
  ['station', ['المحطة', 'محطة']],
  ['uds', ['UDS', 'uds', 'يو دي اس']],
  ['unitNo', ['اليونت', 'يونت', 'اليونيت']],
  ['phone', ['رقم الهاتف', 'الهاتف', 'جوال', 'تلفون', 'رقم التواصل', 'رقم']],
];

function parsePastedComplaintText(text) {
  const result = {};
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line) => {
    const sepMatch = line.match(/^(.*?)[:\-–]\s*(.+)$/);
    if (!sepMatch) return;
    const labelPart = sepMatch[1].trim();
    const valuePart = sepMatch[2].trim();
    for (const [key, labels] of LABEL_MAP) {
      if (result[key]) continue;
      if (labels.some((l) => labelPart.includes(l))) {
        result[key] = valuePart;
        return;
      }
    }
  });
  if (!result.area) {
    const found = AREA_LIST.find((a) => text.includes(a));
    if (found) result.area = found;
  }
  const foundAction = COMPLAINT_ACTIONS.find((a) => text.includes(a));
  if (foundAction) result.action = foundAction;
  if (!result.phone) {
    const phoneMatch = text.match(/\b\d{8}\b/);
    if (phoneMatch) result.phone = phoneMatch[0];
  }
  return result;
}

let tesseractLoadPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('تعذر تحميل مكتبة قراءة الصور'));
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

function SmartComplaintInput({ onParsed }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stepActive, setStepActive] = useState(false);
  const [stepStatus, setStepStatus] = useState('');
  const stepActiveRef = useRef(false);
  const stepIndexRef = useRef(0);
  const stepRecognitionRef = useRef(null);
  const VOICE_STEP_FIELDS = COMPLAINT_FIELDS.filter((f) => f.key !== 'reportDate');

  function findClosestOption(transcript, options) {
    const t = transcript.trim();
    return options.find((o) => t.includes(o) || o.includes(t)) || t;
  }

  function askStep() {
    const idx = stepIndexRef.current;
    if (idx >= VOICE_STEP_FIELDS.length) {
      setStepStatus('✓ خلصنا كل الخانات! راجعها قبل الحفظ.');
      stepActiveRef.current = false;
      setStepActive(false);
      return;
    }
    const field = VOICE_STEP_FIELDS[idx];
    setStepStatus(`🎙️ قول: ${field.label}`);
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = 'ar-KW';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      let value = transcript;
      if (field.type === 'select') value = findClosestOption(transcript, field.options);
      if (field.key === 'phone' || field.key === 'paci') {
        const digits = transcript.replace(/[^\d]/g, '');
        if (digits) value = digits;
      }
      onParsed({ [field.key]: value });
      setStepStatus(`✓ ${field.label}: ${value}`);
      stepIndexRef.current += 1;
      setTimeout(() => { if (stepActiveRef.current) askStep(); }, 700);
    };
    recognition.onerror = (event) => {
      setStepStatus(`✗ ما سمعنا شي واضح (${event.error}) — اضغط "إيقاف" وحاول من جديد`);
    };
    stepRecognitionRef.current = recognition;
    recognition.start();
  }

  function toggleStepMic() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setStepStatus('✗ المتصفح ما يدعم التعرف الصوتي (جرّب Chrome بالجوال أو الكمبيوتر)');
      return;
    }
    if (stepActiveRef.current) {
      stepActiveRef.current = false;
      setStepActive(false);
      stepRecognitionRef.current && stepRecognitionRef.current.stop();
      setStepStatus('⏸️ توقفت التعبئة الصوتية');
      return;
    }
    stepActiveRef.current = true;
    setStepActive(true);
    stepIndexRef.current = 0;
    askStep();
  }

  function runParse(sourceText) {
    const parsed = parsePastedComplaintText(sourceText);
    const count = Object.keys(parsed).length;
    onParsed(parsed);
    setStatus(count > 0
      ? `✓ تم تعبئة ${count} خانة تلقائيًا (راجعها للتأكد)`
      : '⚠️ ما قدرنا نتعرف على خانات واضحة — جرب صيغة "المنطقة: ..." أو راجع الخانات يدويًا');
  }

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setOcrBusy(true);
    setStatus('⏳ جارٍ تحميل مكتبة القراءة...');
    try {
      await loadTesseract();
      setStatus('⏳ جارٍ قراءة الصورة...');
      const { data } = await window.Tesseract.recognize(file, 'ara+eng', {
        logger: (m) => { if (m.status === 'recognizing text') setStatus(`⏳ جارٍ القراءة... ${Math.round(m.progress * 100)}%`); },
      });
      setText(data.text);
      runParse(data.text);
    } catch (err) {
      setStatus('✗ تعذرت قراءة الصورة: ' + err.message);
    } finally {
      setOcrBusy(false);
    }
  }

  function toggleMic() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setStatus('✗ المتصفح ما يدعم التعرف الصوتي (جرّب Chrome بالجوال أو الكمبيوتر)');
      return;
    }
    if (isListening) {
      recognitionRef.current && recognitionRef.current.stop();
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = 'ar-KW';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = '';

    recognition.onstart = () => { setIsListening(true); setStatus('🎙️ جارٍ الاستماع... تكلم الآن'); };
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript + ' ';
        else interim += transcript;
      }
      setText(finalTranscript + interim);
    };
    recognition.onerror = (event) => { setStatus('✗ خطأ بالتعرف الصوتي: ' + event.error); };
    recognition.onend = () => {
      setIsListening(false);
      const finalText = finalTranscript.trim();
      if (finalText) runParse(finalText);
      else setStatus('');
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <div className="field" style={{ marginTop: 0 }}>
      <label>📋 الصق رسالة هنا للتعبئة التلقائية (اختياري)</label>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'مثال:\nالمنطقة: الجليب\nقطعة: 3\nشارع: 5\nمنزل: 10\nرقم الهاتف: 99887766\nالإجراء: فيوز محطة'}
      />
      <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => {
        if (!text.trim()) { setStatus('الصق رسالة أول'); return; }
        runParse(text);
      }}>
        ⚡ تعبئة تلقائية من الرسالة
      </button>

      <button type="button" className="btn-secondary" style={{ marginTop: 8, borderColor: stepActive ? 'var(--danger)' : undefined }} onClick={toggleStepMic}>
        {stepActive ? '⏹️ إيقاف التعبئة الصوتية' : '🎙️ تعبئة صوتية خطوة بخطوة'}
      </button>
      {stepStatus && (
        <div style={{ fontSize: 12, color: 'var(--transactions)', fontWeight: 700, marginTop: 6, minHeight: 16 }}>{stepStatus}</div>
      )}

      <button type="button" className="btn-secondary" style={{ marginTop: 8, borderColor: isListening ? 'var(--danger)' : undefined }} onClick={toggleMic}>
        {isListening ? '⏹️ إيقاف التسجيل' : '🎤 تكلّم برسالة كاملة (بدون توقف)'}
      </button>

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, margin: '10px 0' }}>— أو صوّرها بالكاميرا مباشرة (ورقة/رسالة) —</div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageChange}
        disabled={ocrBusy}
        style={{ width: '100%', fontSize: 11.5 }}
      />

      {status && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{status}</div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />
    </div>
  );
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
  const fields = type === 'faults' ? FAULT_FIELDS : type === 'meters' ? METER_FIELDS : type === 'complaints' ? COMPLAINT_FIELDS : null;

  const initial = {};
  if (fields) {
    fields.forEach((f) => {
      if (f.type === 'date') initial[f.key] = todayStr();
      else if (f.type === 'select') initial[f.key] = f.options[0];
      else initial[f.key] = '';
    });
    if (type === 'complaints') initial.otherAction = '';
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
  const [saved, setSaved] = useState(null); // { blob, filename }

  function setField(key, value) {
    setData((d) => ({ ...d, [key]: value }));
  }
  function setMetric(key, value) {
    setData((d) => ({ ...d, metrics: { ...d.metrics, [key]: parseInt(value, 10) || 0 } }));
  }

  const title = type === 'faults' ? 'تقرير عطل' : type === 'meters' ? 'تقرير عداد محروق' : type === 'complaints' ? 'بلاغ جديد' : 'التقارير اليومية';

  async function handleSave() {
    setSaving(true);
    setStatus({ text: '', kind: '' });
    try {
      if (type === 'complaints') {
        const actionText = data.action === 'أخرى' ? (data.otherAction || 'أخرى') : data.action;
        const displayName = `بلاغ - ${data.area || 'بدون منطقة'} - ${actionText || ''}`.trim();
        const id = crypto.randomUUID();
        await insertReport({
          id,
          type,
          report_date: data.reportDate || todayStr(),
          area: data.area || null,
          period_key: null,
          data,
          pdf_path: null,
          display_name: displayName,
          prepared_by: currentUser?.email || '',
          created_by: currentUser?.id || null,
          created_by_email: currentUser?.email || null,
        });
        setSaved({ done: true });
        setStatus({ text: 'تم حفظ البلاغ بنجاح ✓', kind: 'ok' });
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
          {type === 'complaints' && (
            <SmartComplaintInput onParsed={(parsed) => setData((d) => ({ ...d, ...parsed }))} />
          )}

          {fields && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {fields.map((f) => (
                <div className="field" key={f.key} style={{ marginTop: 8, gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: 10.5 }}>{f.label}</label>
                  <FieldInput field={f} value={data[f.key]} onChange={(v) => setField(f.key, v)} />
                </div>
              ))}
            </div>
          )}

          {type === 'complaints' && data.action === 'أخرى' && (
            <div className="field">
              <label>حدد نوع الإجراء</label>
              <input type="text" value={data.otherAction} onChange={(e) => setField('otherAction', e.target.value)} placeholder="اكتب نوع الإجراء" />
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
