'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Activity, Download, Plus, Search, Trash2, Play, Save } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';

import { fetchFundHistory, searchFunds } from '@/app/api/fund';
import { ASSET_CLASSES, normalizePortfolioFundCandidate } from '@/app/lib/portfolio';
import {
  buildBenchmarkComparison,
  buildWeightedPortfolioBacktest,
  calculateRiskMetrics
} from '@/app/lib/portfolio/backtest';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const percent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
const number = (value) => Number(value || 0).toFixed(2);

const getDefaultAssets = (portfolio, holdings) => {
  const fundHoldings = (Array.isArray(holdings) ? holdings : []).filter(
    (holding) =>
      holding.portfolioId === portfolio?.id &&
      !holding.archived &&
      holding.instrumentType === 'fund' &&
      holding.fundCode
  );
  const countByClass = fundHoldings.reduce((map, holding) => {
    map.set(holding.assetClassId, (map.get(holding.assetClassId) || 0) + 1);
    return map;
  }, new Map());
  return fundHoldings.map((holding) => {
    const target = portfolio?.targetAllocations?.find((row) => row.assetClassId === holding.assetClassId);
    const count = countByClass.get(holding.assetClassId) || 1;
    return {
      fundCode: holding.fundCode,
      fundName: holding.fundName || holding.fundCode,
      assetClassId: holding.assetClassId,
      weight: ((Number(target?.targetRatio) || 1 / Math.max(1, fundHoldings.length)) / count) * 100
    };
  });
};

