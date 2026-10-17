'use client';
import { supabase } from './supabaseClient';

// مولدات الفروانية — صفحة عامة بدون تسجيل دخول
// الإزالة ما تحذف: تسجّل removed_at + اسم اللي أزال

export async function listActiveGenerators() {
  const { data, error } = await supabase
    .from('generators')
    .select('*')
    .is('removed_at', null)
    .order('connected_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function searchGenerators({ by, from, to }) {
  let q = supabase.from('generators').select('*');
  if (by === 'removed') {
    q = q.not('removed_at', 'is', null);
    if (from) q = q.gte('removed_at', `${from}T00:00:00+03:00`);
    if (to) q = q.lte('removed_at', `${to}T23:59:59+03:00`);
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
  const { error } = await supabase.from('generators').insert(row);
  if (error) throw error;
}

export async function removeGenerator(id, removerName, { removedAt, requestAt } = {}) {
  const { error } = await supabase
    .from('generators')
    .update({
      removed_at: removedAt || new Date().toISOString(),
      removal_request_at: requestAt || null,
      removed_by: (removerName || '').trim() || null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function setGeneratorStatus(id, status) {
  const { error } = await supabase.from('generators').update({ status }).eq('id', id);
  if (error) throw error;
}

// تحديث مباشر: أي مولد ينضاف أو يتعدل من أي صفحة يظهر على طول
export function subscribeGenerators(onChange) {
  const ch = supabase
    .channel('generators-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'generators' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export { generatorDays } from './genDays';

export function totalKva(size) {
  return String(size || '').split('+').reduce((s, x) => s + (parseFloat(x) || 0), 0);
}

export const GEN_SIZES = ['1800', '1250', '1150', '1000', '950', '850', '750', '625', '500', '450', '320', '180', '150'];
export const INSTALL_REASONS = ['تخفيف الأحمال', 'عطل بالمحول', 'صيانة', 'كيبل فولتي', 'قطع مبرمج', 'خط مين', 'تقسيم أحمال', 'أخرى'];
