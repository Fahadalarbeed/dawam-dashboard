'use client';
import { useState } from 'react';
import { COMPLAINT_ACTIONS, ACTIONS_WITH_SIZE, ACTION_SIZE_OPTIONS } from '../lib/constants';
import { updateReportData, searchReports } from '../lib/reportsApi';
import { supabase } from '../lib/supabaseClient';
import DriverExtendedReportForm, { resolveExtendedReport } from './DriverExtendedReportForm';
import { autoAssignDriver, pendingComplaints, isOverdue } from '../lib/assignment';

export function pad(n) { return String(n).padStart(2, '0'); }
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function buildAddressText(d) {
  return [
    d.area || '',
    d.block ? `Block ${d.block}` : '',
    d.street ? `Street ${d.street}` : '',
    d.avenue ? `Avenue ${d.avenue}` : '',
    d.building ? `Plot ${d.building}` : '',
    d.house ? `House ${d.house}` : '',
    'Kuwait',
  ].filter(Boolean).join(', ');
}

export function buildMapsUrl(d) {
  // fallback text-search link — used only if OSM geocoding fails
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(buildAddressText(d))}&travelmode=driving`;
}

// Nominatim returns a `place_rank`: lower = broader (country/city), higher = precise
// (street/building). Anything at city level or broader is not a usable destination,
// because it drops the technician in the middle of the whole area.
const MIN_USEFUL_PLACE_RANK = 18; // ~street level and finer

function scoreCandidate(r, d) {
  const rank = Number(r.place_rank || 0);
  if (rank < MIN_USEFUL_PLACE_RANK) return -1; // too broad — reject
  const name = (r.display_name || '');
  let score = rank;
  // reward results that actually mention the block / street we asked for
  if (d.block && new RegExp(`\\b${d.block}\\b`).test(name)) score += 6;
  if (d.street && new RegExp(`\\b${d.street}\\b`).test(name)) score += 4;
  if (r.type === 'house' || r.type === 'building') score += 5;
  return score;
}

async function geocodeCandidates(query) {
  const params = new URLSearchParams({
    format: 'json',
    limit: '10',
    addressdetails: '1',
    countrycodes: 'kw',
    viewbox: '46.5,30.1,48.6,28.5',
    bounded: '1',
    q: query,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { 'Accept-Language': 'ar' },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

export async function openGoogleRoute(d) {
  // Free-text queries work far better than Nominatim's structured fields for
  // Kuwaiti block addressing, so we try progressively looser phrasings.
  const attempts = [
    [d.area, d.block && `قطعة ${d.block}`, d.street && `شارع ${d.street}`, d.house && `منزل ${d.house}`, 'الكويت'],
    [d.area, d.block && `Block ${d.block}`, d.street && `Street ${d.street}`, 'Kuwait'],
    [d.area, d.block && `قطعة ${d.block}`, 'الكويت'],
  ].map((parts) => parts.filter(Boolean).join(', '));

  try {
    for (const q of attempts) {
      const results = await geocodeCandidates(q);
      const best = results
        .map((r) => ({ r, s: scoreCandidate(r, d) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)[0];

      if (best) {
        const { lat, lon } = best.r;
        window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
        return;
      }
    }
  } catch (e) {
    console.error('OSM geocoding failed', e);
  }

  // Nothing precise enough was found — hand the address to Google as text and say so,
  // rather than silently routing to the middle of the area.
  alert('تعذّر تحديد الموقع بدقة من الخريطة.\nراح نفتح بحث خرائط Google بالعنوان — تأكد من الموقع قبل ما تتحرك،\nأو استخدم زر Kuwait Finder للدقة الكاملة.');
  window.location.href = buildMapsUrl(d);
}

export async function openKuwaitFinder(paci) {
  if (!paci) {
    alert('ما فيه رقم آلي (PACI) مسجّل بهذا البلاغ');
    return;
  }
  try {
    await navigator.clipboard.writeText(paci);
    alert(`✓ تم نسخ الرقم الآلي (${paci})\nالصقه بخانة البحث بموقع Kuwait Finder اللي بيفتح الحين`);
  } catch (e) {
    alert(`الرقم الآلي: ${paci}\n(انسخه يدويًا — تعذر النسخ التلقائي)`);
  }
  window.open('https://gis.paci.gov.kw/Client/', '_blank', 'noopener');
}

export function CloseForm({ report, onClosed, onTrack }) {
  const [action, setAction] = useState(COMPLAINT_ACTIONS[0]);
  const [otherAction, setOtherAction] = useState('');
  const [size, setSize] = useState('');
  const [choice, setChoice] = useState(null);
  const [station, setStation] = useState('');
  const [unitNo, setUnitNo] = useState('');
  const [transNo, setTransNo] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const needsSize = ACTIONS_WITH_SIZE.includes(action);
  const sizeOptions = ACTION_SIZE_OPTIONS[action] || [];
  const effectiveSize = needsSize ? (size || sizeOptions[0]) : null;
  const resolution = resolveExtendedReport(action, effectiveSize);
  const hideUnitNo = action === 'محطة طافية' || action === 'محول / UDS';
  const showTransNo = action === 'محول / UDS';

  function handleActionChange(value) {
    setAction(value);
    setSize('');
    setChoice(null);
  }
  function handleSizeChange(value) {
    setSize(value);
    setChoice(null);
  }

  async function handleClose() {
    setSaving(true);
    try {
      const finalAction = (action === 'أخرى' ? (otherAction || 'أخرى') : action) + (needsSize && effectiveSize ? ` (${effectiveSize})` : '');
      await updateReportData(report.id, {
        status: 'closed',
        action: finalAction,
        actionSize: needsSize ? effectiveSize : '',
        station,
        unitNo,
        transNo,
        note: note || '',
        closedAt: new Date().toISOString(),
      });

      try {
        const all = await searchReports({ from: '2000-01-01', to: '2100-01-01', type: 'complaints' });
        const fresh = all.filter((r) => r.id !== report.id);

        // A slot just freed up — hand it to the oldest complaint still waiting,
        // using live positions so the nearest technician gets it.
        const { data: locs } = await supabase.from('driver_locations').select('driver, lat, lng');
        const liveLocations = {};
        (locs || []).forEach((l) => { liveLocations[l.driver] = { lat: l.lat, lng: l.lng }; });

        const waiting = pendingComplaints(fresh);
        for (const w of waiting) {
          const pick = autoAssignDriver(fresh, w.data?.area, liveLocations);
          if (!pick) break;
          await updateReportData(w.id, { driver: pick });
          const row = fresh.find((r) => r.id === w.id);
          if (row) row.data = { ...row.data, driver: pick };
        }
      } catch (e) {
        console.error('post-close housekeeping failed', e);
      }

      onClosed();
    } catch (e) {
      alert('تعذر إغلاق البلاغ: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const showExtended = resolution === 'yes' || (resolution === 'ask' && choice === 'extended');
  const showAsk = resolution === 'ask' && !choice;
  const showSimple = resolution === 'no' || (resolution === 'ask' && choice === 'simple');

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="field" style={{ marginTop: 0 }}>
        <label>الإجراء</label>
        <select value={action} onChange={(e) => handleActionChange(e.target.value)}>
          {COMPLAINT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {action === 'أخرى' && (
        <div className="field">
          <label>حدد نوع الإجراء</label>
          <input type="text" value={otherAction} onChange={(e) => setOtherAction(e.target.value)} placeholder="اكتب نوع الإجراء" />
        </div>
      )}
      {needsSize && (
        <div className="field">
          <label>الحجم</label>
          <select value={effectiveSize} onChange={(e) => handleSizeChange(e.target.value)}>
            {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {showAsk && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1, marginTop: 0 }} onClick={() => setChoice('simple')}>🔧 تبديل</button>
          <button type="button" className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={() => setChoice('extended')}>📋 عمل تقرير كامل</button>
        </div>
      )}

      {showExtended && (
        <DriverExtendedReportForm
          complaint={report}
          action={action}
          driverName={report.data?.driver}
          onSubmitted={onClosed}
          onCancel={() => setChoice('simple')}
        />
      )}

      {showSimple && (
        <>
          <div className="field">
            <label>المحطة أو UDS</label>
            <input type="text" value={station} onChange={(e) => setStation(e.target.value)} placeholder="رقم المحطة أو UDS" />
          </div>
          {!hideUnitNo && (
            <div className="field">
              <label>اليونت</label>
              <input type="text" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder="رقم اليونت" />
            </div>
          )}
          {showTransNo && (
            <div className="field">
              <label>رقم المحول</label>
              <input type="text" value={transNo} onChange={(e) => setTransNo(e.target.value)} placeholder="رقم المحول" />
            </div>
          )}
          <div className="field">
            <label>ملاحظة (اختياري)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="أي ملاحظة إضافية عن الإغلاق" />
          </div>
          <button className="btn-primary" onClick={handleClose} disabled={saving}>
            {saving ? 'جارٍ الإغلاق...' : '🔒 تأكيد إغلاق البلاغ'}
          </button>
        </>
      )}
    </div>
  );
}

export function ComplaintCard({ report, onChanged, onTrack, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const d = report.data || {};
  const isClosed = d.status === 'closed';
  const addressParts = [d.area, d.block ? `قطعة ${d.block}` : '', d.street ? `شارع ${d.street}` : '', d.avenue ? `جادة ${d.avenue}` : '', d.building ? `قسيمة ${d.building}` : '', d.house ? `منزل ${d.house}` : ''].filter(Boolean).join(' — ');

  async function handleRouteClick(e) {
    e.stopPropagation();
    onTrack && onTrack(d);
    setRouteLoading(true);
    try {
      await openGoogleRoute(d);
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 10, borderColor: isClosed ? 'var(--border)' : 'rgba(220,38,38,0.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{addressParts || 'بدون عنوان'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: isClosed ? 'var(--transactions-bg)' : 'var(--complaints-bg)',
            color: isClosed ? 'var(--transactions)' : 'var(--complaints)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            {isClosed ? '✅ مغلق' : (isOverdue(d) ? '⏰ متأخر' : '🟠 نشط')}
          </span>
          {isClosed && onDismiss && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDismiss(report.id); }}
              title="إخفاء هذا البلاغ"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 13, color: 'var(--transactions)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✓
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {d.phone && (
          <a
            href={`tel:${d.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="mono"
            style={{ background: 'var(--transactions-bg)', border: '1px solid var(--transactions)', borderRadius: 7, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--transactions)', textDecoration: 'none' }}
          >
            📞 {d.phone}
          </a>
        )}
        <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
          🕐 الإنشاء: {fmtDateTime(d.createdAt || report.created_at)}
        </span>
        {isClosed && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            🔒 الإغلاق: {fmtDateTime(d.closedAt)}
          </span>
        )}
        {isClosed && d.action && (
          <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
            {d.action}
          </span>
        )}
        {isClosed && d.station && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            المحطة/UDS: {d.station}
          </span>
        )}
        {isClosed && d.unitNo && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            اليونت: {d.unitNo}
          </span>
        )}
        {isClosed && d.transNo && (
          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11 }}>
            رقم المحول: {d.transNo}
          </span>
        )}
        <button
          type="button"
          onClick={handleRouteClick}
          disabled={routeLoading}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, color: 'var(--transactions)', fontWeight: 700, cursor: 'pointer' }}
        >
          {routeLoading ? '⏳ جارٍ التحديد...' : '🧭 المسار (Google)'}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openKuwaitFinder(d.paci); }}
          style={{ background: 'var(--complaints-bg)', border: '1px solid var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, color: 'var(--complaints)', fontWeight: 700, cursor: 'pointer' }}
        >
          📍 Kuwait Finder
        </button>
      </div>

      {isClosed && d.note && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '6px 8px' }}>
          📝 {d.note}
        </div>
      )}

      {!isClosed && (
        <>
          <button className="btn-secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'إلغاء' : '🔒 إغلاق البلاغ'}
          </button>
          {expanded && <CloseForm report={report} onClosed={() => { setExpanded(false); onChanged(); }} />}
        </>
      )}
    </div>
  );
}

