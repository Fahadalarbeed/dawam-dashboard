'use client';
import { useMemo, useState } from 'react';
import { MATERIAL_GROUPS, MATERIAL_BY_ID, ITEM_COLOR, TYPE_AR, TYPE_SWATCH, unitOf } from '../lib/materials';

// اختيار المواد — يُستخدم داخل قسم التشغيل
// value / onChange: مصفوفة [{ itemId, type, qty, unit }]
// unit: 'pcs' لكل المواد، و 'm' | 'cm' | 'mm' للكيبلات والأسلاك

const ICONS_CSS = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css';

const LEN_UNITS = [
  { k: 'm', label: 'متر', en: 'Meter', short: 'م', shortEn: 'm', step: 1, bg: '#E1EEFB', fg: '#2A70C4' },
  { k: 'cm', label: 'سنتي', en: 'Centimeter', short: 'سم', shortEn: 'cm', step: 10, bg: '#DDF3EC', fg: '#13896A' },
  { k: 'mm', label: 'مللي', en: 'Millimeter', short: 'مم', shortEn: 'mm', step: 10, bg: '#ECE8FD', fg: '#6A5AD6' },
];
const UNIT_INFO = {
  pcs: { label: 'حبة', short: 'حبة', shortEn: 'pcs', step: 1 },
  len: { label: 'أطوال', short: '', shortEn: '', step: 1 },
  ...Object.fromEntries(LEN_UNITS.map((u) => [u.k, u])),
};

function isLength(item) { return unitOf(item) === 'متر'; }
function lineKey(itemId, type) { return `${itemId}|${type}`; }
function iconStyle(item) {
  const c = ITEM_COLOR[item.id];
  return c ? { background: c.bg, color: c.fg } : undefined;
}
export function unitLabel(unit) {
  const u = UNIT_INFO[unit] || UNIT_INFO.pcs;
  return `${u.short} / ${u.shortEn}`;
}
function En({ children, style }) {
  return <span className="en-sub" style={style}>{children}</span>;
}

