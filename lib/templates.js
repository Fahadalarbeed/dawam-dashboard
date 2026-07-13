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
  .doc{background:#fff;color:#111;font-family:'Cairo',sans-serif;padding:36px 44px;width:960px;}
  .doc .doc-header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:14px;position:relative;}
  .doc .doc-header .logo{position:absolute;top:0;left:0;height:50px;}
  .doc .doc-header .org{font-size:16px;color:#444;}
  .doc .doc-header .org-en{font-size:14px;color:#666;}
  .doc .doc-header h2{font-size:29px;margin:14px 0 0;}
  .doc .doc-footer{margin-top:18px;padding-top:10px;border-top:1px solid #999;font-size:13px;color:#333;text-align:left;font-weight:600;}
  .doc table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .doc td, .doc th{border:1px solid #333;padding:18px 22px;font-size:19px;vertical-align:top;}
  .doc th{background:#DCE8D0;font-weight:700;text-align:center;width:33%;}
  .doc td.val{font-family:'IBM Plex Mono',monospace;font-size:24px;min-height:26px;text-align:center;vertical-align:middle;}
  .doc .blk-blue th{background:#D6E4F0;}
  .doc .blk-orange th{background:#FBE0C4;}
  .doc .blk-yellow th{background:#FBF0D9;}
  .doc .blk-pink th{background:#F7DADD;}
  .doc .box-label{font-weight:700;font-size:21px;margin:14px 0 6px;}
  .doc .box{border:1px solid #333;min-height:130px;padding:18px 20px;font-size:19px;white-space:pre-wrap;}
  .doc .daily-table th, .doc .daily-table td{padding:5px 3px;font-size:9px;text-align:center;width:auto;}
  .doc .daily-table th.period-col, .doc .daily-table td.period-col{width:16%;text-align:right;font-size:9.5px;}
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
      <tr><th>أسم الموظف</th><th>التاريخ / Date</th><th>الساعة / Time</th></tr>
      <tr><td class="val">${escapeHtml(d.employeeName)}</td><td class="val">${fmtDate(d.reportDate)}</td><td class="val">${escapeHtml(d.time)}</td></tr>
      <tr><th>النوبة / Shift</th><th colspan="2">الرقم الآلي / PACI</th></tr>
      <tr><td class="val">${escapeHtml(d.shift)}</td><td class="val" colspan="2">${escapeHtml(d.paci)}</td></tr>
    </table>
    <table class="blk-blue">
      ${row3({ l: 'Area / المنطقة', v: d.area }, { l: 'Block / القطعة', v: d.block }, { l: 'Street / شارع', v: d.street })}
      ${row3({ l: 'Ln / جادة', v: d.avenue }, { l: 'House / منزل', v: d.house }, { l: 'Building / قسيمة', v: d.building })}
    </table>
    <table class="blk-orange">
      ${row3({ l: 'Unit No.', v: d.unitNo }, { l: 'المحول / Trans. No.', v: d.transNo }, { l: 'المحطة / S/S or UDS', v: d.station })}
    </table>
    <table class="blk-pink">
      ${row3({ l: 'Techn. Name / أسم الفني', v: d.technicianName }, { l: 'Compl. Tel. / رقم الهاتف', v: d.complainantPhone }, { l: 'اسم المبلغ / The Complainant', v: d.complainantName })}
    </table>
    <div class="box-label">نوع العطل / Fault Type</div>
    <div class="box">${escapeHtml(d.faultType)}</div>
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
      ${row3({ l: 'اسم المبلغ / Complainant Name', v: d.complainantName }, { l: 'رقم الهاتف / Phone', v: d.contactNo }, { l: 'الرقم الآلي / PACI', v: d.paci })}
    </table>
    <table class="blk-orange">
      ${row3({ l: 'حجم العداد / Meter Size', v: d.meterSize }, { l: 'رقم العداد / Meter No.', v: d.meterNo }, { l: 'القراءة / Latest Reading', v: d.latestReading })}
    </table>
    <table class="blk-blue">
      ${row3({ l: 'المنطقة / Area', v: d.area }, { l: 'القطعة / Block', v: d.block }, { l: 'الشارع / Street', v: d.street })}
      ${row3({ l: 'رقم المنزل / House No.', v: d.house }, { l: 'الجادة / Avenue', v: d.avenue }, { l: 'القسيمة / Building', v: d.building })}
    </table>
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
  const cells = DAILY_METRICS.map((m) => {
    const v = d.metrics[m.key] || 0;
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
