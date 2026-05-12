'use client';

import { useMemo, useState } from 'react';
import { Activity, Save } from 'lucide-react';

import { calculateRiskMetrics } from '@/app/lib/portfolio/backtest';

const defaultSeriesText = JSON.stringify([
  { date: '2026-05-10', value: 100000 },
  { date: '2026-05-11', value: 100800 },
  { date: '2026-05-12', value: 100300 },
], null, 2);

const percent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
const number = (value) => Number(value || 0).toFixed(2);

export default function PortfolioBacktestPanel({
  portfolioId = '',
  portfolioBacktests = [],
  setPortfolioBacktests,
}) {
  const savedBacktests = useMemo(
    () => portfolioBacktests.filter((row) => row.portfolioId === portfolioId),
    [portfolioBacktests, portfolioId],
  );
  const [seriesText, setSeriesText] = useState(defaultSeriesText);

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(seriesText || '[]');
      if (!Array.isArray(value)) return { series: [], error: 'JSON 顶层需要是数组' };
      return { series: value, error: '' };
    } catch (error) {
      return { series: [], error: error.message };
    }
  }, [seriesText]);

  const metrics = useMemo(() => calculateRiskMetrics(parsed.series), [parsed.series]);

  const saveBacktest = () => {
    if (!portfolioId || parsed.error || !parsed.series.length || typeof setPortfolioBacktests !== 'function') return;
    const now = new Date().toISOString();
    const record = {
      id: `backtest-${portfolioId}-${Date.now()}`,
      portfolioId,
      date: now.slice(0, 10),
      source: 'manual_value_series',
      series: parsed.series,
      metrics,
      createdAt: now,
    };
    setPortfolioBacktests((prev = []) => [record, ...prev]);
  };

  return (
    <section className="portfolio-panel glass">
      <h3>回测指标</h3>
      <div className="portfolio-form">
        <textarea
          className="portfolio-textarea"
          value={seriesText}
          onChange={(event) => setSeriesText(event.target.value)}
          placeholder='[{"date":"2026-05-12","value":100000}]'
        />
        <div className="portfolio-summary-grid">
          <Metric label="年化收益" value={percent(metrics.annualizedReturn)} tone={metrics.annualizedReturn >= 0 ? 'up' : 'down'} />
          <Metric label="波动率" value={percent(metrics.volatility)} />
          <Metric label="夏普" value={number(metrics.sharpe)} />
          <Metric label="最大回撤" value={percent(metrics.maxDrawdown)} tone={metrics.maxDrawdown < 0 ? 'down' : ''} />
        </div>
        <div className="portfolio-inline-form">
          <span className="muted">
            <Activity size={16} />
            样本收益点：{metrics.sampleSize}
          </span>
          <button
            type="button"
            className="button secondary"
            onClick={saveBacktest}
            disabled={!portfolioId || !!parsed.error || !parsed.series.length}
          >
            <Save size={16} />
            保存回测
          </button>
          {parsed.error && <span className="muted">解析失败：{parsed.error}</span>}
        </div>
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>年化收益</th>
                <th>波动率</th>
                <th>最大回撤</th>
              </tr>
            </thead>
            <tbody>
              {savedBacktests.length ? savedBacktests.slice(0, 6).map((row) => (
                <tr key={row.id}>
                  <td>{row.date || '-'}</td>
                  <td>{percent(row.metrics?.annualizedReturn)}</td>
                  <td>{percent(row.metrics?.volatility)}</td>
                  <td>{percent(row.metrics?.maxDrawdown)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4}>暂无已保存回测</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="portfolio-metric is-compact">
      <span>{label}</span>
      <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
  );
}
