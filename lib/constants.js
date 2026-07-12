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
  { key: 'shift', label: 'النوبة (Shift)', type: 'select', options: ['A','B','C','D'] },
  { key: 'time', label: 'الساعة', type: 'time' },
  { key: 'faultType', label: 'نوع العطل', type: 'text' },
  { key: 'area', label: 'المنطقة', type: 'select', options: AREA_LIST },
  { key: 'block', label: 'القطعة', type: 'text' },
  { key: 'avenue', label: 'جادة (Ln)', type: 'text' },
  { key: 'street', label: 'شارع', type: 'text' },
  { key: 'building', label: 'قسيمة', type: 'text' },
  { key: 'house', label: 'منزل', type: 'text' },
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
  { key: 'shift', label: 'النوبة (Shift)', type: 'select', options: ['A','B','C','D'] },
  { key: 'meterType', label: 'نوع العداد', type: 'select', options: ['عادي / Normal','الكتروني / Electronic'] },
  { key: 'reportDate', label: 'التاريخ', type: 'date' },
  { key: 'contactNo', label: 'رقم الهاتف (المبلغ)', type: 'tel' },
  { key: 'complainantName', label: 'أسم المبلغ', type: 'text' },
  { key: 'latestReading', label: 'آخر قراءة للعداد', type: 'text' },
  { key: 'meterNo', label: 'رقم العداد', type: 'text' },
  { key: 'meterSize', label: 'حجم العداد', type: 'select', options: METER_SIZES },
  { key: 'street', label: 'الشارع', type: 'text' },
  { key: 'block', label: 'القطعة', type: 'text' },
  { key: 'area', label: 'المنطقة', type: 'select', options: AREA_LIST },
  { key: 'paci', label: 'الرقم الآلي (PACI)', type: 'text' },
  { key: 'building', label: 'القسيمة', type: 'text' },
  { key: 'house', label: 'المنزل', type: 'text' },
  { key: 'avenue', label: 'الجادة', type: 'text' },
  { key: 'techName', label: 'أسم الفني الكاشف بمركز الطوارئ', type: 'text' },
  { key: 'techPhone', label: 'رقم الهاتف (الفني)', type: 'tel' },
  { key: 'procedure', label: 'الإجراء (Procedure / Action taken)', type: 'textarea' },
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
