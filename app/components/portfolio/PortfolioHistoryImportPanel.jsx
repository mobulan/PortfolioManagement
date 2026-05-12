'use client';

import { ClipboardCheck, RefreshCw, Upload } from 'lucide-react';

const importTypes = [
  ['portfolios', '组合'],
  ['portfolioHoldings', '持仓'],
  ['portfolioTransactions', '交易'],
  ['portfolioPrincipalRecords', '本金'],
  ['portfolioSnapshots', '快照'],
  ['portfolioBacktests', '回测'],
];

const money = (value) => Number(value || 0).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;

export default function PortfolioHistoryImportPanel({
  snapshots = [],
  importText = '',
  onImportTextChange,
  onAnalyze,
  analysis,
  onApplyImport,
  onRecordSnapshot,
}) {
  const sortedSnapshots = [...snapshots].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const latest = sortedSnapshots[0];
  const earliest = sortedSnapshots.at(-1);
  const valueChange = latest && earliest ? Number(latest.totalValue || 0) - Number(earliest.totalValue || 0) : 0;
  const valueChangeRate = earliest && Number(earliest.totalValue) > 0 ? valueChange / Number(earliest.totalValue) : 0;

  return (
    <section className="portfolio-panel glass">
      <h3>快照与导入预览</h3>
      <div className="portfolio-form">
        <button type="button" className="button secondary" onClick={onRecordSnapshot}>
          <RefreshCw size={16} />
          记录今日快照
        </button>
        <div className="portfolio-summary-grid">
          <Metric label="快照数" value={sortedSnapshots.length} />
          <Metric label="区间变化" value={`¥${money(valueChange)}`} tone={valueChange >= 0 ? 'up' : 'down'} />
          <Metric label="区间收益" value={percent(valueChangeRate)} tone={valueChangeRate >= 0 ? 'up' : 'down'} />
        </div>
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>总资产</th>
                <th>本金</th>
                <th>收益</th>
              </tr>
            </thead>
            <tbody>
              {sortedSnapshots.length ? sortedSnapshots.map((snapshot) => (
                <tr key={snapshot.id || `${snapshot.portfolioId}-${snapshot.date}`}>
                  <td>{snapshot.date || '-'}</td>
                  <td>¥{money(snapshot.totalValue)}</td>
                  <td>¥{money(snapshot.totalPrincipal)}</td>
                  <td>¥{money(snapshot.totalProfit)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4}>暂无快照</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <textarea
          className="portfolio-textarea"
          value={importText}
          onChange={(event) => onImportTextChange?.(event.target.value)}
          placeholder="粘贴组合 JSON 后先分析，再确认导入"
        />
        <div className="portfolio-inline-form">
          <button type="button" className="button secondary" onClick={onAnalyze}>
            <ClipboardCheck size={16} />
            分析导入
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={onApplyImport}
            disabled={!analysis || (analysis.counts?.portfolios?.valid || 0) === 0}
          >
            <Upload size={16} />
            应用有效记录
          </button>
        </div>
        {analysis && (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>有效</th>
                  <th>丢弃</th>
                </tr>
              </thead>
              <tbody>
                {importTypes.map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{analysis.counts?.[key]?.valid || 0}</td>
                    <td>{analysis.counts?.[key]?.dropped || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(analysis.errors || []).length > 0 && (
              <ul className="portfolio-import-errors">
                {analysis.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
              </ul>
            )}
          </div>
        )}
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
