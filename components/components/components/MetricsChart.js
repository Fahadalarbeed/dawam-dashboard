'use client';
import { useEffect, useRef } from 'react';
import { DAILY_METRICS } from '../lib/constants';

export default function MetricsChart({ dataList, onClose }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } = await import('chart.js');
      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
      if (cancelled || !canvasRef.current) return;

      const totals = {};
      DAILY_METRICS.forEach((m) => (totals[m.key] = 0));
      dataList.forEach((d) => {
        DAILY_METRICS.forEach((m) => { totals[m.key] += (d.metrics && d.metrics[m.key]) || 0; });
      });

      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels: DAILY_METRICS.map((m) => m.label),
          datasets: [{ label: 'الإجمالي', data: DAILY_METRICS.map((m) => totals[m.key]), backgroundColor: '#2563EB', borderRadius: 6 }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { family: 'Cairo', size: 10 } } },
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
    }
    draw();
    return () => { cancelled = true; if (chartRef.current) chartRef.current.destroy(); };
  }, [dataList]);

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>إجمالي كل مؤشر خلال الفترة المحددة</span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}>✕</button>
        )}
      </div>
      <canvas ref={canvasRef} height={220}></canvas>
    </div>
  );
}
