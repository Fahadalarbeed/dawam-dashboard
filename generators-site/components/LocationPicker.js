'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { useLang } from '../lib/i18n';

// تحديد موقع المولد على الخريطة (Pin) — الخريطة من OpenStreetMap
// value: { lat, lng } أو null
const FARWANIYA = [29.2775, 47.9585];

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function LocationPicker({ value, onChange }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="lp">
      <style>{CSS}</style>
      {value ? (
        <div className="lp-set">
          <div className="lp-coords">
            <b>{t("📍 تم تحديد الموقع")}</b>
            <span className="mono">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</span>
          </div>
          <div className="lp-actions">
            <a href={mapsUrl(value.lat, value.lng)} target="_blank" rel="noreferrer">{t("عرض")}</a>
            <button type="button" onClick={() => setOpen(true)}>{t("تعديل")}</button>
            <button type="button" className="rm" onClick={() => onChange(null)}>{t("مسح")}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="lp-open" onClick={() => setOpen(true)}>{t("🗺️ حدّد مكان المولد على الخريطة")}</button>
      )}
      {open && <MapDialog initial={value} onClose={() => setOpen(false)} onPick={(v) => { onChange(v); setOpen(false); }} />}
    </div>
  );
}

function MapDialog({ initial, onClose, onPick }) {
  const { t } = useLang();
  const box = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [pos, setPos] = useState(initial || null);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let map;
    let cancelled = false;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !box.current) return;
      map = L.map(box.current, { zoomControl: true }).setView(initial ? [initial.lat, initial.lng] : FARWANIYA, initial ? 17 : 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap',
      }).addTo(map);
      const icon = L.divIcon({ className: 'lp-pin', html: '<div></div>', iconSize: [30, 42], iconAnchor: [15, 42] });
      const place = (lat, lng) => {
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          markerRef.current.on('dragend', (e) => { const p = e.target.getLatLng(); setPos({ lat: p.lat, lng: p.lng }); });
        }
        setPos({ lat, lng });
      };
      if (initial) place(initial.lat, initial.lng);
      map.on('click', (e) => place(e.latlng.lat, e.latlng.lng));
      mapRef.current = { map, place };
      setTimeout(() => map.invalidateSize(), 50);
    });
    return () => { cancelled = true; if (map) map.remove(); markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function myLocation() {
    if (!navigator.geolocation) { setMsg(t('الجهاز ما يدعم تحديد الموقع')); return; }
    setLocating(true); setMsg('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = p.coords;
        mapRef.current?.place(lat, lng);
        mapRef.current?.map.setView([lat, lng], 18);
      },
      () => { setLocating(false); setMsg(t('ما قدرنا ناخذ موقعك — اسمح للمتصفح بالموقع أو حط الـ Pin بإيدك')); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="lp-dlg">
      <div className="lp-top">
        <b>{t("حدّد مكان المولد")}</b>
        <button type="button" className="lp-x" onClick={onClose} aria-label={t("إغلاق")}>✕</button>
      </div>
      <div className="lp-hint">{t("اضغط على الخريطة عشان تحط الـ Pin، وتقدر تسحبه لين يركب على المكان بالضبط")}</div>
      <div ref={box} className="lp-map" />
      {msg && <div className="lp-msg">{msg}</div>}
      <div className="lp-bottom">
        <button type="button" className="lp-me" onClick={myLocation} disabled={locating}>{locating ? t('... جاري التحديد') : t('📡 موقعي الحالي')}</button>
        <button type="button" className="lp-ok" disabled={!pos} onClick={() => onPick(pos)}>{t("✓ تأكيد الموقع")}</button>
      </div>
    </div>
  );
}

const CSS = `
.lp-open { width: 100%; padding: 13px; border-radius: 12px; border: 1.5px dashed var(--gold); background: #FBF6EA; color: #8A6E2E; font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; }
.lp-set { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #E6F4EA; border: 1px solid #B9DFC4; border-radius: 12px; padding: 10px 12px; }
.lp-coords { display: flex; flex-direction: column; font-size: 13px; color: #1E7B3A; }
.lp-coords span { font-size: 11.5px; color: var(--text-muted); direction: ltr; text-align: right; }
.lp-actions { display: flex; gap: 6px; }
.lp-actions a, .lp-actions button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 9px; padding: 6px 10px; font-family: 'Cairo', sans-serif; font-size: 12.5px; font-weight: 700; cursor: pointer; text-decoration: none; }
.lp-actions .rm { color: #B3261E; border-color: #E6B3AE; }
.lp-dlg { position: fixed; inset: 0; z-index: 200; background: var(--bg); display: flex; flex-direction: column; }
.lp-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 4px; font-size: 16px; }
.lp-x { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); cursor: pointer; font-size: 15px; }
.lp-hint { font-size: 12px; color: var(--text-muted); padding: 0 14px 8px; }
.lp-map { flex: 1; min-height: 0; }
.lp-msg { background: #FFF1CC; color: #8A5A00; font-size: 12.5px; padding: 8px 14px; }
.lp-bottom { display: flex; gap: 8px; padding: 10px 14px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--surface); border-top: 1px solid var(--border); }
.lp-bottom button { flex: 1; padding: 13px; border-radius: 12px; font-family: 'Cairo', sans-serif; font-size: 14.5px; font-weight: 800; cursor: pointer; }
.lp-me { border: 1px solid var(--border); background: var(--surface); color: var(--navy); }
.lp-ok { border: none; background: var(--gold); color: #fff; }
.lp-ok:disabled { opacity: .45; cursor: not-allowed; }
.lp-pin div { width: 30px; height: 30px; border-radius: 50% 50% 50% 0; background: #D0392F; transform: rotate(-45deg); border: 3px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,.35); }
.lp-pin div::after { content: ''; position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #fff; top: 7px; left: 7px; }
@media (min-width: 900px) { .lp-dlg { inset: 4vh 0; margin: 0 auto; max-width: 900px; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3); } }
`;
