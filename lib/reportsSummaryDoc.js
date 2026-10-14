// ملخص التقارير لفترة — جدول للطباعة (أعطال أو عدادات)

function esc(v) {
  if (v === undefined || v === null || v === '') return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function pad(n) { return String(n).padStart(2, '0'); }
export function fmtD(v) {
  if (!v) return '';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function addressOfReport(d = {}) {
  return [d.area, d.block && `قطعة ${d.block}`, d.street && `شارع ${d.street}`, d.avenue && `جادة ${d.avenue}`, d.building && `قسيمة ${d.building}`, d.house && `منزل ${d.house}`]
    .filter(Boolean).join(' — ');
}
export function technicianOf(r) {
  const d = r.data || {};
  return d.technicianName || d.techName || d.submittedByDriver || d.employeeName || r.prepared_by || '';
}

const STYLES = `
.doc.sum-doc{width:1300px;padding:34px 44px;font-weight:500;}
.sum-doc .doc-header{margin-bottom:6px;}
.sum-doc .doc-header h2{font-size:34px;margin:8px 0 0;}
.sum-doc .sub{text-align:center;font-size:21px;color:#333;margin:4px 0 6px;}
.sum-doc .gold{height:5px;width:160px;background:#B08D3F;margin:6px auto 12px;}
.sum-doc .meta{display:flex;justify-content:space-between;font-size:17px;color:#444;margin-bottom:8px;}
.sum-doc table{width:100%;border-collapse:collapse;margin:0;}
.sum-doc th,.sum-doc td{border:1.5px solid #8C94A6;padding:7px 8px;font-size:17px;text-align:center;vertical-align:middle;width:auto;background:none;font-weight:500;line-height:1.35;}
.sum-doc th{background:#16233F;color:#fff;font-weight:700;}
.sum-doc td.r{text-align:right;}
.sum-doc .mono{font-family:'IBM Plex Mono',monospace;direction:ltr;unicode-bidi:embed;}
.sum-doc .tag{display:inline-block;border-radius:999px;padding:2px 12px;font-size:15px;font-weight:700;}
.sum-doc tr.tot td{background:#F4F1E8;font-weight:800;font-size:19px;}
`;

// rows: [{ report, stage? }] — kind: 'faults' | 'meters'
export function buildReportsSummaryDoc(rows, { kind, from, to }) {
  const isF = kind === 'faults';
  const now = new Date();
  const head = isF
    ? '<th>#</th><th>التاريخ</th><th>العنوان</th><th>الفني</th><th>نوع العطل / الإجراء</th><th>المحطة</th><th>آخر مرحلة</th>'
    : '<th>#</th><th>التاريخ</th><th>العنوان</th><th>الفني</th><th>رقم العداد</th><th>الحجم</th><th>النوع</th>';
  const body = rows.map(({ report: r, stage }, i) => {
    const d = r.data || {};
    const base = `<td>${i + 1}</td><td class="mono">${fmtD(r.report_date)}</td><td class="r">${esc(addressOfReport(d))}</td><td>${esc(technicianOf(r))}</td>`;
    return isF
      ? `<tr>${base}<td>${esc(d.faultType || d.action)}</td><td class="mono">${esc(d.station)}</td><td>${stage ? `<span class="tag" style="background:${stage.bg};color:${stage.color}">${esc(stage.label)}</span>` : ''}</td></tr>`
      : `<tr>${base}<td class="mono">${esc(d.meterNo)}</td><td class="mono">${esc(d.meterSize)}</td><td>${esc(d.meterType)}</td></tr>`;
  }).join('');
  return `<div class="doc sum-doc"><style>${STYLES}</style>
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <h2>ملخص ${isF ? 'تقارير الأعطال' : 'تقارير العدادات المحروقة'} — مراقبة الفروانية</h2>
    </div>
    <div class="sub">الفترة من <span class="mono">${fmtD(from)}</span> إلى <span class="mono">${fmtD(to)}</span></div>
    <div class="gold"></div>
    <div class="meta"><span>تاريخ الطباعة: <span class="mono">${fmtD(now.toISOString())} ${pad(now.getHours())}:${pad(now.getMinutes())}</span></span><span>عدد التقارير: <b class="mono">${rows.length}</b></span></div>
    <table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="7">لا توجد تقارير في هذه الفترة</td></tr>'}
    <tr class="tot"><td colspan="3" style="text-align:right">المجموع</td><td colspan="4" class="mono">${rows.length}</td></tr></tbody></table>
    <div class="doc-footer">مراقبة الفروانية</div>
  </div>`;
}
