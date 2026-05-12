import assert from 'node:assert/strict';

import {
  createDefaultPortfolio,
  normalizePortfolio,
  normalizePortfolioHolding,
  PORTFOLIO_STORAGE_KEYS,
} from '../app/lib/portfolio/schema.js';
import {
  calculatePortfolioSummary,
  summarizeAssetClasses,
} from '../app/lib/portfolio/calculations.js';
import {
  calculateRebalancePlan,
  calculateSmartCashPlan,
} from '../app/lib/portfolio/rebalance.js';
import {
  applyPortfolioTransaction,
} from '../app/lib/portfolio/transactionEngine.js';
import {
  createPortfolioSnapshot,
} from '../app/lib/portfolio/snapshot.js';
import {
  analyzePortfolioImport,
  exportPortfolioData,
  importPortfolioData,
} from '../app/lib/portfolio/importExport.js';
import {
  calculateRiskMetrics,
  calculateCorrelation,
} from '../app/lib/portfolio/backtest.js';
import {
  previewLegacyHoldingsMigration,
} from '../app/lib/portfolio/migrations.js';
import {
  buildPortfolioHoldingFromDraft,
  findPortfolioFundCandidate,
} from '../app/lib/portfolio/holdingForm.js';
import {
  normalizeAllocationDraftPercents,
} from '../app/lib/portfolio/editorForm.js';

const nearly = (actual, expected, delta = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= delta, `${actual} not within ${delta} of ${expected}`);
};

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const portfolio = createDefaultPortfolio('permanent', {
  id: 'portfolio_permanent_smoke',
  name: 'Permanent Portfolio Smoke',
});

const holdings = [
  normalizePortfolioHolding({
    id: 'h_equity_a',
    portfolioId: portfolio.id,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '000001',
    fundName: 'Equity Fund A',
    share: 100,
    costPrice: 1,
    costAmount: 100,
    estimatedNav: 1.2,
    previousNav: 1.1,
  }),
  normalizePortfolioHolding({
    id: 'h_equity_b',
    portfolioId: portfolio.id,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '000002',
    fundName: 'Equity Fund B',
    share: 50,
    costPrice: 1.8,
    costAmount: 90,
    estimatedNav: 2,
    previousNav: 1.9,
  }),
  normalizePortfolioHolding({
    id: 'h_bond',
    portfolioId: portfolio.id,
    assetClassId: 'bond',
    instrumentType: 'fund',
    fundCode: '110001',
    fundName: 'Bond Fund',
    share: 200,
    costPrice: 1.05,
    costAmount: 210,
    estimatedNav: 1,
    previousNav: 1.01,
  }),
  normalizePortfolioHolding({
    id: 'h_gold',
    portfolioId: portfolio.id,
    assetClassId: 'gold',
    instrumentType: 'fund',
    fundCode: '518880',
    fundName: 'Gold ETF',
    share: 5,
    costPrice: 36,
    costAmount: 180,
    estimatedNav: 40,
    previousNav: 39,
  }),
  normalizePortfolioHolding({
    id: 'h_cash',
    portfolioId: portfolio.id,
    assetClassId: 'cash',
    instrumentType: 'cash',
    fundName: 'Cash',
    share: 1,
    costAmount: 80,
    manualValue: 80,
  }),
  normalizePortfolioHolding({
    id: 'h_archived',
    portfolioId: portfolio.id,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '999999',
    share: 1000,
    costAmount: 1000,
    estimatedNav: 10,
    archived: true,
  }),
];

test('permanent portfolio defaults to four equal asset classes', () => {
  assert.equal(portfolio.type, 'permanent');
  assert.equal(portfolio.targetAllocations.length, 4);
  assert.deepEqual(portfolio.targetAllocations.map((row) => row.assetClassId), ['equity', 'bond', 'gold', 'cash']);
  portfolio.targetAllocations.forEach((row) => nearly(row.targetRatio, 0.25, 0.0001));
  nearly(portfolio.targetAllocations.reduce((sum, row) => sum + row.targetRatio, 0), 1, 0.0001);
});

