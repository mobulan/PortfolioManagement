'use client';

import { useMemo, useState } from 'react';
import { Plus, Save, WalletCards } from 'lucide-react';
import {
  ASSET_CLASSES,
  createDefaultPortfolio,
  normalizePortfolioHolding,
  calculatePortfolioSummary,
  aggregateDashboard,
  calculateRebalancePlan,
  calculateSmartCashPlan,
  applyPortfolioTransaction,
  createPortfolioSnapshot,
  exportPortfolioData,
  analyzePortfolioImport,
  previewLegacyHoldingsMigration,
} from '@/app/lib/portfolio';
import PortfolioBacktestPanel from './PortfolioBacktestPanel';
import PortfolioDetailTabs from './PortfolioDetailTabs';
import PortfolioEditorPanel from './PortfolioEditorPanel';
import PortfolioHistoryImportPanel from './PortfolioHistoryImportPanel';
import PortfolioMigrationPanel from './PortfolioMigrationPanel';
import PortfolioTransactionsPanel from './PortfolioTransactionsPanel';

const money = (value) => Number(value || 0).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = (value) => `${((Number(value) || 0) * 100).toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);

export default function PortfolioWorkspace({
  funds = [],
  legacyHoldings = {},
  portfolios = [],
  setPortfolios,
  portfolioHoldings = [],
  setPortfolioHoldings,
  portfolioTransactions = [],
  setPortfolioTransactions,
  portfolioPrincipalRecords = [],
  setPortfolioPrincipalRecords,
  portfolioSnapshots = [],
  setPortfolioSnapshots,
  portfolioBacktests = [],
  setPortfolioBacktests,
  portfolioSettings = {},
  setPortfolioSettings,
  portfolioSchemaVersion = 1,
  setPortfolioSchemaVersion,
}) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(portfolios[0]?.id || '');
  const [holdingDraft, setHoldingDraft] = useState({
    assetClassId: 'equity',
    fundCode: '',
    fundName: '',
    instrumentType: 'fund',
    share: '',
    costAmount: '',
    estimatedNav: '',
    manualValue: '',
  });
  const [transactionDraft, setTransactionDraft] = useState({
    type: 'buy',
    holdingId: '',
    amount: '',
    share: '',
    price: '',
    fee: '',
    date: today(),
  });
  const [cashflowAmount, setCashflowAmount] = useState('');
  const [importText, setImportText] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [importAnalysis, setImportAnalysis] = useState(null);

  const selectedPortfolio = useMemo(
    () => portfolios.find((row) => row.id === selectedPortfolioId) || portfolios[0] || null,
    [portfolios, selectedPortfolioId],
  );
  const dashboard = useMemo(() => aggregateDashboard(portfolios, portfolioHoldings), [portfolios, portfolioHoldings]);
  const selectedSummary = useMemo(
    () => selectedPortfolio ? calculatePortfolioSummary(selectedPortfolio, portfolioHoldings) : null,
    [selectedPortfolio, portfolioHoldings],
  );
  const rebalancePlan = useMemo(
    () => selectedPortfolio ? calculateRebalancePlan(selectedPortfolio, portfolioHoldings) : null,
    [selectedPortfolio, portfolioHoldings],
  );
  const smartCashPlan = useMemo(
    () => selectedPortfolio ? calculateSmartCashPlan(selectedPortfolio, portfolioHoldings, Number(cashflowAmount || 0)) : null,
    [selectedPortfolio, portfolioHoldings, cashflowAmount],
  );
  const selectedHoldings = useMemo(
    () => portfolioHoldings.filter((holding) => holding.portfolioId === selectedPortfolio?.id && !holding.archived),
    [portfolioHoldings, selectedPortfolio?.id],
  );
  const selectedSnapshots = useMemo(
    () => portfolioSnapshots.filter((snapshot) => snapshot.portfolioId === selectedPortfolio?.id),
    [portfolioSnapshots, selectedPortfolio?.id],
  );
  const allocationTotal = useMemo(
    () => (selectedPortfolio?.targetAllocations || []).reduce((sum, row) => sum + Number(row.targetRatio || 0), 0),
    [selectedPortfolio],
  );
  const validationErrors = useMemo(() => {
    const errors = [];
    if (!selectedPortfolio) errors.push('请先创建或选择一个组合');
    if (selectedPortfolio && Math.abs(allocationTotal - 1) > 0.0001) errors.push('目标比例合计需要等于 100%');
    if (transactionDraft.holdingId && !portfolioHoldings.some((holding) => holding.id === transactionDraft.holdingId)) {
      errors.push('当前交易选择的持仓不存在');
    }
    return errors;
  }, [allocationTotal, portfolioHoldings, selectedPortfolio, transactionDraft.holdingId]);
  const detailTabs = useMemo(() => ([
    { id: 'overview', label: '总览' },
    { id: 'holdings', label: '持仓', count: selectedHoldings.length },
    { id: 'transactions', label: '交易', count: portfolioTransactions.filter((tx) => tx.portfolioId === selectedPortfolio?.id).length },
    { id: 'rebalance', label: '再平衡' },
    { id: 'history', label: '历史', count: selectedSnapshots.length },
    { id: 'backtest', label: '回测' },
  ]), [portfolioTransactions, selectedHoldings.length, selectedPortfolio?.id, selectedSnapshots.length]);
  const legacyMigrationPreview = useMemo(
    () => previewLegacyHoldingsMigration({
      funds,
      holdings: legacyHoldings,
      existingPortfolioHoldings: portfolioHoldings,
      portfolioId: selectedPortfolio?.id,
    }),
    [funds, legacyHoldings, portfolioHoldings, selectedPortfolio?.id],
  );

  const ensureDefaultPortfolio = () => {
    const portfolio = createDefaultPortfolio('permanent', { name: '我的基金组合' });
    setPortfolios([portfolio]);
    setSelectedPortfolioId(portfolio.id);
  };

  const addPortfolio = (type = 'custom') => {
    const portfolio = createDefaultPortfolio(type, {
      name: type === 'permanent' ? '永久投资组合' : type === 'all_weather' ? '全天候组合' : `自定义组合 ${portfolios.length + 1}`,
    });
    setPortfolios((prev) => [...prev, portfolio]);
    setSelectedPortfolioId(portfolio.id);
  };

  const addHolding = () => {
    if (!selectedPortfolio) return;
    const fund = funds.find((row) => String(row.code) === String(holdingDraft.fundCode).trim());
    const estimatedNav = holdingDraft.instrumentType === 'cash'
      ? null
      : Number(holdingDraft.estimatedNav || fund?.gsz || fund?.dwjz || 0);
    const manualValue = holdingDraft.instrumentType === 'cash'
      ? Number(holdingDraft.manualValue || holdingDraft.costAmount || 0)
      : null;
    const holding = normalizePortfolioHolding({
      portfolioId: selectedPortfolio.id,
      assetClassId: holdingDraft.assetClassId,
      instrumentType: holdingDraft.instrumentType,
      fundCode: holdingDraft.instrumentType === 'cash' ? '' : String(holdingDraft.fundCode).trim(),
      fundName: holdingDraft.fundName || fund?.name || (holdingDraft.instrumentType === 'cash' ? '现金' : String(holdingDraft.fundCode).trim()),
      share: Number(holdingDraft.share || (holdingDraft.instrumentType === 'cash' ? 1 : 0)),
      costAmount: Number(holdingDraft.costAmount || manualValue || 0),
      estimatedNav,
      currentNav: Number(fund?.dwjz || estimatedNav || 0) || null,
      previousNav: Number(fund?.dwjz || 0) || null,
      manualValue,
    });
    setPortfolioHoldings((prev) => [...prev, holding]);
    setHoldingDraft({
      assetClassId: 'equity',
      fundCode: '',
      fundName: '',
      instrumentType: 'fund',
      share: '',
      costAmount: '',
      estimatedNav: '',
      manualValue: '',
    });
  };

  const recordTransaction = () => {
    if (!selectedPortfolio || !transactionDraft.holdingId) return;
    const holding = portfolioHoldings.find((row) => row.id === transactionDraft.holdingId);
    const result = applyPortfolioTransaction({
      holdings: portfolioHoldings,
      principalRecords: portfolioPrincipalRecords,
      transaction: {
        ...transactionDraft,
        portfolioId: selectedPortfolio.id,
        holdingId: transactionDraft.holdingId,
        assetClassId: holding?.assetClassId || 'other',
        fundCode: holding?.fundCode || '',
        amount: Number(transactionDraft.amount || 0),
        share: Number(transactionDraft.share || 0),
        price: Number(transactionDraft.price || 0),
        fee: Number(transactionDraft.fee || 0),
      },
    });
    setPortfolioHoldings(result.holdings);
    setPortfolioTransactions((prev) => [...prev, result.transaction]);
    setPortfolioPrincipalRecords(result.principalRecords);
    setTransactionDraft({ type: 'buy', holdingId: '', amount: '', share: '', price: '', fee: '', date: today() });
  };

  const recordSnapshot = () => {
    if (!selectedPortfolio) return;
    const snapshot = createPortfolioSnapshot({
      portfolio: selectedPortfolio,
      holdings: portfolioHoldings,
      date: today(),
      source: 'manual',
    });
    setPortfolioSnapshots((prev) => {
      const next = prev.filter((row) => !(row.portfolioId === snapshot.portfolioId && row.date === snapshot.date));
      return [...next, snapshot].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const exportJson = () => {
    const text = exportPortfolioData({
      portfolios,
      portfolioHoldings,
      portfolioTransactions,
      portfolioPrincipalRecords,
      portfolioSnapshots,
      portfolioBacktests,
      portfolioSettings,
      portfolioSchemaVersion,
    });
    setImportText(text);
  };

  const analyzeImport = () => {
    setImportAnalysis(analyzePortfolioImport(importText));
  };

  const applyAnalyzedImport = () => {
    if (!importAnalysis?.normalized) return;
    const parsed = importAnalysis.normalized;
    if (!parsed.portfolios?.length) return;
    setPortfolios(parsed.portfolios || []);
    setPortfolioHoldings(parsed.portfolioHoldings || []);
    setPortfolioTransactions(parsed.portfolioTransactions || []);
    setPortfolioPrincipalRecords(parsed.portfolioPrincipalRecords || []);
    setPortfolioSnapshots(parsed.portfolioSnapshots || []);
    setPortfolioBacktests(parsed.portfolioBacktests || []);
    setPortfolioSettings(parsed.portfolioSettings || {});
    setPortfolioSchemaVersion?.(parsed.portfolioSchemaVersion || 1);
    setSelectedPortfolioId(parsed.portfolios?.[0]?.id || '');
  };

  const runLegacyMigration = () => {
    if (!selectedPortfolio || !legacyMigrationPreview.holdings?.length) return;
    setPortfolioHoldings((prev) => [...prev, ...legacyMigrationPreview.holdings]);
  };

  const savePortfolio = (nextPortfolio) => {
    setPortfolios((prev) => prev.map((row) => (row.id === nextPortfolio.id ? nextPortfolio : row)));
  };

  const archivePortfolio = (_portfolioId, archivedPortfolio) => {
    savePortfolio(archivedPortfolio);
  };

  const createPortfolioFromEditor = (nextPortfolio) => {
    setPortfolios((prev) => [...prev, nextPortfolio]);
    setSelectedPortfolioId(nextPortfolio.id);
  };

  if (!portfolios.length) {
    return (
      <section className="portfolio-workspace">
        <div className="portfolio-empty glass">
          <WalletCards size={36} />
          <h2>投资组合</h2>
          <p>创建一个默认永久组合，开始统一管理基金、黄金、债券和现金。</p>
          <button type="button" className="button" onClick={ensureDefaultPortfolio}>
            <Plus size={16} />
            创建我的基金组合
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="portfolio-workspace">
      <div className="portfolio-toolbar glass">
        <div>
          <span className="muted">PortfolioManagement</span>
          <h2>投资组合</h2>
        </div>
        <div className="portfolio-toolbar-actions">
          <select className="select" value={selectedPortfolio?.id || ''} onChange={(e) => setSelectedPortfolioId(e.target.value)}>
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
            ))}
          </select>
          <button type="button" className="button secondary" onClick={() => addPortfolio('permanent')}>永久组合</button>
          <button type="button" className="button secondary" onClick={() => addPortfolio('custom')}>自定义</button>
        </div>
      </div>

      <div className="portfolio-metrics">
        <Metric label="总资产" value={`¥${money(dashboard.totalValue)}`} />
        <Metric label="总本金" value={`¥${money(dashboard.totalPrincipal)}`} />
        <Metric label="总收益" value={`¥${money(dashboard.totalProfit)}`} tone={dashboard.totalProfit >= 0 ? 'up' : 'down'} />
        <Metric label="今日预估" value={`¥${money(dashboard.dailyEstimatedProfit)}`} tone={dashboard.dailyEstimatedProfit >= 0 ? 'up' : 'down'} />
      </div>

      <PortfolioDetailTabs
        value={activeDetailTab}
        onChange={setActiveDetailTab}
        tabs={detailTabs}
        allocationTotal={allocationTotal}
        errors={validationErrors}
      />

      <div className="portfolio-layout">
        <div className="portfolio-main">
          {activeDetailTab === 'overview' && (
          <Panel title="组合概览">
            {selectedSummary && (
              <div className="portfolio-summary-grid">
                <Metric label="当前金额" value={`¥${money(selectedSummary.totalValue)}`} compact />
                <Metric label="总收益率" value={pct(selectedSummary.totalReturnRate)} compact tone={selectedSummary.totalReturnRate >= 0 ? 'up' : 'down'} />
                <Metric label="目标偏离度" value={pct(selectedSummary.theta)} compact />
                <Metric label="持仓数量" value={selectedSummary.holdingCount} compact />
              </div>
            )}
            <div className="portfolio-asset-bars">
              {(selectedSummary?.assetClasses || []).map((row) => (
                <div key={row.assetClassId} className="portfolio-asset-row">
                  <span>{row.assetClassName}</span>
                  <div className="portfolio-asset-track">
                    <div style={{ width: `${Math.min(100, row.currentRatio * 100)}%` }} />
                  </div>
                  <strong>{pct(row.currentRatio)}</strong>
                  <em>目标 {pct(row.targetRatio)}</em>
                </div>
              ))}
            </div>
          </Panel>
          )}

          {activeDetailTab === 'holdings' && (
          <Panel title="持仓">
            <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>资产</th>
                    <th>类别</th>
                    <th>份额</th>
                    <th>本金</th>
                    <th>市值</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHoldings.map((holding) => {
                    const nav = holding.manualValue ?? holding.currentValue ?? (holding.share || 0) * (holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0);
                    return (
                      <tr key={holding.id}>
                        <td>{holding.fundName}</td>
                        <td>{ASSET_CLASSES.find((row) => row.id === holding.assetClassId)?.name || holding.assetClassId}</td>
                        <td>{money(holding.share)}</td>
                        <td>¥{money(holding.costAmount)}</td>
                        <td>¥{money(nav)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          )}

          {activeDetailTab === 'transactions' && (
            <PortfolioTransactionsPanel
              portfolioId={selectedPortfolio?.id}
              holdings={portfolioHoldings}
              transactions={portfolioTransactions}
              principalRecords={portfolioPrincipalRecords}
            />
          )}

          {activeDetailTab === 'rebalance' && (
          <Panel title="再平衡">
            <div className="portfolio-rebalance-list">
              {(rebalancePlan?.items || []).map((item) => (
                <div key={item.assetClassId} className={`portfolio-rebalance-item is-${item.action}`}>
                  <span>{item.assetClassName}</span>
                  <strong>{item.action === 'buy' ? '买入' : item.action === 'sell' ? '卖出' : '保持'}</strong>
                  <em>¥{money(Math.abs(item.rebalanceAmount))}</em>
                </div>
              ))}
            </div>
            <div className="portfolio-inline-form">
              <input className="input" value={cashflowAmount} onChange={(e) => setCashflowAmount(e.target.value)} placeholder="新增/取出资金" />
              <span className="muted">
                {smartCashPlan?.mode || 'smart_fill'}：
                {(smartCashPlan?.items || []).map((item) => `${item.assetClassName} ¥${money(item.amount)}`).join('；') || '输入金额查看建议'}
              </span>
            </div>
          </Panel>
          )}

          {activeDetailTab === 'history' && (
            <PortfolioHistoryImportPanel
              snapshots={selectedSnapshots}
              importText={importText}
              onImportTextChange={(next) => {
                setImportText(next);
                setImportAnalysis(null);
              }}
              onAnalyze={analyzeImport}
              analysis={importAnalysis}
              onApplyImport={applyAnalyzedImport}
              onRecordSnapshot={recordSnapshot}
            />
          )}

          {activeDetailTab === 'backtest' && (
            <PortfolioBacktestPanel
              portfolioId={selectedPortfolio?.id}
              portfolioBacktests={portfolioBacktests}
              setPortfolioBacktests={setPortfolioBacktests}
            />
          )}
        </div>

        <aside className="portfolio-side">
          {activeDetailTab === 'overview' && (
            <PortfolioEditorPanel
              portfolio={selectedPortfolio}
              onSavePortfolio={savePortfolio}
              onArchivePortfolio={archivePortfolio}
              onCreatePortfolio={createPortfolioFromEditor}
            />
          )}

          {activeDetailTab === 'holdings' && (
          <>
          <PortfolioMigrationPanel preview={legacyMigrationPreview} onRunMigration={runLegacyMigration} />
          <Panel title="新增持仓">
            <div className="portfolio-form">
              <select className="select" value={holdingDraft.instrumentType} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, instrumentType: e.target.value }))}>
                <option value="fund">基金/ETF</option>
                <option value="cash">现金</option>
                <option value="manual">手动资产</option>
              </select>
              <select className="select" value={holdingDraft.assetClassId} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, assetClassId: e.target.value }))}>
                {ASSET_CLASSES.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              <input className="input" value={holdingDraft.fundCode} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, fundCode: e.target.value }))} placeholder="基金代码" />
              <input className="input" value={holdingDraft.fundName} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, fundName: e.target.value }))} placeholder="名称，可自动带出" />
              <input className="input" value={holdingDraft.share} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, share: e.target.value }))} placeholder="份额" />
              <input className="input" value={holdingDraft.costAmount} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, costAmount: e.target.value }))} placeholder="本金/成本金额" />
              <input className="input" value={holdingDraft.estimatedNav} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, estimatedNav: e.target.value }))} placeholder="估算净值" />
              <button type="button" className="button" onClick={addHolding}><Plus size={16} />添加持仓</button>
            </div>
          </Panel>
          </>
          )}

          {activeDetailTab === 'transactions' && (
          <Panel title="记录交易">
            <div className="portfolio-form">
              <select className="select" value={transactionDraft.holdingId} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, holdingId: e.target.value }))}>
                <option value="">选择持仓</option>
                {selectedHoldings.map((holding) => <option key={holding.id} value={holding.id}>{holding.fundName}</option>)}
              </select>
              <select className="select" value={transactionDraft.type} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
                <option value="cash_in">现金转入</option>
                <option value="cash_out">现金转出</option>
                <option value="fee">手续费</option>
                <option value="dividend_cash">现金分红</option>
              </select>
              <input className="input" type="date" value={transactionDraft.date} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, date: e.target.value }))} />
              <input className="input" value={transactionDraft.amount} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, amount: e.target.value }))} placeholder="金额" />
              <input className="input" value={transactionDraft.share} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, share: e.target.value }))} placeholder="份额" />
              <input className="input" value={transactionDraft.price} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, price: e.target.value }))} placeholder="价格" />
              <input className="input" value={transactionDraft.fee} onChange={(e) => setTransactionDraft((prev) => ({ ...prev, fee: e.target.value }))} placeholder="手续费" />
              <button type="button" className="button" onClick={recordTransaction}><Save size={16} />保存交易</button>
            </div>
          </Panel>
          )}

          {activeDetailTab === 'history' && (
            <Panel title="导出备份">
              <div className="portfolio-form">
                <button type="button" className="button secondary" onClick={exportJson}>生成 JSON</button>
                <span className="muted">生成后会填入左侧文本框，可复制保存或重新导入。</span>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = '', compact = false }) {
  return (
    <div className={`portfolio-metric ${compact ? 'is-compact' : ''}`}>
      <span>{label}</span>
      <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="portfolio-panel glass">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
