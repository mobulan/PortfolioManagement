'use client';

import { useMemo, useState } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

import { buildPortfolioHistorySeries } from '@/app/lib/portfolio';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const chartModes = [
  { id: 'assets', label: '资产走势' },
  { id: 'return', label: '收益与回撤' },
  { id: 'classReturn', label: '分类收益' },
  { id: 'allocation', label: '资产占比' },
  { id: 'daily', label: '每日盈亏' },
  { id: 'calendar', label: '收益日历' }
];

const classColors = ['#22d3ee', '#60a5fa', '#f59e0b', '#a78bfa', '#94a3b8', '#fb7185'];

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 10, boxHeight: 10, color: '#94a3b8', usePointStyle: true }
    },
    tooltip: { usePointStyle: true }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', maxTicksLimit: 7, maxRotation: 0 }
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.12)' },
      ticks: { color: '#94a3b8' }
    }
  }
};

export default function PortfolioHistoryCharts({ snapshots = [], transactions = [] }) {
  const [mode, setMode] = useState('assets');
  const series = useMemo(() => buildPortfolioHistorySeries(snapshots, transactions), [snapshots, transactions]);

  if (series.labels.length < 2) {
    return (
      <div className="portfolio-empty-hint">
        <strong>至少需要 2 条快照才能绘制趋势</strong>
        <span>记录今日快照或导入历史数据后，这里会展示资产、收益和配置变化。</span>
      </div>
    );
  }

  const content = getChartContent(mode, series);

  return (
    <div className="portfolio-history-charts">
      <div className="portfolio-chart-tabs" role="tablist" aria-label="历史图表">
        {chartModes.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={mode === item.id ? 'is-active' : ''}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={content.type === 'calendar' ? 'portfolio-profit-calendar-wrap' : 'portfolio-chart-canvas'}>
        {content.type === 'calendar' ? (
          <ProfitCalendar rows={series.dailyProfitRows} />
        ) : content.type === 'bar' ? (
          <Bar data={content.data} options={content.options} />
        ) : (
          <Line data={content.data} options={content.options} />
        )}
      </div>
    </div>
  );
}

function getChartContent(mode, series) {
  if (mode === 'calendar') return { type: 'calendar' };

  if (mode === 'classReturn') {
    return {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: series.assetClasses.map((assetClass, index) => ({
          label: assetClass.name,
          data: assetClass.returnRates.map((value) => value * 100),
          borderColor: classColors[index % classColors.length],
          tension: 0.28,
          pointRadius: 2
        }))
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            ticks: { ...commonOptions.scales.y.ticks, callback: (value) => `${value}%` }
          }
        }
      }
    };
  }

  if (mode === 'return') {
    return {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [
          {
            label: '累计收益率',
            data: series.totalReturnRates.map((value) => value * 100),
            borderColor: '#f87171',
            backgroundColor: 'rgba(248, 113, 113, 0.12)',
            fill: true,
            tension: 0.28,
            pointRadius: 2
          },
          {
            label: '回撤',
            data: series.drawdowns.map((value) => value * 100),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
            tension: 0.28,
            pointRadius: 2
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            ticks: { ...commonOptions.scales.y.ticks, callback: (value) => `${value}%` }
          }
        }
      }
    };
  }

  if (mode === 'allocation') {
    return {
      type: 'bar',
      data: {
        labels: series.labels,
        datasets: series.assetClasses.map((assetClass, index) => ({
          label: assetClass.name,
          data: assetClass.ratios.map((value) => value * 100),
          backgroundColor: classColors[index % classColors.length],
          borderWidth: 0
        }))
      },
      options: {
        ...commonOptions,
        scales: {
          x: { ...commonOptions.scales.x, stacked: true },
          y: {
            ...commonOptions.scales.y,
            stacked: true,
            min: 0,
            max: 100,
            ticks: { ...commonOptions.scales.y.ticks, callback: (value) => `${value}%` }
          }
        }
      }
    };
  }

  if (mode === 'daily') {
    return {
      type: 'bar',
      data: {
        labels: series.labels,
        datasets: [
          {
            label: '每日盈亏',
            data: series.dailyProfits,
            backgroundColor: series.dailyProfits.map((value) =>
              value >= 0 ? 'rgba(248, 113, 113, 0.78)' : 'rgba(52, 211, 153, 0.78)'
            ),
            borderRadius: 4
          }
        ]
      },
      options: commonOptions
    };
  }

  return {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: '总资产',
          data: series.totalValues,
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.12)',
          fill: true,
          tension: 0.28,
          pointRadius: 2
        },
        {
          label: '总本金',
          data: series.totalPrincipals,
          borderColor: '#94a3b8',
          borderDash: [6, 4],
          stepped: true,
          pointRadius: 2
        },
        {
          label: '交易节点',
          data: series.transactionEvents.map((event) => ({ x: event.date, y: event.value, event })),
          showLine: false,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      ...commonOptions,
      plugins: {
        ...commonOptions.plugins,
        tooltip: {
          ...commonOptions.plugins.tooltip,
          callbacks: {
            afterLabel: (context) => {
              const event = context.raw?.event;
              return event ? `${event.type} ${event.amount.toFixed(2)}${event.note ? ` · ${event.note}` : ''}` : '';
            }
          }
        }
      }
    }
  };
}

function ProfitCalendar({ rows = [] }) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row.value) || 0)));
  return (
    <div className="portfolio-profit-calendar" role="list" aria-label="每日收益热力日历">
      {rows.map((row) => {
        const value = Number(row.value) || 0;
        const intensity = Math.max(12, Math.round((Math.abs(value) / max) * 80));
        return (
          <div
            key={row.date}
            role="listitem"
            className={value >= 0 ? 'is-up' : 'is-down'}
            style={{ '--profit-intensity': `${intensity}%` }}
            title={`${row.date} ${value >= 0 ? '+' : ''}${value.toFixed(2)}`}
          >
            <span>{row.date.slice(5)}</span>
            <strong>
              {value >= 0 ? '+' : ''}
              {value.toFixed(0)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
