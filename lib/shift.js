// النوبات — مطابقة لجدول "فرق التشغيل" الرسمي (مراقبة محافظة الفروانية)
// ٥ فرق (A..E) — صبح ٧ص-٣ع | عصر ٣ع-١١ل | ليل ١١ل-٧ص
// الجدول يتكرر كل ٥ أيام بشكل متصل (ما يعتمد على رقم اليوم في الشهر)
// المرجع: ١ أكتوبر ٢٠٢٦ = صبح E، عصر D، ليل A
// كل الحسابات بتوقيت الكويت (UTC+3) مهما كان توقيت الجهاز

// [صبح, عصر, ليل] لكل يوم في الدورة
const ROTATION = [
  ['E', 'D', 'A'],
  ['C', 'E', 'D'],
  ['B', 'C', 'E'],
  ['A', 'B', 'C'],
  ['D', 'A', 'B'],
];
const ANCHOR_UTC_DAY = Date.UTC(2026, 9, 1) / 86400000; // 2026-10-01

// الحرف العربي للفريق (أسماء مسؤولي النوبة مربوطة فيه) ↔ الحرف اللاتيني
export const SHIFT_BASE_ORDER = ['أ', 'ب', 'ج', 'د', 'هـ'];
export const SHIFT_LETTER_MAP = { 'أ': 'A', 'ب': 'B', 'ج': 'C', 'د': 'D', 'هـ': 'E' };
export const LATIN_TO_ARABIC = Object.fromEntries(Object.entries(SHIFT_LETTER_MAP).map(([ar, la]) => [la, ar]));

export const SHIFT_PERIODS = [
  { key: 'p1', label: 'صبح', icon: '☀️' },
  { key: 'p2', label: 'عصر', icon: '🌇' },
  { key: 'p3', label: 'ليل', icon: '🌙' },
];

// وقت الكويت كأرقام (سنة/شهر/يوم/ساعة)
function kuwait(date) {
  const k = new Date(date.getTime() + 3 * 3600000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), h: k.getUTCHours() };
}

// صبح 7ص-3ع = 0 | عصر 3ع-11ل = 1 | ليل 11ل-7ص = 2
export function getCurrentPeriodIndex(date = new Date()) {
  const { h } = kuwait(date);
  if (h >= 7 && h < 15) return 0;
  if (h >= 15 && h < 23) return 1;
  return 2;
}

// اليوم اللي بدأت فيه النوبة (الليل من ٠٠:٠٠ لين ٦:٥٩ تابع لأمس)
function shiftDayIndex(date) {
  const { y, m, d, h } = kuwait(date);
  let day = Date.UTC(y, m, d) / 86400000;
  if (h < 7) day -= 1;
  return day;
}

// الحرف اللاتيني لنوبة يوم معيّن (تاريخ الكويت YYYY-MM-DD أو Date) وفترة معيّنة
export function getShiftLetterFor(dayOrDate, periodIndex) {
  let day;
  if (typeof dayOrDate === 'string') {
    const [y, m, d] = dayOrDate.split('-').map(Number);
    day = Date.UTC(y, m - 1, d) / 86400000;
  } else {
    const { y, m, d } = kuwait(dayOrDate);
    day = Date.UTC(y, m, d) / 86400000;
  }
  const i = (((day - ANCHOR_UTC_DAY) % 5) + 5) % 5;
  return ROTATION[i][periodIndex];
}

// الحرف اللاتيني للنوبة المناوبة في لحظة معيّنة، مثل 'C'
export function getShiftLetterAt(date = new Date()) {
  const i = (((shiftDayIndex(date) - ANCHOR_UTC_DAY) % 5) + 5) % 5;
  return ROTATION[i][getCurrentPeriodIndex(date)];
}

export function getCurrentShiftLetter(date = new Date()) {
  try { return getShiftLetterAt(date); } catch (e) { return 'A'; }
}

// الحرف العربي للفريق المناوب، مثل 'ج'
export function getCurrentTeamLetter(date = new Date()) {
  return LATIN_TO_ARABIC[getShiftLetterAt(date)];
}

export function getCurrentPeriod(date = new Date()) {
  return SHIFT_PERIODS[getCurrentPeriodIndex(date)];
}

// توافق مع الكود القديم: date هنا هو "يوم النوبة" (بعد تعديل الليل) و columnIndex = الفترة
export function getTeamForDate(date, columnIndex) {
  return LATIN_TO_ARABIC[getShiftLetterFor(date, columnIndex)];
}
