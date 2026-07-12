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
  return data;
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
    await supabase.storage.from(BUCKET).remove([pdfPath]).catch(() => {});
  }
}

export async function searchReports({ from, to, type, area }) {
  let query = supabase
    .from('reports')
    .select('*')
    .gte('report_date', from)
    .lte('report_date', to)
    .order('created_at', { ascending: false });

  if (type && type !== 'all') query = query.eq('type', type);
  if (area && area !== 'all') query = query.eq('area', area);

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
