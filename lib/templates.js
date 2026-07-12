import { DAILY_METRICS, PERIOD_ORDER } from './constants';

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const DOC_STYLES = `
  *{box-sizing:border-box;}
  body{margin:0;background:#fff;}
  .doc{background:#fff;color:#111;font-family:'Cairo',sans-serif;padding:26px 30px;width:760px;}
  .doc .doc-header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:14px;position:relative;}
  .doc .doc-header .logo{position:absolute;top:0;left:0;height:50px;}
  .doc .doc-header .org{font-size:12px;color:#444;}
  .doc .doc-header .org-en{font-size:10.5px;color:#666;}
  .doc .doc-header h2{font-size:19px;margin:8px 0 0;}
  .doc .doc-footer{margin-top:16px;padding-top:8px;border-top:1px solid #999;font-size:11.5px;color:#333;text-align:left;font-weight:600;}
  .doc table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .doc td, .doc th{border:1px solid #333;padding:8px 10px;font-size:12.5px;vertical-align:top;}
  .doc th{background:#DCE8D0;font-weight:700;text-align:center;width:33%;}
  .doc td.val{font-family:'IBM Plex Mono',monospace;font-size:13px;}
  .doc .blk-blue th{background:#D6E4F0;}
  .doc .blk-yellow th{background:#FBF0D9;}
  .doc .blk-pink th{background:#F7DADD;}
  .doc .box-label{font-weight:700;font-size:12.5px;margin:10px 0 4px;}
  .doc .box{border:1px solid #333;min-height:80px;padding:10px;font-size:13px;white-space:pre-wrap;}
  .doc .daily-table th, .doc .daily-table td{padding:7px 5px;font-size:11.5px;text-align:center;width:auto;}
  .doc .daily-table th.period-col, .doc .daily-table td.period-col{width:16%;text-align:right;font-size:12px;}
  .doc .daily-table tr.total-row th, .doc .daily-table tr.total-row td{background:#EFEFEF;font-weight:700;}
  .doc .grand-total{text-align:left;font-size:12px;font-weight:700;margin:6px 0 14px;}
`;

function row3(a, b, c) {
  return `<tr><th>${a.l}</th><th>${b.l}</th><th>${c.l}</th></tr><tr><td class="val">${escapeHtml(a.v)}</td><td class="val">${escapeHtml(b.v)}</td><td class="val">${escapeHtml(c.v)}</td></tr>`;
}

export function buildFaultDoc(d) {
  return `<div class="doc">
    <div class="doc-header">
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2>تقرير الأعطال لمراقبة الفروانية</h2>
    </div>
    <table>
      <tr><th>أسم الموظف</th><th>التاريخ / Date</th><th>النوبة / Shift</th></tr>
      <tr><td class="val">${escapeHtml(d.employeeName)}</td><td class="val">${fmtDate(d.reportDate)}</td><td class="val">${escapeHtml(d.shift)}</td></tr>
      <tr><th>الساعة / Time</th><th colspan="2">نوع العطل / Fault Type</th></tr>
      <tr><td class="val">${escapeHtml(d.time)}</td><td class="val" colspan="2">${escapeHtml(d.faultType)}</td></tr>
    </table>
    <table>
      ${row3({ l: 'Ln / جادة', v: d.avenue }, { l: 'Block / القطعة', v: d.block }, { l: 'Area / المنطقة', v: d.area })}
      ${row3({ l: 'House / منزل', v: d.house }, { l: 'Building / قسيمة', v: d.building }, { l: 'Street / شارع', v: d.street })}
      <tr><th colspan="3">PACI / الرقم الآلي</th></tr>
      <tr><td class="val" colspan="3">${escapeHtml(d.paci)}</td></tr>
      ${row3({ l: 'Unit No.', v: d.unitNo }, { l: 'Trans. No.', v: d.transNo }, { l: 'S/S or UDS', v: d.station })}
      ${row3({ l: 'Techn. Name', v: d.technicianName }, { l: 'Compl. Tel.', v: d.complainantPhone }, { l: 'The Complainant', v: d.complainantName })}
    </table>
    <div class="doc-footer">التقرير أُعد بواسطة: ${escapeHtml(d.employeeName)}</div>
  </div>`;
}

