// Local assistant: understands Arabic questions about complaints/technicians and
// answers from data already in the browser. Nothing is sent to any external service.
import { AREA_LIST, DRIVERS_LIST, COMPLAINT_ACTIONS } from './constants';

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDuration(hours) {
  if (!isFinite(hours)) return '—';
  return hours < 1 ? `${Math.round(hours * 60)} دقيقة` : `${hours.toFixed(1)} ساعة`;
}
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// ---------- period detection ----------
function resolvePeriod(q) {
  const now = new Date();
  const end = todayStr(now);
  // "التقارير اليومية" is a report type, not a time filter — don't treat it as "today"
  const isDailyReportType = /التقارير\s*اليومي|تقارير\s*يومي|تقرير\s*يومي/.test(q);
  if (!isDailyReportType && /اليوم|النهارده|هاليوم/.test(q)) return { from: end, to: end, label: 'اليوم' };
  if (/امس|أمس|البارحة/.test(q)) {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: todayStr(y), to: todayStr(y), label: 'أمس' };
  }
  if (/اسبوع|أسبوع/.test(q)) {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { from: todayStr(s), to: end, label: 'آخر ٧ أيام' };
  }
  if (/شهر/.test(q)) {
    const s = new Date(now); s.setDate(s.getDate() - 29);
    return { from: todayStr(s), to: end, label: 'آخر ٣٠ يوم' };
  }
  return { from: '2000-01-01', to: end, label: 'كل الفترات' };
}

function inPeriod(d, p) {
  const key = d.reportDate || localDate(d.createdAt);
  return key >= p.from && key <= p.to;
}

// ---------- helpers over the complaint list ----------
function dataOf(r) { return r.data || r; }
const isClosed = (d) => d.status === 'closed';
const isActive = (d) => (d.status || 'active') !== 'closed';

function durationHours(d) {
  if (!d.createdAt || !d.closedAt) return null;
  return (new Date(d.closedAt) - new Date(d.createdAt)) / 3600000;
}

function topEntries(map, n = 5) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function findMentioned(q, list) {
  return list.filter((x) => q.includes(x));
}

// ---------- answer builders ----------
function answerCounts(rows, p) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p));
  const active = all.filter(isActive).length;
  const closed = all.filter(isClosed).length;
  const durs = all.map(durationHours).filter((x) => x !== null);
  const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : NaN;
  return {
    text: `📊 ${p.label}:\n• إجمالي البلاغات: ${all.length}\n• نشطة: ${active}\n• مغلقة: ${closed}` +
          (durs.length ? `\n• متوسط زمن الإصلاح: ${fmtDuration(avg)}` : ''),
  };
}

function answerByArea(rows, p, askedAreas) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p));
  const scope = askedAreas.length ? all.filter((d) => askedAreas.includes(d.area)) : all;
  if (!scope.length) return { text: `ما فيه بلاغات ${p.label}${askedAreas.length ? ' بهذي المنطقة' : ''}.` };

  if (askedAreas.length) {
    const durs = scope.map(durationHours).filter((x) => x !== null);
    const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : NaN;
    const actions = {};
    scope.forEach((d) => { if (d.action) actions[d.action] = (actions[d.action] || 0) + 1; });
    const top = topEntries(actions, 3).map(([a, c]) => `   – ${a}: ${c}`).join('\n');
    return {
      text: `📍 ${askedAreas.join('، ')} — ${p.label}:\n• البلاغات: ${scope.length}\n` +
            `• نشطة: ${scope.filter(isActive).length} | مغلقة: ${scope.filter(isClosed).length}` +
            (durs.length ? `\n• متوسط الإصلاح: ${fmtDuration(avg)}` : '') +
            (top ? `\n• أكثر الأعطال:\n${top}` : ''),
    };
  }

  const byArea = {};
  scope.forEach((d) => { const a = d.area || 'بدون منطقة'; byArea[a] = (byArea[a] || 0) + 1; });
  const lines = topEntries(byArea, 5)
    .map(([a, c], i) => `${i + 1}. ${a}: ${c} بلاغ (${((c / scope.length) * 100).toFixed(0)}٪)`)
    .join('\n');
  return { text: `📍 أكثر المناطق انقطاعًا — ${p.label}:\n${lines}` };
}

