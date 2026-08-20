import {
  DRIVERS_LIST, AREA_COORDS, CORE_AREAS, HIGH_LOAD_AREAS,
  SLA_MINUTES, CAP_CORE, CAP_OUTLYING,
} from './constants';

const CORE = new Set(CORE_AREAS);
const HIGH = new Set(HIGH_LOAD_AREAS);

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function areaDistanceKm(a, b) {
  const A = AREA_COORDS[a], B = AREA_COORDS[b];
  if (!A || !B) return 999;
  const toRad = (x) => (x * Math.PI) / 180;
  const [lat1, lng1] = A, [lat2, lng2] = B;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function capacityFor(area) {
  return CORE.has(area) ? CAP_CORE : CAP_OUTLYING;
}

// `complaints` is the raw reports array (type === 'complaints'); we read .data off each row.
function dataOf(r) { return r.data || r; }

function openComplaintsFor(complaints, driver) {
  return complaints.filter((r) => {
    const d = dataOf(r);
    return d.driver === driver && (d.status || 'active') === 'active';
  });
}

function closedTodayCount(complaints, driver) {
  const t = todayStr();
  return complaints.filter((r) => {
    const d = dataOf(r);
    return d.driver === driver && d.status === 'closed' && (d.closedAt || '').slice(0, 10) === t;
  }).length;
}

// Last area this technician actually worked — used as their proxy location.
function lastAreaFor(complaints, driver) {
  const hist = complaints
    .map(dataOf)
    .filter((d) => d.driver === driver && d.area)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return hist.length ? hist[0].area : null;
}

export function autoAssignDriver(complaints, area) {
  const cap = capacityFor(area);
  const eligible = DRIVERS_LIST.filter((d) => openComplaintsFor(complaints, d).length < cap);
  if (eligible.length === 0) return null;

  // 1) Already working this exact area — keep the same technician there.
  const sameArea = eligible.filter((d) =>
    openComplaintsFor(complaints, d).some((r) => dataOf(r).area === area));
  if (sameArea.length) {
    return sameArea.sort((a, b) =>
      openComplaintsFor(complaints, a).length - openComplaintsFor(complaints, b).length)[0];
  }

  // 2) Otherwise rank by: idle first, then closeness, then lighter load, then fewer done today.
  const scored = eligible.map((d) => {
    const open = openComplaintsFor(complaints, d).length;
    const last = lastAreaFor(complaints, d);
    const dist = open === 0 ? 0 : (last ? areaDistanceKm(area, last) : 50);
    const loadWeight = HIGH.has(area) ? open * 2 : open;
    return { d, open, score: dist + loadWeight * 5, done: closedTodayCount(complaints, d) };
  });
  scored.sort((a, b) => a.score - b.score || a.open - b.open || a.done - b.done);
  return scored[0].d;
}

export function isOverdue(d) {
  if (!d || (d.status || 'active') !== 'active' || !d.createdAt) return false;
  return (Date.now() - new Date(d.createdAt)) / 60000 > SLA_MINUTES;
}

// Complaints still waiting for a technician, oldest first.
export function pendingComplaints(complaints) {
  return complaints
    .filter((r) => {
      const d = dataOf(r);
      return (d.status || 'active') === 'active' && !d.driver;
    })
    .sort((a, b) => new Date(dataOf(a).createdAt || 0) - new Date(dataOf(b).createdAt || 0));
}
