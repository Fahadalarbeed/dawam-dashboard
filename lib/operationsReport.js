import { MATERIAL_BY_ID, TYPE_AR, TYPE_SWATCH } from './materials';

// تقرير قسم التشغيل وصرف المواد — يُحوَّل لـ PDF عبر htmlToPdfBlob (lib/pdf.js)
// العرض 1300px مثل باقي التقارير، والتنسيق كله تحت .ops-doc عشان ما يتأثر بتنسيق التقارير الثانية

function esc(s) {
  if (s === undefined || s === null || s === '') return '—';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pad(n) { return String(n).padStart(2, '0'); }
function dt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const UNIT = { pcs: ['حبة', 'pcs'], m: ['متر', 'm'], cm: ['سنتي', 'cm'], mm: ['مللي', 'mm'] };

const STYLES = `
.ops-doc .doc-header{margin-bottom:10px;}
.ops-doc .doc-footer{margin-top:14px;}
.doc.ops-doc{font-weight:500;padding:32px 50px;}
.ops-doc .doc-header h2{font-size:32px;margin:8px 0 0;}
.ops-doc .h2en{font-size:22px;color:#444;direction:ltr;margin-top:2px;}
.ops-doc .gold{height:5px;width:150px;background:#B08D3F;margin:8px auto 10px;}
.ops-doc .meta{display:flex;justify-content:space-between;font-size:19px;color:#444;margin-bottom:8px;}
.ops-doc .mono{font-family:'IBM Plex Mono',monospace;direction:ltr;unicode-bidi:embed;}
.ops-doc .sec{display:flex;justify-content:space-between;background:#16233F;color:#fff;padding:6px 16px;font-size:21px;font-weight:700;margin-top:12px;}
.ops-doc .sec span:last-child{direction:ltr;font-weight:500;font-size:19px;opacity:.9;}
.ops-doc table{width:100%;border-collapse:collapse;margin:0;}
.ops-doc td,.ops-doc th{border:1.5px solid #8C94A6;padding:5px 12px;font-size:19px;line-height:1.35;vertical-align:middle;text-align:right;width:auto;background:none;font-weight:500;}
.ops-doc td.k{background:#F4F1E8;width:17%;font-size:17px;color:#333;font-weight:700;}
.ops-doc .en{font-size:14px;color:#666;direction:ltr;font-weight:500;margin-right:8px;}
.ops-doc .enb{display:block;font-size:14px;color:#666;direction:ltr;font-weight:500;}
.ops-doc .mt th{background:#EDE6D3;text-align:center;font-weight:700;font-size:18px;}
.ops-doc .mt th .enb{text-align:center;}
.ops-doc .mt td{text-align:center;}
.ops-doc .mt td.r{text-align:right;}
.ops-doc .mt td.q{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:22px;}
.ops-doc .mt tr.tot td{background:#F4F1E8;font-weight:700;}
.ops-doc .sq{display:inline-block;width:17px;height:17px;border-radius:50%;margin-right:8px;border:1.5px solid #777;vertical-align:middle;}
.ops-doc .sig{display:flex;gap:34px;margin-top:26px;}
.ops-doc .sig div{flex:1;text-align:center;font-size:18px;font-weight:700;}
.ops-doc .sig .ln{border-bottom:2px solid #111;height:50px;margin-bottom:6px;}
.ops-doc .direct{display:inline-block;background:#FFF1CC;color:#8A5A00;border-radius:8px;padding:2px 12px;font-size:18px;}
`;

function kvRows(pairs) {
  let html = '';
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    html += `<tr><td class="k">${a[0]}<span class="en">${a[1]}</span></td><td>${a[2]}</td>`;
    html += b ? `<td class="k">${b[0]}<span class="en">${b[1]}</span></td><td>${b[2]}</td></tr>` : '<td class="k"></td><td></td></tr>';
  }
  return html;
}

