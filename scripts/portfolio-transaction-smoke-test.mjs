import assert from 'node:assert/strict';

import { normalizePortfolioHolding } from '../app/lib/portfolio/schema.js';
import {
  createPortfolioTransactionBaseline,
  rebuildPortfolioLedgerFromTransactions,
  rebuildPortfolioAfterTransactionDelete,
} from '../app/lib/portfolio/transactionEngine.js';
import {
  calculateSmartCashPlan,
  createSmartTradeDrafts,
  resolveHoldingTradePrice,
} from '../app/lib/portfolio/rebalance.js';

const nearly = (actual, expected, delta = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= delta, `${actual} not within ${delta} of ${expected}`);
};

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const portfolioId = 'portfolio_transaction_smoke';

const smartPortfolio = {
  id: portfolioId,
  targetAllocations: [
    { assetClassId: 'equity', assetClassName: 'Equity', targetRatio: 0.5, rebalanceThreshold: 0.1 },
    { assetClassId: 'bond', assetClassName: 'Bond', targetRatio: 0.5, rebalanceThreshold: 0.1 },
  ],
  rebalanceConfig: {
    defaultThreshold: 0.1,
  },
};

const baseHoldings = [
  normalizePortfolioHolding({
    id: 'h_equity',
    portfolioId,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '000001',
    fundName: 'Equity Fund',
    share: 10,
    costAmount: 20,
    estimatedNav: 2.5,
  }),
  normalizePortfolioHolding({
    id: 'h_cash',
    portfolioId,
    assetClassId: 'cash',
    instrumentType: 'cash',
    fundName: 'Cash',
    share: 1,
    costAmount: 100,
    manualValue: 100,
  }),
];

const transactions = [
  {
    id: 'tx_buy',
    portfolioId,
    holdingId: 'h_equity',
    assetClassId: 'equity',
    fundCode: '000001',
    type: 'buy',
    amount: 50,
    share: 25,
    fee: 1,
    date: '2026-05-10',
  },
  {
    id: 'tx_dividend_cash',
    portfolioId,
    holdingId: 'h_cash',
    assetClassId: 'cash',
    type: 'dividend_cash',
    amount: 6,
    date: '2026-05-11',
    note: 'Cash dividend from h_equity',
  },
  {
    id: 'tx_convert_out',
    portfolioId,
    holdingId: 'h_equity',
    assetClassId: 'equity',
    fundCode: '000001',
    type: 'convert_out',
    amount: 30,
    share: 10,
    date: '2026-05-12',
    relatedTransactionId: 'tx_convert_in',
  },
  {
    id: 'tx_convert_in',
    portfolioId,
    holdingId: 'h_bond',
    assetClassId: 'bond',
    fundCode: '110001',
    type: 'convert_in',
    amount: 30,
    share: 15,
    date: '2026-05-12',
    relatedTransactionId: 'tx_convert_out',
  },
];

const smartTradeHoldings = [
  normalizePortfolioHolding({
    id: 'h_smart_equity',
    portfolioId,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '000001',
    fundName: 'Equity Fund',
    share: 100,
    costAmount: 100,
    estimatedNav: 1,
  }),
  normalizePortfolioHolding({
    id: 'h_smart_bond',
    portfolioId,
    assetClassId: 'bond',
    instrumentType: 'fund',
    fundCode: '110001',
    fundName: 'Bond Fund',
    share: 300,
    costAmount: 300,
    estimatedNav: 1,
  }),
];

const fundPrices = [
  { code: '000001', name: 'Equity Fund', gsz: '1.2500', dwjz: '1.2000', gztime: '2026-05-16 14:50' },
  { code: '110001', name: 'Bond Fund', dwjz: '2.0000', jzrq: '2026-05-15' },
];

const excelPortfolio = {
  id: portfolioId,
  targetAllocations: [
    { assetClassId: 'equity', assetClassName: 'Equity', targetRatio: 0.25 },
    { assetClassId: 'bond', assetClassName: 'Bond', targetRatio: 0.25 },
    { assetClassId: 'gold', assetClassName: 'Gold', targetRatio: 0.25 },
    { assetClassId: 'cash', assetClassName: 'Cash', targetRatio: 0.25 },
  ],
};

const excelBuyHoldings = [
  { id: 'h_excel_equity', portfolioId, assetClassId: 'equity', instrumentType: 'cash', fundName: 'Equity', manualValue: 100 },
  { id: 'h_excel_bond', portfolioId, assetClassId: 'bond', instrumentType: 'cash', fundName: 'Bond', manualValue: 200 },
  { id: 'h_excel_gold', portfolioId, assetClassId: 'gold', instrumentType: 'cash', fundName: 'Gold', manualValue: 300 },
  { id: 'h_excel_cash', portfolioId, assetClassId: 'cash', instrumentType: 'cash', fundName: 'Cash', manualValue: 400 },
].map(normalizePortfolioHolding);

