'use client';

import { useState } from 'react';
import { ClipboardCheck, History, RefreshCw, RotateCcw, Upload } from 'lucide-react';

import PortfolioHistoryCharts from './PortfolioHistoryCharts';

const importTypes = [
  ['portfolios', '组合'],
  ['portfolioHoldings', '持仓'],
  ['portfolioTransactions', '交易'],
  ['portfolioPrincipalRecords', '本金记录'],
  ['portfolioSnapshots', '快照'],
  ['portfolioBacktests', '回测']
];

const money = (value) =>
  Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const percent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;

export default function PortfolioHistoryImportPanel({
  snapshots = [],
  transactions = [],
  importText = '',
  onImportTextChange,
  onAnalyze,
  analysis,
  onApplyImport,
  onRecordSnapshot,
  snapshotVersions = [],
  onRestoreSnapshotVersion,
  snapshotAutoEnabled = false,
  onSnapshotAutoEnabledChange
}) {
  const [snapshotNote, setSnapshotNote] = useState('');
  const sortedSnapshots = [...snapshots].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const latest = sortedSnapshots[0];
  const earliest = sortedSnapshots.at(-1);
  const valueChange = latest && earliest ? Number(latest.totalValue || 0) - Number(earliest.totalValue || 0) : 0;
  const valueChangeRate = earliest && Number(earliest.totalValue) > 0 ? valueChange / Number(earliest.totalValue) : 0;

  return (
    <section className="portfolio-panel glass">
      <h3>快照与 JSON 导入</h3>
      <div className="portfolio-form">
        <div className="portfolio-inline-form">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              onRecordSnapshot?.(snapshotNote);
              setSnapshotNote('');
            }}
          >
            <RefreshCw size={16} />
            记录今日快照
          </button>
          <label className="muted">
            <input
              type="checkbox"
              checked={snapshotAutoEnabled}
              onChange={(event) => onSnapshotAutoEnabledChange?.(event.target.checked)}
            />
            自动每日快照
          </label>
        </div>
        <input
          className="input"
          value={snapshotNote}
          onChange={(event) => setSnapshotNote(event.target.value)}
          placeholder="快照备注，例如：季度再平衡后"
        />
        <div className="portfolio-summary-grid">
          <Metric label="快照数" value={sortedSnapshots.length} />
          <Metric label="资产变化" value={`¥${money(valueChange)}`} tone={valueChange >= 0 ? 'up' : 'down'} />
          <Metric label="收益率" value={percent(valueChangeRate)} tone={valueChangeRate >= 0 ? 'up' : 'down'} />
        </div>
        <PortfolioHistoryCharts snapshots={sortedSnapshots} transactions={transactions} />
        {snapshotVersions.length > 0 && (
          <details className="portfolio-snapshot-versions">
            <summary>
              <History size={16} />
              已覆盖版本（{snapshotVersions.length}）
            </summary>
            <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>快照日期</th>
                    <th>覆盖时间</th>
                    <th>原市值</th>
                    <th>原备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotVersions.map((version) => (
                    <tr key={version.id}>
                      <td>{version.date}</td>
                      <td>{version.replacedAt ? new Date(version.replacedAt).toLocaleString('zh-CN') : '-'}</td>
                      <td>¥{money(version.snapshot?.totalValue)}</td>
                      <td>{version.snapshot?.note || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => onRestoreSnapshotVersion?.(version)}
                        >
                          <RotateCcw size={15} />
                          恢复
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>总市值</th>
                <th>本金</th>
                <th>收益</th>
                <th>来源</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {sortedSnapshots.length ? (
                sortedSnapshots.map((snapshot) => (
                  <tr key={snapshot.id || `${snapshot.portfolioId}-${snapshot.date}`}>
                    <td>{snapshot.date || '-'}</td>
                    <td>¥{money(snapshot.totalValue)}</td>
                    <td>¥{money(snapshot.totalPrincipal)}</td>
                    <td>¥{money(snapshot.totalProfit)}</td>
                    <td>{snapshot.source === 'auto' ? '自动' : snapshot.source === 'import' ? '导入' : '手动'}</td>
                    <td>{snapshot.note || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>暂无快照。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <textarea
          className="portfolio-textarea"
          value={importText}
          onChange={(event) => onImportTextChange?.(event.target.value)}
          placeholder="粘贴组合 JSON，先分析，再应用有效记录。"
        />
        <div className="portfolio-inline-form">
          <button type="button" className="button secondary" onClick={onAnalyze}>
            <ClipboardCheck size={16} />
            分析 JSON
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
                  <th>已丢弃</th>
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
                {analysis.errors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
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
