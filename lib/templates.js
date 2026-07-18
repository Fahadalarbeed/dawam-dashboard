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

// shared CSS injected into every generated document
export const DOC_STYLES = `
  *{box-sizing:border-box;}
  body{margin:0;background:#fff;}
  .doc{background:#fff;color:#111;font-family:'Cairo',sans-serif;font-weight:700;padding:34px 48px;width:1300px;}
  .doc .doc-header{text-align:center;border-bottom:2px solid #333;padding:10px 0 24px;margin-bottom:24px;position:relative;min-height:125px;}
  .doc .doc-header .logo{position:absolute;top:0;right:0;height:95px;}
  .doc .doc-header .logo-left{position:absolute;top:0;left:0;height:95px;}
  .doc .doc-header .org{font-size:24px;color:#444;}
  .doc .doc-header .org-en{font-size:20px;color:#666;}
  .doc .doc-header h2{font-size:40px;margin:16px 0 0;}
  .doc .doc-footer{margin-top:18px;padding-top:12px;border-top:1px solid #999;font-size:25px;color:#333;text-align:left;font-weight:600;}
  .doc table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .doc td, .doc th{border:1px solid #333;padding:24px 26px;font-size:30px;vertical-align:top;}
  .doc th{background:#DCE8D0;font-weight:700;text-align:center;width:33%;}
  .doc td.val{font-family:'IBM Plex Mono',monospace;font-size:34px;min-height:26px;text-align:center;vertical-align:middle;}
  .doc .blk-blue th{background:#D6E4F0;}
  .doc .blk-orange th{background:#FBE0C4;}
  .doc .blk-yellow th{background:#FBF0D9;}
  .doc .blk-pink th{background:#F7DADD;}
  .doc .box-label{font-weight:700;font-size:30px;margin:16px 0 8px;}
  .doc .box{border:1px solid #333;min-height:175px;padding:22px 26px;font-size:45px;white-space:pre-wrap;}
  .doc .daily-table th, .doc .daily-table td{padding:14px 8px;font-size:18px;text-align:center;width:auto;}
  .doc .daily-table.summary-faults th{background:#D6E4F0;}
  .doc .daily-table.summary-meters th{background:#FBE0C4;}
  .doc .daily-table.summary-complaints th{background:#FBF0D9;}
  .doc .daily-table th.period-col, .doc .daily-table td.period-col{width:16%;text-align:right;font-size:19px;}
  .doc .daily-table th.num-col, .doc .daily-table td.num-col{width:3%;font-weight:800;}
  .doc .daily-table tr.total-row th, .doc .daily-table tr.total-row td{background:#EFEFEF;font-weight:700;}
  .doc .grand-total{text-align:left;font-size:12px;font-weight:700;margin:6px 0 14px;}
`;

function row3(a, b, c) {
  return `<tr><th>${a.l}</th><th>${b.l}</th><th>${c.l}</th></tr><tr><td class="val">${escapeHtml(a.v)}</td><td class="val">${escapeHtml(b.v)}</td><td class="val">${escapeHtml(c.v)}</td></tr>`;
}

