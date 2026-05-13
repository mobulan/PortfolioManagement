import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calculatePortfolioSummary,
} from '../app/lib/portfolio/calculations.js';
import {
  createDefaultPortfolio,
  normalizePortfolioHolding,
} from '../app/lib/portfolio/schema.js';
import {
  buildDashboardRiskMetrics,
} from '../app/lib/portfolio/dashboardRisk.js';

const nearly = (actual, expected, delta = 0.0001) => {
  assert.ok(Math.abs(actual - expected) <= delta, `${actual} not within ${delta} of ${expected}`);
};

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const portfolio = createDefaultPortfolio('permanent', {
  id: 'portfolio_dashboard_risk',
  name: 'Dashboard Risk Smoke',
});

const holdings = [
  normalizePortfolioHolding({
    id: 'h_equity',
    portfolioId: portfolio.id,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '000001',
    fundName: 'Equity Fund',
    share: 400,
    costPrice: 1,
    costAmount: 400,
    estimatedNav: 1.2,
    previousNav: 1.18,
  }),
  normalizePortfolioHolding({
    id: 'h_bond',
    portfolioId: portfolio.id,
    assetClassId: 'bond',
    instrumentType: 'fund',
    fundCode: '110001',
    fundName: 'Bond Fund',
    share: 150,
    costPrice: 1,
    costAmount: 150,
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
    share: 120,
    costPrice: 1,
    costAmount: 120,
    estimatedNav: 1,
    previousNav: 0.99,
  }),
  normalizePortfolioHolding({
    id: 'h_cash',
    portfolioId: portfolio.id,
    assetClassId: 'cash',
    instrumentType: 'cash',
    fundName: 'Cash',
    share: 1,
    costAmount: 100,
    manualValue: 100,
  }),
];

const summary = calculatePortfolioSummary(portfolio, holdings);

const snapshots = [
  {
    id: 's1',
    portfolioId: portfolio.id,
    date: '2026-05-10',
    totalValue: 700,
    totalPrincipal: 670,
    totalProfit: 30,
    totalReturnRate: 30 / 670,
    dailyProfit: 4,
    assetClassValues: { equity: 320, bond: 170, gold: 110, cash: 100 },
  },
  {
    id: 's2',
    portfolioId: portfolio.id,
    date: '2026-05-11',
    totalValue: 760,
    totalPrincipal: 700,
    totalProfit: 60,
    totalReturnRate: 60 / 700,
    dailyProfit: 12,
    assetClassValues: { equity: 390, bond: 160, gold: 110, cash: 100 },
  },
  {
    id: 's3',
    portfolioId: portfolio.id,
    date: '2026-05-12',
    totalValue: 820,
    totalPrincipal: 770,
    totalProfit: 50,
    totalReturnRate: 50 / 770,
    dailyProfit: 7.5,
    assetClassValues: { equity: 480, bond: 150, gold: 120, cash: 100 },
  },
];

test('dashboard helper builds trend, contribution, and risk alert summaries', () => {
  const metrics = buildDashboardRiskMetrics({
    portfolio,
    snapshots,
    holdings,
    summary,
    options: {
      maxSingleAssetClassRatio: 0.5,
      minSnapshots: 4,
    },
  });

  assert.equal(metrics.trend.snapshotCount, 3);
  nearly(metrics.trend.totalValueChange, 120);
  nearly(metrics.trend.totalValueChangeRate, 120 / 700);
  nearly(metrics.trend.latest.totalValue, 820);
  nearly(metrics.trend.previous.totalValue, 760);
  nearly(metrics.trend.maxDrawdown, 0);
  assert.deepEqual(metrics.trend.series.map((row) => row.date), ['2026-05-10', '2026-05-11', '2026-05-12']);

  assert.equal(metrics.contributions.assetClasses[0].assetClassId, 'equity');
  nearly(metrics.contributions.assetClasses[0].profit, 80);
  nearly(metrics.contributions.assetClasses[0].profitContributionRate, 1);
  assert.equal(metrics.contributions.holdings[0].holdingId, 'h_equity');
  nearly(metrics.contributions.holdings[0].profit, 80);

  assert.equal(metrics.alerts.length >= 3, true);
  assert.equal(metrics.alerts.some((alert) => alert.code === 'snapshot_insufficient'), true);
  assert.equal(metrics.alerts.some((alert) => alert.code === 'asset_class_overweight' && alert.assetClassId === 'equity'), true);
  assert.equal(metrics.alerts.some((alert) => alert.code === 'target_deviation' && alert.assetClassId === 'equity'), true);
  assert.equal(metrics.alertSummary.high >= 2, true);
  assert.equal(metrics.alertSummary.medium, 1);
});

test('portfolio index exports dashboard risk helpers for UI wiring', () => {
  const indexSource = readFileSync(new URL('../app/lib/portfolio/index.js', import.meta.url), 'utf8');
  assert.ok(indexSource.includes("export * from './dashboardRisk.js';"));
});

test('dashboard helper returns empty-safe metrics without portfolio data', () => {
  const metrics = buildDashboardRiskMetrics({ snapshots: [], holdings: [], summary: null });

  assert.equal(metrics.trend.snapshotCount, 0);
  assert.equal(metrics.trend.latest, null);
  assert.equal(metrics.contributions.assetClasses.length, 0);
  assert.equal(metrics.contributions.holdings.length, 0);
  assert.equal(metrics.alerts.some((alert) => alert.code === 'snapshot_insufficient'), true);
});