export function groupByDriver(list) {
  const grouped = {};
  list.forEach((r) => {
    const driver = r.data?.driver || '⏳ بانتظار التعيين';
    if (!grouped[driver]) grouped[driver] = [];
    grouped[driver].push(r);
  });
  return Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
}

function getDismissedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('dismissed_complaints') || '[]'));
  } catch (e) {
    return new Set();
  }
}
function saveDismissedIds(set) {
  try {
    localStorage.setItem('dismissed_complaints', JSON.stringify([...set]));
  } catch (e) { /* ignore */ }
}

export function DriverGroupBox({ driver, reports, onChanged, onTrack }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => (typeof window !== 'undefined' ? getDismissedIds() : new Set()));

  function handleDismiss(id) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedIds(next);
      return next;
    });
  }

  const visibleReports = reports.filter((r) => !dismissed.has(r.id));

  return (
    <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, cursor: 'pointer' }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--transactions)' }}>🔧 {driver}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 800 }}>{visibleReports.length}</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', transform: open ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>‹</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {visibleReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '14px 10px', color: 'var(--text-muted)', fontSize: 12 }}>ما فيه بلاغات ظاهرة (تم إخفاء الباقي)</div>
          ) : (
            visibleReports.map((r) => <ComplaintCard key={r.id} report={r} onChanged={onChanged} onTrack={onTrack} onDismiss={handleDismiss} />)
          )}
        </div>
      )}
    </div>
  );
}
