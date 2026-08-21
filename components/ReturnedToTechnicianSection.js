'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReturnedToTechnicianSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .in('type', ['faults', 'meters'])
        .eq('data->>needsRevision', 'true')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('returned-to-technician')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (loading || items.length === 0) return null;

  return (
    <div className="framed" style={{ borderColor: 'rgba(180,83,9,0.4)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: '#B45309' }}>
        📤 تقارير مرجعة للفنيين — بانتظار التعديل ({items.length})
      </h2>
      <div className="alert-grid">
      {items.map((r) => {
        const d = r.data || {};
        const isMeter = r.type === 'meters';
        return (
          <div key={r.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{isMeter ? '📟 تقرير عداد محروق' : '⚠️ تقرير عطل'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{d.area || ''} {d.block ? `— قطعة ${d.block}` : ''}</div>
              </div>
              <span style={{ background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                🔧 {d.submittedByDriver || 'غير معروف'}
              </span>
            </div>
            {d.revisionNote && (
              <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 8, background: 'rgba(180,83,9,0.08)', borderRadius: 8, padding: '6px 8px' }}>
                ⚠️ سبب الإرجاع: {d.revisionNote}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>🕐 آخر تحديث: {fmtDateTime(r.created_at)}</div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
