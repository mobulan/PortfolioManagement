import assert from 'node:assert/strict';

import { normalizePortfolioHolding } from '../app/lib/portfolio/schema.js';
import {
  createPortfolioSnapshot,
  createSnapshotVersionEntry,
  prepareAutomaticDailySnapshot,
  restoreSnapshotVersion
} from '../app/lib/portfolio/snapshot.js';

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const portfolio = {
  id: 'portfolio_snapshot_smoke',
  name: 'Snapshot Smoke Portfolio',
  targetAllocations: [
    { assetClassId: 'equity', assetClassName: 'Equity', targetRatio: 0.5 },
    { assetClassId: 'cash', assetClassName: 'Cash', targetRatio: 0.5 }
  ]
};

const holdings = [
  normalizePortfolioHolding({
    id: 'h_equity',
    portfolioId: portfolio.id,
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '000001',
    fundName: 'Equity Fund',
    share: 10,
    costAmount: 20,
    estimatedNav: 2.5
  }),
  normalizePortfolioHolding({
    id: 'h_other',
    portfolioId: 'other_portfolio',
    assetClassId: 'equity',
    instrumentType: 'fund',
    fundCode: '110001',
    fundName: 'Other Fund',
    share: 99,
    costAmount: 99,
    estimatedNav: 9
  })
];

test('automatic daily snapshot skips when portfolio settings disable it', () => {
  const existingSnapshots = [];
  const result = prepareAutomaticDailySnapshot({
    portfolio,
    holdings,
    snapshots: existingSnapshots,
    portfolioSettings: { snapshotReminderEnabled: false },
    date: '2026-05-13'
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'disabled');
  assert.equal(result.shouldPersist, false);
  assert.equal(result.snapshot, null);
  assert.equal(result.snapshots, existingSnapshots);
});

test('manual snapshot preserves user note', () => {
  const snapshot = createPortfolioSnapshot({
    portfolio,
    holdings,
    date: '2026-05-12',
    source: 'manual',
    note: 'Quarterly rebalance'
  });

  assert.equal(snapshot.note, 'Quarterly rebalance');
  assert.equal(snapshot.source, 'manual');
});

test('overwritten snapshot can be restored from a version entry', () => {
  const original = createPortfolioSnapshot({
    portfolio,
    holdings,
    date: '2026-05-14',
    source: 'manual',
    note: '原始版本'
  });
  const replacement = { ...original, id: 'replacement', totalValue: original.totalValue + 100, note: '覆盖版本' };
  const version = createSnapshotVersionEntry(original, '2026-05-15T00:00:00.000Z');
  const restored = restoreSnapshotVersion({ snapshots: [replacement], version });

  assert.equal(restored.length, 1);
  assert.equal(restored[0].totalValue, original.totalValue);
  assert.equal(restored[0].source, 'restored');
  assert.match(restored[0].note, /已恢复/);
});

test('automatic daily snapshot creates a pure append proposal when enabled', () => {
  const existingSnapshots = [];
  const result = prepareAutomaticDailySnapshot({
    portfolio,
    holdings,
    snapshots: existingSnapshots,
    portfolioSettings: { snapshotReminderEnabled: true },
    date: '2026-05-13'
  });

  assert.equal(result.status, 'created');
  assert.equal(result.reason, 'created');
  assert.equal(result.shouldPersist, true);
  assert.equal(existingSnapshots.length, 0);
  assert.equal(result.snapshots.length, 1);
  assert.equal(result.snapshot.portfolioId, portfolio.id);
  assert.equal(result.snapshot.date, '2026-05-13');
  assert.equal(result.snapshot.source, 'auto');
  assert.equal(result.snapshot.holdingSnapshots.length, 1);
  assert.equal(result.snapshot.holdingSnapshots[0].holdingId, 'h_equity');
});

test('automatic daily snapshot defaults to idempotent skip for same portfolio and date', () => {
  const existing = createPortfolioSnapshot({
    portfolio,
    holdings,
    date: '2026-05-13',
    source: 'manual'
  });
  const existingSnapshots = [existing];
  const result = prepareAutomaticDailySnapshot({
    portfolio,
    holdings,
    snapshots: existingSnapshots,
    portfolioSettings: { snapshotReminderEnabled: true },
    date: '2026-05-13'
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'already_exists');
  assert.equal(result.shouldPersist, false);
  assert.equal(result.snapshot, existing);
  assert.equal(result.snapshots, existingSnapshots);
});

test('automatic daily snapshot can overwrite only the matching portfolio and date', () => {
  const existing = {
    id: 'snapshot_old',
    portfolioId: portfolio.id,
    date: '2026-05-13',
    totalValue: 1,
    source: 'manual'
  };
  const otherPortfolioSameDate = {
    id: 'snapshot_other',
    portfolioId: 'other_portfolio',
    date: '2026-05-13',
    totalValue: 999
  };
  const result = prepareAutomaticDailySnapshot({
    portfolio,
    holdings,
    snapshots: [existing, otherPortfolioSameDate],
    portfolioSettings: {
      snapshotReminderEnabled: true,
      automaticSnapshotConflictMode: 'overwrite'
    },
    date: '2026-05-13'
  });

  assert.equal(result.status, 'created');
  assert.equal(result.reason, 'overwritten');
  assert.equal(result.shouldPersist, true);
  assert.equal(result.snapshots.length, 2);
  assert.equal(
    result.snapshots.some((row) => row.id === 'snapshot_old'),
    false
  );
  assert.equal(
    result.snapshots.some((row) => row.id === 'snapshot_other'),
    true
  );
  assert.equal(result.snapshot.portfolioId, portfolio.id);
  assert.equal(result.snapshot.date, '2026-05-13');
  assert.equal(result.snapshot.source, 'auto');
});

console.log('portfolio snapshot smoke tests passed');
