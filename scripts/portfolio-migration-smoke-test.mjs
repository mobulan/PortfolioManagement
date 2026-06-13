import assert from 'node:assert/strict';

import { previewGroupHoldingsMigration } from '../app/lib/portfolio/migrations.js';

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

test('group holdings migration previews one group into a target portfolio with skipped details', () => {
  const groupHoldings = {
    group_alpha: {
      '000001': { share: 100, cost: 1.25 },
      '000002': { share: 0, cost: 2 },
      '000003': { share: 20, cost: 3 },
      '': { share: 8, cost: 1 }
    },
    group_beta: {
      '000004': { share: 40, cost: 4 }
    }
  };
  const beforeGroupHoldings = JSON.stringify(groupHoldings);
  const existingPortfolioHoldings = [{ portfolioId: 'portfolio_target', fundCode: '000003', share: 1, costAmount: 3 }];

  const preview = previewGroupHoldingsMigration({
    funds: [
      { code: '000001', name: 'Equity Fund A', dwjz: 1.3, gsz: 1.4 },
      { code: '000002', name: 'Empty Share Fund', dwjz: 2.1 },
      { code: '000003', name: 'Duplicate Fund', dwjz: 3.1 },
      { code: '000004', name: 'Other Group Fund', dwjz: 4.1 }
    ],
    groupHoldings,
    groupId: 'group_alpha',
    portfolioId: 'portfolio_target',
    existingPortfolioHoldings
  });

  assert.equal(preview.portfolioId, 'portfolio_target');
  assert.equal(preview.groupId, 'group_alpha');
  assert.equal(preview.migratableCount, 1);
  assert.equal(preview.skippedCount, 3);
  assert.deepEqual(
    preview.holdings.map((holding) => holding.fundCode),
    ['000001']
  );

  const migrated = preview.holdings[0];
  assert.equal(migrated.portfolioId, 'portfolio_target');
  assert.equal(migrated.fundName, 'Equity Fund A');
  assert.equal(migrated.share, 100);
  assert.equal(migrated.costPrice, 1.25);
  assert.equal(migrated.costAmount, 125);
  assert.equal(migrated.currentNav, 1.3);
  assert.equal(migrated.estimatedNav, 1.4);

  assert.deepEqual(
    preview.skipped.map((item) => ({ groupId: item.groupId, fundCode: item.fundCode, reason: item.reason })),
    [
      { groupId: 'group_alpha', fundCode: '000002', reason: 'empty_holding' },
      { groupId: 'group_alpha', fundCode: '000003', reason: 'duplicate_fund_code' },
      { groupId: 'group_alpha', fundCode: '', reason: 'empty_fund_code' }
    ]
  );
  assert.equal(JSON.stringify(groupHoldings), beforeGroupHoldings);
});
