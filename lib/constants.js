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
  { key: 'technicianName', label: 'أ
