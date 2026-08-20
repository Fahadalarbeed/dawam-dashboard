// Shift rotation helper. NOTE: mirrors the rotation used by ShiftLeadCard —
// if that logic changes, update it here too so reports stay in sync.
const SHIFT_BASE_ORDER = ['أ', 'ب', 'ج', 'هـ', 'د'];
const SHIFT_LETTER_MAP = { 'أ': 'A', 'ب': 'B', 'ج': 'C', 'هـ': 'D', 'د': 'E' };

export function getCurrentShiftLetter() {
  try {
    const epoch = new Date('2024-01-01T00:00:00');
    const daysSince = Math.floor((new Date() - epoch) / 86400000);
    const idx = ((daysSince % SHIFT_BASE_ORDER.length) + SHIFT_BASE_ORDER.length) % SHIFT_BASE_ORDER.length;
    return SHIFT_LETTER_MAP[SHIFT_BASE_ORDER[idx]] || 'A';
  } catch (e) {
    return 'A';
  }
}