export default function MaterialsPicker({ value = [], onChange, readOnly = false }) {
  const [showAll, setShowAll] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [askKey, setAskKey] = useState('');
  const [unitPick, setUnitPick] = useState({});

  const cart = useMemo(() => {
    const m = {};
    for (const l of value) m[lineKey(l.itemId, l.type)] = l;
    return m;
  }, [value]);
  const emit = (next) => onChange && onChange(Object.values(next));

  const qtyOf = (itemId, type) => cart[lineKey(itemId, type)]?.qty || 0;

  function unitFor(item) {
    if (!isLength(item)) return 'pcs';
    if (unitPick[item.id]) return unitPick[item.id];
    const line = value.find((l) => l.itemId === item.id && UNIT_INFO[l.unit] && l.unit !== 'pcs');
    return line ? line.unit : 'len';
  }
  function setUnit(item, unit) {
    setUnitPick((p) => ({ ...p, [item.id]: unit }));
    const next = { ...cart };
    for (const [k, l] of Object.entries(next)) if (l.itemId === item.id) next[k] = { ...l, unit };
    emit(next);
  }
  function setQty(item, type, qty) {
    const unit = unitFor(item);
    if (unit === 'len') return;
    const n = Math.max(0, Math.floor(Number(qty) || 0));
    const next = { ...cart };
    const k = lineKey(item.id, type);
    if (n <= 0) delete next[k];
    else next[k] = { itemId: item.id, type, qty: n, unit };
    emit(next);
  }
  function countOf(item) { return value.filter((l) => l.itemId === item.id).length; }
  const itemTypes = (item) => (item.askText ? value.filter((l) => l.itemId === item.id).map((l) => l.type) : item.types);

  function jumpTo(key) {
    const el = document.getElementById(`mp-grp-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      <link rel="stylesheet" href={ICONS_CSS} />
      <style>{CSS}</style>

      {/* المواد المختارة */}
      {value.length === 0 && <div className="mp-empty">لا توجد مواد بعد<En>No materials yet</En></div>}
      {MATERIAL_GROUPS.map((g) => {
        const gl = value.filter((l) => g.items.some((it) => it.id === l.itemId));
        if (!gl.length) return null;
        return (
          <div key={g.key}>
            <div className="sum-group">{g.title} · {g.titleEn}</div>
            {gl.map((l) => {
              const item = MATERIAL_BY_ID[l.itemId];
              if (!item) return null;
              return (
                <div key={lineKey(l.itemId, l.type)} className="sum-row">
                  <span className="mat-icon mp-row-icon" style={iconStyle(item)}><i className={`ti ti-${item.icon}`} aria-hidden="true" /></span>
                  {TYPE_SWATCH[l.type] && <span className="swatch sm" style={{ background: TYPE_SWATCH[l.type] }} aria-hidden="true" />}
                  <button className="sum-main" disabled={readOnly} onClick={() => { setAskKey(''); setOpenItem(item); }} style={readOnly ? { cursor: 'default' } : undefined}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{item.label}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', direction: 'ltr' }}>{l.type}{TYPE_AR[l.type] ? ` — ${TYPE_AR[l.type]}` : ''}</span>
                    <En>{item.en}</En>
                  </button>
                  <span className="sum-qty"><b className="mono">{l.qty}</b> {unitLabel(l.unit)}</span>
                  {!readOnly && (
                    <button className="sum-x" onClick={() => setQty(item, l.type, 0)} aria-label="حذف"><i className="ti ti-x" /></button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {!readOnly && (
        <button className="mp-add" onClick={() => setShowAll(true)}>
          <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 18 }} />
          <span>إضافة مواد<En>Add materials</En></span>
        </button>
      )}

      {/* كل المواد */}
      {showAll && (
        <div className="sheet-overlay mp-overlay" onClick={() => setShowAll(false)}>
          <div className="sheet mp-big" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sheet-grip" />
            <div style={{ fontWeight: 800, fontSize: 17 }}>اختر المادة<En>Pick a material</En></div>
            <nav className="grp-tabs">
              {MATERIAL_GROUPS.map((g) => (
                <button key={g.key} className="grp-tab" onClick={() => jumpTo(g.key)}>{g.short}<En>{g.shortEn}</En></button>
              ))}
            </nav>
            {MATERIAL_GROUPS.map((group) => (
              <section key={group.key} id={`mp-grp-${group.key}`} className="grp">
                <h2 className="grp-title"><span className="grp-dot" style={{ background: group.color?.fg }} />{group.title}<En style={{ display: 'inline', fontSize: 12 }}>{group.titleEn}</En></h2>
                <div className="mat-grid">
                  {group.items.map((item) => {
                    const n = countOf(item);
                    return (
                      <button key={item.id} className={`mat-card${n ? ' has' : ''}`} onClick={() => { setAskKey(''); setOpenItem(item); }}>
                        <span className="mat-icon" style={iconStyle(item)}><i className={`ti ti-${item.icon}`} aria-hidden="true" /></span>
                        <span className="mat-name">{item.label}</span>
                        <span className="mat-en">{item.en}</span>
                        <span className="mat-foot">
                          {n
                            ? <span className="mat-picked">{n} مختار / selected</span>
                            : <span className="mat-hint">{item.askText ? 'بإدخال رقم / Enter no.' : item.types.length === 1 ? item.types[0] : `${item.types.length} أنواع / types`}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <div className="mp-done">
              <button className="btn-primary" style={{ marginTop: 0, padding: 14, fontSize: 14 }} onClick={() => setShowAll(false)}>تم / Done ({value.length})</button>
            </div>
          </div>
        </div>
      )}

      {/* أنواع المادة */}
      {openItem && (
        <div className="sheet-overlay mp-overlay top" onClick={() => setOpenItem(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sheet-grip" />
            <div className="sheet-head">
              <span className="mat-icon" style={iconStyle(openItem)}><i className={`ti ti-${openItem.icon}`} aria-hidden="true" /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{openItem.label}</div>
                <En>{openItem.en}</En>
              </div>
            </div>

            {isLength(openItem) && (
              <>
                <div className="len-units">
                  {LEN_UNITS.map((u) => {
                    const on = unitFor(openItem) === u.k;
                    return (
                      <button key={u.k} className={`len-btn${on ? ' on' : ''}`} style={{ '--u-bg': u.bg, '--u-fg': u.fg }} onClick={() => setUnit(openItem, u.k)} aria-pressed={on}>
                        <i className={`ti ti-${on ? 'circle-check' : 'circle'}`} aria-hidden="true" />
                        <span className="len-name">{u.label}</span>
                        <span className="len-en">{u.en}</span>
                        <span className="len-short">{u.short} · {u.shortEn}</span>
                      </button>
                    );
                  })}
                </div>
                {unitFor(openItem) === 'len' && <div className="len-hint">اختر الوحدة: متر أو سنتي أو مللي<En style={{ color: 'inherit', textAlign: 'center' }}>Choose a unit: m, cm or mm</En></div>}
              </>
            )}

            {openItem.askText && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input type="text" placeholder={openItem.askText} value={askKey} onChange={(e) => setAskKey(e.target.value)} />
                <button className="add-key" disabled={!askKey.trim()} onClick={() => { setQty(openItem, askKey.trim(), qtyOf(openItem.id, askKey.trim()) + 1); setAskKey(''); }}>إضافة / Add</button>
              </div>
            )}

            <div className={`type-list${unitFor(openItem) === 'len' ? ' locked' : ''}`}>
              {itemTypes(openItem).map((t) => (
                <TypeRow key={t} type={t} qty={qtyOf(openItem.id, t)} unit={unitFor(openItem)} onChange={(q) => setQty(openItem, t, q)} />
              ))}
            </div>

            <button className="btn-primary" style={{ padding: 14, fontSize: 14 }} onClick={() => setOpenItem(null)}>تم / Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeRow({ type, qty, unit, onChange }) {
  const info = UNIT_INFO[unit] || UNIT_INFO.pcs;
  const short = info.short ? `${info.short} · ${info.shortEn}` : '';
  return (
    <div className={`type-row${qty ? ' has' : ''}`}>
      {TYPE_SWATCH[type] && <span className="swatch" style={{ background: TYPE_SWATCH[type] }} aria-hidden="true" />}
      <span className="type-name mono">
        {type}
        {TYPE_AR[type] && <small className="type-ar">{TYPE_AR[type]}</small>}
        <small className="type-unit" style={info.fg ? { color: info.fg, fontWeight: 700 } : undefined}>{short}</small>
      </span>
      <div className="stepper">
        <button onClick={() => onChange(qty + info.step)} aria-label="زيادة"><i className="ti ti-plus" /></button>
        <input className="mono" type="number" inputMode="numeric" min="0" value={qty || ''} placeholder="0" onChange={(e) => onChange(e.target.value)} />
        <button onClick={() => onChange(Math.max(0, qty - info.step))} disabled={!qty} aria-label="إنقاص"><i className="ti ti-minus" /></button>
      </div>
    </div>
  );
}

const CSS = `
.grp-tabs {
  position: sticky; top: 0; z-index: 20; display: flex; gap: 6px; overflow-x: auto;
  margin: 0 -16px 8px; padding: 10px 16px; background: var(--bg);
  border-bottom: 1px solid var(--border); scrollbar-width: none;
}
.grp-tabs::-webkit-scrollbar { display: none; }
.grp-tab {
  flex-shrink: 0; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--border);
  background: transparent; color: var(--text-muted); font-family: 'Cairo', sans-serif;
  font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.grp-tab.active { background: var(--gold); border-color: var(--gold); color: var(--navy); }

.grp { scroll-margin-top: 64px; padding-top: 14px; }
.grp-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; margin: 0 2px 10px; color: var(--text); }
.grp-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

.mat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (min-width: 640px) { .mat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.mat-card {
  box-shadow: var(--shadow);
  display: flex; flex-direction: column; align-items: flex-start; text-align: right;
  gap: 2px; padding: 14px; min-height: 132px; border-radius: 16px;
  background: var(--surface); border: 1.5px solid var(--border);
  color: var(--text); font-family: 'Cairo', sans-serif; cursor: pointer;
  transition: border-color .2s, transform .12s;
}
.mat-card:active { transform: scale(.98); }
.mat-card:focus-visible { outline: none; border-color: var(--gold); }
.mat-card.has { border-color: var(--gold); background: var(--faults-bg); }
.mat-icon {
  width: 50px; height: 50px; border-radius: 16px; flex-shrink: 0; margin-bottom: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-2); color: var(--gold); font-size: 27px;
  transition: transform .2s cubic-bezier(.3,1.6,.5,1);
}
.mat-icon .ti { stroke-width: 1.6; }
.mat-card:active .mat-icon { transform: scale(.9) rotate(-6deg); }
.mat-card.has .mat-icon { transform: rotate(-6deg); }
@media (prefers-reduced-motion: reduce) { .mat-icon { transition: none; } .mat-card.has .mat-icon { transform: none; } }
.mat-name { font-size: 14.5px; font-weight: 700; line-height: 1.3; }
.mat-en { font-size: 11px; color: var(--text-muted); direction: ltr; }
.mat-foot { margin-top: auto; padding-top: 8px; width: 100%; }
.mat-hint { font-size: 11.5px; color: var(--text-muted); }
.mat-picked {
  display: block; font-size: 11.5px; font-weight: 600; color: var(--gold);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: ltr; text-align: right;
}

.mat-bar {
  position: fixed; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%);
  width: calc(100% - 32px); max-width: 520px; z-index: 50;
  display: flex; align-items: center; gap: 10px; padding: 15px 18px;
  border-radius: 16px; border: none; cursor: pointer;
  background: var(--gold); color: var(--navy);
  font-family: 'Cairo', sans-serif; font-weight: 700; font-size: 14.5px;
  box-shadow: 0 8px 24px rgba(22,35,63,.25);
}
.mat-bar-count { background: var(--navy); color: var(--gold); border-radius: 999px; padding: 1px 10px; font-size: 12.5px; }

.sheet-overlay {
  position: fixed; inset: 0; z-index: 200; background: rgba(22,35,63,.45);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  width: 100%; max-width: 560px; max-height: 88vh; overflow-y: auto;
  background: var(--surface); border: 1px solid var(--border); border-bottom: none;
  border-radius: 22px 22px 0 0; padding: 10px 18px calc(20px + env(safe-area-inset-bottom, 0px));
  animation: sheetUp .22s ease-out;
}
@keyframes sheetUp { from { transform: translateY(40px); opacity: .5; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .sheet { animation: none; } }
.sheet-grip { width: 42px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
.sheet-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.sheet-head .mat-icon { margin-bottom: 0; }
.en-sub { display: block; font-size: 10.5px; font-weight: 500; color: var(--text-muted); direction: ltr; font-family: 'Cairo', sans-serif; letter-spacing: .1px; }
.grp-tab .en-sub { font-size: 9.5px; color: inherit; opacity: .75; text-align: center; }
.grp-tab { display: flex; flex-direction: column; align-items: center; line-height: 1.25; }
.seg-tab .en-sub { text-align: center; }
.len-en { font-size: 10.5px; opacity: .85; }
.type-ar { display: block; font-family: 'Cairo', sans-serif; font-size: 12px; font-weight: 600; color: var(--text); }
.swatch {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  border: 3px solid #fff; box-shadow: 0 0 0 1px var(--border), 0 2px 5px rgba(22,35,63,.18);
}
.swatch.sm { width: 20px; height: 20px; border-width: 2px; }
.len-units { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.len-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 4px;
  border-radius: 14px; border: 1.5px solid transparent; background: var(--u-bg);
  color: var(--u-fg); font-family: 'Cairo', sans-serif; cursor: pointer;
  transition: border-color .15s, background .15s, transform .12s;
}
.len-btn .ti { font-size: 18px; }
.len-btn:active { transform: scale(.96); }
.len-btn.on { border-color: var(--u-fg); background: var(--u-fg); color: #fff; box-shadow: 0 4px 12px color-mix(in srgb, var(--u-fg) 35%, transparent); }
.len-name { font-size: 13.5px; font-weight: 700; }
.len-short { font-size: 11px; opacity: .85; }
.len-hint { text-align: center; font-size: 12px; color: var(--gold); font-weight: 600; margin: -4px 0 12px; }
.type-list.locked { opacity: .35; pointer-events: none; }
.type-unit { display: block; font-family: 'Cairo', sans-serif; font-size: 10.5px; font-weight: 500; color: var(--text-muted); }
.unit-pill { font-size: 11.5px; color: var(--text-muted); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }

.type-list { display: flex; flex-direction: column; gap: 8px; }
.type-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 12px;
  padding-inline-start: 14px; border-radius: 14px;
  background: var(--surface-2); border: 1.5px solid transparent;
}
.type-row.has { border-color: var(--gold); background: var(--faults-bg); }
.type-name { flex: 1; font-size: 15px; font-weight: 600; direction: ltr; text-align: right; }
.stepper { display: flex; align-items: center; gap: 4px; }
.stepper button {
  width: 42px; height: 42px; border-radius: 11px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.stepper button:active { transform: scale(.94); }
.stepper button:disabled { opacity: .35; cursor: default; }
.type-row.has .stepper button:first-child { background: var(--gold); border-color: var(--gold); color: var(--navy); }
.stepper input {
  width: 54px; height: 42px; padding: 0; text-align: center; font-size: 18px; font-weight: 600;
  border-radius: 11px; -moz-appearance: textfield;
}
.stepper input::-webkit-outer-spin-button, .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.add-key {
  flex-shrink: 0; padding: 0 18px; border-radius: 11px; border: none; background: var(--gold);
  color: var(--navy); font-family: 'Cairo', sans-serif; font-weight: 700; cursor: pointer;
}
.add-key:disabled { opacity: .45; }

.sum-group { font-size: 12px; color: var(--text-muted); font-weight: 700; margin: 16px 0 4px; }
.sum-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.sum-main {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start;
  background: transparent; border: none; padding: 0; cursor: pointer; color: var(--text);
  font-family: 'Cairo', sans-serif; text-align: right;
}
.sum-qty { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
.sum-qty b { font-size: 17px; color: var(--gold); }
.sum-x {
  width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
  background: transparent; color: var(--text-muted); cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}

.mp-overlay { z-index: 200; }
.mp-overlay.top { z-index: 210; }
.mp-big { max-height: 92vh; }
.mp-big .grp-tabs { margin: 0 -18px 4px; padding: 10px 18px; top: -10px; background: var(--surface); }
.mp-big .grp { scroll-margin-top: 70px; }
.mp-big .mat-card { background: var(--bg); box-shadow: none; }
.mp-big .mat-card.has { background: var(--faults-bg); }
.mp-done { position: sticky; bottom: calc(-20px - env(safe-area-inset-bottom, 0px)); margin: 14px -18px calc(-20px - env(safe-area-inset-bottom, 0px)); padding: 12px 18px calc(16px + env(safe-area-inset-bottom, 0px)); background: var(--surface); border-top: 1px solid var(--border); }
.mp-add {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; margin-top: 10px; border-radius: 14px; cursor: pointer;
  border: 1.5px dashed var(--gold); background: var(--faults-bg); color: var(--gold);
  font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: 700; line-height: 1.2;
}
.mp-add .en-sub { color: inherit; opacity: .8; }
.mp-empty { font-size: 12.5px; color: var(--text-muted); padding: 6px 0; }
.mp-row-icon { width: 34px; height: 34px; border-radius: 10px; font-size: 18px; margin: 0; }
`;