test('normalizers clamp ratios and fill asset class names', () => {
  const normalized = normalizePortfolio({
    type: 'unknown',
    targetAllocations: [
      { assetClassId: 'equity', targetRatio: '1.5' },
      { assetClassId: 'bond', targetRatio: '-0.1' },
      { assetClassId: 'cash', targetRatio: '0.2' },
    ],
  });
  assert.equal(normalized.type, 'custom');
  assert.equal(normalized.targetAllocations.length, 2);
  nearly(normalized.targetAllocations[0].targetRatio, 1);
  nearly(normalized.targetAllocations[1].targetRatio, 0.2);
  assert.equal(normalized.targetAllocations[0].assetClassName.length > 0, true);
});

test('summary aggregates permanent portfolio values and ignores archived holdings', () => {
  const summary = calculatePortfolioSummary(portfolio, holdings);
  nearly(summary.totalValue, 700);
  nearly(summary.totalPrincipal, 660);
  nearly(summary.totalProfit, 40);
  nearly(summary.totalReturnRate, 40 / 660, 0.0001);
  nearly(summary.dailyEstimatedProfit, 18);
  assert.equal(summary.holdingCount, 5);
  assert.equal(summary.assetClassCount, 4);
});

test('multi-fund same asset class is grouped while preserving holding count', () => {
  const assetClasses = summarizeAssetClasses(portfolio, holdings);
  const equity = assetClasses.find((row) => row.assetClassId === 'equity');
  assert.equal(equity.holdingCount, 2);
  nearly(equity.currentValue, 220);
  nearly(equity.principal, 190);
  nearly(equity.currentRatio, 220 / 700, 0.0001);
});

test('rebalance identifies over-weight and under-weight permanent portfolio sleeves', () => {
  const rebalance = calculateRebalancePlan(portfolio, holdings);
  assert.equal(rebalance.items.length, 4);
  nearly(rebalance.totalValue, 700);
  nearly(rebalance.thresholdAmount, 190, 0.01);

  const equity = rebalance.items.find((item) => item.assetClassId === 'equity');
  const cash = rebalance.items.find((item) => item.assetClassId === 'cash');
  assert.equal(equity.action, 'sell');
  nearly(equity.rebalanceAmount, -45);
  assert.equal(cash.action, 'buy');
  nearly(cash.rebalanceAmount, 95);
});

test('smart cash flow fills or trims the most drifted sleeves first', () => {
  const buyCash = calculateSmartCashPlan(portfolio, holdings, 70);
  assert.equal(buyCash.mode, 'smart_fill');
  nearly(buyCash.totalCashflow, 70);
  assert.equal(buyCash.items.length, 1);
  assert.equal(buyCash.items[0].assetClassId, 'cash');
  nearly(buyCash.items[0].amount, 70);

  const sellCash = calculateSmartCashPlan(portfolio, holdings, -60);
  assert.equal(sellCash.mode, 'smart_trim');
  nearly(sellCash.totalCashflow, -60);
  assert.equal(sellCash.items[0].assetClassId, 'equity');
  nearly(sellCash.items.reduce((sum, item) => sum + item.amount, 0), 60);
});

