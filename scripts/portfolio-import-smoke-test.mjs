import assert from 'node:assert/strict';

import {
  CSV_IMPORT_TYPES,
  PORTFOLIO_IMPORT_CONFLICT_MODES,
  analyzePortfolioCsvImport,
  buildPortfolioImportConflictPreview,
  exportPortfolioCsv
} from '../app/lib/portfolio/importExport.js';
import { analyzePortfolioExcelRows } from '../app/lib/portfolio/excelImport.js';

const test = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const knownFunds = [
  { code: '000001', name: 'Equity Fund A' },
  { code: '110001', name: 'Bond Fund' }
];

test('CSV preview drops malformed dates, malformed amounts, and unknown fund codes', () => {
  const csv = [
    'portfolioId,holdingId,fundCode,assetClassId,type,date,amount,share,price,fee,note',
    'p1,h1,000001,equity,buy,2026-05-12,"1,100.50",10,10.05,0.1,valid buy',
    'p1,h1,000001,equity,buy,2026-99-12,100,10,10,0,bad date',
    'p1,h1,000001,equity,buy,2026-05-13,abc,10,10,0,bad amount',
    'p1,h_unknown,999999,equity,buy,2026-05-14,100,10,10,0,unknown code'
  ].join('\n');

  const preview = analyzePortfolioCsvImport({
    csv,
    type: 'portfolioTransactions',
    knownFunds,
    validPortfolioIds: ['p1'],
    validHoldingIds: ['h1']
  });

  assert.equal(preview.type, 'portfolioTransactions');
  assert.equal(preview.valid, false);
  assert.equal(preview.counts.valid, 1);
  assert.equal(preview.counts.dropped, 3);
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].amount, 1100.5);
  assert.equal(preview.rows[0].fundCode, '000001');
  assert.ok(preview.errors.some((message) => message.includes('date invalid')));
  assert.ok(preview.errors.some((message) => message.includes('amount invalid')));
  assert.ok(preview.errors.some((message) => message.includes('fundCode 999999 was not found')));
});

test('conflict modes are available for skip, overwrite, and merge wiring', () => {
  assert.deepEqual(Object.keys(PORTFOLIO_IMPORT_CONFLICT_MODES), ['skip', 'overwrite', 'merge']);
  assert.equal(PORTFOLIO_IMPORT_CONFLICT_MODES.skip.id, 'skip');
  assert.equal(PORTFOLIO_IMPORT_CONFLICT_MODES.overwrite.id, 'overwrite');
  assert.equal(PORTFOLIO_IMPORT_CONFLICT_MODES.merge.id, 'merge');
});

test('conflict preview uses id for transactions and portfolio date for snapshots', () => {
  const transactionPreview = buildPortfolioImportConflictPreview({
    type: 'portfolioTransactions',
    importedRows: [{ id: 'tx1' }, { id: 'tx2' }],
    currentRows: [{ id: 'tx1' }],
    conflictMode: 'overwrite'
  });
  assert.deepEqual(
    transactionPreview.previewRows.map((row) => row._importAction),
    ['覆盖', '新增']
  );

  const snapshotPreview = buildPortfolioImportConflictPreview({
    type: 'portfolioSnapshots',
    importedRows: [
      { id: 'new-id', portfolioId: 'p1', date: '2026-05-12' },
      { id: 's2', portfolioId: 'p1', date: '2026-05-13' }
    ],
    currentRows: [{ id: 'old-id', portfolioId: 'p1', date: '2026-05-12' }],
    conflictMode: 'skip'
  });
  assert.deepEqual(
    snapshotPreview.previewRows.map((row) => row._importAction),
    ['跳过', '新增']
  );
});

test('Excel history rows map four asset classes and principal totals into snapshots', () => {
  const preview = analyzePortfolioExcelRows(
    [
      [
        '日期',
        '股票市值',
        '债券市值',
        '黄金市值',
        '现金市值',
        '股票本金',
        '债券本金',
        '黄金本金',
        '现金本金',
        '当日收益'
      ],
      ['2026/05/12', '40,000', 30000, 20000, 10000, 35000, 28000, 18000, 10000, 500]
    ],
    { portfolioId: 'p1' }
  );

  assert.equal(preview.snapshots.length, 1);
  assert.equal(preview.snapshots[0].totalValue, 100000);
  assert.equal(preview.snapshots[0].totalPrincipal, 91000);
  assert.equal(preview.snapshots[0].totalProfit, 9000);
  assert.equal(preview.snapshots[0].dailyProfit, 500);
  assert.deepEqual(preview.snapshots[0].assetClassValues, {
    equity: 40000,
    bond: 30000,
    gold: 20000,
    cash: 10000
  });
});

test('CSV export emits holdings, transactions, and snapshots with stable headers', () => {
  assert.deepEqual(CSV_IMPORT_TYPES, ['portfolioHoldings', 'portfolioTransactions', 'portfolioSnapshots']);

  const holdingsCsv = exportPortfolioCsv({
    type: 'portfolioHoldings',
    rows: [
      {
        id: 'h1',
        portfolioId: 'p1',
        assetClassId: 'equity',
        instrumentType: 'fund',
        fundCode: '000001',
        fundName: 'Equity, Fund A',
        share: 10,
        costPrice: 1.23,
        costAmount: 12.3,
        currentNav: 1.25,
        manualValue: null,
        enabled: true,
        archived: false
      }
    ]
  });

  const transactionCsv = exportPortfolioCsv({
    type: 'portfolioTransactions',
    rows: [
      {
        id: 'tx1',
        portfolioId: 'p1',
        holdingId: 'h1',
        fundCode: '000001',
        assetClassId: 'equity',
        type: 'buy',
        date: '2026-05-12',
        amount: 100,
        share: 10,
        price: 10,
        fee: 0,
        note: 'first buy'
      }
    ]
  });

  const snapshotCsv = exportPortfolioCsv({
    type: 'portfolioSnapshots',
    rows: [
      {
        id: 's1',
        portfolioId: 'p1',
        date: '2026-05-12',
        totalValue: 100,
        totalPrincipal: 90,
        totalProfit: 10,
        totalReturnRate: 0.1111,
        dailyEstimatedProfit: 1,
        holdingCount: 1,
        assetClassValues: [{ assetClassId: 'equity', value: 100 }]
      }
    ]
  });

  const holdingLines = holdingsCsv.split('\n');
  assert.equal(
    holdingLines[0],
    'id,portfolioId,assetClassId,instrumentType,fundCode,fundName,share,costPrice,costAmount,currentNav,estimatedNav,previousNav,currentValue,manualValue,enabled,archived,createdAt,updatedAt'
  );
  assert.ok(holdingLines[1].includes('"Equity, Fund A"'));
  assert.equal(
    transactionCsv.split('\n')[0],
    'id,portfolioId,holdingId,fundCode,assetClassId,type,date,amount,share,price,fee,isAfter3pm,relatedTransactionId,principalImpact,note,createdAt,updatedAt'
  );
  assert.equal(
    snapshotCsv.split('\n')[0],
    'id,portfolioId,date,totalValue,totalPrincipal,totalProfit,totalReturnRate,dailyEstimatedProfit,holdingCount,assetClassValues,createdAt'
  );
  assert.ok(snapshotCsv.split('\n')[1].includes('"[{""assetClassId"":""equity"",""value"":100}]"'));
});
