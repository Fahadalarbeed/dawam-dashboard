'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { searchReports, deleteReport, checkIsAdmin } from '../../lib/reportsApi';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const FIELD_LABELS = [
  ['reportDate', 'التاريخ', (v) => fmtDate(v)],
  ['area', 'المنطقة'],
  ['block', 'القطعة'],
  ['street', 'الشارع'],
  ['house', 'المنزل'],
  ['paci', 'الرقم الآلي (PACI)'],
  ['station', 'المحول أو UDS'],
  ['unitNo', 'اليونت'],
  ['phone', 'رقم الهاتف'],
];

export default function ComplaintsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [complaints, setComplaints] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setCheckingAuth(false);
      checkIsAdmin(data.session.user.id).then(setIsAdmin);
    });
  }, [router]);

  const loadComplaints = useCallback(async () => {
    try {
      const data = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
      setComplaints(data);
    } catch (e) {
      console.error(e);
      setComplaints([]);
    }
  }, []);

  useEffect(() => {
    if (!checkingAuth) loadComplaints();
  }, [checkingAuth, loadComplaints]);

  async function handleDelete(r) {
    try {
      await deleteReport(r.id, r.pdf_path);
      loadComplaints();
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmId(null);
    }
  }

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق...</div>;
  }

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '10px 16px' }} onClick={() => router.push('/dashboard')}>
          → رجوع
        </button>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>إحصائية البلاغات</h1>
      </header>

      <div className="card">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          {complaints ? `${complaints.length} بلاغ` : 'جارٍ التحميل...'}
        </div>

        {complaints && complaints.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            لا توجد بلاغات مسجّلة بعد
          </div>
        )}

        {complaints && complaints.map((r) => {
          const d = r.data || {};
          const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
          return (
            <div key={r.id} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '8px 10px', marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
            }}>
              {FIELD_LABELS.map(([key, label, format]) => {
                const val = format ? format(d[key]) : d[key];
                if (!val) return null;
                return (
                  <span key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}:</span> <b>{val}</b>
                  </span>
                );
              })}
              <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
                {actionText}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setConfirmId(r.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 15, marginRight: 'auto' }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirmId && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmId(null); }}>
          <div className="modal" style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 13.5 }}>حذف هذا البلاغ؟</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-primary" style={{ marginTop: 0, background: 'var(--danger)', color: '#fff' }}
                onClick={() => handleDelete(complaints.find((r) => r.id === confirmId))}>حذف</button>
              <button className="btn-secondary" style={{ marginTop: 0 }} onClick={() => setConfirmId(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
