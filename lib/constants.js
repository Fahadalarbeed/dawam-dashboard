export const AREA_LIST = [
  'اليرموك','الضجيج','خيطان','الجليب','العمرية','جامعة الشدادية','الفروانية','عبدالله المبارك',
  'الرابية','غرب عبدالله المبارك','الرحاب','جنوب عبدالله المبارك','اشبيليه','الشدادية الصناعية',
  'العارضية السكنية','رجم خشمان','العارضية الحرفية','كبد','العارضية مخازن','فروسية الفروانية',
  'مستشفى الفروانية','مزارع الصليبية','صباح الناصر','المطار الدولي','الفردوس','المطار العسكري',
  'السجن المركزي','ام قدير','صليبية الصناعية+مخازن','قاعدة جابر الاحمد','صليبية السكنية','كبد مزارع الابقار'
];

export const METER_SIZES = ['40A','50A','75A','80A','100A','125A','200A','300A'];

export const FAULT_FIELDS = [
  { key: 'employeeName', label: 'اسم الموظف', type: 'text' },
  { key: 'reportDate', label: 'التاريخ', type: 'date' },
  { key: 'shift', label: 'النوبة (Shift)', type: 'select', options: ['A','B','C','D','E'] },
  { key: 'time', label: 'الساعة', type: 'time' },
  { key: 'faultType', label: 'نوع العطل', type: 'text' },
  { key: 'area', label: 'المنطقة', type: 'select', options: AREA_LIST },
  { key: 'block', label: 'القطعة', type: 'text' },
  { key: 'street', label: 'الشارع', type: 'text' },
  { key: 'avenue', label: 'الجادة', type: 'text' },
  { key: 'building', label: 'القسيمة', type: 'text' },
  { key: 'house', label: 'المنزل', type: 'text' },
  { key: 'paci', label: 'الرقم الآلي (PACI)', type: 'text' },
  { key: 'station', label: 'المحطة أو وحدة التوزيع (S/S or UDS)', type: 'text' },
  { key: 'transNo', label: 'رقم المحول', type: 'text' },
  { key: 'unitNo', label: 'رقم اليونيت', type: 'text' },
  { key: 'complainantName', label: 'أسم المبلغ', type: 'text' },
  { key: 'complainantPhone', label: 'رقم المبلغ', type: 'tel' },
  { key: 'technicianName', label: 'أسم الفني', type: 'text' },
];

export const METER_FIELDS = [
  { key: 'preparedBy', label: 'اسم معد التقرير', type: 'text' },
  { key: 'shift', label: 'النوبة (Shift)', type: 'select', options: ['A','B','C','D','E'] },
  { key: 'meterType', label: 'نوع العداد', type: 'select', options: ['عادي / Normal','الكتروني / Electronic'] },
  { key: 'reportDate', label: 'التاريخ', type: 'date' },
  { key: 'area', label: 'المنطقة', type: 'select', options: AREA_LIST },
  { key: 'block', label: 'القطعة', type: 'text' },
  { key: 'street', label: 'الشارع', type: 'text' },
  { key: 'avenue', label: 'الجادة', type: 'text' },
  { key: 'building', label: 'القسيمة', type: 'text' },
  { key: 'house', label: 'المنزل', type: 'text' },
  { key: 'paci', label: 'الرقم الآلي (PACI)', type: 'text' },
  { key: 'contactNo', label: 'رقم الهاتف (المبلغ)', type: 'tel' },
  { key: 'complainantName', label: 'أسم المبلغ', type: 'text' },
  { key: 'latestReading', label: 'آخر قراءة للعداد', type: 'text' },
  { key: 'meterNo', label: 'رقم العداد', type: 'text' },
  { key: 'meterSize', label: 'حجم العداد', type: 'select', options: METER_SIZES },
  { key: 'techName', label: 'أسم الفني الكاشف بمركز الطوارئ', type: 'text' },
  { key: 'techPhone', label: 'رقم الهاتف (الفني)', type: 'tel' },
  { key: 'procedure', label: 'الإجراء (Procedure / Action taken)', type: 'textarea' },
];

