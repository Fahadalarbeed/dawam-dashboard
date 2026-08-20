export const AREA_LIST = [
  'اليرموك','الضجيج','خيطان','خيطان الجديدة','جليب الشيوخ','العمرية','جامعة الشدادية','الفروانية','عبدالله المبارك',
  'الرابية','غرب عبدالله المبارك','الرحاب','جنوب عبدالله المبارك','اشبيليه','الشدادية الصناعية',
  'العارضية','رجم خشمان','العارضية الحرفية','كبد','العارضية مخازن','فروسية الفروانية',
  'مستشفى الفروانية','مزارع الصليبية','صباح الناصر','المطار الدولي','الفردوس','المطار العسكري',
  'السجن المركزي','ام قدير','الصليبية الصناعية','قاعدة جابر الاحمد','الصليبيه','كبد مزارع الابقار'
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
  'فيوز محطة / UDS', 'فيوز منزل', 'قاطع محطة / UDS',
  'عطل داخلي', 'قاعدة محترقة', 'عداد محروق', 'محول / UDS', 'محطة طافية', 'عداد ذكي/حمل', 'عطل HT', 'عطل كيبل',
  'بلاغ غير تابع الوزارة', 'بلاغ غير دقيق', 'أخرى',
];
export const ACTION_SIZE_OPTIONS = {
  'فيوز منزل': ['100A', '160A', '200A', '250A', '300A'],
  'فيوز محطة / UDS': ['355A', '400A (VEM)', '450A'],
  'قاعدة محترقة': ['100A', '200A', '300A'],
};
export const ACTIONS_WITH_SIZE = Object.keys(ACTION_SIZE_OPTIONS);

// Approximate area centres (lat,lng) — used only to measure relative closeness between areas.
export const AREA_COORDS = {
  'اليرموك':[29.3167,47.9500], 'الضجيج':[29.2833,47.9333], 'خيطان':[29.2870,47.9450],
  'خيطان الجديدة':[29.2790,47.9410], 'جليب الشيوخ':[29.2690,47.9260], 'العمرية':[29.3050,47.9420],
  'جامعة الشدادية':[29.3020,47.8960], 'الفروانية':[29.2770,47.9580], 'عبدالله المبارك':[29.2580,47.9000],
  'الرابية':[29.2960,47.9280], 'غرب عبدالله المبارك':[29.2540,47.8850], 'الرحاب':[29.2900,47.9150],
  'جنوب عبدالله المبارك':[29.2470,47.8930], 'اشبيليه':[29.2830,47.8990], 'الشدادية الصناعية':[29.3080,47.8890],
  'العارضية':[29.3060,47.9100], 'رجم خشمان':[29.2600,47.8300], 'العارضية الحرفية':[29.3120,47.9040],
  'كبد':[29.1900,47.7300], 'العارضية مخازن':[29.3150,47.8980], 'فروسية الفروانية':[29.2720,47.9490],
  'مستشفى الفروانية':[29.2760,47.9600], 'مزارع الصليبية':[29.2450,47.8100], 'صباح الناصر':[29.2650,47.9070],
  'المطار الدولي':[29.2266,47.9689], 'الفردوس':[29.2960,47.9020], 'المطار العسكري':[29.2200,47.9600],
  'السجن المركزي':[29.2350,47.8600], 'ام قدير':[29.2500,47.9200], 'الصليبية الصناعية':[29.2600,47.8200],
  'قاعدة جابر الاحمد':[29.2100,47.7900], 'الصليبيه':[29.2550,47.8350], 'كبد مزارع الابقار':[29.1800,47.7200],
};

// Core Farwaniya areas get a higher workload cap; outlying areas cost more travel time.
export const CORE_AREAS = [
  'اليرموك','الضجيج','خيطان','خيطان الجديدة','جليب الشيوخ','العمرية','الفروانية','عبدالله المبارك',
  'الرابية','غرب عبدالله المبارك','الرحاب','جنوب عبدالله المبارك','اشبيليه','العارضية','العارضية الحرفية',
  'العارضية مخازن','فروسية الفروانية','مستشفى الفروانية','صباح الناصر','الفردوس','ام قدير','جامعة الشدادية',
];

// Areas that historically generate the most load — keep capacity free for them.
export const HIGH_LOAD_AREAS = ['جليب الشيوخ','خيطان','خيطان الجديدة','الفروانية'];

export const SLA_MINUTES = 75;   // target close time; past this a complaint is flagged overdue
export const CAP_CORE = 3;       // max open complaints for a core Farwaniya area
export const CAP_OUTLYING = 2;   // outlying areas cost more travel, so cap lower

export const DRIVERS_LIST = [
  'فني 1', 'فني 2', 'فني 3', 'فني 4', 'فني 5',
];

export const COMPLAINT_FIELDS = [
  { key: 'reportDate', label: 'التاريخ', type: 'date' },
  { key: 'area', label: 'المنطقة', type: 'select', options: AREA_LIST },
  { key: 'block', label: 'القطعة', type: 'text' },
  { key: 'street', label: 'الشارع', type: 'text' },
  { key: 'avenue', label: 'الجادة', type: 'text' },
  { key: 'building', label: 'القسيمة', type: 'text' },
  { key: 'house', label: 'المنزل', type: 'text' },
  { key: 'paci', label: 'الرقم الآلي (PACI)', type: 'text' },
  { key: 'phone', label: 'رقم الهاتف', type: 'tel' },
  { key: 'driver', label: 'الفني (يُحدَّد تلقائيًا)', type: 'autodriver' },
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
  { key: 'burntBase', label: 'تبديل قاعدة محروقة' },
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