test('buy, sell, cash-in, and cash-out transactions update holdings and principal records', () => {
  const buyResult = applyPortfolioTransaction({
    holdings,
    principalRecords: [],
    transaction: {
      id: 'tx_buy_equity',
      portfolioId: portfolio.id,
      holdingId: 'h_equity_a',
      assetClassId: 'equity',
      fundCode: '000001',
      type: 'buy',
      amount: 60,
      share: 50,
      price: 1.2,
      fee: 1,
      date: '2026-05-12',
    },
  });
  const bought = buyResult.holdings.find((row) => row.id === 'h_equity_a');
  nearly(bought.share, 150);
  nearly(bought.costAmount, 161);
  nearly(bought.costPrice, 161 / 150, 0.000001);
  nearly(buyResult.principalRecords.at(-1).amount, 61);

  const sellResult = applyPortfolioTransaction({
    holdings: buyResult.holdings,
    principalRecords: buyResult.principalRecords,
    transaction: {
      id: 'tx_sell_bond',
      portfolioId: portfolio.id,
      holdingId: 'h_bond',
      assetClassId: 'bond',
      fundCode: '110001',
      type: 'sell',
      amount: 50,
      share: 50,
      price: 1,
      date: '2026-05-12',
    },
  });
  const sold = sellResult.holdings.find((row) => row.id === 'h_bond');
  nearly(sold.share, 150);
  nearly(sold.costAmount, 157.5);
  nearly(sellResult.principalRecords.at(-1).amount, -52.5);

  const sellProfitResult = applyPortfolioTransaction({
    holdings: [normalizePortfolioHolding({
      id: 'h_profit',
      portfolioId: portfolio.id,
      assetClassId: 'equity',
      instrumentType: 'fund',
      fundCode: '000003',
      fundName: 'Profit Sale Fund',
      share: 200,
      costAmount: 220,
      estimatedNav: 1.5,
    })],
    principalRecords: [],
    transaction: {
      id: 'tx_sell_profit',
      portfolioId: portfolio.id,
      holdingId: 'h_profit',
      assetClassId: 'equity',
      fundCode: '000003',
      type: 'sell',
      amount: 150,
      share: 100,
      price: 1.5,
      date: '2026-05-12',
    },
  });
  const afterProfitSell = sellProfitResult.holdings.find((row) => row.id === 'h_profit');
  nearly(afterProfitSell.share, 100);
  nearly(afterProfitSell.costAmount, 110);
  nearly(sellProfitResult.principalRecords[0].amount, -110);
  nearly(sellProfitResult.principalRecords[0].beforePrincipal, 220);
  nearly(sellProfitResult.principalRecords[0].afterPrincipal, 110);

  const cashInResult = applyPortfolioTransaction({
    holdings: sellResult.holdings,
    principalRecords: sellResult.principalRecords,
    transaction: {
      id: 'tx_cash_in',
      portfolioId: portfolio.id,
      holdingId: 'h_cash',
      assetClassId: 'cash',
      type: 'cash_in',
      amount: 40,
      date: '2026-05-12',
    },
  });
  const cashAfterIn = cashInResult.holdings.find((row) => row.id === 'h_cash');
  nearly(cashAfterIn.manualValue, 120);
  nearly(cashAfterIn.costAmount, 120);

  const cashOutResult = applyPortfolioTransaction({
    holdings: cashInResult.holdings,
    principalRecords: cashInResult.principalRecords,
    transaction: {
      id: 'tx_cash_out',
      portfolioId: portfolio.id,
      holdingId: 'h_cash',
      assetClassId: 'cash',
      type: 'cash_out',
      amount: 25,
      date: '2026-05-12',
    },
  });
  const cashAfterOut = cashOutResult.holdings.find((row) => row.id === 'h_cash');
  nearly(cashAfterOut.manualValue, 95);
  nearly(cashAfterOut.costAmount, 95);
  assert.equal(cashOutResult.principalRecords.length, 4);
});

test('snapshots and JSON export/import preserve valid portfolio records', () => {
  const snapshot = createPortfolioSnapshot({ portfolio, holdings, date: '2026-05-12', source: 'manual' });
  assert.equal(snapshot.date, '2026-05-12');
  nearly(snapshot.totalValue, 700);
  nearly(snapshot.assetClassValues.equity, 220);

  const exported = exportPortfolioData({
    portfolios: [portfolio],
    portfolioHoldings: holdings,
    portfolioTransactions: [{
      id: 'tx_existing',
      portfolioId: portfolio.id,
      holdingId: 'h_equity_a',
      assetClassId: 'equity',
      type: 'buy',
      amount: 100,
      share: 100,
      date: '2026-05-12',
    }],
    portfolioPrincipalRecords: [{
      id: 'principal_existing',
      portfolioId: portfolio.id,
      holdingId: 'h_equity_a',
      assetClassId: 'equity',
      date: '2026-05-12',
      type: 'increase',
      amount: 100,
      transactionId: 'tx_existing',
    }],
    portfolioSnapshots: [snapshot],
  });
  const imported = importPortfolioData(JSON.parse(exported));
  assert.equal(imported.portfolios.length, 1);
  assert.equal(imported.portfolioHoldings.length, 6);
  assert.equal(imported.portfolioTransactions.length, 1);
  assert.equal(imported.portfolioPrincipalRecords.length, 1);
  assert.equal(imported.portfolioSnapshots.length, 1);
  assert.equal(imported.errors.length, 0);
  assert.equal(Object.keys(PORTFOLIO_STORAGE_KEYS).includes('portfolios'), true);
});