export const COMPLAINT_ACTIONS = [
  'فيوز محطة', 'فيوز UDS', 'فيوز 100A', 'فيوز 160A', 'فيوز 200A', 'فيوز 250A', 'فيوز 300A',
  'عطل داخلي', 'قاعدة محترقة', 'عداد محروق', 'محول طافي', 'عداد ذكي/حمل', 'أخرى',
];

export const COMPLAINT_FIELDS = [
  { key: 'reportDate', label: 'التاريخ', type: 'date' },
  { key: 'area', label: 'المنطقة', type: 'select', options: AREA_LIST },
  { key: 'block', label: 'القطعة', type: 'text' },
  { key: 'street', label: 'الشارع', type: 'text' },
  { key: 'house', label: 'المنزل', type: 'text' },
  { key: 'paci', label: 'الرقم الآلي (PACI)', type: 'text' },
  { key: 'station', label: 'المحول أو UDS', type: 'text' },
  { key: 'unitNo', label: 'اليونت', type: 'text' },
  { key: 'phone', label: 'رقم الهاتف', type: 'tel' },
  { key: 'action', label: 'الإجراء', type: 'select', options: COMPLAINT_ACTIONS },
];

export const DAILY_PERIODS = [
  { key: 'p1', label: 'صبح (7 صباحًا : 3 ظهرًا)' },
  { key: 'p2', label: 'عصر (3 ظهرًا : 11 مساءً)' },
  { key: 'p3', label: 'ليل (11 مساءً : 7 صباحًا)' },
];

export const DAILY_METRICS = [
  { key: 'complaints', label: 'عدد البلاغات' },
  { key: 'kitkatFuses', label: 'تبديل فيوزات الكتاوت' },
  { key: 'stationFuses', label: 'تبديل فيوزات محطة/محول UDS' },
  { key: 'lvCables', label: 'اعطال كيبلات ضغط منخفض' },
  { key: 'htFaults', label: 'اعطال HT' },
  { key: 'burntBase', label: 'تبديل قاعدة محترقة' },
  { key: 'burntMeters', label: 'احتراق عدادات' },
  { key: 'internalReports', label: 'بلاغات أعطال داخلية' },
];

export const PERIOD_ORDER = { p1: 0, p2: 1, p3: 2 };

// ---------------- shift team-lead rotation ----------------
// team rotation: each day-of-month, the 5-team order rotates by one position.
// columns: [صباحاً(صبح), عصراً(عصر), ليلاً(ليل), استراحة1, استراحة2]
export const SHIFT_BASE_ORDER = ['أ', 'ب', 'ج', 'هـ', 'د'];
export const SHIFT_TEAM_INFO = {
  'أ': { name: 'فهد اسامه العنزي', phone: '94131611' },
  'ب': { name: 'رزيق غنيم المطيري', phone: '99012210' },
  'ج': { name: 'طلال عيد مبارك العراده', phone: '99738884' },
  'هـ': { name: 'مرزوق دغيم فالح العازمي', phone: '66155523' },
  'د': { name: 'حمود عوض الحصم الرشيدي', phone: '60000294' },
};
export const SHIFT_PERIODS = [
  { label: 'صبح', icon: '☀️' },
  { label: 'عصر', icon: '🌇' },
  { label: 'ليل', icon: '🌙' },
];
export function getTeamForDate(date, columnIndex) {
  const n = SHIFT_BASE_ORDER.length;
  const offset = (date.getDate() - 1) % n;
  const idx = ((columnIndex - offset) % n + n) % n;
  return SHIFT_BASE_ORDER[idx];
}
export function getCurrentPeriodIndex(date) {
  const hr = date.getHours();
  if (hr >= 7 && hr < 15) return 0;   // صبح: 7ص - 3ظ
  if (hr >= 15 && hr < 23) return 1;  // عصر: 3ظ - 11م
  return 2;                            // ليل: 11م - 7ص
}
// The night shift (11م-7ص) spans past midnight into the next calendar day.
// Between 00:00-06:59 the shift actually started YESTERDAY, so the rotation
// must use yesterday's date, not today's — otherwise the team appears wrong
// for the first few hours after midnight.
export function getShiftReferenceDate(date) {
  const hr = date.getHours();
  if (hr < 7) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  return date;
}