const excelSellHoldings = [
  { id: 'h_excel_equity', portfolioId, assetClassId: 'equity', instrumentType: 'cash', fundName: 'Equity', manualValue: 400 },
  { id: 'h_excel_bond', portfolioId, assetClassId: 'bond', instrumentType: 'cash', fundName: 'Bond', manualValue: 300 },
  { id: 'h_excel_gold', portfolioId, assetClassId: 'gold', instrumentType: 'cash', fundName: 'Gold', manualValue: 200 },
  { id: 'h_excel_cash', portfolioId, assetClassId: 'cash', instrumentType: 'cash', fundName: 'Cash', manualValue: 100 },
].map(normalizePortfolioHolding);

test('rebuild creates deterministic holdings and principal records from transactions', () => {
  const first = rebuildPortfolioLedgerFromTransactions({
    holdings: baseHoldings,
    transactions,
  });
  const second = rebuildPortfolioLedgerFromTransactions({
    holdings: baseHoldings,
    transactions: [...transactions].reverse(),
  });

  assert.deepEqual(first.holdings, second.holdings);
  assert.deepEqual(first.principalRecords, second.principalRecords);

  const equity = first.holdings.find((row) => row.id === 'h_equity');
  const cash = first.holdings.find((row) => row.id === 'h_cash');
  const bond = first.holdings.find((row) => row.id === 'h_bond');

  nearly(equity.share, 25);
  nearly(equity.costAmount, 50.714286);
  nearly(cash.manualValue, 106);
  nearly(cash.costAmount, 100);
  nearly(bond.share, 15);
  nearly(bond.costAmount, 30);

  assert.deepEqual(first.principalRecords.map((row) => row.transactionId), [
    'tx_buy',
    'tx_convert_out',
    'tx_convert_in',
  ]);
  nearly(first.principalRecords[0].amount, 51);
  nearly(first.principalRecords[1].amount, -20.285714);
  nearly(first.principalRecords[2].amount, 30);
});

test('delete rebuild uses baseline and preserves other portfolio rows', () => {
  const otherHolding = normalizePortfolioHolding({
    id: 'h_other',
    portfolioId: 'other_portfolio',
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundName: 'Other Fund',
    share: 99,
    costAmount: 88,
  });
  const baseline = createPortfolioTransactionBaseline({
    portfolioId,
    holdings: [...baseHoldings, otherHolding],
  });

  const rebuilt = rebuildPortfolioAfterTransactionDelete({
    portfolioId,
    baseline,
    holdings: [...baseHoldings, otherHolding],
    transactions,
    principalRecords: [
      { id: 'other_principal', portfolioId: 'other_portfolio', transactionId: 'other_tx', amount: 1 },
    ],
    transactionId: 'tx_buy',
  });

  assert.equal(rebuilt.transactions.some((tx) => tx.id === 'tx_buy'), false);
  assert.equal(rebuilt.transactions.length, transactions.length - 1);
  assert.equal(rebuilt.holdings.some((holding) => holding.id === 'h_other'), true);
  assert.equal(rebuilt.principalRecords.some((record) => record.id === 'other_principal'), true);

  const equity = rebuilt.holdings.find((row) => row.id === 'h_equity');
  const cash = rebuilt.holdings.find((row) => row.id === 'h_cash');
  const bond = rebuilt.holdings.find((row) => row.id === 'h_bond');

  nearly(equity.share, 0);
  nearly(equity.costAmount, 0);
  nearly(cash.manualValue, 106);
  nearly(bond.share, 15);
  nearly(bond.costAmount, 30);
  assert.deepEqual(
    rebuilt.principalRecords.filter((row) => row.portfolioId === portfolioId).map((row) => row.transactionId),
    ['tx_convert_out', 'tx_convert_in'],
  );
});

test('smart buy below threshold fills underweight asset and uses estimated price for share', () => {
  const plan = calculateSmartCashPlan(smartPortfolio, smartTradeHoldings, 50);
  const drafts = createSmartTradeDrafts({
    portfolio: smartPortfolio,
    holdings: smartTradeHoldings,
    funds: fundPrices,
    plan,
    date: '2026-05-16',
  });

  assert.equal(drafts.mode, 'smart_fill');
  assert.equal(drafts.rows.length, 1);
  assert.equal(drafts.rows[0].holdingId, 'h_smart_equity');
  assert.equal(drafts.rows[0].type, 'buy');
  nearly(drafts.rows[0].amount, 50);
  nearly(drafts.rows[0].price, 1.25);
  nearly(drafts.rows[0].share, 40);
  assert.equal(drafts.rows[0].priceSource, 'estimated');
  assert.equal(drafts.blockingWarnings.length, 0);
});