test('JSON import filters orphan records and tolerates malformed payload fields', () => {
  const imported = importPortfolioData({
    portfolios: [portfolio],
    portfolioHoldings: [
      holdings[0],
      { id: 'orphan_holding', portfolioId: 'missing_portfolio', assetClassId: 'equity', share: 10 },
    ],
    portfolioTransactions: [
      { id: 'valid_tx', portfolioId: portfolio.id, holdingId: 'h_equity_a', type: 'buy', amount: 10 },
      { id: 'orphan_tx', portfolioId: portfolio.id, holdingId: 'missing_holding', type: 'buy', amount: 10 },
    ],
    portfolioPrincipalRecords: [
      { id: 'valid_principal', portfolioId: portfolio.id, transactionId: 'valid_tx', amount: 10 },
      { id: 'orphan_principal', portfolioId: portfolio.id, transactionId: 'orphan_tx', amount: 10 },
    ],
    portfolioSnapshots: [
      { id: 'valid_snapshot', portfolioId: portfolio.id },
      { id: 'orphan_snapshot', portfolioId: 'missing_portfolio' },
    ],
    portfolioSettings: 'not-an-object',
  });

  assert.equal(imported.portfolioHoldings.length, 1);
  assert.equal(imported.portfolioTransactions.length, 1);
  assert.equal(imported.portfolioPrincipalRecords.length, 1);
  assert.equal(imported.portfolioSnapshots.length, 1);
  assert.equal(imported.portfolioSettings.includeDuplicateFunds, true);

  const emptyImport = importPortfolioData({
    portfolios: 'not-an-array',
    portfolioHoldings: 'not-an-array',
  });
  assert.equal(emptyImport.portfolios.length, 0);
  assert.equal(emptyImport.portfolioHoldings.length, 0);
});

test('import analysis reports valid and dropped counts without applying import', () => {
  const analysis = analyzePortfolioImport({
    portfolios: [portfolio, null],
    portfolioHoldings: [
      holdings[0],
      { id: 'orphan_holding', portfolioId: 'missing_portfolio', assetClassId: 'equity', share: 10 },
    ],
    portfolioTransactions: [
      { id: 'valid_tx', portfolioId: portfolio.id, holdingId: 'h_equity_a', type: 'buy', amount: 10 },
      { id: 'orphan_tx', portfolioId: portfolio.id, holdingId: 'missing_holding', type: 'buy', amount: 10 },
    ],
    portfolioPrincipalRecords: [
      { id: 'valid_principal', portfolioId: portfolio.id, transactionId: 'valid_tx', amount: 10 },
      { id: 'orphan_principal', portfolioId: portfolio.id, transactionId: 'orphan_tx', amount: 10 },
    ],
    portfolioSnapshots: [
      { id: 'valid_snapshot', portfolioId: portfolio.id },
      { id: 'orphan_snapshot', portfolioId: 'missing_portfolio' },
    ],
    portfolioBacktests: [{ id: 'valid_backtest' }, null],
  });

  assert.equal(analysis.valid, false);
  assert.equal(analysis.counts.portfolios.valid, 1);
  assert.equal(analysis.counts.portfolios.dropped, 1);
  assert.equal(analysis.counts.portfolioHoldings.valid, 1);
  assert.equal(analysis.counts.portfolioHoldings.dropped, 1);
  assert.equal(analysis.counts.portfolioTransactions.valid, 1);
  assert.equal(analysis.counts.portfolioTransactions.dropped, 1);
  assert.equal(analysis.counts.portfolioPrincipalRecords.valid, 1);
  assert.equal(analysis.counts.portfolioPrincipalRecords.dropped, 1);
  assert.equal(analysis.counts.portfolioSnapshots.valid, 1);
  assert.equal(analysis.counts.portfolioSnapshots.dropped, 1);
  assert.equal(analysis.counts.portfolioBacktests.valid, 1);
  assert.equal(analysis.counts.portfolioBacktests.dropped, 1);
  assert.equal(analysis.errors.length > 0, true);

  const malformed = analyzePortfolioImport('{bad json');
  assert.equal(malformed.valid, false);
  assert.equal(malformed.errors.length, 1);
});