function answerTechnicians(rows, p, askedTechs) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p) && d.driver);
  if (!all.length) return { text: `ما فيه بيانات فنيين ${p.label}.` };

  const stats = {};
  all.forEach((d) => {
    const t = d.driver;
    if (!stats[t]) stats[t] = { total: 0, closed: 0, active: 0, durs: [] };
    stats[t].total++;
    if (isClosed(d)) stats[t].closed++; else stats[t].active++;
    const h = durationHours(d);
    if (h !== null) stats[t].durs.push(h);
  });

  const rank = Object.entries(stats).map(([t, s]) => {
    const avg = s.durs.length ? s.durs.reduce((a, b) => a + b, 0) / s.durs.length : Infinity;
    return { t, ...s, avg };
  }).sort((a, b) => a.avg - b.avg);

  if (askedTechs.length) {
    const lines = rank.filter((r) => askedTechs.includes(r.t)).map((r) =>
      `🔧 ${r.t}:\n• البلاغات: ${r.total} (مغلقة ${r.closed} | نشطة ${r.active})\n• متوسط الإصلاح: ${fmtDuration(r.avg)}`
    ).join('\n\n');
    return { text: lines || 'ما لقيت بيانات لهذا الفني بهذي الفترة.' };
  }

  const lines = rank.map((r, i) =>
    `${i + 1}. ${r.t} — ${r.closed} مغلق، متوسط ${fmtDuration(r.avg)}`
  ).join('\n');
  return { text: `🔧 ترتيب الفنيين (الأسرع أولًا) — ${p.label}:\n${lines}` };
}

function answerActions(rows, p) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p) && d.action);
  if (!all.length) return { text: `ما فيه أعطال مسجّلة ${p.label}.` };
  const byAction = {};
  all.forEach((d) => { byAction[d.action] = (byAction[d.action] || 0) + 1; });
  const lines = topEntries(byAction, 6)
    .map(([a, c], i) => `${i + 1}. ${a}: ${c} (${((c / all.length) * 100).toFixed(0)}٪)`)
    .join('\n');
  return { text: `⚡ أكثر الأعطال تكرارًا — ${p.label}:\n${lines}` };
}

// Which station+unit burns out most often — optionally filtered to one fault
// type and/or one area. Grouped by station AND unit, since a station can have
// several units and only one of them may be the real problem.
function answerStationHotspots(rows, p, askedAreas, faultFilter) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p));

  let scope = all.filter((d) => (d.station || '').trim() && (d.unitNo || '').trim());
  if (askedAreas.length) scope = scope.filter((d) => askedAreas.includes(d.area));
  if (faultFilter) scope = scope.filter((d) => (d.action || '').startsWith(faultFilter));

  const where = [
    faultFilter ? `«${faultFilter}»` : 'أعطال المحطات',
    askedAreas.length ? `— ${askedAreas.join('، ')}` : '',
    `— ${p.label}`,
  ].filter(Boolean).join(' ');

  if (!scope.length) {
    return { text: `ما فيه بلاغات مسجّلة بمحطة ويونت (${where}).\n\n💡 لاحظ: المحطة واليونت يُسجّلان وقت إغلاق البلاغ، فالبلاغات النشطة ما تُحتسب.` };
  }

  const counts = {};
  const meta = {};
  scope.forEach((d) => {
    const k = `${d.area || 'بدون منطقة'} — محطة ${String(d.station).trim()} — يونت ${String(d.unitNo).trim()}`;
    counts[k] = (counts[k] || 0) + 1;
    if (!meta[k]) meta[k] = {};
    if (d.action) meta[k][d.action] = (meta[k][d.action] || 0) + 1;
  });

  const ranked = topEntries(counts, 6);
  const lines = ranked.map(([k, n], i) => {
    const kinds = topEntries(meta[k] || {}, 2).map(([a, x]) => `${a} ×${x}`).join('، ');
    return `${i + 1}. ${k} — ${n} مرة${kinds ? `\n     (${kinds})` : ''}`;
  }).join('\n');

  const worst = ranked[0];
  const tip = worst && worst[1] > 1
    ? `\n\n💡 الأعلى: ${worst[0]} بـ ${worst[1]} تكرار — يفضّل فحص السبب الجذري.`
    : '';

  return { text: `🏭 أكثر المحطات احتراقًا (${where}):\n${lines}${tip}` };
}

function answerRepeated(rows, p) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p));
  const key = (d) => (d.area && d.block && d.street && (d.house || d.building))
    ? `${d.area} — قطعة ${d.block} — شارع ${d.street} — ${d.house ? 'منزل ' + d.house : 'قسيمة ' + d.building}`
    : null;
  const counts = {};
  all.forEach((d) => { const k = key(d); if (k) counts[k] = (counts[k] || 0) + 1; });
  const rep = topEntries(counts, 5).filter(([, c]) => c > 1);
  if (!rep.length) return { text: `ما فيه عناوين متكررة ${p.label}.` };
  const lines = rep.map(([a, c], i) => `${i + 1}. ${a} — ${c} مرات`).join('\n');
  return { text: `🔁 أكثر العناوين تكرارًا — ${p.label}:\n${lines}\n\n💡 هذي مشاكل مزمنة — يفضّل فحص السبب الجذري.` };
}

