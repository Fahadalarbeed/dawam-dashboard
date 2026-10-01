'use client';
import { supabase } from './supabaseClient';

// مولدات قسم التشغيل — جدول generators في Supabase
// الإزالة ما تحذف: تسجّل removed_at عشان يبقى السجل للبحث بالتاريخ

async function email() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email || '';
}

// المولدات الحالية (اللي ما انزالت)
export async function listActiveGenerators() {
  const { data, error } = await supabase
    .from('generators')
    .select('*')
    .is('removed_at', null)
    .order('connected_on', { ascending: false });
  if (error) throw error;
  return data || [];
}

// بحث بالتاريخ — by: 'connected' | 'removed'، from/to بصيغة YYYY-MM-DD
export async function searchGenerators({ by, from, to }) {
  let q = supabase.from('generators').select('*');
  if (by === 'removed') {
    q = q.not('removed_at', 'is', null);
    if (from) q = q.gte('removed_at', `${from}T00:00:00`);
    if (to) q = q.lte('removed_at', `${to}T23:59:59`);
    q = q.order('removed_at', { ascending: false });
  } else {
    if (from) q = q.gte('connected_on', from);
    if (to) q = q.lte('connected_on', to);
    q = q.order('connected_on', { ascending: false });
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function addGenerator(row) {
  const { data, error } = await supabase
    .from('generators')
    .insert({ ...row, created_by_email: await email() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeGenerator(id) {
  const { error } = await supabase
    .from('generators')
    .update({ removed_at: new Date().toISOString(), removed_by: await email() })
    .eq('id', id);
  if (error) throw error;
}

export async function setGeneratorStatus(id, status) {
  const { error } = await supabase.from('generators').update({ status }).eq('id', id);
  if (error) throw error;
}

// عدد الأيام من الإيصال لين اليوم (أو لين الإزالة) — اليوم الأول يُحسب
export function generatorDays(g) {
  const start = new Date(`${g.connected_on}T00:00:00`);
  const end = g.removed_at ? new Date(g.removed_at) : new Date();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

// حجم مثل "500+625" ← 1125
export function totalKva(size) {
  return String(size || '').split('+').reduce((s, x) => s + (parseFloat(x) || 0), 0);
}