export default function PortfolioBacktestPanel({
  portfolio,
  holdings = [],
  portfolioBacktests = [],
  setPortfolioBacktests
}) {
  const portfolioId = portfolio?.id || '';
  const savedBacktests = useMemo(
    () => portfolioBacktests.filter((row) => row.portfolioId === portfolioId),
    [portfolioBacktests, portfolioId]
  );
  const [assets, setAssets] = useState(() => getDefaultAssets(portfolio, holdings));
  const [reportName, setReportName] = useState(`${portfolio?.name || '投资组合'}回测`);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateResults, setCandidateResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [initialCapital, setInitialCapital] = useState('100000');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rebalanceType, setRebalanceType] = useState('none');
  const [rebalanceThreshold, setRebalanceThreshold] = useState('5');
  const [benchmarkCode, setBenchmarkCode] = useState('');
  const [benchmarkName, setBenchmarkName] = useState('比较基准');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setAssets(getDefaultAssets(portfolio, holdings));
    setReportName(`${portfolio?.name || '投资组合'}回测`);
    setResult(null);
    setStatus('');
  }, [holdings, portfolio]);

  const metrics = result?.metrics || calculateRiskMetrics([]);
  const totalWeight = assets.reduce((sum, asset) => sum + Number(asset.weight || 0), 0);
  const validWeight = Math.abs(totalWeight - 100) < 0.01;

  const searchCandidates = async () => {
    const query = candidateQuery.trim();
    if (query.length < 2) return;
    setIsSearching(true);
    try {
      const rows = await searchFunds(query);
      setCandidateResults((Array.isArray(rows) ? rows : []).map(normalizePortfolioFundCandidate).filter(Boolean));
    } finally {
      setIsSearching(false);
    }
  };

  const addCandidate = (fund) => {
    if (!fund?.code || assets.some((row) => row.fundCode === fund.code)) return;
    setAssets((current) => [
      ...current,
      {
        fundCode: fund.code,
        fundName: fund.name || fund.code,
        assetClassId: 'equity',
        weight: 0
      }
    ]);
    setCandidateQuery('');
    setCandidateResults([]);
  };

  const runBacktest = async () => {
    if (!assets.length || !validWeight) {
      setStatus('当前组合没有可回测的基金代码。现金和手动资产暂不参与净值回测。');
      return;
    }
    setIsRunning(true);
    setStatus('正在拉取基金历史净值...');
    try {
      const historyEntries = await Promise.all(
        assets.map(async (asset) => [asset.fundCode, await fetchFundHistory(asset.fundCode, 'all')])
      );
      const portfolioResult = buildWeightedPortfolioBacktest({
        assets,
        histories: Object.fromEntries(historyEntries),
        initialCapital: Number(initialCapital || 0),
        startDate,
        endDate,
        rebalanceRule: {
          type: rebalanceType,
          threshold: Number(rebalanceThreshold || 0) / 100
        }
      });
      const benchmarkHistory = benchmarkCode.trim() ? await fetchFundHistory(benchmarkCode.trim(), 'all') : [];
      const benchmark = benchmarkCode.trim()
        ? buildBenchmarkComparison({
            portfolioSeries: portfolioResult.series,
            benchmarkHistory,
            initialCapital: Number(initialCapital || 0)
          })
        : null;
      const next = { ...portfolioResult, benchmark };
      setResult(next);
      setStatus(
        next.series.length
          ? `回测完成，共 ${next.series.length} 个共同净值日期。`
          : `无法生成回测。缺少共同历史数据：${next.missingFundCodes.join('、') || '日期区间不足'}`
      );
    } catch (error) {
      setResult(null);
      setStatus(`历史净值加载失败：${error?.message || '未知错误'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const saveBacktest = () => {
    if (!portfolioId || !result?.series?.length || typeof setPortfolioBacktests !== 'function') return;
    const now = new Date().toISOString();
    const record = {
      id: `backtest-${portfolioId}-${Date.now()}`,
      portfolioId,
      name: reportName.trim() || `${portfolio?.name || '投资组合'}回测`,
      date: now.slice(0, 10),
      source: 'fund_history',
      config: {
        assets,
        initialCapital: Number(initialCapital || 0),
        startDate,
        endDate,
        rebalanceRule: {
          type: rebalanceType,
          threshold: Number(rebalanceThreshold || 0) / 100
        },
        benchmarkCode: benchmarkCode.trim(),
        benchmarkName: benchmarkName.trim()
      },
      series: result.series,
      assetSeries: result.assetSeries,
      correlation: result.correlation,
      contributions: result.contributions,
      riskContributions: result.riskContributions,
      rollingVolatility: result.rollingVolatility,
      benchmark: result.benchmark,
      metrics: result.metrics,
      createdAt: now
    };
    setPortfolioBacktests((prev = []) => [record, ...prev]);
    setStatus('回测报告已保存。');
  };

  const downloadBacktest = () => {
    if (!result?.series?.length || typeof document === 'undefined') return;
    const report = {
      name: reportName.trim() || `${portfolio?.name || '投资组合'}回测`,
      generatedAt: new Date().toISOString(),
      config: {
        assets,
        initialCapital: Number(initialCapital || 0),
        startDate,
        endDate,
        rebalanceRule: {
          type: rebalanceType,
          threshold: Number(rebalanceThreshold || 0) / 100
        },
        benchmarkCode: benchmarkCode.trim(),
        benchmarkName: benchmarkName.trim()
      },
      result
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `portfolio-backtest-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const drawdownValues = (() => {
    let peak = 0;
    return (result?.series || []).map((row) => {
      peak = Math.max(peak, Number(row.value) || 0);
      return peak > 0 ? ((Number(row.value) || 0) / peak - 1) * 100 : 0;
    });
  })();

  const chartData = {
    labels: result?.series?.map((row) => row.date) || [],
    datasets: [
      {
        label: '组合净值',
        data: result?.series?.map((row) => row.value) || [],
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.12)',
        fill: true,
        tension: 0.25,
        pointRadius: 0
      },
      ...(result?.benchmark?.series?.length
        ? [
            {
              label: benchmarkName.trim() || benchmarkCode.trim() || '比较基准',
              data: (() => {
                const values = new Map(result.benchmark.series.map((row) => [row.date, row.value]));
                return result.series.map((row) => values.get(row.date) ?? null);
              })(),
              borderColor: '#f59e0b',
              borderDash: [6, 4],
              tension: 0.25,
              pointRadius: 0
            }
          ]
        : [])
    ]
  };

  return (
    <section className="portfolio-panel glass">
      <div className="portfolio-panel-header">
        <div>
          <h3>基金历史净值回测</h3>
          <p className="portfolio-panel-intro">
            按共同净值日期模拟组合，可设置定期或阈值再平衡，并与任意基金基准比较。
          </p>
        </div>
      </div>
      <div className="portfolio-form">
        <div className="portfolio-backtest-candidate-search">
          <label className="portfolio-field">
            <span>回测名称</span>
            <input className="input" value={reportName} onChange={(event) => setReportName(event.target.value)} />
          </label>
          <div className="portfolio-field">
            <span>搜索候选基金</span>
            <div className="portfolio-inline-form">
              <input
                className="input"
                value={candidateQuery}
                onChange={(event) => setCandidateQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    searchCandidates();
                  }
                }}
                placeholder="基金代码或名称"
              />
              <button type="button" className="button secondary" onClick={searchCandidates} disabled={isSearching}>
                <Search size={16} />
                {isSearching ? '搜索中' : '搜索'}
              </button>
            </div>
            {candidateResults.length > 0 && (
              <div className="portfolio-fund-suggestions">
                {candidateResults.slice(0, 8).map((fund) => (
                  <button key={fund.code} type="button" onClick={() => addCandidate(fund)}>
                    <strong>{fund.code}</strong>
                    <span>{fund.name}</span>
                    <Plus size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {assets.length ? (
          <div className="portfolio-backtest-assets">
            {assets.map((asset, index) => (
              <div key={`${asset.fundCode}-${index}`} className="portfolio-backtest-asset">
                <span>
                  <strong>{asset.fundName}</strong>
                  <small>{asset.fundCode}</small>
                </span>
                <label>
                  权重
                  <input
                    className="input"
                    inputMode="decimal"
                    value={asset.weight}
                    onChange={(event) =>
                      setAssets((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, weight: event.target.value } : row
                        )
                      )
                    }
                  />
                  %
                </label>
                <select
                  className="select"
                  value={asset.assetClassId || 'other'}
                  onChange={(event) =>
                    setAssets((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, assetClassId: event.target.value } : row
                      )
                    )
                  }
                  aria-label={`${asset.fundName}资产类别`}
                >
                  {ASSET_CLASSES.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setAssets((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label={`删除${asset.fundName}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="portfolio-empty-hint">
            <strong>没有可回测基金</strong>
            <span>请先在持仓中添加带基金代码的基金或 ETF。</span>
          </div>
        )}
        <div className="portfolio-backtest-config">
          <label className="portfolio-field">
            <span>初始资金</span>
            <input
              className="input"
              inputMode="decimal"
              value={initialCapital}
              onChange={(event) => setInitialCapital(event.target.value)}
            />
          </label>
          <label className="portfolio-field">
            <span>起始日期</span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="portfolio-field">
            <span>结束日期</span>
            <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="portfolio-field">
            <span>再平衡频率</span>
            <select className="select" value={rebalanceType} onChange={(event) => setRebalanceType(event.target.value)}>
              <option value="none">不再平衡</option>
              <option value="monthly">月度</option>
              <option value="quarterly">季度</option>
              <option value="yearly">年度</option>
              <option value="threshold">偏离阈值</option>
            </select>
          </label>
          {rebalanceType === 'threshold' && (
            <label className="portfolio-field">
              <span>偏离阈值（%）</span>
              <input
                className="input"
                inputMode="decimal"
                value={rebalanceThreshold}
                onChange={(event) => setRebalanceThreshold(event.target.value)}
              />
            </label>
          )}
          <label className="portfolio-field">
            <span>基准基金代码（可选）</span>
            <input
              className="input"
              value={benchmarkCode}
              onChange={(event) => setBenchmarkCode(event.target.value)}
              placeholder="例如 000300"
            />
          </label>
          {benchmarkCode.trim() && (
            <label className="portfolio-field">
              <span>基准名称</span>
              <input
                className="input"
                value={benchmarkName}
                onChange={(event) => setBenchmarkName(event.target.value)}
              />
            </label>
          )}
        </div>
        <div className="portfolio-inline-form">
          <button
            type="button"
            className="button secondary"
            onClick={runBacktest}
            disabled={isRunning || !assets.length || !validWeight}
          >
            <Play size={16} />
            {isRunning ? '回测中...' : '运行回测'}
          </button>
          <span className={validWeight ? 'muted' : 'portfolio-form-warning'}>
            当前权重合计 {totalWeight.toFixed(2)}%，必须等于 100%。
          </span>
        </div>
        {status && <div className="portfolio-help-strip">{status}</div>}
        <div className="portfolio-summary-grid">
          <Metric
            label="累计收益"
            value={percent(metrics.cumulativeReturn)}
            tone={metrics.cumulativeReturn >= 0 ? 'up' : 'down'}
          />
          <Metric
            label="年化收益"
            value={percent(metrics.annualizedReturn)}
            tone={metrics.annualizedReturn >= 0 ? 'up' : 'down'}
          />
          <Metric label="波动率" value={percent(metrics.volatility)} />
          <Metric label="夏普" value={number(metrics.sharpe)} />
          <Metric label="最大回撤" value={percent(metrics.maxDrawdown)} tone={metrics.maxDrawdown < 0 ? 'down' : ''} />
          <Metric label="Calmar" value={number(metrics.calmar)} />
          <Metric label="上涨胜率" value={percent(metrics.winRate)} />
          <Metric label="最长回撤期" value={`${metrics.longestRecoveryPeriods || 0} 个净值周期`} />
          {result?.benchmark?.series?.length > 1 && (
            <>
              <Metric
                label="超额收益"
                value={percent(result.benchmark.excessReturn)}
                tone={result.benchmark.excessReturn >= 0 ? 'up' : 'down'}
              />
              <Metric label="跟踪误差" value={percent(result.benchmark.trackingError)} />
              <Metric label="信息比率" value={number(result.benchmark.informationRatio)} />
              <Metric label="Alpha" value={percent(result.benchmark.alpha)} />
              <Metric label="Beta" value={number(result.benchmark.beta)} />
            </>
          )}
        </div>
        {result?.series?.length > 1 && (
          <div className="portfolio-backtest-chart-grid">
            <div className="portfolio-backtest-chart">
              <Line data={chartData} options={chartOptions()} />
            </div>
            <div className="portfolio-backtest-chart">
              <Line
                data={{
                  labels: result.series.map((row) => row.date),
                  datasets: [
                    {
                      label: '组合回撤',
                      data: drawdownValues,
                      borderColor: '#34d399',
                      backgroundColor: 'rgba(52, 211, 153, 0.12)',
                      fill: true,
                      tension: 0.25,
                      pointRadius: 0
                    }
                  ]
                }}
                options={chartOptions(true)}
              />
            </div>
          </div>
        )}
        {result?.correlation?.length > 1 && <CorrelationTable rows={result.correlation} />}
        {result?.rollingVolatility?.[20]?.length > 1 && (
          <div className="portfolio-backtest-chart">
            <Line
              data={{
                labels: result.rollingVolatility[20].map((row) => row.date),
                datasets: [
                  {
                    label: '20 日滚动波动率',
                    data: result.rollingVolatility[20].map((row) => row.value * 100),
                    borderColor: '#a78bfa',
                    tension: 0.25,
                    pointRadius: 0
                  },
                  {
                    label: '60 日滚动波动率',
                    data: result.rollingVolatility[60].map((row) => row.value * 100),
                    borderColor: '#60a5fa',
                    tension: 0.25,
                    pointRadius: 0
                  }
                ]
              }}
              options={chartOptions(true)}
            />
          </div>
        )}
        {result?.contributions?.length > 0 && (
          <div className="portfolio-backtest-analysis-grid">
            <div className="portfolio-backtest-chart">
              <Bar
                data={{
                  labels: result.contributions.map((row) => row.fundName),
                  datasets: [
                    {
                      label: '收益贡献',
                      data: result.contributions.map((row) => row.profit),
                      backgroundColor: result.contributions.map((row) =>
                        row.profit >= 0 ? 'rgba(248, 113, 113, 0.78)' : 'rgba(52, 211, 153, 0.78)'
                      ),
                      borderRadius: 5
                    }
                  ]
                }}
                options={chartOptions()}
              />
            </div>
            <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>基金</th>
                    <th>权重</th>
                    <th>收益贡献</th>
                    <th>区间收益率</th>
                  </tr>
                </thead>
                <tbody>
                  {result.contributions.map((row) => (
                    <tr key={row.fundCode}>
                      <td>{row.fundName}</td>
                      <td>{percent(row.weight)}</td>
                      <td>{number(row.profit)}</td>
                      <td>{percent(row.returnRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {result?.riskContributions?.length > 0 && (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>基金</th>
                  <th>风险贡献</th>
                </tr>
              </thead>
              <tbody>
                {result.riskContributions.map((row) => (
                  <tr key={row.fundCode}>
                    <td>{row.fundName}</td>
                    <td>{percent(row.contributionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="portfolio-inline-form">
          <span className="muted">
            <Activity size={16} />
            样本收益点：{metrics.sampleSize || 0}
          </span>
          <button
            type="button"
            className="button secondary"
            onClick={saveBacktest}
            disabled={!portfolioId || !result?.series?.length}
          >
            <Save size={16} />
            保存回测报告
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={downloadBacktest}
            disabled={!result?.series?.length}
          >
            <Download size={16} />
            下载报告
          </button>
        </div>
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>名称</th>
                <th>数据来源</th>
                <th>累计收益</th>
                <th>年化收益</th>
                <th>最大回撤</th>
              </tr>
            </thead>
            <tbody>
              {savedBacktests.length ? (
                savedBacktests.slice(0, 6).map((row) => (
                  <tr key={row.id}>
                    <td>{row.date || '-'}</td>
                    <td>{row.name || '组合回测'}</td>
                    <td>{row.source === 'fund_history' ? '基金历史净值' : '手工序列'}</td>
                    <td>{percent(row.metrics?.cumulativeReturn)}</td>
                    <td>{percent(row.metrics?.annualizedReturn)}</td>
                    <td>{percent(row.metrics?.maxDrawdown)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>暂无已保存回测</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CorrelationTable({ rows }) {
  return (
    <div className="portfolio-table-wrap">
      <table className="portfolio-table portfolio-correlation-table">
        <thead>
          <tr>
            <th>相关性</th>
            {rows.map((row) => (
              <th key={row.fundCode}>{row.fundName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.fundCode}>
              <td>{row.fundName}</td>
              {row.values.map((cell) => (
                <td
                  key={cell.fundCode}
                  style={{
                    background: `color-mix(in srgb, ${cell.value >= 0 ? '#f87171' : '#34d399'} ${Math.round(
                      Math.min(1, Math.abs(cell.value)) * 34
                    )}%, transparent)`
                  }}
                >
                  {number(cell.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function chartOptions(percentAxis = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { labels: { color: '#94a3b8' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 7, maxRotation: 0 } },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        ticks: {
          color: '#94a3b8',
          callback: percentAxis ? (value) => `${value}%` : undefined
        }
      }
    }
  };
}

function Metric({ label, value, tone }) {
  return (
    <div className="portfolio-metric is-compact">
      <span>{label}</span>
      <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
  );
}