test('smart buy below threshold follows Excel future-gap proportional fill', () => {
  const plan = calculateSmartCashPlan(excelPortfolio, excelBuyHoldings, 100);

  assert.equal(plan.mode, 'smart_fill');
  assert.deepEqual(
    plan.items.map((item) => [item.assetClassId, item.amount]),
    [
      ['equity', 70],
      ['bond', 30],
    ],
  );
});

test('smart sell below threshold follows Excel future-gap proportional trim', () => {
  const plan = calculateSmartCashPlan(excelPortfolio, excelSellHoldings, -100);

  assert.equal(plan.mode, 'smart_trim');
  assert.deepEqual(
    plan.items.map((item) => [item.assetClassId, item.amount]),
    [
      ['equity', 70],
      ['bond', 30],
    ],
  );
});

test('smart cash plan uses proportional mode when Excel threshold is zero', () => {
  const balancedHoldings = [
    { id: 'h_balanced_equity', portfolioId, assetClassId: 'equity', instrumentType: 'cash', fundName: 'Equity', manualValue: 250 },
    { id: 'h_balanced_bond', portfolioId, assetClassId: 'bond', instrumentType: 'cash', fundName: 'Bond', manualValue: 250 },
    { id: 'h_balanced_gold', portfolioId, assetClassId: 'gold', instrumentType: 'cash', fundName: 'Gold', manualValue: 250 },
    { id: 'h_balanced_cash', portfolioId, assetClassId: 'cash', instrumentType: 'cash', fundName: 'Cash', manualValue: 250 },
  ].map(normalizePortfolioHolding);

  const plan = calculateSmartCashPlan(excelPortfolio, balancedHoldings, 100);

  assert.equal(plan.thresholdAmount, 0);
  assert.equal(plan.mode, 'proportional');
  assert.deepEqual(plan.items.map((item) => item.amount), [25, 25, 25, 25]);
});

test('trade price does not use cost price as same-day valuation', () => {
  const priceInfo = resolveHoldingTradePrice({
    instrumentType: 'fund',
    costPrice: 39098.399915,
    share: 0.127882,
  });

  assert.equal(priceInfo.price, 0);
  assert.equal(priceInfo.source, 'missing');
});

test('smart buy above threshold allocates proportionally across target assets', () => {
  const plan = calculateSmartCashPlan(smartPortfolio, smartTradeHoldings, 250);
  const drafts = createSmartTradeDrafts({
    portfolio: smartPortfolio,
    holdings: smartTradeHoldings,
    funds: fundPrices,
    plan,
    date: '2026-05-16',
  });

  assert.equal(drafts.mode, 'proportional');
  assert.deepEqual(drafts.rows.map((row) => row.holdingId), ['h_smart_equity', 'h_smart_bond']);
  nearly(drafts.rows[0].amount, 125);
  nearly(drafts.rows[0].share, 100);
  nearly(drafts.rows[1].amount, 125);
  nearly(drafts.rows[1].price, 2);
  nearly(drafts.rows[1].share, 62.5);
  assert.equal(drafts.rows[1].priceSource, 'latestNav');
});

test('smart sell below threshold trims overweight asset and blocks oversell', () => {
  const trimPlan = calculateSmartCashPlan(smartPortfolio, smartTradeHoldings, -50);
  const trimDrafts = createSmartTradeDrafts({
    portfolio: smartPortfolio,
    holdings: smartTradeHoldings,
    funds: fundPrices,
    plan: trimPlan,
    date: '2026-05-16',
  });

  assert.equal(trimDrafts.mode, 'smart_trim');
  assert.equal(trimDrafts.rows.length, 1);
  assert.equal(trimDrafts.rows[0].holdingId, 'h_smart_bond');
  assert.equal(trimDrafts.rows[0].type, 'sell');
  nearly(trimDrafts.rows[0].amount, 50);
  nearly(trimDrafts.rows[0].share, 25);
  assert.equal(trimDrafts.blockingWarnings.length, 0);

  const oversellPlan = calculateSmartCashPlan(smartPortfolio, smartTradeHoldings, -1000);
  const oversellDrafts = createSmartTradeDrafts({
    portfolio: smartPortfolio,
    holdings: smartTradeHoldings,
    funds: fundPrices,
    plan: oversellPlan,
    date: '2026-05-16',
  });

  assert.ok(oversellDrafts.blockingWarnings.some((warning) => warning.code === 'sell_amount_exceeds_available_value'));
});

console.log('portfolio transaction smoke tests passed');