function answerOverdue(rows) {
  const all = rows.map(dataOf).filter(isActive);
  const late = all.filter((d) => d.createdAt && (Date.now() - new Date(d.createdAt)) / 60000 > 75);
  if (!late.length) return { text: '✅ ما فيه بلاغات متأخرة — كل النشطة ضمن الوقت المستهدف.' };
  const lines = late.slice(0, 8).map((d) => {
    const mins = Math.round((Date.now() - new Date(d.createdAt)) / 60000);
    return `• ${d.area || '—'} ${d.block ? 'ق' + d.block : ''} — ${d.driver || 'غير معيّن'} — ${mins} دقيقة`;
  }).join('\n');
  return { text: `⏰ بلاغات تجاوزت ٧٥ دقيقة (${late.length}):\n${lines}` };
}

function answerBusiest(rows) {
  const all = rows.map(dataOf).filter((d) => d.closedAt);
  if (!all.length) return { text: 'ما فيه بلاغات مغلقة بعد.' };
  const byMonth = {};
  all.forEach((d) => { const m = (d.closedAt || '').slice(0, 7); if (m) byMonth[m] = (byMonth[m] || 0) + 1; });
  const top = topEntries(byMonth, 3);
  const lines = top.map(([m, c], i) => {
    const [y, mo] = m.split('-');
    return `${i + 1}. ${AR_MONTHS[parseInt(mo, 10) - 1]} ${y}: ${c} بلاغ`;
  }).join('\n');
  return { text: `📅 أكثر الشهور انقطاعًا:\n${lines}` };
}

// Breakdown for one specific fault type, e.g. "تقرير عداد محروق"
function answerSpecificAction(rows, p, action) {
  const all = rows.map(dataOf).filter((d) => inPeriod(d, p));
  const scope = all.filter((d) => (d.action || '').startsWith(action));
  if (!scope.length) return { text: `ما فيه بلاغات «${action}» ${p.label}.` };

  const durs = scope.map(durationHours).filter((x) => x !== null);
  const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : NaN;
  const byArea = {};
  scope.forEach((d) => { const a = d.area || 'بدون منطقة'; byArea[a] = (byArea[a] || 0) + 1; });
  const areaLines = topEntries(byArea, 4).map(([a, n]) => `   – ${a}: ${n}`).join('\n');
  const share = all.length ? ((scope.length / all.length) * 100).toFixed(0) : 0;

  return {
    text: `📄 تقرير «${action}» — ${p.label}:\n` +
      `• العدد: ${scope.length} (${share}٪ من كل البلاغات)\n` +
      `• نشطة: ${scope.filter(isActive).length} | مغلقة: ${scope.filter(isClosed).length}` +
      (durs.length ? `\n• متوسط الإصلاح: ${fmtDuration(avg)}` : '') +
      (areaLines ? `\n• حسب المنطقة:\n${areaLines}` : ''),
  };
}

// Finds actual report documents (fault/meter/daily) matching whatever the user typed.
// Returns `reports` so the UI can render open/share buttons.
export function findReports(question, allReports) {
  const q = (question || '').trim();
  const p = resolvePeriod(q);
  const areas = findMentioned(q, AREA_LIST);

  let type = null;
  if (/عداد|عدادات/.test(q)) type = 'meters';
  else if (/عطل|اعطال|أعطال|كيبل|فيوز|قاعدة/.test(q)) type = 'faults';
  else if (/يومي|يوميه|يومية/.test(q)) type = 'daily';

  // free numbers in the question can be a meter no, block, or house no
  const nums = (q.match(/\d+/g) || []);

  const scope = (allReports || []).filter((r) => {
    const d = r.data || {};
    if (type && r.type !== type) return false;

    const day = r.report_date || localDate(r.created_at);
    if (!(day >= p.from && day <= p.to)) return false;

    if (areas.length && !areas.includes(d.area)) return false;

    if (nums.length) {
      const hay = [d.meterNo, d.block, d.house, d.building, d.street, d.paci]
        .filter(Boolean).map(String);
      const anyNum = nums.some((n) => hay.includes(n));
      // only enforce when the question looks like it targets a specific record
      if (/رقم|عداد|قطعة|منزل|قسيمة|شارع/.test(q) && !anyNum) return false;
    }
    return true;
  });

  const sorted = scope.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const label = [
    type === 'meters' ? 'تقارير العدادات' : type === 'faults' ? 'تقارير الأعطال' : type === 'daily' ? 'التقارير اليومية' : 'كل التقارير',
    areas.length ? `— ${areas.join('، ')}` : '',
    `— ${p.label}`,
  ].filter(Boolean).join(' ');

  return {
    reports: sorted.slice(0, 20),
    total: sorted.length,
    text: sorted.length
      ? `📁 لقيت ${sorted.length} تقرير (${label}).` + (sorted.length > 20 ? '\nأعرض أول ٢٠ — ضيّق البحث لنتائج أدق.' : '')
      : `ما لقيت تقارير مطابقة (${label}).\nجرّب توسّع الفترة أو تغيّر المنطقة.`,
  };
}

