import { generatorDays } from './generatorsApi';

// طباعة جدول المولدات — بالعرض (A4 landscape)، جدول HT ثم LT مثل كشف المحافظة
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function esc(v) {
  if (v === undefined || v === null || v === '') return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function pad(n) { return String(n).padStart(2, '0'); }
function fdate(v) {
  if (!v) return '';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fdatetime(v) {
  if (!v) return '';
  const d = new Date(v);
  return `${fdate(v)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STYLES = `
.doc.gen-doc{width:1900px;padding:34px 44px;font-weight:500;}
.gen-doc .doc-header{margin-bottom:6px;}
.gen-doc .doc-header h2{font-size:36px;margin:8px 0 0;}
.gen-doc .sub{text-align:center;font-size:22px;color:#333;margin:4px 0 6px;}
.gen-doc .gold{height:5px;width:160px;background:#B08D3F;margin:6px auto 10px;}
.gen-doc .meta{display:flex;justify-content:space-between;font-size:18px;color:#444;margin-bottom:6px;}
.gen-doc .sec{background:#16233F;color:#fff;padding:7px 16px;font-size:22px;font-weight:700;margin-top:16px;display:flex;justify-content:space-between;}
.gen-doc table{width:100%;border-collapse:collapse;margin:0;}
.gen-doc th,.gen-doc td{border:1.5px solid #8C94A6;padding:6px 6px;font-size:17px;text-align:center;vertical-align:middle;width:auto;background:none;font-weight:500;line-height:1.3;}
.gen-doc th{background:#EDE6D3;font-weight:700;font-size:16px;}
.gen-doc th.grp{background:#DCD2B8;font-size:17px;}
.gen-doc td.n{text-align:right;min-width:150px;}
.gen-doc .mono{font-family:'IBM Plex Mono',monospace;direction:ltr;unicode-bidi:embed;}
.gen-doc tr.sb td{background:#FFF8E6;}
.gen-doc tr.rm td{background:#F3F3F3;color:#666;}
.gen-doc tr.tot td{background:#F4F1E8;font-weight:800;font-size:19px;}
.gen-doc .none{padding:14px;color:#666;}
.gen-doc .grand{margin-top:14px;text-align:center;font-size:22px;font-weight:800;border:2px solid #16233F;padding:8px;}
`;

function tableFor(rows, typeLabel, showRemoved) {
  const head = `<thead>
    <tr><th class="grp" rowspan="2">م</th><th class="grp" colspan="4">العنوان</th><th class="grp" colspan="5">مصدر التغذية</th><th class="grp" colspan="5">بيانات المولد</th>
    <th class="grp" rowspan="2">النوبة</th><th class="grp" rowspan="2">التاريخ</th><th class="grp" rowspan="2">الأيام</th><th class="grp" rowspan="2">ملاحظات</th>${showRemoved ? '<th class="grp" rowspan="2">الإزالة</th>' : ''}</tr>
    <tr><th>المنطقة</th><th>القطعة</th><th>الشارع</th><th>القسيمة</th><th>محطة</th><th>UDS</th><th>Spur</th><th>محول</th><th>اليونت</th>
    <th>العدد</th><th>الحجم kVA</th><th>رقم المولد</th><th>الوايرات</th><th>الحالة</th></tr></thead>`;
  const cols = showRemoved ? 20 : 19;
  if (!rows.length) return `<table>${head}<tbody><tr><td colspan="${cols}" class="none">لا توجد مولدات ${typeLabel}</td></tr></tbody></table>`;
  const body = rows.map((g, i) => {
    const sb = g.status === 'standby';
    const rm = !!g.removed_at;
    return `<tr class="${rm ? 'rm' : sb ? 'sb' : ''}"><td>${i + 1}</td><td>${esc(g.area)}</td><td>${esc(g.block)}</td><td>${esc(g.street)}</td><td>${esc(g.plot)}</td>`
      + `<td class="mono">${esc(g.station)}</td><td class="mono">${esc(g.uds)}</td><td class="mono">${esc(g.spur)}</td><td class="mono">${esc(g.transformer)}</td><td class="mono">${esc(g.unit_no)}</td>`
      + `<td class="mono">${esc(g.gen_count)}</td><td class="mono"><b>${esc(g.size_kva)}</b></td><td class="mono">${esc(g.gen_no)}</td><td class="mono">${esc(g.wires)}</td>`
      + `<td>${sb ? 'ستاند باي' : 'شغال'}</td><td><b>${esc(g.shift)}</b></td><td class="mono">${fdate(g.connected_on)}</td><td class="mono"><b>${generatorDays(g)}</b></td>`
      + `<td class="n">${esc(g.notes)}</td>${showRemoved ? `<td>${rm ? `<span class="mono">${fdatetime(g.removed_at)}</span><br/>${esc(g.removed_by || g.removed_by_email)}` : ''}</td>` : ''}</tr>`;
  }).join('');
  const total = rows.reduce((s, g) => s + (g.gen_count || 1), 0);
  return `<table>${head}<tbody>${body}<tr class="tot"><td colspan="10" style="text-align:left">المجموع</td><td class="mono">${total}</td><td colspan="${cols - 11}"></td></tr></tbody></table>`;
}

// rows: الصفوف الظاهرة بالجدول (بعد الفلتر/البحث) — title: وصف الفلتر إن وجد
export function buildGeneratorsDoc(rows, { title = '' } = {}) {
  const now = new Date();
  const ht = rows.filter((g) => g.gen_type === 'HT');
  const lt = rows.filter((g) => g.gen_type === 'LT');
  const showRemoved = rows.some((g) => g.removed_at);
  const count = (list) => list.reduce((s, g) => s + (g.gen_count || 1), 0);
  return `<div class="doc gen-doc"><style>${STYLES}</style>
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <h2>مولدات محافظة الفروانية</h2>
    </div>
    <div class="sub">اليوم / ${DAYS_AR[now.getDay()]} / الموافق <span class="mono">${fdate(now.toISOString())}</span>${title ? ` — ${esc(title)}` : ''}</div>
    <div class="gold"></div>
    <div class="meta"><span>تاريخ الطباعة: <span class="mono">${fdatetime(now.toISOString())}</span></span><span>قسم التشغيل</span></div>
    <div class="sec"><span>مولدات أعطال / H.T</span><span class="mono">${count(ht)}</span></div>${tableFor(ht, 'HT', showRemoved)}
    <div class="sec"><span>مولدات أعطال / L.T</span><span class="mono">${count(lt)}</span></div>${tableFor(lt, 'LT', showRemoved)}
    <div class="grand">المجمـــوع الكلي: <span class="mono">${count(rows)}</span></div>
    <div class="doc-footer">مراقبة الفروانية — قسم التشغيل</div>
  </div>`;
}
