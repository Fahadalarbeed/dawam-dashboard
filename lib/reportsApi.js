'use client';
import { supabase } from './supabaseClient';

const BUCKET = 'report-pdfs';

export async function uploadReportPdf(id, type, blob) {
  const path = `${type}/${id}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function downloadReportPdf(pdfPath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(pdfPath);
  if (error) throw error;
  return data; // Blob
}

export async function insertReport(row) {
  const { data, error } = await supabase.from('reports').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteReport(id, pdfPath) {
  const { error: dbErr } = await supabase.from('reports').delete().eq('id', id);
  if (dbErr) throw dbErr;
  if (pdfPath) {
    // best-effort — don't block on storage cleanup failing
    await supabase.storage.from(BUCKET).remove([pdfPath]).catch(() => {});
  }
}

// from/to are 'YYYY-MM-DD' strings (inclusive)
export async function searchReports({ from, to, type, area, block, street, building, house, paci, meterNo, action }) {
  let query = supabase
    .from('reports')
    .select('*')
    .gte('report_date', from)
    .lte('report_date', to)
    .order('created_at', { ascending: false });

  if (type === 'all') {
    query = query.neq('type', 'complaints');
  } else if (type) {
    query = query.eq('type', type);
  }
  if (area && area !== 'all') query = query.eq('area', area);
  if (block) query = query.ilike('data->>block', `%${block}%`);
  if (street) query = query.ilike('data->>street', `%${street}%`);
  if (building) query = query.ilike('data->>building', `%${building}%`);
  if (house) query = query.ilike('data->>house', `%${house}%`);
  if (paci) query = query.ilike('data->>paci', `%${paci}%`);
  if (meterNo) query = query.ilike('data->>meterNo', `%${meterNo}%`);
  if (action) query = query.eq('data->>action', action);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function todaysStats(todayStr) {
  const { data, error } = await supabase.from('reports').select('type').eq('report_date', todayStr);
  if (error) throw error;
  return {
    total: data.length,
    faults: data.filter((r) => r.type === 'faults').length,
    meters: data.filter((r) => r.type === 'meters').length,
  };
}

export async function checkIsAdmin(userId) {
  if (!userId) return false;
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) { console.warn('checkIsAdmin failed:', error); return false; }
  return !!data;
}
