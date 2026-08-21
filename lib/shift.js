// Shift rotation — mirrors the logic used by ShiftLeadCard so that reports are
// always stamped with the team that is actually on duty at that moment.
export const SHIFT_BASE_ORDER = ['أ', 'ب', 'ج', 'هـ', 'د'];
export const SHIFT_LETTER_MAP = { 'أ': 'A', 'ب': 'B', 'ج': 'C', 'هـ': 'D', 'د': 'E' };

export const SHIFT_PERIODS = [
  { key: 'p1', label: 'صبح', icon: '☀️' },
  { key: 'p2', label: 'عصر', icon: '🌇' },
  { key: 'p3', label: 'ليل', icon: '🌙' },
];

// صبح 7ص-3ظ | عصر 3ظ-11م | ليل 11م-7ص
export function getCurrentPeriodIndex(date = new Date()) {
  const hr = date.getHours();
  if (hr >= 7 && hr < 15) return 0;
  if (hr >= 15 && hr < 23) return 1;
  return 2;
}

export function getTeamForDate(date, columnIndex) {
  const n = SHIFT_BASE_ORDER.length;
  const offset = (date.getDate() - 1) % n;
  const idx = (((columnIndex - offset) % n) + n) % n;
  return SHIFT_BASE_ORDER[idx];
}

// Arabic team letter currently on duty, e.g. 'ج'
export function getCurrentTeamLetter(date = new Date()) {
  return getTeamForDate(date, getCurrentPeriodIndex(date));
}

// Latin shift letter used in report forms, e.g. 'C'
export function getCurrentShiftLetter(date = new Date()) {
  try {
    return SHIFT_LETTER_MAP[getCurrentTeamLetter(date)] || 'A';
  } catch (e) {
    return 'A';
  }
}

export function getCurrentPeriod(date = new Date()) {
  return SHIFT_PERIODS[getCurrentPeriodIndex(date)];
}
