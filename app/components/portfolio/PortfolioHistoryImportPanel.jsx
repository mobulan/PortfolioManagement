'use client';

import { ClipboardCheck, RefreshCw, Upload } from 'lucide-react';

const importTypes = [
  ['portfolios', 'Portfolios'],
  ['portfolioHoldings', 'Holdings'],
  ['portfolioTransactions', 'Transactions'],
  ['portfolioPrincipalRecords', 'Principal'],
  ['portfolioSnapshots', 'Snapshots'],
  ['portfolioBacktests', 'Backtests'],
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
  snapshotAutoEnabled = false,
  onSnapshotAutoEnabledChange,
}) {
  const sortedSnapshots = [...snapshots].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const latest = sortedSnapshots[0];
  const earliest = sortedSnapshots.at(-1);
  const valueChange = latest && earliest ? Number(latest.totalValue || 0) - Number(earliest.totalValue || 0) : 0;
  const valueChangeRate = earliest && Number(earliest.totalValue) > 0 ? valueChange / Number(earliest.totalValue) : 0;

  return (
    <section className="portfolio-panel glass">
      <h3>Snapshots and JSON import</h3>
      <div className="portfolio-form">
        <div className="portfolio-inline-form">
          <button type="button" className="button secondary" onClick={onRecordSnapshot}>
            <RefreshCw size={16} />
            Record today snapshot
          </button>
          <label className="muted">
            <input
              type="checkbox"
              checked={snapshotAutoEnabled}
              onChange={(event) => onSnapshotAutoEnabledChange?.(event.target.checked)}
            />
            Auto daily snapshot
          </label>
        </div>
        <div className="portfolio-summary-grid">
          <Metric label="Snapshots" value={sortedSnapshots.length} />
          <Metric label="Value change" value={`¥${money(valueChange)}`} tone={valueChange >= 0 ? 'up' : 'down'} />
          <Metric label="Return" value={percent(valueChangeRate)} tone={valueChangeRate >= 0 ? 'up' : 'down'} />
        </div>
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Total value</th>
                <th>Principal</th>
                <th>Profit</th>
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
                  <td colSpan={4}>No snapshots yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <textarea
          className="portfolio-textarea"
          value={importText}
          onChange={(event) => onImportTextChange?.(event.target.value)}
          placeholder="Paste portfolio JSON, analyze it, then apply valid records."
        />
        <div className="portfolio-inline-form">
          <button type="button" className="button secondary" onClick={onAnalyze}>
            <ClipboardCheck size={16} />
            Analyze JSON
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={onApplyImport}
            disabled={!analysis || (analysis.counts?.portfolios?.valid || 0) === 0}
          >
            <Upload size={16} />
            Apply valid records
          </button>
        </div>
        {analysis && (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Valid</th>
                  <th>Dropped</th>
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