function answerGreeting() {
  return {
    text: 'وعليكم السلام 👋 تفضل، اسألني عن البلاغات أو الفنيين أو الإحصائيات.\n' +
      'مثلاً: «كم بلاغ اليوم؟» أو «مين أسرع فني؟» — أو اكتب «مساعدة» تشوف كل الأمثلة.',
  };
}

function answerHelp() {
  return {
    text: 'أقدر أجاوبك عن بيانات النظام. جرّب تسألني:\n\n' +
      '• كم بلاغ اليوم؟\n' +
      '• أي منطقة أكثر انقطاع هالشهر؟\n' +
      '• مين أسرع فني؟\n' +
      '• وش أكثر عطل متكرر؟\n' +
      '• فيه بلاغات متأخرة؟\n' +
      '• العناوين المتكررة\n' +
      '• أكثر شهر انقطاع\n' +
      '• بلاغات جليب الشيوخ',
  };
}

// ---------- router ----------
export function askAssistant(question, complaints) {
  const q = (question || '').trim();
  if (!q) return answerHelp();
  if (!complaints || !complaints.length) return { text: 'ما فيه بيانات محمّلة بعد — جرّب بعد ما تفتح صفحة البلاغات.' };

  const p = resolvePeriod(q);
  const areas = findMentioned(q, AREA_LIST);
  const techs = findMentioned(q, DRIVERS_LIST);

  // longest match first, so "فيوز محطة / UDS" wins over "فيوز"
  const mentionedAction = [...COMPLAINT_ACTIONS]
    .sort((a, b) => b.length - a.length)
    .find((a) => q.includes(a));

  if (/^\s*(السلام|سلام|هلا|هلو|مرحبا|مرحبًا|صباح|مساء|اهلا|أهلا|هاي)/.test(q)) return answerGreeting();
  if (/شكرا|شكرًا|مشكور|يعطيك العافية/.test(q))                      return { text: 'العفو 🙏 أي وقت تحتاج شي أنا موجود.' };
  if (/مساعدة|ساعدني|وش تقدر|شنو تسوي|كيف استخدم/.test(q))           return answerHelp();
  if (/متاخر|متأخر|تجاوز|تأخير/.test(q))                            return answerOverdue(complaints);
  if (/متكرر|تكرار|مزمن/.test(q))                                    return answerRepeated(complaints, p);
  if (/اسرع|أسرع|افضل فني|أفضل فني|ترتيب الفنيين|اداء|أداء/.test(q)) return answerTechnicians(complaints, p, techs);
  if (techs.length)                                                  return answerTechnicians(complaints, p, techs);
  if (/شهر.*(اكثر|أكثر)|(اكثر|أكثر).*شهر/.test(q))                   return answerBusiest(complaints);
  // "أكثر فيوز محطة احتراق في خيطان" → station/unit hotspots
  if (/محطة|محطه|محطات|يونت|قاطع/.test(q)
      && /اكثر|أكثر|احتراق|احتراقا|تكرار|متكرر|اعلى|أعلى/.test(q)) {
    const fault = /قاطع/.test(q) ? 'قاطع محطة'
                : /فيوز/.test(q) ? 'فيوز محطة'
                : null;
    return answerStationHotspots(complaints, p, areas, fault);
  }
  // asking for the document itself, not statistics about it
  if (/ابي|أبي|اعطني|أعطني|ارسل|أرسل|جيب|حمل|حمّل|نزل|افتح|ملف|pdf|PDF/.test(q)
      && /تقرير|تقارير/.test(q))                                     return { wantsDocuments: true };
  if (mentionedAction)                                               return answerSpecificAction(complaints, p, mentionedAction);
  if (areas.length)                                                  return answerByArea(complaints, p, areas);
  if (/اكثر|أكثر|نوع|انواع|أنواع/.test(q) && /عطل|اعطال|أعطال|بلاغ/.test(q))
                                                                     return answerActions(complaints, p);
  if (/منطقة|مناطق|وين/.test(q))                                     return answerByArea(complaints, p, areas);
  if (/عطل|اعطال|أعطال/.test(q))                                     return answerActions(complaints, p);
  if (/كم|عدد|احصائ|إحصائ|تقرير|ملخص|وضع|الوضع/.test(q))             return answerCounts(complaints, p);

  return {
    text: 'ما فهمت السؤال تمامًا 🤔\nجرّب مثلاً:\n• كم بلاغ اليوم؟\n• مين أسرع فني؟\n• تقرير عداد محروق\n• بلاغات خيطان\n\nأو اكتب «مساعدة» تشوف كل الأمثلة.',
  };
}
