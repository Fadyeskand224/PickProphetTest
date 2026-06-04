'use client';
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { GameRow, StatConfig } from '@/types';

Chart.register(...registerables);

interface Props {
  gameData: GameRow[];
  cfg: StatConfig;
  propLine: number | null;
}

export default function StatChart({ gameData, cfg, propLine }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !gameData.length) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = gameData.map(g => {
      const opp = g.opponent.length > 12 ? g.opponent.slice(0, 11) + '…' : g.opponent;
      return opp + '\n' + g.date;
    });

    const values = gameData.map(g => {
      const v = g.stats[cfg.primaryStat];
      return v !== null && v !== undefined ? v : 0;
    });

    const colors = values.map(v =>
      propLine !== null ? (v >= propLine ? '#3dff8f' : '#5ba3ff') : '#5ba3ff'
    );

    const datasets: Chart['data']['datasets'] = [
      {
        type: 'bar',
        label: cfg.primaryLabel,
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      } as unknown as Chart['data']['datasets'][0],
    ];

    if (propLine !== null) {
      datasets.push({
        type: 'line',
        label: 'Prop Line',
        data: Array(values.length).fill(propLine),
        borderColor: '#ff4d4d',
        borderDash: [6, 3],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      } as unknown as Chart['data']['datasets'][0]);
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => gameData[items[0].dataIndex]?.opponent || '',
              label: (item) => `${item.dataset.label}: ${item.raw}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#555', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#555', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.08)' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [gameData, cfg, propLine]);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px' }}>
      <canvas ref={canvasRef} height={200} />
    </div>
  );
}
