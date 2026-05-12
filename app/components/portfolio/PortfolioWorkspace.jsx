'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, Plus, Save, Trash2, WalletCards } from 'lucide-react';
import {
  ASSET_CLASSES,
  buildPortfolioHoldingFromDraft,
  createDefaultPortfolio,
  normalizePortfolioFundCandidate,
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
import { fetchFundData, searchFunds } from '@/app/api/fund';
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
const customPortfolioNumber = (name = '') => {
  const match = String(name).trim().match(/^自定义组合\s*(\d+)?$/);
  if (!match) return null;
  return Number(match[1] || 1);
};

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
    valueMode: 'amount',
  });
  const [holdingFundMatches, setHoldingFundMatches] = useState([]);
  const [isHoldingFundSearching, setIsHoldingFundSearching] = useState(false);
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

  const activePortfolios = useMemo(
    () => portfolios.filter((portfolio) => !portfolio.archived),
    [portfolios],
  );
  const selectedPortfolio = useMemo(
    () => activePortfolios.find((row) => row.id === selectedPortfolioId) || activePortfolios[0] || null,
    [activePortfolios, selectedPortfolioId],
  );

  useEffect(() => {
    if (!activePortfolios.length) {
      setSelectedPortfolioId('');
      return;
    }
    if (!activePortfolios.some((portfolio) => portfolio.id === selectedPortfolioId)) {
      setSelectedPortfolioId(activePortfolios[0].id);
    }
  }, [activePortfolios, selectedPortfolioId]);

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
  const localFundMatches = useMemo(() => {
    const query = String(holdingDraft.fundCode || holdingDraft.fundName || '').trim().toLowerCase();
    if (!query || holdingDraft.instrumentType === 'cash') return [];
    return (Array.isArray(funds) ? funds : [])
      .map(normalizePortfolioFundCandidate)
      .filter(Boolean)
      .filter((fund) => fund.code.includes(query) || fund.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [funds, holdingDraft.fundCode, holdingDraft.fundName, holdingDraft.instrumentType]);
  const fundSuggestions = useMemo(() => {
    const byCode = new Map();
    [...localFundMatches, ...holdingFundMatches.map(normalizePortfolioFundCandidate).filter(Boolean)].forEach((fund) => {
      if (!fund.code || byCode.has(fund.code)) return;
      byCode.set(fund.code, fund);
    });
    return Array.from(byCode.values()).slice(0, 6);
  }, [holdingFundMatches, localFundMatches]);

  useEffect(() => {
    const query = String(holdingDraft.fundCode || holdingDraft.fundName || '').trim();
    if (holdingDraft.instrumentType === 'cash' || query.length < 2) {
      setHoldingFundMatches([]);
      setIsHoldingFundSearching(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsHoldingFundSearching(true);
      try {
        const results = await searchFunds(query);
        if (!cancelled) setHoldingFundMatches(Array.isArray(results) ? results : []);
      } finally {
        if (!cancelled) setIsHoldingFundSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [holdingDraft.fundCode, holdingDraft.fundName, holdingDraft.instrumentType]);

  useEffect(() => {
    const code = String(holdingDraft.fundCode || '').trim();
    if (!code || holdingDraft.instrumentType === 'cash') return;
    const exact = fundSuggestions.find((fund) => fund.code === code);
    if (!exact) return;
    setHoldingDraft((prev) => {
      if (prev.fundCode !== code) return prev;
      const nextName = prev.fundName || exact.name;
      const nextNav = prev.estimatedNav || (exact.estimatedNav ? String(exact.estimatedNav) : '');
      if (nextName === prev.fundName && nextNav === prev.estimatedNav) return prev;
      return { ...prev, fundName: nextName, estimatedNav: nextNav };
    });
  }, [fundSuggestions, holdingDraft.fundCode, holdingDraft.instrumentType]);

  const ensureDefaultPortfolio = () => {
    const portfolio = createDefaultPortfolio('permanent', { name: '我的基金组合' });
    setPortfolios((prev) => [...prev, portfolio]);
    setSelectedPortfolioId(portfolio.id);
  };

  const addPortfolio = (type = 'custom') => {
    const usedCustomNumbers = new Set(portfolios.map((portfolio) => customPortfolioNumber(portfolio.name)).filter(Boolean));
    let nextCustomNumber = 1;
    while (usedCustomNumbers.has(nextCustomNumber)) nextCustomNumber += 1;
    const portfolio = createDefaultPortfolio(type, {
      name: type === 'permanent' ? '\u6c38\u4e45\u6295\u8d44\u7ec4\u5408' : type === 'all_weather' ? '\u5168\u5929\u5019\u7ec4\u5408' : `\u81ea\u5b9a\u4e49\u7ec4\u5408 ${nextCustomNumber}`,
    });
    setPortfolios((prev) => [...prev, portfolio]);
    setSelectedPortfolioId(portfolio.id);
  };

  const addHolding = () => {
    if (!selectedPortfolio) return;
    const holding = buildPortfolioHoldingFromDraft({
      portfolioId: selectedPortfolio.id,
      draft: holdingDraft,
      funds: [...funds, ...holdingFundMatches],
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
      valueMode: 'amount',
    });
    setHoldingFundMatches([]);
  };

  const selectHoldingFund = async (fund) => {
    const candidate = normalizePortfolioFundCandidate(fund);
    if (!candidate) return;
    setHoldingDraft((prev) => ({
      ...prev,
      fundCode: candidate.code,
      fundName: candidate.name,
      estimatedNav: candidate.estimatedNav ? String(candidate.estimatedNav) : prev.estimatedNav,
    }));
    setHoldingFundMatches([]);
    if (candidate.estimatedNav || !candidate.code) return;
    try {
      const detail = await fetchFundData(candidate.code);
      const detailed = normalizePortfolioFundCandidate(detail);
      if (!detailed) return;
      setHoldingDraft((prev) => (
        prev.fundCode === candidate.code
          ? {
              ...prev,
              fundName: prev.fundName || detailed.name,
              estimatedNav: detailed.estimatedNav ? String(detailed.estimatedNav) : prev.estimatedNav,
            }
          : prev
      ));
    } catch {
      // Search result selection still provides code and name; NAV can be entered manually.
    }
  };

  const archiveHolding = (holdingId) => {
    setPortfolioHoldings((prev) => prev.map((holding) => (
      holding.id === holdingId ? { ...holding, archived: true } : holding
    )));
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

  const deletePortfolio = (portfolioId = selectedPortfolio?.id) => {
    if (!portfolioId) return;
    const portfolio = portfolios.find((row) => row.id === portfolioId);
    const portfolioName = portfolio?.name || '当前组合';
    if (typeof window !== 'undefined' && !window.confirm(`删除“${portfolioName}”？该组合下的持仓、交易和历史记录也会一起删除。`)) return;
    const nextPortfolio = activePortfolios.find((row) => row.id !== portfolioId);
    setPortfolios((prev) => prev.filter((row) => row.id !== portfolioId));
    setPortfolioHoldings((prev) => prev.filter((row) => row.portfolioId !== portfolioId));
    setPortfolioTransactions((prev) => prev.filter((row) => row.portfolioId !== portfolioId));
    setPortfolioPrincipalRecords((prev) => prev.filter((row) => row.portfolioId !== portfolioId));
    setPortfolioSnapshots((prev) => prev.filter((row) => row.portfolioId !== portfolioId));
    setPortfolioBacktests((prev) => prev.filter((row) => row.portfolioId !== portfolioId));
    setSelectedPortfolioId(nextPortfolio?.id || '');
  };

  const createPortfolioFromEditor = (nextPortfolio) => {
    setPortfolios((prev) => [...prev, nextPortfolio]);
    setSelectedPortfolioId(nextPortfolio.id);
  };

  if (!activePortfolios.length) {
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
          <span className="muted">Portfolio Management</span>
          <h2>投资组合</h2>
          <p>先设定目标比例，再录入持仓和交易，系统会按偏离度给出再平衡建议。</p>
        </div>
        <div className="portfolio-toolbar-actions">
          <select className="select" value={selectedPortfolio?.id || ''} onChange={(e) => setSelectedPortfolioId(e.target.value)}>
            {activePortfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="button secondary"
            onClick={() => deletePortfolio(selectedPortfolio?.id)}
            disabled={!selectedPortfolio}
          >
            <Trash2 size={16} />
            删除
          </button>
          <button type="button" className="button secondary" onClick={() => addPortfolio('custom')}>
            <Plus size={16} />
            新建
          </button>
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

      <div className="portfolio-help-strip" role="note">
        <Info size={16} aria-hidden="true" />
        <span>
          当前组合：<strong>{selectedPortfolio?.name || '未选择'}</strong>。
          {selectedHoldings.length > 0 ? '可在“再平衡”查看买入/卖出建议。' : '建议先在“持仓”中添加资产，概览和偏离度才会有实际数据。'}
        </span>
      </div>

      <div className={`portfolio-layout ${activeDetailTab === 'holdings' ? 'is-holdings' : ''}`}>
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
              {(selectedSummary?.assetClasses || []).length > 0 ? (selectedSummary?.assetClasses || []).map((row) => (
                <div key={row.assetClassId} className="portfolio-asset-row">
                  <span>{row.assetClassName}</span>
                  <div className="portfolio-asset-track">
                    <div style={{ width: `${Math.min(100, row.currentRatio * 100)}%` }} />
                  </div>
                  <strong>{pct(row.currentRatio)}</strong>
                  <em>目标 {pct(row.targetRatio)}</em>
                </div>
              )) : (
                <EmptyHint
                  title="还没有资产分布"
                  description="添加持仓后，这里会显示当前比例、目标比例和偏离情况。"
                />
              )}
            </div>
          </Panel>
          )}

          {activeDetailTab === 'holdings' && (
          <Panel title="持仓">
            <div className="portfolio-table-wrap portfolio-holdings-wrap">
              <table className="portfolio-table portfolio-holdings-table">
                <thead>
                  <tr>
                    <th>资产</th>
                    <th>类别</th>
                    <th>份额</th>
                    <th>本金</th>
                    <th>市值</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHoldings.length ? selectedHoldings.map((holding) => {
                    const nav = holding.manualValue ?? holding.currentValue ?? (holding.share || 0) * (holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0);
                    return (
                      <tr key={holding.id}>
                        <td>{holding.fundName}</td>
                        <td>{ASSET_CLASSES.find((row) => row.id === holding.assetClassId)?.name || holding.assetClassId}</td>
                        <td>{money(holding.share)}</td>
                        <td>¥{money(holding.costAmount)}</td>
                        <td>¥{money(nav)}</td>
                        <td>
                          <button type="button" className="button ghost portfolio-row-action" onClick={() => archiveHolding(holding.id)}>
                            <Trash2 size={15} />
                            移除
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6}>暂无持仓。请使用右侧表单添加基金、现金或手动资产。</td>
                    </tr>
                  )}
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
              {(rebalancePlan?.items || []).length ? (rebalancePlan?.items || []).map((item) => (
                <div key={item.assetClassId} className={`portfolio-rebalance-item is-${item.action}`}>
                  <span>{item.assetClassName}</span>
                  <strong>{item.action === 'buy' ? '买入' : item.action === 'sell' ? '卖出' : '保持'}</strong>
                  <em>¥{money(Math.abs(item.rebalanceAmount))}</em>
                </div>
              )) : (
                <EmptyHint
                  title="暂无再平衡建议"
                  description="设置目标比例并录入持仓后，系统会计算每类资产需要买入、卖出或保持。"
                />
              )}
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
              onDeletePortfolio={deletePortfolio}
              onCreatePortfolio={createPortfolioFromEditor}
            />
          )}

          {activeDetailTab === 'holdings' && (
          <>
          <PortfolioMigrationPanel preview={legacyMigrationPreview} onRunMigration={runLegacyMigration} />
          <Panel title="新增持仓">
            <p className="portfolio-panel-intro">基金可填写代码自动匹配名称；现金和手动资产可直接填名称与金额。</p>
            <div className="portfolio-form">
              <select className="select" value={holdingDraft.instrumentType} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, instrumentType: e.target.value }))}>
                <option value="fund">基金/ETF</option>
                <option value="cash">现金</option>
                <option value="manual">手动资产</option>
              </select>
              <select className="select" value={holdingDraft.assetClassId} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, assetClassId: e.target.value }))}>
                {ASSET_CLASSES.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              <div className="portfolio-code-name-field">
                <div className="portfolio-code-name-row">
                  <input className="input" value={holdingDraft.fundCode} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, fundCode: e.target.value }))} placeholder="代码" />
                  <input className="input" value={holdingDraft.fundName} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, fundName: e.target.value }))} placeholder="名称" />
                </div>
                {holdingDraft.instrumentType !== 'cash' && (fundSuggestions.length > 0 || isHoldingFundSearching) && (
                  <div className="portfolio-fund-suggestions">
                    {isHoldingFundSearching && <span className="muted">搜索中...</span>}
                    {fundSuggestions.map((fund) => (
                      <button key={fund.code} type="button" onClick={() => selectHoldingFund(fund)}>
                        <strong>{fund.code}</strong>
                        <span>{fund.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="portfolio-mode-toggle" role="group" aria-label="持仓录入模式">
                <button type="button" className={holdingDraft.valueMode === 'amount' ? 'is-active' : ''} onClick={() => setHoldingDraft((prev) => ({ ...prev, valueMode: 'amount' }))}>按市值录入</button>
                <button type="button" className={holdingDraft.valueMode === 'share' ? 'is-active' : ''} onClick={() => setHoldingDraft((prev) => ({ ...prev, valueMode: 'share' }))}>按份额录入</button>
              </div>
              <input className="input" value={holdingDraft.costAmount} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, costAmount: e.target.value }))} placeholder="本金/成本金额" />
              {holdingDraft.valueMode === 'amount' ? (
                <input className="input" value={holdingDraft.manualValue} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, manualValue: e.target.value }))} placeholder="当前市值" />
              ) : (
                <>
                  <input className="input" value={holdingDraft.share} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, share: e.target.value }))} placeholder="份额" />
                  <input className="input" value={holdingDraft.estimatedNav} onChange={(e) => setHoldingDraft((prev) => ({ ...prev, estimatedNav: e.target.value }))} placeholder="估算净值" />
                </>
              )}
              <button type="button" className="button" onClick={addHolding}><Plus size={16} />添加持仓</button>
            </div>
          </Panel>
          </>
          )}

          {activeDetailTab === 'transactions' && (
          <Panel title="记录交易">
            <p className="portfolio-panel-intro">交易会同步更新持仓与本金记录，适合记录买入、卖出、现金流和分红。</p>
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

function EmptyHint({ title, description }) {
  return (
    <div className="portfolio-empty-hint">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