export function buildMeterDoc(d) {
  return `<div class="doc">
    <div class="doc-header">
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2>استبدال عداد كهربائي</h2>
      <div class="org-en">Meter Replacement Report</div>
    </div>
    <table>
      <tr><th>Shift / النوبة</th><th>Meter Type / نوع العداد</th><th>Date / التاريخ</th></tr>
      <tr><td class="val">${escapeHtml(d.shift)}</td><td class="val">${escapeHtml(d.meterType)}</td><td class="val">${fmtDate(d.reportDate)}</td></tr>
    </table>
    <table>
      <tr><th>Contact No. / رقم الهاتف</th><th colspan="2">Complainant Name / أسم المبلغ</th></tr>
      <tr><td class="val">${escapeHtml(d.contactNo)}</td><td class="val" colspan="2">${escapeHtml(d.complainantName)}</td></tr>
    </table>
    <table class="blk-blue">
      ${row3({ l: 'Latest Meter Reading', v: d.latestReading }, { l: 'Meter No.', v: d.meterNo }, { l: 'Meter Size', v: d.meterSize })}
    </table>
    <table class="blk-yellow">
      ${row3({ l: 'Street / الشارع', v: d.street }, { l: 'Block / القطعة', v: d.block }, { l: 'Area / المنطقة', v: d.area })}
      ${row3({ l: 'PACI / الرقم الآلي', v: d.paci }, { l: 'Building / القسيمة', v: d.building }, { l: 'House / المنزل', v: d.house })}
    </table>
    <table class="blk-yellow"><tr><th>Avenue / الجادة</th></tr><tr><td class="val">${escapeHtml(d.avenue)}</td></tr></table>
    <table class="blk-pink">
      <tr><th>Technician Name / أسم الفني الكاشف</th><th>Contact No. / رقم الهاتف</th></tr>
      <tr><td class="val">${escapeHtml(d.techName)}</td><td class="val">${escapeHtml(d.techPhone)}</td></tr>
    </table>
    <div class="box-label">الإجراء / Procedure (Action taken)</div>
    <div class="box">${escapeHtml(d.procedure)}</div>
    <div class="doc-footer">التقرير أُعد بواسطة: ${escapeHtml(d.preparedBy)}</div>
  </div>`;
}

export function buildDailyDoc(d) {
  let grand = 0;
  const cells = DAILY_METRICS.map((m) => {
    const v = d.metrics[m.key] || 0;
    grand += v;
    return `<td>${v}</td>`;
  }).join('');
  const headerCells = DAILY_METRICS.map((m) => `<th>${m.label}</th>`).join('');

  return `<div class="doc" style="width:1000px;">
    <div class="doc-header">
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2>الأعطال اليومية على شبكتي (الضغط المتوسط والمنخفض) بمراقبة محافظة الفروانية</h2>
      <div class="org-en">التاريخ: ${fmtDate(d.reportDate)} — الفترة: ${escapeHtml(d.periodLabel)}</div>
    </div>
    <table class="daily-table">
      <tr><th class="period-col">الفترة</th>${headerCells}</tr>
      <tr><td class="period-col">${escapeHtml(d.periodLabel)}</td>${cells}</tr>
    </table>
    <div class="grand-total">إجمالي الفترة: ${grand}</div>
    <div class="box-label">ملاحظات</div>
    <div class="box">${escapeHtml(d.notes)}</div>
    <div class="doc-footer">التقرير أُعد بواسطة: ${escapeHtml(d.preparedBy)}</div>
  </div>`;
}

export function buildMergedDailyDoc(reportsData) {
  const sorted = [...reportsData].sort((a, b) => {
    if (a.reportDate !== b.reportDate) return a.reportDate.localeCompare(b.reportDate);
    return (PERIOD_ORDER[a.periodKey] ?? 9) - (PERIOD_ORDER[b.periodKey] ?? 9);
  });
  const totals = {};
  DAILY_METRICS.forEach((m) => (totals[m.key] = 0));
  let grand = 0;
  const rows = sorted
    .map((r) => {
      const cells = DAILY_METRICS.map((m) => {
        const v = r.metrics[m.key] || 0;
        totals[m.key] += v;
        grand += v;
        return `<td>${v}</td>`;
      }).join('');
      return `<tr><td class="period-col">${fmtDate(r.reportDate)} — ${escapeHtml(r.periodLabel)}</td>${cells}</tr>`;
    })
    .join('');
  const totalCells = DAILY_METRICS.map((m) => `<th>${totals[m.key]}</th>`).join('');
  const headerCells = DAILY_METRICS.map((m) => `<th>${m.label}</th>`).join('');
  const dates = [...new Set(sorted.map((r) => r.reportDate))].sort();
  const rangeLabel = dates.length <= 1 ? fmtDate(dates[0]) : `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}`;

  return `<div class="doc" style="width:1000px;">
    <div class="doc-header">
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2>الأعطال اليومية على شبكتي (الضغط المتوسط والمنخفض) بمراقبة محافظة الفروانية</h2>
      <div class="org-en">تقرير مدمج — الفترة: ${rangeLabel}</div>
    </div>
    <table class="daily-table">
      <tr><th class="period-col">التاريخ — الفترة</th>${headerCells}</tr>
      ${rows}
      <tr class="total-row"><th class="period-col">الإجمالي</th>${totalCells}</tr>
    </table>
    <div class="grand-total">الإجمالي الكلي: ${grand}</div>
  </div>`;
}

export { fmtDate, escapeHtml };
