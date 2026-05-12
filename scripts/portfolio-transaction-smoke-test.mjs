import assert from 'node:assert/strict';

import { normalizePortfolioHolding } from '../app/lib/portfolio/schema.js';
import {
  rebuildPortfolioLedgerFromTransactions,
} from '../app/lib/portfolio/transactionEngine.js';

const nearly = (actual, expected, delta = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= delta, `${actual} not within ${delta} of ${expected}`);
};

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const portfolioId = 'portfolio_transaction_smoke';

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

console.log('portfolio transaction smoke tests passed');