// report: صف البلاغ من جدول reports — override: قيم الشاشة الحالية (ملاحظات/خيار/مواد) قبل الحفظ
export function buildOperationsDoc(report, override = {}) {
  const d = report.data || {};
  const o = { ...(d.ops || {}), ...override };
  const sent = o.status === 'sent';
  const address = [d.area, d.block && `قطعة ${d.block}`, d.street && `شارع ${d.street}`, d.avenue && `جادة ${d.avenue}`, d.building && `قسيمة ${d.building}`, d.house && `منزل ${d.house}`].filter(Boolean).join(' — ');
  const m = (v) => `<span class="mono">${esc(v)}</span>`;

  const complaint = kvRows([
    ['المنطقة', 'Area', esc(d.area)],
    ['القطعة', 'Block', esc(d.block)],
    ['الشارع', 'Street', esc(d.street)],
    ['الجادة', 'Avenue', esc(d.avenue)],
    ['القسيمة', 'Plot', esc(d.building)],
    ['المنزل', 'House', esc(d.house)],
    ['الهاتف', 'Phone', m(d.phone)],
    ['الرقم الآلي', 'PACI', m(d.paci)],
    ['الفني', 'Technician', esc(d.driver)],
    ['الحالة', 'Status', sent ? 'أُرسل للمخزن · Sent' : 'نشط · Active'],
    ['تاريخ الإنشاء', 'Created', m(dt(d.createdAt || report.created_at))],
    ['تاريخ الإغلاق', 'Closed', m(dt(d.closedAt))],
  ]) + `<tr><td class="k">العنوان<span class="en">Address</span></td><td colspan="3">${esc(address)}</td></tr>`;

  const tech = kvRows([
    ['الإجراء', 'Action', esc(d.action)],
    ['المحطة', 'Station / UDS', m(d.station)],
    ['اليونت', 'Unit', m(d.unitNo)],
    ['رقم المحول', 'Trans.', m(d.transNo)],
  ]) + (d.note ? `<tr><td class="k">ملاحظة الفني<span class="en">Note</span></td><td colspan="3">${esc(d.note)}</td></tr>` : '');

  const ops = kvRows([
    ['تاريخ التحويل', 'Transferred', m(dt(o.transferredAt))],
    ['بواسطة', 'By', m(o.transferredBy)],
  ])
    + `<tr><td class="k">سبب التحويل<span class="en">Reason</span></td><td colspan="3">${o.source === 'technician' ? '<span class="direct">⚡ مباشر من الفني · Direct</span> ' : ''}${esc(o.reason)}</td></tr>`
    + `<tr><td class="k">نوع العمل<span class="en">Option</span></td><td colspan="3">${esc(o.option)}</td></tr>`
    + `<tr><td class="k">الملاحظات<span class="en">Notes</span></td><td colspan="3" style="white-space:pre-wrap">${esc(o.notes)}</td></tr>`
    + (sent ? `<tr><td class="k">الإرسال للمخزن<span class="en">Sent</span></td><td colspan="3">${m(dt(o.sentAt))}${o.sentBy ? ` — ${esc(o.sentBy)}` : ''}</td></tr>` : '');

  const mats = o.materials || [];
  const matRows = mats.length
    ? mats.map((l, i) => {
      const item = MATERIAL_BY_ID[l.itemId] || { label: l.itemId, en: '' };
      const u = UNIT[l.unit] || UNIT.pcs;
      const sw = TYPE_SWATCH[l.type] ? `<span class="sq" style="background:${TYPE_SWATCH[l.type]}"></span>` : '';
      return `<tr><td>${i + 1}</td><td class="r">${esc(item.label)}<span class="enb">${esc(item.en)}</span></td>`
        + `<td><span class="mono">${sw}${esc(l.type)}</span>${TYPE_AR[l.type] ? `<span class="enb" style="text-align:center">${TYPE_AR[l.type]}</span>` : ''}</td>`
        + `<td class="q">${esc(l.qty)}</td><td>${u[0]}<span class="enb" style="text-align:center">${u[1]}</span></td></tr>`;
    }).join('') + `<tr class="tot"><td colspan="3" style="text-align:right">إجمالي البنود / Total items</td><td colspan="2" class="q">${mats.length}</td></tr>`
    : '<tr><td colspan="5">لا توجد مواد مصروفة · No materials</td></tr>';

  return `<div class="doc ops-doc"><style>${STYLES}</style>
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2>تقرير قسم التشغيل وصرف المواد — مراقبة الفروانية</h2>
      <div class="h2en">Operations &amp; Materials Issue Report — Farwaniya</div>
    </div>
    <div class="meta"><span>تاريخ الطباعة / Printed: <span class="mono">${dt(new Date().toISOString())}</span></span><span>مرجع / Ref: <span class="mono">${esc(String(report.id).slice(0, 8).toUpperCase())}</span></span></div>
    <div class="sec"><span>بيانات البلاغ</span><span>Complaint Details</span></div><table>${complaint}</table>
    <div class="sec"><span>تقرير الفني</span><span>Technician Report</span></div><table>${tech}</table>
    <div class="sec"><span>التحويل لقسم التشغيل</span><span>Transfer to Operations</span></div><table>${ops}</table>
    <div class="sec"><span>المواد المصروفة</span><span>Materials Issued</span></div>
    <table class="mt"><thead><tr><th style="width:6%">#</th><th>المادة<span class="enb">Material</span></th><th style="width:26%">النوع<span class="enb">Type</span></th><th style="width:11%">الكمية<span class="enb">Qty</span></th><th style="width:11%">الوحدة<span class="enb">Unit</span></th></tr></thead><tbody>${matRows}</tbody></table>
    <div class="sig"><div><div class="ln"></div>فورمن التشغيل<span class="enb" style="text-align:center">Operations Foreman</span></div><div><div class="ln"></div>أمين المخزن<span class="enb" style="text-align:center">Storeman</span></div><div><div class="ln"></div>المهندس المسؤول<span class="enb" style="text-align:center">Engineer In-Charge</span></div></div>
    <div class="doc-footer">مراقبة الفروانية — قسم التشغيل</div>
  </div>`;
}
