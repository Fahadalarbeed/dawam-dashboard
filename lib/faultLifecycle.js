'use client';
import { supabase } from './supabaseClient';

// مسار تقرير العطل: البلاغ ← تقرير الفني ← الاعتماد ← قسم التشغيل ← المخزن
// التقرير (type=faults) مربوط بالبلاغ عن طريق complaint.data.linkedReportId / report.data.sourceComplaintId

export const STAGES = [
  { key: 'complaint', label: 'البلاغ', color: '#6A7183', bg: '#F1EDE2' },
  { key: 'report', label: 'تقرير الفني', color: '#D0592F', bg: '#FDE7DF' },
  { key: 'approval', label: 'الاعتماد', color: '#8A5A00', bg: '#FFF1CC' },
  { key: 'ops', label: 'قسم التشغيل', color: '#2A70C4', bg: '#E1EEFB' },
  { key: 'store', label: 'مكتمل · بالمخزن', color: '#1E7B3A', bg: '#E6F4EA' },
];

// البلاغات المربوطة بمجموعة تقارير أعطال ← { reportId: complaintRow }
export async function complaintsForReports(reports) {
  const faults = (reports || []).filter((r) => r.type === 'faults');
  if (!faults.length) return {};
  const ids = faults.map((r) => r.id);
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('type', 'complaints')
    .in('data->>linkedReportId', ids);
  if (error) throw error;
  const map = {};
  for (const c of data || []) map[c.data?.linkedReportId] = c;
  return map;
}

// حالة كل مرحلة + آخر مرحلة وصلها التقرير
export function faultLifecycle(report, complaint) {
  const d = report?.data || {};
  const ops = complaint?.data?.ops;
  const fromTech = !!(complaint || d.sourceComplaintId || d.submittedByDriver);

  const approval = d.needsRevision ? 'returned' : d.pendingApproval ? 'pending' : 'done';
  const steps = {
    complaint: fromTech ? 'done' : 'skip',
    report: 'done',
    approval,
    ops: ops ? (ops.status === 'sent' ? 'done' : 'current') : 'todo',
    store: ops?.status === 'sent' ? 'done' : 'todo',
  };

  let label;
  let stage;
  if (ops?.status === 'sent') { stage = 4; label = 'مكتمل · بالمخزن'; }
  else if (ops) { stage = 3; label = 'قسم التشغيل'; }
  else if (approval === 'returned') { stage = 2; label = 'مُرجَع للفني'; }
  else if (approval === 'pending') { stage = 2; label = 'بانتظار الاعتماد'; }
  else { stage = 2; label = 'معتمد'; }

  const s = STAGES[stage];
  return {
    steps, stage, label,
    color: approval === 'returned' && !ops ? '#B3261E' : s.color,
    bg: approval === 'returned' && !ops ? '#FDECEA' : s.bg,
  };
}
