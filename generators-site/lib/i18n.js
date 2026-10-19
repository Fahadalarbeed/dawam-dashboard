'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// عربي / English — زر ENG فوق يحوّل الموقع كامل، والاختيار ينحفظ بالجهاز
const EN = {
  // عام
  'مولدات محافظة الفروانية': 'Farwaniya Governorate Generators',
  'مراقبة الفروانية': 'Farwaniya Control',
  'إغلاق': 'Close',
  'إلغاء': 'Cancel',
  'مسح': 'Clear',
  'عرض': 'View',
  'تعديل': 'Edit',
  'إضافة': 'Add',
  'الاسم': 'Name',
  'اسمك': 'Your name',
  'جارٍ التحميل...': 'Loading...',
  'جارٍ الحفظ...': 'Saving...',
  'جارٍ الإرسال...': 'Sending...',
  'جارٍ الإزالة...': 'Removing...',
  'يوم': 'day(s)',
  'ساعة': 'hr',
  '{d} يوم و {h} ساعة': '{d} d {h} h',
  '{d} يوم': '{d} d',
  '{h} ساعة': '{h} h',

  // الحالات والأنواع
  'شغال': 'Running',
  'ستاند باي': 'Standby',
  'الكل': 'All',
  'المولدات الشغالة': 'Running generators',
  'إجمالي أيام التشغيل': 'Total running days',
  'مُزال': 'Removed',
  'الشغالة': 'Running',

  // أزرار الصفحة
  '➕ تركيب / إزالة مولد': '➕ Install / Remove generator',
  '📅 بحث بالتاريخ': '📅 Search by date',
  '🖨️ طباعة': '🖨️ Print',
  '📤 مشاركة': '📤 Share',
  '✏️ تعديل': '✏️ Edit',
  '🗑️ إزالة المولد': '🗑️ Remove',
  '← شغال': '→ Running',
  '← ستاند باي': '→ Standby',
  '📍 خريطة': '📍 Map',

  // البحث
  'حسب تاريخ الإيصال': 'By connection date',
  'حسب تاريخ الإزالة': 'By removal date',
  'من / From': 'From',
  'إلى / To': 'To',
  'نتائج البحث: {n} مولد — منها {r} مُزال': 'Results: {n} generators — {r} removed',
  'اختر الفترة — يطلع لك المولدات اللي انشالت خلالها': 'Pick a period — shows generators removed during it',
  'اختر الفترة — يطلع لك كل المولدات اللي انركبت خلالها حتى لو انشالت بعدين، مع تاريخ الإزالة': 'Pick a period — shows every generator installed during it, even if removed later, with the removal date',
  'عدد المولدات': 'Generators',
  'مجموع القدرة': 'Total capacity',
  'إجمالي وقت التشغيل': 'Total running time',
  'متوسط التشغيل للمولد': 'Average per generator',
  'خلال الفترة': 'In period',
  'ما زال مركّب': 'Still installed',
  'لا توجد نتائج': 'No results',
  'لا توجد مولدات': 'No generators',
  'لا توجد مولدات — اضغط "تركيب / إزالة مولد"': 'No generators — tap "Install / Remove generator"',

  // الجدول
  'م': '#',
  'العنوان': 'Address',
  'مصدر التغذية': 'Feed source',
  'بيانات المولد': 'Generator data',
  'النوع': 'Type',
  'النوبة': 'Shift',
  'تاريخ التركيب': 'Installed',
  'مدة التشغيل': 'Running time',
  'الأيام': 'Days',
  'سبب التركيب': 'Install reason',
  'ملاحظات': 'Notes',
  'الملاحظات': 'Notes',
  'تاريخ الإزالة': 'Removed',
  'إجراء': 'Action',
  'المنطقة': 'Area',
  'القطعة': 'Block',
  'الشارع': 'Street',
  'القسيمة': 'Plot',
  'رقم القسيمة': 'Plot No.',
  'اللوكيشن': 'Location',
  'محطة': 'S/S',
  'محول': 'Transformer',
  'اليونت': 'Unit',
  'العدد': 'Qty',
  'الحجم kVA': 'Size kVA',
  'رقم المولد': 'Gen. No',
  'الوايرات': 'Wires',
  'عدد الوايرات': 'No. of wires',
  'الحالة': 'Status',
  'المجموع / Total': 'Total',
  'الجدول يتمرر يمين ويسار · Scroll sideways': 'Scroll sideways',

  // تأكيدات وأخطاء
  'متأكد تبي تحوّل المولد من ستاند باي إلى شغال؟': 'Switch this generator from Standby to Running?',
  'متأكد تبي تحوّل المولد من شغال إلى ستاند باي؟': 'Switch this generator from Running to Standby?',
  'متأكد تبي تحفظ التعديل على المولد؟': 'Save the changes to this generator?',
  'الحجم': 'Size',
  'ق': 'Blk',
  'ش': 'St',
  'تعذر التحميل': 'Could not load',
  'تعذر الإزالة: ': 'Could not remove: ',
  'تعذر التعديل: ': 'Could not update: ',
  'تعذر الحفظ: ': 'Could not save: ',
  'تعذر الإرسال: ': 'Could not send: ',
  'تعذر إنشاء الملف: ': 'Could not create file: ',
  'ما فيه مولدات بالجدول': 'No generators in the table',

  // نافذة الإزالة
  'إزالة المولد': 'Remove generator',
  'قطعة': 'Block',
  'مولد': 'Gen.',
  'موصول من {d} — {n} يوم': 'Connected since {d} — {n} day(s)',
  'اسم اللي أزال المولد *': 'Removed by *',
  '🕐 وقت الإزالة ينحفظ تلقائي —': '🕐 Removal time is saved automatically —',
  '🗑️ تأكيد الإزالة': '🗑️ Confirm removal',

  // نافذة التعديل
  'تعديل بيانات المولد': 'Edit generator',
  'إدخال مولد جديد': 'New generator',
  '⚡ نوع المولد *': '⚡ Generator type *',
  '📶 حالة المولد': '📶 Generator status',
  '📝 سبب التركيب *': '📝 Install reason *',
  'اكتب السبب': 'Type the reason',
  '📍 العنوان': '📍 Address',
  'المنطقة *': 'Area *',
  '— اختر المنطقة —': '— Select area —',
  '🔌 مصدر التغذية': '🔌 Feed source',
  '⚙️ بيانات المولد': '⚙️ Generator data',
  'حجم المولد kVA': 'Generator size kVA',
  'اختر {n} أحجام': 'Pick {n} sizes',
  'أخرى': 'Other',
  'أخرى: ': 'Other: ',
  'اكتب الحجم kVA': 'Type size kVA',
  'المختار:': 'Selected:',
  '🗓️ النوبة والتاريخ': '🗓️ Shift & date',
  '— تلقائي': '— automatic',
  'تاريخ الإيصال': 'Connection date',
  'اسم اللي ركّب': 'Installed by',
  'مثال: تخفيف أحمال': 'e.g. load shedding',
  '👤 اسم اللي عدّل *': '👤 Edited by *',
  '💾 حفظ التعديل': '💾 Save changes',
  '💾 حفظ المولد / Save': '💾 Save generator',
  'الخانات المطلوبة: نوع المولد، سبب التركيب، المنطقة، النوبة، التاريخ، اسم اللي عدّل': 'Required: type, install reason, area, shift, date, edited by',
  'الخانات المطلوبة: نوع المولد، سبب التركيب، المنطقة': 'Required: type, install reason, area',

  // أسباب التركيب
  'تخفيف الأحمال': 'Load shedding',
  'عطل بالمحول': 'Transformer fault',
  'صيانة': 'Maintenance',
  'كيبل فولتي': 'Faulty cable',
  'قطع مبرمج': 'Scheduled outage',
  'خط مين': 'Main line',
  'تقسيم أحمال': 'Load splitting',

  // نموذج التركيب / الإزالة
  'نموذج تركيب أو إزالة مولد — عبّي البيانات بدقة واضغط إرسال': 'Install / remove generator form — fill in the details and press Send',
  'تم تسجيل تركيب المولد': 'Generator installation recorded',
  'تم تسجيل إزالة المولد': 'Generator removal recorded',
  'انضاف على طول بجدول المولدات': 'Added to the generators table right away',
  '➕ تسجيل جديد': '➕ New entry',
  '📋 جدول المولدات': '📋 Generators table',
  '← رجوع لجدول المولدات': '← Back to generators table',
  '← جدول المولدات': '← Generators table',
  'تركيب أو إزالة *': 'Install or remove *',
  'تركيب': 'Install',
  'إزالة': 'Remove',
  'حالة المولد *': 'Generator status *',
  'نوع المولد *': 'Generator type *',
  'نوع المولد': 'Generator type',
  'وقت طلب التركيب': 'Install request time',
  'وقت التركيب': 'Install time',
  'حجم المولد': 'Generator size',
  'اسم اللي ركّب المولد': 'Installed by',
  'اسم اللي ركّب المولد *': 'Installed by *',
  'عبّي: ': 'Fill in: ',
  '، ': ', ',
  'النوبة *': 'Shift *',
  '— تلقائي حسب الجدول': '— automatic from the rota',
  'التاريخ / وقت طلب التركيب *': 'Date / install request time *',
  'وقت التركيب *': 'Install time *',
  'عدد المولدات *': 'Number of generators *',
  'مولد إضافي': 'Add generator',
  'المولد {n}': 'Generator {n}',
  'حجم المولد {n} (kVA) *': 'Generator {n} size (kVA) *',
  'رقم المولد {n}': 'Generator {n} No.',
  'مثال: 11': 'e.g. 11',
  'اللوكيشن (مكان المولد)': 'Location (generator spot)',
  'سبب التركيب *': 'Install reason *',
  'إرسال': 'Send',
  'اختر المولد': 'the generator',
  'اكتب اسم اللي أزال المولد': 'enter who removed it',
  'اختر المولد *': 'Select generator *',
  '🔍 بحث: المنطقة، رقم المولد، المحطة...': '🔍 Search: area, gen. no, S/S...',
  'شارع': 'St',
  'رقم': 'No.',
  'التاريخ / وقت طلب الإزالة *': 'Date / removal request time *',
  'وقت الإزالة *': 'Removal time *',
  'إرسال الإزالة': 'Send removal',

  // الخريطة
  '📍 تم تحديد الموقع': '📍 Location set',
  '🗺️ حدّد مكان المولد على الخريطة': '🗺️ Pin the generator on the map',
  'الجهاز ما يدعم تحديد الموقع': 'This device does not support location',
  'ما قدرنا ناخذ موقعك — اسمح للمتصفح بالموقع أو حط الـ Pin بإيدك': 'Could not get your location — allow location access or drop the pin manually',
  'حدّد مكان المولد': 'Pin the generator',
  'اضغط على الخريطة عشان تحط الـ Pin، وتقدر تسحبه لين يركب على المكان بالضبط': 'Tap the map to drop the pin, then drag it to the exact spot',
  '... جاري التحديد': 'Locating...',
  '📡 موقعي الحالي': '📡 My location',
  '✓ تأكيد الموقع': '✓ Confirm location',

  // المناطق
  'اليرموك': 'Al-Yarmouk', 'الضجيج': 'Al-Dajeej', 'خيطان': 'Khaitan', 'خيطان الجديدة': 'New Khaitan',
  'جليب الشيوخ': 'Jleeb Al-Shuyoukh', 'العمرية': 'Al-Omariya', 'جامعة الشدادية': 'Shadadiya University',
  'الفروانية': 'Farwaniya', 'عبدالله المبارك': 'Abdullah Al-Mubarak', 'الرابية': 'Al-Rabiya',
  'غرب عبدالله المبارك': 'West Abdullah Al-Mubarak', 'الرحاب': 'Al-Rehab', 'جنوب عبدالله المبارك': 'South Abdullah Al-Mubarak',
  'اشبيليه': 'Ishbiliya', 'الشدادية الصناعية': 'Shadadiya Industrial', 'العارضية': 'Ardiya',
  'رجم خشمان': 'Rajm Khashman', 'العارضية الحرفية': 'Ardiya Crafts', 'كبد': 'Kabd',
  'العارضية مخازن': 'Ardiya Storage', 'فروسية الفروانية': 'Farwaniya Equestrian', 'مستشفى الفروانية': 'Farwaniya Hospital',
  'مزارع الصليبية': 'Sulaibiya Farms', 'صباح الناصر': 'Sabah Al-Nasser', 'المطار الدولي': 'International Airport',
  'الفردوس': 'Al-Ferdous', 'المطار العسكري': 'Military Airport', 'السجن المركزي': 'Central Prison',
  'ام قدير': 'Umm Qadir', 'الصليبية الصناعية': 'Sulaibiya Industrial', 'قاعدة جابر الاحمد': 'Jaber Al-Ahmad Base',
  'الصليبيه': 'Sulaibiya', 'كبد مزارع الابقار': 'Kabd Cow Farms', 'قاعدة جوية': 'Air base',
};

const Ctx = createContext({ lang: 'ar', en: false, t: (s) => s, setLang: () => {} });

function fill(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState('ar');
  useEffect(() => {
    try { const v = localStorage.getItem('gen_lang'); if (v === 'en') setLang('en'); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    document.documentElement.dataset.lang = lang;
    try { localStorage.setItem('gen_lang', lang); } catch { /* ignore */ }
  }, [lang]);
  const t = useCallback((s, vars) => {
    if (s == null) return s;
    const out = lang === 'en' ? (EN[s] ?? s) : s;
    return fill(out, vars);
  }, [lang]);
  return <Ctx.Provider value={{ lang, en: lang === 'en', t, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() { return useContext(Ctx); }

// زر ENG / عربي
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      style={{
        flex: 'none', border: '1.5px solid var(--navy)', background: 'var(--surface)', color: 'var(--navy)',
        borderRadius: 999, padding: '6px 14px', fontFamily: "'Cairo', sans-serif", fontSize: 13, fontWeight: 800, cursor: 'pointer',
      }}
      aria-label="Language"
    >
      {lang === 'en' ? 'عربي' : 'ENG'}
    </button>
  );
}
