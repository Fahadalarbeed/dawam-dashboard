'use client';
import { useEffect, useState } from 'react';
import { SHIFT_TEAM_INFO, SHIFT_PERIODS, getTeamForDate, getCurrentPeriodIndex } from '../lib/constants';

export default function ShiftLeadCard() {
  const [info, setInfo] = useState({ period: SHIFT_PERIODS[0], teamLetter: '—', name: '—', phone: '' });

  useEffect(() => {
    function update() {
      const now = new Date();
      const periodIdx = getCurrentPeriodIndex(now);
      const period = SHIFT_PERIODS[periodIdx];
      const teamLetter = getTeamForDate(now, periodIdx);
      const teamInfo = SHIFT_TEAM_INFO[teamLetter] || { name: '—', phone: '' };
      setInfo({ period, teamLetter, name: teamInfo.name, phone: teamInfo.phone });
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--transactions-bg), var(--daily-bg))',
      border: '1px solid var(--transactions)', borderRadius: 14, padding: '14px 18px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{info.period.icon}</span>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>النوبة الحالية</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--transactions)' }}>{info.period.label}</div>
        </div>
      </div>
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', minHeight: 36 }} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>مسؤول النوبة (فريق {info.teamLetter})</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{info.name}</div>
        <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{info.phone}</div>
      </div>
    </div>
  );
        }
