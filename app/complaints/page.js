'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AREA_LIST } from '../../lib/constants';
import { searchReports, deleteReport, checkIsAdmin } from '../../lib/reportsApi';
import { buildRepeatedComplaintsDoc, buildRepeatedStationsDoc, buildMetricsFilterDoc, buildMergedComplaintsDoc } from '../../lib/templates';
import { htmlToPdfBlob, downloadBlob, sharePdf } from '../../lib/pdf';
import SimpleBarChart from '../../components/SimpleBarChart';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateRangeFor(period, customFrom, customTo) {
  const now = new Date();
  const end = todayStr();
  if (period === 'all') return { from: '2000-01-01', to: '2100-01-01' };
  if (period === 'daily') return { from: end, to: end };
  if (period === 'weekly') {
    const start = new Date(now); start.setDate(start.getDate() - 6);
    return { from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`, to: end };
  }
  return { from: customFrom || end, to: customTo || end };
}

const FIELD_LABELS = [
  ['reportDate', 'التاريخ', (v) => fmtDate(v)],
  ['area', 'المنطقة'],
  ['block', 'القطعة'],
  ['street', 'الشارع'],
  ['building', 'القسيمة'],
  ['house', 'المنزل'],
  ['paci', 'الرقم الآلي (PACI)'],
  ['station', 'المحطة أو UDS'],
  ['unitNo', 'اليونت'],
  ['phone', 'رقم الهاتف'],
];

const CATEGORY_DEFS = [
  { key: 'internal', label: 'بلاغ داخلي', color: '#5B6FE0', match: (a) => a === 'عطل داخلي' },
  { key: 'stationFuse', label: 'فيوزات محطة', color: '#0E9AA8', match: (a) => a === 'فيوز محطة' || a === 'فيوز UDS' },
  { key: 'kitkatFuse', label: 'فيوزات المنزل', color: '#E8A33D', match: (a) => ['فيوز 100A', 'فيوز 160A', 'فيوز 200A', 'فيوز 250A', 'فيوز 300A'].includes(a) },
  { key: 'burntMeter', label: 'عداد محترق', color: '#1E3A6E', match: (a) => a === 'عداد محروق' },
  { key: 'burntBase', label: 'تبديل قاعدة', color: '#B45309', match: (a) => a === 'قاعدة محترقة' },
];

const METRIC_DEFS = [
  { key: 'complaints', label: 'عدد البلاغات', match: () => true },
  { key: 'kitkatFuses', label: 'فيوزات المنزل', match: (a) => ['فيوز 100A', 'فيوز 160A', 'فيوز 200A', 'فيوز 250A', 'فيوز 300A'].includes(a) },
  { key: 'stationFuses', label: 'تبديل فيوزات محطة/محول UDS', match: (a) => a === 'فيوز محطة' || a === 'فيوز UDS' },
  { key: 'lvCables', label: 'اعطال كيبلات ضغط منخفض', match: () => false },
  { key: 'htFaults', label: 'اعطال HT', match: () => false },
  { key: 'burntBase', label: 'تبديل قاعدة محترقة', match: (a) => a === 'قاعدة محترقة' },
  { key: 'burntMeters', label: 'احتراق عدادات', match: (a) => a === 'عداد محروق' },
  { key: 'internalReports', label: 'بلاغات أعطال داخلية', match: (a) => a === 'عطل داخلي' },
];

function addressKey(d) {
  const parts = [d.area, d.block ? `قطعة ${d.block}` : '', d.street ? `شارع ${d.street}` : '', d.building ? `قسيمة ${d.building}` : '', d.house ? `منزل ${d.house}` : ''].filter(Boolean);
  return parts.join(' — ') || 'بدون عنوان';
}
function stationKey(d) {
  return (d.station || '').trim();
}

export default function ComplaintsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [complaints, setComplaints] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const [period, setPeriod] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [showRepeated, setShowRepeated] = useState(false);
  const [repeatedAreaFilter, setRepeatedAreaFilter] = useState([]);
  const [expandedAddr, setExpandedAddr] = useState(null);
  const [exportingRepeated, setExportingRepeated] = useState(false);

  const [showStationRepeated, setShowStationRepeated] = useState(false);
  const [stationRepeatedAreaFilter, setStationRepeatedAreaFilter] = useState([]);
  const [expandedStation, setExpandedStation] = useState(null);
  const [exportingStationRepeated, setExportingStationRepeated] = useState(false);

  const [selectedMetricsAreas, setSelectedMetricsAreas] = useState([]);
  const [selectedExtremeArea, setSelectedExtremeArea] = useState(null);
  const [exportingExtreme, setExportingExtreme] = useState(false);
  const [metricsResult, setMetricsResult] = useState(null);
  const [exportingMetrics, setExportingMetrics] = useState(false);

  const [searchPeriod, setSearchPeriod] = useState('daily');
  const [searchCustomFrom, setSearchCustomFrom] = useState('');
  const [searchCustomTo, setSearchCustomTo] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [searchBlock, setSearchBlock] = useState('');
  const [searchStreet, setSearchStreet] = useState('');
  const [searchBuilding, setSearchBuilding] = useState('');
  const [searchHouse, setSearchHouse] = useState('');
  const [searchPaci, setSearchPaci] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [exportingSearch, setExportingSearch] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setCheckingAuth(false);
      checkIsAdmin(data.session.user.id).then(setIsAdmin);
    });
  }, [router]);

  const loadComplaints = useCallback(async (p, cf, ct) => {
    try {
      const { from, to } = dateRangeFor(p, cf, ct);
      const data = await searchReports({ from, to, type: 'complaints' });
      setComplaints(data);
      return data;
    } catch (e) {
      console.error(e);
      setComplaints([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!checkingAuth) loadComplaints(period, customFrom, customTo);
  }, [checkingAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPeriod(p) {
    setPeriod(p);
    if (p !== 'custom') loadComplaints(p, customFrom, customTo);
  }

  async function handleDelete(r) {
    try {
      await deleteReport(r.id, r.pdf_path);
      loadComplaints(period, customFrom, customTo);
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmId(null);
    }
  }

  const categoryCounts = useMemo(() => {
    if (!complaints) return CATEGORY_DEFS.map(() => 0);
    return CATEGORY_DEFS.map((c) => complaints.filter((r) => c.match(r.data?.action)).length);
  }, [complaints]);

  const areaBreakdown = useMemo(() => {
    if (!complaints) return { labels: [], values: [] };
    const counts = {};
    complaints.forEach((r) => {
      const a = r.data?.area || 'بدون منطقة';
      counts[a] = (counts[a] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
  }, [complaints]);

  const areaExtremes = useMemo(() => {
    if (!complaints || complaints.length === 0) return null;
    const counts = {};
    complaints.forEach((r) => {
      const a = r.data?.area || 'بدون منطقة';
      counts[a] = (counts[a] || 0) + 1;
    });
    const entries = Object.entries(counts);
    const maxCount = Math.max(...entries.map((e) => e[1]));
    const minCount = Math.min(...entries.map((e) => e[1]));
    const mostAreas = entries.filter((e) => e[1] === maxCount).map((e) => e[0]).sort((a, b) => a.localeCompare(b, 'ar'));
    const leastAreas = entries.filter((e) => e[1] === minCount).map((e) => e[0]).sort((a, b) => a.localeCompare(b, 'ar'));
    return { mostAreas, maxCount, leastAreas, minCount };
  }, [complaints]);

  const repeatedEntries = useMemo(() => {
    if (!complaints) return [];
    const source = repeatedAreaFilter.length > 0
      ? complaints.filter((r) => repeatedAreaFilter.includes(r.data?.area))
      : complaints;
    const groups = {};
    source.forEach((r) => {
      const key = addressKey(r.data || {});
      if (!groups[key]) groups[key] = [];
      groups[key].push(r.data || {});
    });
    return Object.entries(groups)
      .filter(([, items]) => items.length > 1)
      .map(([address, items]) => ({ address, count: items.length, items }))
      .sort((a, b) => b.count - a.count);
  }, [complaints, repeatedAreaFilter]);

  const stationRepeatedEntries = useMemo(() => {
    if (!complaints) return [];
    const source = stationRepeatedAreaFilter.length > 0
      ? complaints.filter((r) => stationRepeatedAreaFilter.includes(r.data?.area))
      : complaints;
    const groups = {};
    source.forEach((r) => {
      const key = stationKey(r.data || {});
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r.data || {});
    });
    return Object.entries(groups)
      .filter(([, items]) => items.length > 1)
      .map(([station, items]) => {
        const areas = [...new Set(items.map((d) => d.area).filter(Boolean))];
        return { station, count: items.length, items, areas };
      })
      .sort((a, b) => b.count - a.count);
  }, [complaints, stationRepeatedAreaFilter]);

  const extremeAreaComplaints = useMemo(() => {
    if (!complaints || !selectedExtremeArea) return [];
    return complaints.filter((r) => (r.data?.area || 'بدون منطقة') === selectedExtremeArea);
  }, [complaints, selectedExtremeArea]);

  const availableAreas = useMemo(() => {
    if (!complaints) return [];
    const inData = [...new Set(complaints.map((r) => r.data?.area).filter(Boolean))];
    return (inData.length ? inData : AREA_LIST).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [complaints]);

  function addMetricsArea(area) {
    if (area && !selectedMetricsAreas.includes(area)) {
      setSelectedMetricsAreas((prev) => [...prev, area]);
    }
  }
  function removeMetricsArea(area) {
    setSelectedMetricsAreas((prev) => prev.filter((a) => a !== area));
  }

  function addRepeatedArea(area) {
    if (area && !repeatedAreaFilter.includes(area)) setRepeatedAreaFilter((prev) => [...prev, area]);
  }
  function removeRepeatedArea(area) {
    setRepeatedAreaFilter((prev) => prev.filter((a) => a !== area));
  }
  function addStationRepeatedArea(area) {
    if (area && !stationRepeatedAreaFilter.includes(area)) setStationRepeatedAreaFilter((prev) => [...prev, area]);
  }
  function removeStationRepeatedArea(area) {
    setStationRepeatedAreaFilter((prev) => prev.filter((a) => a !== area));
  }

  function applyMetricsFilter(sourceData) {
    const data = sourceData || complaints || [];
    if (selectedMetricsAreas.length === 0) { setMetricsResult(null); return; }
    const { from, to } = dateRangeFor(period, customFrom, customTo);
    const filteredByArea = selectedMetricsAreas.map((area) => {
      const rows = data.filter((r) => r.data?.area === area && r.report_date >= from && r.report_date <= to);
      const counts = METRIC_DEFS.map((m) => rows.filter((r) => m.match(r.data?.action)).length);
      return { area, counts };
    });
    const totals = METRIC_DEFS.map((m, i) => filteredByArea.reduce((sum, r) => sum + r.counts[i], 0));
    setMetricsResult({ filteredByArea, totals, from, to });
  }

  async function handleApplyClick() {
    if (period === 'custom') {
      const freshData = await loadComplaints('custom', customFrom, customTo);
      applyMetricsFilter(freshData);
    } else {
      applyMetricsFilter();
    }
  }

  async function exportRepeated() {
    setExportingRepeated(true);
    try {
      const entries = repeatedEntries;
      const html = buildRepeatedComplaintsDoc(entries);
      const blob = await htmlToPdfBlob(html, 'p');
      const shared = await sharePdf(blob, 'تفاصيل_البلاغات_المتكررة.pdf');
      if (!shared) downloadBlob(blob, 'تفاصيل_البلاغات_المتكررة.pdf');
    } catch (e) {
      alert('تعذر إنشاء الملف: ' + e.message);
    } finally {
      setExportingRepeated(false);
    }
  }

  async function exportStationRepeated() {
    setExportingStationRepeated(true);
    try {
      const entries = stationRepeatedEntries;
      const html = buildRepeatedStationsDoc(entries);
      const blob = await htmlToPdfBlob(html, 'p');
      const shared = await sharePdf(blob, 'تفاصيل_بلاغات_المحطات_المتكررة.pdf');
      if (!shared) downloadBlob(blob, 'تفاصيل_بلاغات_المحطات_المتكررة.pdf');
    } catch (e) {
      alert('تعذر إنشاء الملف: ' + e.message);
    } finally {
      setExportingStationRepeated(false);
    }
  }

  async function exportExtremeArea() {
    if (!selectedExtremeArea || extremeAreaComplaints.length === 0) return;
    setExportingExtreme(true);
    try {
      const { from, to } = dateRangeFor(period, customFrom, customTo);
      const html = buildMergedComplaintsDoc(extremeAreaComplaints.map((r) => r.data), from, to);
      const blob = await htmlToPdfBlob(html, 'l');
      const shared = await sharePdf(blob, `بلاغات_${selectedExtremeArea}.pdf`);
      if (!shared) downloadBlob(blob, `بلاغات_${selectedExtremeArea}.pdf`);
    } catch (e) {
      alert('تعذر إنشاء الملف: ' + e.message);
    } finally {
      setExportingExtreme(false);
    }
  }

  async function exportMetrics() {
    if (!metricsResult) return;
    setExportingMetrics(true);
    try {
      const { filteredByArea, totals, from, to } = metricsResult;
      const html = buildMetricsFilterDoc(filteredByArea, totals, METRIC_DEFS, from, to);
      const blob = await htmlToPdfBlob(html, 'l');
      const shared = await sharePdf(blob, 'تقرير_البلاغات_حسب_المنطقة.pdf');
      if (!shared) downloadBlob(blob, 'تقرير_البلاغات_حسب_المنطقة.pdf');
    } catch (e) {
      alert('تعذر إنشاء الملف: ' + e.message);
    } finally {
      setExportingMetrics(false);
    }
  }

  async function runComplaintsSearch() {
    const { from, to } = dateRangeFor(searchPeriod, searchCustomFrom, searchCustomTo);
    try {
      const data = await searchReports({
        from, to, type: 'complaints',
        area: searchArea || 'all', block: searchBlock, street: searchStreet, building: searchBuilding, house: searchHouse, paci: searchPaci,
      });
      setSearchResults(data);
    } catch (e) {
      alert('تعذر تنفيذ البحث: ' + e.message);
      setSearchResults([]);
    }
  }

  async function exportSearchResults() {
    if (!searchResults || searchResults.length === 0) return;
    setExportingSearch(true);
    try {
      const { from, to } = dateRangeFor(searchPeriod, searchCustomFrom, searchCustomTo);
      const html = buildMergedComplaintsDoc(searchResults.map((r) => r.data), from, to);
      const blob = await htmlToPdfBlob(html, 'l');
      const shared = await sharePdf(blob, 'نتائج_البحث_البلاغات.pdf');
      if (!shared) downloadBlob(blob, 'نتائج_البحث_البلاغات.pdf');
    } catch (e) {
      alert('تعذر إنشاء الملف: ' + e.message);
    } finally {
      setExportingSearch(false);
    }
  }

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>جارٍ التحقق...</div>;
  }

  return (
    <div className="wrap">
      <header style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-secondary" style={{ marginTop: 0, width: 'auto', padding: '10px 16px' }} onClick={() => router.push('/dashboard')}>
          → رجوع
        </button>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>إحصائية البلاغات</h1>
      </header>

      {complaints && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
          <div className="card" style={{ padding: '8px 6px', textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--transactions)' }}>{complaints.length}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>إجمالي البلاغات</div>
          </div>
          {CATEGORY_DEFS.map((c, i) => (
            <div key={c.key} className="card" style={{ padding: '8px 6px', textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{categoryCounts[i]}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <button onClick={() => setShowRepeated((v) => !v)} style={{
          width: '100%', textAlign: 'right', background: 'var(--surface-2)', border: '1px solid rgba(37,99,235,0.35)',
          borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{ fontSize: 22 }}>🔁</div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>البلاغات المتكررة</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{repeatedEntries.length > 0 ? `${repeatedEntries.length} عنوان متكرر` : 'اضغط للعرض'}</div>
        </button>

        {showRepeated && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div className="field" style={{ marginTop: 0 }}>
              <label>المناطق (اتركه فاضي = الكل، أو حدد مناطق معينة)</label>
              <select value="" onChange={(e) => addRepeatedArea(e.target.value)}>
                <option value="">اختر منطقة لإضافتها...</option>
                {availableAreas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {repeatedAreaFilter.map((a) => (
                  <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
                    {a}
                    <span onClick={() => removeRepeatedArea(a)} style={{ cursor: 'pointer', fontWeight: 800 }}>✕</span>
                  </span>
                ))}
              </div>
            </div>

            <button className="btn-secondary" style={{ marginTop: 12, width: '100%', marginBottom: 12 }} onClick={exportRepeated} disabled={exportingRepeated}>
              {exportingRepeated ? 'جارٍ التجهيز...' : `🖨️ تصدير ${repeatedAreaFilter.length > 0 ? 'المناطق المحددة' : 'الكل'} كجدول (طباعة / مشاركة)`}
            </button>

            {repeatedEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: 12.5 }}>لا توجد عناوين متكررة</div>
            ) : (
              repeatedEntries.map((entry, i) => {
                const maxCount = repeatedEntries[0].count;
                const pct = Math.round((entry.count / maxCount) * 100);
                const isOpen = expandedAddr === entry.address;
                return (
                  <div key={entry.address} style={{ marginBottom: 6 }}>
                    <div onClick={() => setExpandedAddr(isOpen ? null : entry.address)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
                    }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--transactions-bg)', color: 'var(--transactions)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.address}</div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--transactions)', borderRadius: 3 }} />
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--transactions)', flexShrink: 0 }}>{entry.count}</div>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '8px 4px 0' }}>
                        {entry.items.map((d, j) => {
                          const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
                          return (
                            <div key={j} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 5 }}>
                              {FIELD_LABELS.map(([key, label, format]) => {
                                const val = format ? format(d[key]) : d[key];
                                if (!val) return null;
                                return (
                                  <span key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{label}:</span> <b>{val}</b>
                                  </span>
                                );
                              })}
                              <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{actionText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <button onClick={() => setShowStationRepeated((v) => !v)} style={{
          width: '100%', textAlign: 'right', background: 'var(--surface-2)', border: '1px solid rgba(180,83,9,0.35)',
          borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{ fontSize: 22 }}>🏭</div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>بلاغات متكررة محطات</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stationRepeatedEntries.length > 0 ? `${stationRepeatedEntries.length} محطة/UDS متكررة` : 'اضغط للعرض'}</div>
        </button>

        {showStationRepeated && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div className="field" style={{ marginTop: 0 }}>
              <label>المناطق (اتركه فاضي = الكل، أو حدد مناطق معينة)</label>
              <select value="" onChange={(e) => addStationRepeatedArea(e.target.value)}>
                <option value="">اختر منطقة لإضافتها...</option>
                {availableAreas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {stationRepeatedAreaFilter.map((a) => (
                  <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
                    {a}
                    <span onClick={() => removeStationRepeatedArea(a)} style={{ cursor: 'pointer', fontWeight: 800 }}>✕</span>
                  </span>
                ))}
              </div>
            </div>

            <button className="btn-secondary" style={{ marginTop: 12, width: '100%', marginBottom: 12 }} onClick={exportStationRepeated} disabled={exportingStationRepeated}>
              {exportingStationRepeated ? 'جارٍ التجهيز...' : `🖨️ تصدير ${stationRepeatedAreaFilter.length > 0 ? 'المناطق المحددة' : 'الكل'} كجدول (طباعة / مشاركة)`}
            </button>

            {stationRepeatedEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: 12.5 }}>لا توجد محطات متكررة</div>
            ) : (
              stationRepeatedEntries.map((entry, i) => {
                const maxCount = stationRepeatedEntries[0].count;
                const pct = Math.round((entry.count / maxCount) * 100);
                const isOpen = expandedStation === entry.station;
                return (
                  <div key={entry.station} style={{ marginBottom: 6 }}>
                    <div onClick={() => setExpandedStation(isOpen ? null : entry.station)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
                    }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--complaints-bg)', color: 'var(--complaints)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>محطة/UDS: {entry.station} {entry.areas.length > 0 ? `— ${entry.areas.join('، ')}` : ''}</div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--complaints)', borderRadius: 3 }} />
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--complaints)', flexShrink: 0 }}>{entry.count}</div>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '8px 4px 0' }}>
                        {entry.items.map((d, j) => {
                          const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
                          return (
                            <div key={j} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 5 }}>
                              {FIELD_LABELS.map(([key, label, format]) => {
                                const val = format ? format(d[key]) : d[key];
                                if (!val) return null;
                                return (
                                  <span key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{label}:</span> <b>{val}</b>
                                  </span>
                                );
                              })}
                              <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{actionText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {complaints && complaints.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <SimpleBarChart title="حسب النوع" labels={CATEGORY_DEFS.map((c) => c.label)} values={categoryCounts} color="#2563EB" />
          <SimpleBarChart title="حسب المنطقة" labels={areaBreakdown.labels} values={areaBreakdown.values} color="#0E9AA8" />
        </div>
      )}

      {areaExtremes && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div className="card" style={{ padding: '12px 10px', textAlign: 'center', borderColor: 'rgba(220,38,38,0.35)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>🔺 الأكثر بلاغات</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.5 }}>
                {areaExtremes.mostAreas.map((a, i) => (
                  <span key={a}>
                    <span onClick={() => setSelectedExtremeArea(selectedExtremeArea === a ? null : a)} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{a}</span>
                    {i < areaExtremes.mostAreas.length - 1 ? '، ' : ''}
                  </span>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)', marginTop: 4 }}>{areaExtremes.maxCount}</div>
            </div>
            <div className="card" style={{ padding: '12px 10px', textAlign: 'center', borderColor: 'rgba(79,190,141,0.35)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>🔻 الأقل بلاغات</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.5 }}>
                {areaExtremes.leastAreas.map((a, i) => (
                  <span key={a}>
                    <span onClick={() => setSelectedExtremeArea(selectedExtremeArea === a ? null : a)} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{a}</span>
                    {i < areaExtremes.leastAreas.length - 1 ? '، ' : ''}
                  </span>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--transactions)', marginTop: 4 }}>{areaExtremes.minCount}</div>
            </div>
          </div>

          {selectedExtremeArea && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>بلاغات: {selectedExtremeArea}</h2>
                <button onClick={() => setSelectedExtremeArea(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>✕</button>
              </div>
              {extremeAreaComplaints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 10px', color: 'var(--text-muted)', fontSize: 12.5 }}>لا توجد بلاغات</div>
              ) : (
                <>
                  {extremeAreaComplaints.map((r) => {
                    const d = r.data || {};
                    const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
                    return (
                      <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                        {FIELD_LABELS.map(([key, label, format]) => {
                          const val = format ? format(d[key]) : d[key];
                          if (!val) return null;
                          return (
                            <span key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{label}:</span> <b>{val}</b>
                            </span>
                          );
                        })}
                        <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{actionText}</span>
                      </div>
                    );
                  })}
                  <button className="btn-secondary" style={{ marginTop: 8, width: '100%' }} onClick={exportExtremeArea} disabled={exportingExtreme}>
                    {exportingExtreme ? 'جارٍ التجهيز...' : '🖨️ تصدير كجدول PDF (طباعة / مشاركة)'}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>فترة الإحصائية العامة (تؤثر على كل البطاقات والرسوم أعلاه)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['all', 'الكل'], ['daily', 'يومي'], ['weekly', 'اسبوعي'], ['custom', 'مخصص']].map(([val, label]) => (
            <button key={val} className={`chip ${period === val ? 'active' : ''}`} onClick={() => applyPeriod(val)}>{label}</button>
          ))}
        </div>

        <h2 style={{ fontSize: 13, fontWeight: 700, margin: '18px 0 10px', paddingTop: 14, borderTop: '1px solid var(--border)' }}>فلتر حسب المنطقة والفترة (جدول مثل التقرير اليومي)</h2>

        {period === 'custom' && (
          <div className="field" style={{ marginTop: 0 }}>
            <label>الفترة (مخصص)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="field">
          <label>المناطق (اختر ثم تنضاف تلقائيًا)</label>
          <select value="" onChange={(e) => addMetricsArea(e.target.value)}>
            <option value="">اختر منطقة لإضافتها...</option>
            {availableAreas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {selectedMetricsAreas.map((a) => (
              <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--transactions-bg)', color: 'var(--transactions)', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
                {a}
                <span onClick={() => removeMetricsArea(a)} style={{ cursor: 'pointer', fontWeight: 800 }}>✕</span>
              </span>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={handleApplyClick}>تطبيق</button>

        {metricsResult && (
          <div style={{ marginTop: 14 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid var(--border)', padding: '6px 8px', background: 'var(--surface-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>المنطقة</th>
                    {METRIC_DEFS.map((m) => (
                      <th key={m.key} style={{ border: '1px solid var(--border)', padding: '6px 8px', background: 'var(--surface-2)' }}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricsResult.filteredByArea.map((r) => (
                    <tr key={r.area}>
                      <td style={{ border: '1px solid var(--border)', padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.area}</td>
                      {r.counts.map((c, i) => <td key={i} style={{ border: '1px solid var(--border)', padding: '6px 8px', textAlign: 'center' }}>{c}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <th style={{ border: '1px solid var(--border)', padding: '6px 8px', background: 'var(--surface-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>الإجمالي</th>
                    {metricsResult.totals.map((t, i) => (
                      <th key={i} style={{ border: '1px solid var(--border)', padding: '6px 8px', background: 'var(--surface-2)' }}>{t}</th>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <SimpleBarChart labels={METRIC_DEFS.map((m) => m.label)} values={metricsResult.totals} color="#2563EB" />
            <button className="btn-secondary" style={{ marginTop: 0, width: '100%' }} onClick={exportMetrics} disabled={exportingMetrics}>
              {exportingMetrics ? 'جارٍ التجهيز...' : '🖨️ تصدير كـ PDF (كل منطقة + الإجمالي)'}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>🔍 البحث في البلاغات</h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['daily', 'يومي'], ['weekly', 'اسبوعي'], ['custom', 'مخصص']].map(([val, label]) => (
            <button key={val} className={`chip ${searchPeriod === val ? 'active' : ''}`} onClick={() => setSearchPeriod(val)}>{label}</button>
          ))}
        </div>
        {searchPeriod === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div className="field" style={{ marginTop: 0 }}><label>من</label><input type="date" value={searchCustomFrom} onChange={(e) => setSearchCustomFrom(e.target.value)} /></div>
            <div className="field" style={{ marginTop: 0 }}><label>إلى</label><input type="date" value={searchCustomTo} onChange={(e) => setSearchCustomTo(e.target.value)} /></div>
          </div>
        )}

        <div className="field">
          <label>المنطقة</label>
          <select value={searchArea} onChange={(e) => setSearchArea(e.target.value)}>
            <option value="">كل المناطق</option>
            {AREA_LIST.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field" style={{ marginTop: 0 }}><label>القطعة</label><input type="text" value={searchBlock} onChange={(e) => setSearchBlock(e.target.value)} placeholder="بحث بالقطعة" /></div>
          <div className="field" style={{ marginTop: 0 }}><label>الشارع</label><input type="text" value={searchStreet} onChange={(e) => setSearchStreet(e.target.value)} placeholder="بحث بالشارع" /></div>
          <div className="field" style={{ marginTop: 0 }}><label>القسيمة</label><input type="text" value={searchBuilding} onChange={(e) => setSearchBuilding(e.target.value)} placeholder="بحث بالقسيمة" /></div>
          <div className="field" style={{ marginTop: 0 }}><label>المنزل</label><input type="text" value={searchHouse} onChange={(e) => setSearchHouse(e.target.value)} placeholder="بحث بالمنزل" /></div>
          <div className="field" style={{ marginTop: 0, gridColumn: '1 / -1' }}><label>الرقم الآلي (PACI)</label><input type="text" value={searchPaci} onChange={(e) => setSearchPaci(e.target.value)} placeholder="بحث بالرقم الآلي" /></div>
        </div>

        <button className="btn-primary" onClick={runComplaintsSearch}>بحث</button>

        {searchResults !== null && (
          <div style={{ marginTop: 14 }}>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: 12.5 }}>لا توجد بلاغات مطابقة</div>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>{searchResults.length} بلاغ</div>
                {searchResults.map((r) => {
                  const d = r.data || {};
                  const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
                  return (
                    <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                      {FIELD_LABELS.map(([key, label, format]) => {
                        const val = format ? format(d[key]) : d[key];
                        if (!val) return null;
                        return (
                          <span key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{label}:</span> <b>{val}</b>
                          </span>
                        );
                      })}
                      <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{actionText}</span>
                    </div>
                  );
                })}
                <button className="btn-secondary" style={{ marginTop: 8, width: '100%' }} onClick={exportSearchResults} disabled={exportingSearch}>
                  {exportingSearch ? 'جارٍ التجهيز...' : '🖨️ تصدير النتائج كجدول PDF (طباعة / مشاركة)'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          {complaints ? `${complaints.length} بلاغ` : 'جارٍ التحميل...'}
        </div>

        {complaints && complaints.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            لا توجد بلاغات مسجّلة بعد
          </div>
        )}

        {complaints && complaints.map((r) => {
          const d = r.data || {};
          const actionText = d.action === 'أخرى' ? (d.otherAction || 'أخرى') : d.action;
          return (
            <div key={r.id} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '8px 10px', marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
            }}>
              {FIELD_LABELS.map(([key, label, format]) => {
                const val = format ? format(d[key]) : d[key];
                if (!val) return null;
                return (
                  <span key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}:</span> <b>{val}</b>
                  </span>
                );
              })}
              <span style={{ background: 'var(--complaints-bg)', color: 'var(--complaints)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
                {actionText}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setConfirmId(r.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 15, marginRight: 'auto' }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirmId && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmId(null); }}>
          <div className="modal" style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 13.5 }}>حذف هذا البلاغ؟</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-primary" style={{ marginTop: 0, background: 'var(--danger)', color: '#fff' }}
                onClick={() => handleDelete(complaints.find((r) => r.id === confirmId))}>حذف</button>
              <button className="btn-secondary" style={{ marginTop: 0 }} onClick={() => setConfirmId(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
