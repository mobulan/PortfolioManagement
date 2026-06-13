'use client';

import { useMemo } from 'react';

const DEFAULT_TABS = [
  { id: 'overview', label: '总览' },
  { id: 'holdings', label: '持仓' },
  { id: 'transactions', label: '交易' },
  { id: 'rebalance', label: '再平衡' },
  { id: 'history', label: '历史' },
  { id: 'backtest', label: '回测' }
];

const formatPercent = (value) => `${((Number(value) || 0) * 100).toFixed(2)}%`;

function normalizeError(error, index) {
  if (!error) return null;
  if (typeof error === 'string') return { id: `error-${index}`, message: error };
  if (typeof error === 'object') {
    return {
      id: error.id || error.code || `error-${index}`,
      message: error.message || error.label || String(error.code || '校验失败')
    };
  }
  return { id: `error-${index}`, message: String(error) };
}

export default function PortfolioDetailTabs({
  value = 'overview',
  onChange,
  tabs = DEFAULT_TABS,
  allocationTotal = 0,
  errors = []
}) {
  const normalizedTabs = useMemo(() => {
    const sourceTabs = Array.isArray(tabs) && tabs.length ? tabs : DEFAULT_TABS;
    return sourceTabs.filter((tab) => tab?.id && tab?.label);
  }, [tabs]);

  const normalizedErrors = useMemo(
    () => (Array.isArray(errors) ? errors : [errors]).map(normalizeError).filter(Boolean),
    [errors]
  );

  const total = Number(allocationTotal) || 0;
  const allocationDelta = total - 1;
  const hasAllocationWarning = Math.abs(allocationDelta) > 0.0001;
  const allocationMessage = allocationDelta > 0 ? '目标比例超过 100%' : '目标比例未满 100%';

  return (
    <section className="portfolio-detail-tabs" aria-label="组合详情导航">
      <div className="portfolio-detail-tab-scroll">
        <div className="portfolio-detail-tab-list" role="tablist" aria-label="组合详情">
          {normalizedTabs.map((tab) => {
            const isActive = tab.id === value;
            return (
              <button
                key={tab.id}
                type="button"
                className={`portfolio-detail-tab ${isActive ? 'is-active' : ''}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`portfolio-detail-panel-${tab.id}`}
                onClick={() => onChange?.(tab.id)}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count !== null && Number.isFinite(Number(tab.count)) && (
                  <strong className="portfolio-detail-tab-count">{Number(tab.count)}</strong>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="portfolio-detail-validation" aria-live="polite">
        <div className={`portfolio-detail-allocation ${hasAllocationWarning ? 'is-warning' : 'is-ok'}`}>
          <span>目标比例合计</span>
          <strong>{formatPercent(total)}</strong>
          {hasAllocationWarning && <em>{allocationMessage}</em>}
        </div>

        {normalizedErrors.length > 0 && (
          <div className="portfolio-detail-errors" role="alert">
            <span>校验提示</span>
            <ul>
              {normalizedErrors.map((error) => (
                <li key={error.id}>{error.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