test('invalid holding input normalizes to safe numeric defaults', () => {
  const invalidHolding = normalizePortfolioHolding({
    instrumentType: 'unsupported',
    share: 'NaN',
    costAmount: 'bad',
    currentValue: 'bad',
    estimatedNav: 'bad',
    previousNav: 'bad',
  });
  assert.equal(invalidHolding.instrumentType, 'fund');
  assert.equal(invalidHolding.assetClassId, 'other');
  nearly(invalidHolding.share, 0);
  nearly(invalidHolding.costAmount, 0);
  nearly(invalidHolding.costPrice, 0);

  const summary = calculatePortfolioSummary(portfolio, [invalidHolding]);
  nearly(summary.totalValue, 0);
  nearly(summary.totalPrincipal, 0);
  nearly(summary.dailyEstimatedProfit, 0);
});

test('legacy holdings migration preview skips duplicate portfolio fund codes', () => {
  const sourceHoldings = {
    '000001': { share: 100, cost: 1 },
    '000002': { share: 50, cost: 2 },
    '': { share: 10, cost: 1 },
  };
  const existingPortfolioHoldings = [
    normalizePortfolioHolding({
      portfolioId: portfolio.id,
      assetClassId: 'equity',
      instrumentType: 'fund',
      fundCode: '000001',
      fundName: 'Already Migrated',
      share: 1,
      costAmount: 1,
    }),
  ];
  const beforeExisting = JSON.stringify(existingPortfolioHoldings);

  const preview = previewLegacyHoldingsMigration({
    funds: [
      { code: '000001', name: 'Equity Fund A', dwjz: 1.1, gsz: 1.2 },
      { code: '000002', name: 'Equity Fund B', dwjz: 1.9, gsz: 2 },
    ],
    holdings: sourceHoldings,
    existingPortfolioHoldings,
    portfolioId: portfolio.id,
  });

  assert.equal(preview.migratableCount, 1);
  assert.equal(preview.skippedCount, 2);
  assert.equal(preview.holdings.length, 1);
  assert.equal(preview.holdings[0].fundCode, '000002');
  nearly(preview.holdings[0].share, 50);
  nearly(preview.holdings[0].costAmount, 100);
  assert.equal(JSON.stringify(existingPortfolioHoldings), beforeExisting);
});

test('portfolio holding form matches fund candidates from loaded funds and search results', () => {
  const loaded = findPortfolioFundCandidate([
    { code: '006961', name: '富国深证红利ETF联接A', dwjz: 1.2, gsz: 1.25, lastNav: 1.18 },
  ], '006961');
  assert.equal(loaded.code, '006961');
  assert.equal(loaded.name, '富国深证红利ETF联接A');
  nearly(loaded.estimatedNav, 1.25);

  const searched = findPortfolioFundCandidate([
    { CODE: '022424', NAME: '永赢红利慧选混合发起A' },
  ], '永赢');
  assert.equal(searched.code, '022424');
  assert.equal(searched.name, '永赢红利慧选混合发起A');
});