export function buildFaultDoc(d) {
  return `<div class="doc">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
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
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
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
    return `<td>${v || ''}</td>`;
  }).join('');
  const headerCells = DAILY_METRICS.map((m) => `<th>${m.label}</th>`).join('');

  return `<div class="doc" style="width:1300px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:24px;">الأعطال اليومية على شبكتي (الضغط المتوسط والمنخفض) بمراقبة محافظة الفروانية</h2>
      <div class="org-en">التاريخ: ${fmtDate(d.reportDate)} — الفترة: ${escapeHtml(d.periodLabel)}</div>
    </div>
    <table class="daily-table">
      <tr><th class="period-col">الفترة</th>${headerCells}</tr>
      <tr><td class="period-col">${escapeHtml(d.periodLabel)}</td>${cells}</tr>
    </table>
    <div class="box-label">ملاحظات</div>
    <div class="box" style="font-size:18px;min-height:80px;">${escapeHtml(d.notes)}</div>
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
        return `<td>${v || ''}</td>`;
      }).join('');
      return `<tr><td class="period-col">${fmtDate(r.reportDate)} — ${escapeHtml(r.periodLabel)}</td>${cells}</tr>`;
    })
    .join('');
  const totalCells = DAILY_METRICS.map((m) => `<th>${totals[m.key] || ''}</th>`).join('');
  const headerCells = DAILY_METRICS.map((m) => `<th>${m.label}</th>`).join('');
  const dates = [...new Set(sorted.map((r) => r.reportDate))].sort();
  const rangeLabel = dates.length <= 1 ? fmtDate(dates[0]) : `${fmtDate(dates[0])} — ${fmtDate(dates[dates.length - 1])}`;

  return `<div class="doc" style="width:1300px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:24px;">الأعطال اليومية على شبكتي (الضغط المتوسط والمنخفض) بمراقبة محافظة الفروانية</h2>
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

function toArabicDigits(n) {
  const map = { '0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩' };
  return String(n).replace(/[0-9]/g, (d) => map[d]);
}

export function buildMergedMetersDoc(reportsData, fromDate, toDate) {
  const sorted = [...reportsData].sort((a, b) => (a.reportDate || '').localeCompare(b.reportDate || ''));
  const rows = sorted.map((r, i) => `<tr>
      <td class="num-col">${toArabicDigits(i + 1)}</td>
      <td class="period-col">${fmtDate(r.reportDate)}</td>
      <td>${escapeHtml(r.area)}</td>
      <td>${escapeHtml(r.block)}</td>
      <td>${escapeHtml(r.street)}</td>
      <td>${escapeHtml(r.avenue)}</td>
      <td>${escapeHtml(r.house)}</td>
      <td>${escapeHtml(r.paci)}</td>
      <td>${escapeHtml(r.meterType)}</td>
      <td>${escapeHtml(r.meterSize)}</td>
      <td>${escapeHtml(r.meterNo)}</td>
      <td>${escapeHtml(r.latestReading)}</td>
    </tr>`).join('');

  return `<div class="doc" style="width:1900px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:24px;">إحصائية العدادات المحروقة</h2>
      <div class="org-en">الفترة من ${fmtDate(fromDate)} إلى ${fmtDate(toDate)}</div>
    </div>
    <table class="daily-table summary-meters">
      <tr>
        <th class="num-col">#</th>
        <th class="period-col">التاريخ</th>
        <th>المنطقة</th><th>القطعة</th><th>الشارع</th><th>الجادة</th><th>المنزل</th>
        <th>الرقم الآلي</th><th>نوع العداد</th><th>حجمه</th><th>رقمه</th><th>آخر قراءة</th>
      </tr>
      ${rows}
    </table>
    <div class="grand-total">إجمالي التقارير: ${toArabicDigits(sorted.length)}</div>
  </div>`;
}

export { fmtDate, escapeHtml };

export function buildMergedFaultsDoc(reportsData, fromDate, toDate) {
  const sorted = [...reportsData].sort((a, b) => (a.reportDate || '').localeCompare(b.reportDate || ''));

  const columnDefs = [
    { key: 'reportDate', label: 'التاريخ', periodCol: true, format: (v) => fmtDate(v) },
    { key: 'area', label: 'المنطقة' },
    { key: 'block', label: 'القطعة' },
    { key: 'street', label: 'الشارع' },
    { key: 'avenue', label: 'الجادة' },
    { key: 'house', label: 'المنزل' },
    { key: 'faultType', label: 'نوع العطل' },
    { key: 'station', label: 'المحول / UDS' },
    { key: 'transNo', label: 'رقم المحول' },
    { key: 'unitNo', label: 'اليونيت' },
  ];

  // a column only appears if at least one report in the set has a non-empty value for it
  const activeColumns = columnDefs.filter((col) =>
    sorted.some((r) => {
      const v = r[col.key];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
  );

  const headerCells = activeColumns
    .map((col) => `<th${col.periodCol ? ' class="period-col"' : ''}>${col.label}</th>`)
    .join('');

  const rows = sorted
    .map((r, i) => {
      const cells = activeColumns
        .map((col) => {
          const raw = r[col.key];
          const val = col.format ? col.format(raw) : raw;
          return `<td${col.periodCol ? ' class="period-col"' : ''}>${escapeHtml(val)}</td>`;
        })
        .join('');
      return `<tr><td class="num-col">${toArabicDigits(i + 1)}</td>${cells}</tr>`;
    })
    .join('');

  return `<div class="doc" style="width:1900px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:24px;">إحصائية تقارير الأعطال</h2>
      <div class="org-en">الفترة من ${fmtDate(fromDate)} إلى ${fmtDate(toDate)}</div>
    </div>
    <table class="daily-table summary-faults">
      <tr><th class="num-col">#</th>${headerCells}</tr>
      ${rows}
    </table>
    <div class="grand-total">إجمالي التقارير: ${toArabicDigits(sorted.length)}</div>
  </div>`;
}

export function buildComplaintDoc(d) {
  const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
  return `<div class="doc">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2>بلاغ جديد</h2>
    </div>
    <table>
      <tr><th>التاريخ</th><th>المنطقة</th><th>القطعة</th></tr>
      <tr><td class="val">${fmtDate(d.reportDate)}</td><td class="val">${escapeHtml(d.area)}</td><td class="val">${escapeHtml(d.block)}</td></tr>
      <tr><th>الشارع</th><th>القسيمة</th><th>المنزل</th></tr>
      <tr><td class="val">${escapeHtml(d.street)}</td><td class="val">${escapeHtml(d.building)}</td><td class="val">${escapeHtml(d.house)}</td></tr>
      <tr><th>الرقم الآلي</th><th>المحطة / UDS</th><th>اليونت</th></tr>
      <tr><td class="val">${escapeHtml(d.paci)}</td><td class="val">${escapeHtml(d.station)}</td><td class="val">${escapeHtml(d.unitNo)}</td></tr>
      <tr><th colspan="3">رقم الهاتف</th></tr>
      <tr><td class="val" colspan="3">${escapeHtml(d.phone)}</td></tr>
    </table>
    <div class="box-label">الإجراء</div>
    <div class="box" style="font-size:32px;min-height:100px;">${escapeHtml(actionText)}</div>
    <div class="doc-footer">التقرير أُعد بواسطة: ${escapeHtml(d.preparedBy || '')}</div>
  </div>`;
}

export function buildMergedComplaintsDoc(reportsData, fromDate, toDate) {
  const sorted = [...reportsData].sort((a, b) => (a.reportDate || '').localeCompare(b.reportDate || ''));

  const columnDefs = [
    { key: 'reportDate', label: 'التاريخ', periodCol: true, format: (v) => fmtDate(v) },
    { key: 'area', label: 'المنطقة' },
    { key: 'block', label: 'القطعة' },
    { key: 'street', label: 'الشارع' },
    { key: 'building', label: 'القسيمة' },
    { key: 'house', label: 'المنزل' },
    { key: 'paci', label: 'الرقم الآلي' },
    { key: 'station', label: 'المحطة / UDS' },
    { key: 'unitNo', label: 'اليونت' },
    { key: 'phone', label: 'رقم الهاتف' },
    { key: 'action', label: 'الإجراء', format: (v, r) => (v === 'أخرى' ? (r.otherAction || 'أخرى') : v) },
  ];

  const activeColumns = columnDefs.filter((col) =>
    sorted.some((r) => {
      const v = r[col.key];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
  );

  const headerCells = activeColumns
    .map((col) => `<th${col.periodCol ? ' class="period-col"' : ''}>${col.label}</th>`)
    .join('');

  const rows = sorted
    .map((r, i) => {
      const cells = activeColumns
        .map((col) => {
          const raw = r[col.key];
          const val = col.format ? col.format(raw, r) : raw;
          return `<td${col.periodCol ? ' class="period-col"' : ''}>${escapeHtml(val)}</td>`;
        })
        .join('');
      return `<tr><td class="num-col">${toArabicDigits(i + 1)}</td>${cells}</tr>`;
    })
    .join('');

  return `<div class="doc" style="width:1900px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:24px;">إحصائية البلاغات</h2>
      <div class="org-en">الفترة من ${fmtDate(fromDate)} إلى ${fmtDate(toDate)}</div>
    </div>
    <table class="daily-table summary-complaints">
      <tr><th class="num-col">#</th>${headerCells}</tr>
      ${rows}
    </table>
    <div class="grand-total">إجمالي البلاغات: ${toArabicDigits(sorted.length)}</div>
  </div>`;
}

export function buildRepeatedComplaintsDoc(entries) {
  const sections = entries.map((entry, i) => {
    const rows = entry.items
      .map((d, j) => {
        const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
        return `<tr>
          <td class="num-col">${toArabicDigits(j + 1)}</td>
          <td class="period-col">${fmtDate(d.reportDate)}</td>
          <td>${escapeHtml(d.paci || '')}</td>
          <td>${escapeHtml(d.phone || '')}</td>
          <td>${escapeHtml(actionText || '')}</td>
        </tr>`;
      })
      .join('');
    return `<div class="box-label" style="font-size:22px;margin-top:${i === 0 ? '0' : '20px'};">${i + 1}. ${escapeHtml(entry.address)} — (${entry.count} بلاغ)</div>
      <table class="daily-table summary-complaints" style="margin-bottom:0;">
        <tr><th class="num-col">#</th><th class="period-col">التاريخ</th><th>الرقم الآلي</th><th>الهاتف</th><th>الإجراء</th></tr>
        ${rows}
      </table>`;
  }).join('');

  return `<div class="doc" style="width:1300px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:26px;">تفاصيل البلاغات المتكررة</h2>
      <div class="org-en">إجمالي العناوين المتكررة: ${toArabicDigits(entries.length)}</div>
    </div>
    ${sections || '<div style="text-align:center;padding:30px;color:#666;">لا توجد عناوين متكررة</div>'}
  </div>`;
}

export function buildRepeatedStationsDoc(entries) {
  const sections = entries.map((entry, i) => {
    const rows = entry.items
      .map((d, j) => {
        const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
        return `<tr>
          <td class="num-col">${toArabicDigits(j + 1)}</td>
          <td class="period-col">${fmtDate(d.reportDate)}</td>
          <td>${escapeHtml(d.area || '')}</td>
          <td>${escapeHtml(d.paci || '')}</td>
          <td>${escapeHtml(d.phone || '')}</td>
          <td>${escapeHtml(actionText || '')}</td>
        </tr>`;
      })
      .join('');
    const areasLabel = entry.area ? ` — ${entry.area}` : '';
    return `<div class="box-label" style="font-size:22px;margin-top:${i === 0 ? '0' : '20px'};">${i + 1}. محطة/UDS: ${escapeHtml(entry.station)}${areasLabel} — (${entry.count} بلاغ)</div>
      <table class="daily-table summary-meters" style="margin-bottom:0;">
        <tr><th class="num-col">#</th><th class="period-col">التاريخ</th><th>المنطقة</th><th>الرقم الآلي</th><th>الهاتف</th><th>الإجراء</th></tr>
        ${rows}
      </table>`;
  }).join('');

  return `<div class="doc" style="width:1300px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:26px;">تفاصيل بلاغات المحطات المتكررة</h2>
      <div class="org-en">إجمالي المحطات المتكررة: ${toArabicDigits(entries.length)}</div>
    </div>
    ${sections || '<div style="text-align:center;padding:30px;color:#666;">لا توجد محطات متكررة</div>'}
  </div>`;
}

export function buildMetricsFilterDoc(filteredByArea, totals, metricDefs, fromDate, toDate) {
  const headerCells = metricDefs.map((m) => `<th>${m.label}</th>`).join('');

  const perAreaSections = filteredByArea
    .map((r, i) => `
    <div class="box-label" style="font-size:22px;margin-top:${i === 0 ? '0' : '20px'};">${i + 1}. منطقة: ${escapeHtml(r.area)}</div>
    <table class="daily-table summary-complaints" style="margin-bottom:0;">
      <tr>${headerCells}</tr>
      <tr>${r.counts.map((c) => `<td>${c}</td>`).join('')}</tr>
    </table>`)
    .join('');

  const combinedBodyRows = filteredByArea
    .map((r) => `<tr><td class="period-col">${escapeHtml(r.area)}</td>${r.counts.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  const combinedTotalRow = `<tr class="total-row"><th class="period-col">الإجمالي</th>${totals.map((t) => `<th>${t}</th>`).join('')}</tr>`;

  return `<div class="doc" style="width:1500px;">
    <div class="doc-header"><img class="logo" src="/logo.png" /><img class="logo-left" src="/logo-left.png" />
      <div class="org">وزارة الكهرباء والماء والطاقة المتجددة — دولة الكويت</div>
      <div class="org-en">Ministry of Electricity &amp; Water &amp; Renewable Energy</div>
      <h2 style="font-size:26px;">تقرير البلاغات حسب المنطقة والفترة</h2>
      <div class="org-en">الفترة من ${fmtDate(fromDate)} إلى ${fmtDate(toDate)}</div>
    </div>
    ${perAreaSections}
    <div class="box-label" style="font-size:22px;margin-top:20px;">الجدول المجمّع (كل المناطق المختارة)</div>
    <table class="daily-table summary-complaints">
      <tr><th class="period-col">المنطقة</th>${headerCells}</tr>
      ${combinedBodyRows}
      ${combinedTotalRow}
    </table>
  </div>`;
}
