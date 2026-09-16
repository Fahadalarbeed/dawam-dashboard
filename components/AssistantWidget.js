'use client';
import { useState, useRef, useEffect } from 'react';
import { askAssistant, findReports } from '../lib/assistant';
import { searchReports, downloadReportPdf } from '../lib/reportsApi';
import { downloadBlob, sharePdf } from '../lib/pdf';

const SUGGESTIONS = [
  'كم بلاغ اليوم؟',
  'أي منطقة أكثر انقطاع؟',
  'مين أسرع فني؟',
  'فيه بلاغات متأخرة؟',
  'العناوين المتكررة',
  'أبي تقارير العدادات هالشهر',
];

export default function AssistantWidget({ complaints }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'هلا 👋 اسألني أي شي عن البلاغات والفنيين والإحصائيات.\nاكتب «مساعدة» تشوف أمثلة.' },
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Report documents live in a different table than complaints, so they are only
  // fetched the first time the user actually asks for a file.
  const reportsRef = useRef(null);
  async function getReports() {
    if (reportsRef.current) return reportsRef.current;
    const rows = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'all' });
    reportsRef.current = rows || [];
    return reportsRef.current;
  }

  async function openReport(r) {
    try {
      const blob = await downloadReportPdf(r.pdf_path);
      downloadBlob(blob, (r.display_name || 'تقرير') + '.pdf');
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: 'تعذّر فتح الملف: ' + e.message }]);
    }
  }

  async function shareReport(r) {
    try {
      const blob = await downloadReportPdf(r.pdf_path);
      const name = (r.display_name || 'تقرير') + '.pdf';
      const ok = await sharePdf(blob, name);
      if (!ok) downloadBlob(blob, name);
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: 'تعذّرت المشاركة: ' + e.message }]);
    }
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);

    const answer = askAssistant(q, complaints || []);

    if (answer.wantsDocuments) {
      setMessages((m) => [...m, { role: 'bot', text: 'لحظة أدوّر لك...' }]);
      try {
        const all = await getReports();
        const found = findReports(q, all);
        setMessages((m) => [...m.slice(0, -1), { role: 'bot', text: found.text, reports: found.reports }]);
      } catch (e) {
        setMessages((m) => [...m.slice(0, -1), { role: 'bot', text: 'تعذّر جلب التقارير: ' + e.message }]);
      }
      return;
    }

    setMessages((m) => [...m, { role: 'bot', text: answer.text }]);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="المساعد"
        style={{
          position: 'fixed', bottom: 20, left: 20, zIndex: 900,
          width: 54, height: 54, borderRadius: '50%', cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--transactions)',
          color: '#fff', fontSize: 22, boxShadow: '0 4px 16px rgba(0,0,0,.18)',
        }}
      >
        💬
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 900,
        width: 'min(380px, calc(100vw - 32px))', height: 'min(540px, 75vh)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,.22)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>مساعد الدوام</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>يعمل داخل النظام — بياناتك ما تطلع برّا</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
            <div style={{
              maxWidth: '85%', padding: '9px 12px', borderRadius: 14, fontSize: 12.5, lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: m.role === 'user' ? 'var(--transactions)' : 'var(--surface-2)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>
              {m.text}
              {m.reports && m.reports.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.reports.map((r) => (
                    <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>{r.display_name || 'تقرير'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openReport(r)} className="chip" style={{ fontSize: 10.5, padding: '4px 10px' }}>📄 فتح</button>
                        <button onClick={() => shareReport(r)} className="chip" style={{ fontSize: 10.5, padding: '4px 10px' }}>📤 مشاركة</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="chip" style={{ whiteSpace: 'nowrap', fontSize: 10.5, padding: '5px 11px' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="اكتب سؤالك..."
            style={{ flex: 1, padding: '10px 12px', fontSize: 12.5 }}
          />
          <button
            onClick={() => send()}
            style={{
              flexShrink: 0, width: 42, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'var(--transactions)', color: '#fff', fontSize: 15,
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