test('portfolio holding form supports amount and share input modes', () => {
  const amountMode = buildPortfolioHoldingFromDraft({
    portfolioId: portfolio.id,
    draft: {
      instrumentType: 'manual',
      assetClassId: 'equity',
      fundName: '手动股票',
      valueMode: 'amount',
      costAmount: '10',
      manualValue: '12',
    },
    funds: [],
  });
  nearly(amountMode.costAmount, 10);
  nearly(amountMode.manualValue, 12);
  nearly(calculatePortfolioSummary(portfolio, [amountMode]).totalProfit, 2);

  const shareMode = buildPortfolioHoldingFromDraft({
    portfolioId: portfolio.id,
    draft: {
      instrumentType: 'fund',
      assetClassId: 'equity',
      fundCode: '006961',
      valueMode: 'share',
      costAmount: '10',
      share: '100',
    },
    funds: [{ code: '006961', name: '富国深证红利ETF联接A', gsz: 0.12, dwjz: 0.11, lastNav: 0.1 }],
  });
  assert.equal(shareMode.fundName, '富国深证红利ETF联接A');
  nearly(shareMode.costAmount, 10);
  nearly(shareMode.share, 100);
  nearly(calculatePortfolioSummary(portfolio, [shareMode]).totalValue, 12);
  nearly(calculatePortfolioSummary(portfolio, [shareMode]).dailyEstimatedProfit, 2);
});

test('portfolio editor can normalize existing allocation rows to 100 percent', () => {
  const normalized = normalizeAllocationDraftPercents([
    { assetClassId: 'equity', targetPercent: '60', thresholdPercent: '5' },
    { assetClassId: 'bond', targetPercent: '20', thresholdPercent: '5' },
    { assetClassId: 'cash', targetPercent: '10', thresholdPercent: '5' },
  ]);
  assert.deepEqual(normalized.map((row) => row.assetClassId), ['equity', 'bond', 'cash']);
  nearly(normalized.reduce((sum, row) => sum + Number(row.targetPercent), 0), 100, 0.0001);
  nearly(Number(normalized[0].targetPercent), 66.67, 0.01);
  nearly(Number(normalized[1].targetPercent), 22.22, 0.01);
  nearly(Number(normalized[2].targetPercent), 11.11, 0.01);

  const equalized = normalizeAllocationDraftPercents([
    { assetClassId: 'equity', targetPercent: '', thresholdPercent: '5' },
    { assetClassId: 'bond', targetPercent: '', thresholdPercent: '5' },
  ]);
  nearly(equalized.reduce((sum, row) => sum + Number(row.targetPercent), 0), 100, 0.0001);
  nearly(Number(equalized[0].targetPercent), 50, 0.0001);
  nearly(Number(equalized[1].targetPercent), 50, 0.0001);
});

test('backtest metrics and correlation remain finite for representative series', () => {
  const risk = calculateRiskMetrics([
    { date: '2026-05-10', value: 100 },
    { date: '2026-05-11', value: 102 },
    { date: '2026-05-12', value: 101 },
  ]);
  assert.equal(Number.isFinite(risk.annualizedReturn), true);
  assert.equal(Number.isFinite(risk.volatility), true);
  assert.equal(Number.isFinite(risk.maxDrawdown), true);
  assert.equal(risk.sampleSize, 2);

  const corr = calculateCorrelation([0.01, 0.02, -0.01], [0.02, 0.04, -0.02]);
  nearly(corr, 1, 0.0001);
  assert.equal(calculateCorrelation([0.01], [0.02]), 0);
});

test('backtest metrics stay finite for empty and single-point series', () => {
  const empty = calculateRiskMetrics([]);
  assert.equal(empty.sampleSize, 0);
  assert.equal(empty.annualizedReturn, 0);
  assert.equal(empty.volatility, 0);
  assert.equal(empty.sharpe, 0);
  assert.equal(empty.maxDrawdown, 0);

  const single = calculateRiskMetrics([{ date: '2026-05-12', value: 100 }]);
  assert.equal(single.sampleSize, 0);
  assert.equal(single.annualizedReturn, 0);
  assert.equal(single.volatility, 0);
  assert.equal(single.sharpe, 0);
  assert.equal(single.maxDrawdown, 0);
});

console.log('portfolio smoke tests passed');
