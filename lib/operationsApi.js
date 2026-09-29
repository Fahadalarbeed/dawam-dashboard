'use client';
import { supabase } from './supabaseClient';

// قسم التشغيل
// ما نحتاج جدول جديد: بيانات التشغيل تنحفظ داخل البلاغ نفسه في data.ops
// فيبقى البلاغ متصل بكل بياناته (العنوان، الفني، الإغلاق، التقرير) + بيانات التشغيل والمواد.
//
// data.ops = {
//   status: 'active' | 'sent',       نشط بقسم التشغيل / أُرسل للمخزن
//   reason, transferredAt, transferredBy,
//   notes, option,
//   materials: [{ itemId, type, qty, unit }],
//   sentAt, sentBy, updatedAt
// }

// البلاغ يقبل التحويل لو فيه تقرير كامل وما هو تقرير عدادات، وما تحوّل قبل
export function canTransferToOps(d) {
  return !!d && d.status === 'closed' && !!d.linkedReportType && d.linkedReportType !== 'meters' && !d.ops;
}

async function readData(id) {
  const { data, error } = await supabase.from('reports').select('data').eq('id', id).single();
  if (error) throw error;
  return data.data || {};
}

async function writeOps(id, opsPatch) {
  const current = await readData(id);
  const ops = { ...(current.ops || {}), ...opsPatch, updatedAt: new Date().toISOString() };
  const { data, error } = await supabase
    .from('reports')
    .update({ data: { ...current, ops } })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function currentEmail() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email || '';
}

export async function transferToOperations(id, reason) {
  const current = await readData(id);
  if (current.ops) throw new Error('البلاغ محوّل لقسم التشغيل من قبل');
  return writeOps(id, {
    status: 'active',
    reason: reason.trim(),
    transferredAt: new Date().toISOString(),
    transferredBy: await currentEmail(),
    notes: '',
    option: '',
    materials: [],
  });
}

// حفظ مسودة (الملاحظات، الخيار، المواد) بدون إغلاق
export async function saveOperations(id, { notes, option, materials }) {
  return writeOps(id, { notes, option, materials });
}

// إرسال للمخزن: يتسكّر البلاغ بقسم التشغيل ويتحوّل للمخزن
export async function sendToStore(id, { notes, option, materials }) {
  return writeOps(id, {
    notes,
    option,
    materials,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sentBy: await currentEmail(),
  });
}

// كل البلاغات اللي انحوّلت للتشغيل (نشطة ومغلقة)
export async function listOperations() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('type', 'complaints')
    .not('data->ops', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).sort((a, b) =>
    String(b.data?.ops?.transferredAt || '').localeCompare(String(a.data?.ops?.transferredAt || ''))
  );
}

// تقرير العطل المرتبط بالبلاغ (للعرض و PDF)
export async function getLinkedReport(linkedReportId) {
  if (!linkedReportId) return null;
  const { data, error } = await supabase.from('reports').select('*').eq('id', linkedReportId).maybeSingle();
  if (error) throw error;
  return data;
}

// ── تبديل الفيوزات: الفني يختار المواد عند الإغلاق والبلاغ يروح للمخزن مباشرة ──
export const FUSE_ACTIONS = ['فيوز منزل', 'فيوز محطة / UDS'];

// الحجم في نموذج الإغلاق ← المادة في نموذج المخزن
const FUSE_MATERIAL_MAP = {
  'فيوز منزل': {
    '100A': ['cutout_fuse', '100 AMP'],
    '160A': ['cutout_fuse', '160 AMP'],
    '200A': ['cutout_fuse', '200 AMP'],
    '250A': ['cutout_fuse', '250 AMP'],
    '300A': ['cutout_fuse', '315 AMP'], // 300A بالنموذج = 315 AMP بالمخزن
  },
  'فيوز محطة / UDS': {
    '355A': ['stn_fuse', '355 AMP'],
    '450A': ['stn_fuse', '450 AMP'],
    '400A (VEM)': ['vem_fuse', '400 AMP'],
  },
};

export function fuseMaterialFor(action, size, qty) {
  const m = FUSE_MATERIAL_MAP[action]?.[size];
  if (!m) return null;
  return { itemId: m[0], type: m[1], qty: Math.max(1, Number(qty) || 1), unit: 'pcs', auto: true };
}

// بيانات التشغيل لبلاغ فيوز مُرسل مباشرة للمخزن من الفني
export function directStoreOps({ materials, driver, actionLabel }) {
  const now = new Date().toISOString();
  return {
    status: 'sent',
    source: 'technician',
    reason: `${actionLabel} — إرسال مباشر من الفني`,
    transferredAt: now,
    transferredBy: driver || '',
    notes: '',
    option: '',
    materials: (materials || []).map(({ itemId, type, qty, unit }) => ({ itemId, type, qty, unit })),
    sentAt: now,
    sentBy: driver || '',
    updatedAt: now,
  };
}

// ── تحويل تلقائي: الفني يسكّر البلاغ بتقرير أعطال ← يروح لقسم التشغيل على طول (بدون اعتماد) ──
export function autoOperationsOps({ action, driver, faultType }) {
  const now = new Date().toISOString();
  return {
    status: 'active',
    source: 'auto',
    reason: [action, faultType].filter(Boolean).join(' — ') + ' — تحويل تلقائي بعد تقرير الفني',
    transferredAt: now,
    transferredBy: driver || '',
    notes: '',
    option: '',
    materials: [],
    updatedAt: now,
  };
}
