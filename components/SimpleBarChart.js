'use client';
import { useEffect, useRef } from 'react';

export default function SimpleBarChart({ labels, values, color = '#2563EB', title }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } = await import('chart.js');
      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
      if (cancelled || !canvasRef.current) return;

      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'العدد', data: values, backgroundColor: color, borderRadius: 6 }],
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
  }, [labels, values, color]);

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      {title && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>{title}</div>}
      <canvas ref={canvasRef} height={220}></canvas>
    </div>
  );
}
