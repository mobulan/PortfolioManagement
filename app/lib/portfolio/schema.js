export const PORTFOLIO_SCHEMA_VERSION = 1;

export const ASSET_CLASSES = [
  { id: 'equity', name: '股票', color: '#ef4444' },
  { id: 'bond', name: '债券', color: '#3b82f6' },
  { id: 'gold', name: '黄金', color: '#f59e0b' },
  { id: 'cash', name: '现金', color: '#10b981' },
  { id: 'other', name: '其他', color: '#8b5cf6' },
];

export const PORTFOLIO_TYPES = ['permanent', 'all_weather', 'custom'];

export const PORTFOLIO_TEMPLATE_OPTIONS = [
  { id: 'permanent', name: '永久组合', description: '股票、债券、黄金、现金各 25%' },
  { id: 'all_weather', name: '全天候模板', description: '股票 30%、债券 40%、黄金 15%、现金 15%' },
  { id: 'custom', name: '自定义组合', description: '默认股票 60%、债券 30%、现金 10%' },
];

export const ALLOCATION_TOTAL_TOLERANCE = 0.0001;

export const PORTFOLIO_STORAGE_KEYS = {
  portfolios: 'portfolios',
  portfolioHoldings: 'portfolioHoldings',
  portfolioTransactions: 'portfolioTransactions',
  portfolioPrincipalRecords: 'portfolioPrincipalRecords',
  portfolioSnapshots: 'portfolioSnapshots',
  portfolioBacktests: 'portfolioBacktests',
  portfolioSettings: 'portfolioSettings',
  portfolioImportJobs: 'portfolioImportJobs',
  portfolioSchemaVersion: 'portfolioSchemaVersion',
};

export const DEFAULT_PORTFOLIO_SETTINGS = {
  colorMode: 'cn',
  includeDuplicateFunds: true,
  snapshotReminderEnabled: false,
};

const nowIso = () => new Date().toISOString();
const toStringValue = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};
const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const clampRatio = (value) => Math.min(1, Math.max(0, toNumber(value, 0)));
export const createPortfolioId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export function getAssetClassName(assetClassId) {
  return ASSET_CLASSES.find((row) => row.id === assetClassId)?.name || '其他';
}

export function getPortfolioTemplate(type = 'permanent') {
  return PORTFOLIO_TEMPLATE_OPTIONS.find((row) => row.id === type) || PORTFOLIO_TEMPLATE_OPTIONS[0];
}

export function createDefaultAllocations(type = 'permanent') {
  if (type === 'all_weather') {
    return [
      { assetClassId: 'equity', assetClassName: '股票', targetRatio: 0.3, rebalanceThreshold: 0.05 },
      { assetClassId: 'bond', assetClassName: '债券', targetRatio: 0.4, rebalanceThreshold: 0.05 },
      { assetClassId: 'gold', assetClassName: '黄金', targetRatio: 0.15, rebalanceThreshold: 0.05 },
      { assetClassId: 'cash', assetClassName: '现金', targetRatio: 0.15, rebalanceThreshold: 0.05 },
    ];
  }
  if (type === 'custom') {
    return [
      { assetClassId: 'equity', assetClassName: '股票', targetRatio: 0.6, rebalanceThreshold: 0.05 },
      { assetClassId: 'bond', assetClassName: '债券', targetRatio: 0.3, rebalanceThreshold: 0.05 },
      { assetClassId: 'cash', assetClassName: '现金', targetRatio: 0.1, rebalanceThreshold: 0.05 },
    ];
  }
  return [
    { assetClassId: 'equity', assetClassName: '股票', targetRatio: 0.25, rebalanceThreshold: 0.05 },
    { assetClassId: 'bond', assetClassName: '债券', targetRatio: 0.25, rebalanceThreshold: 0.05 },
    { assetClassId: 'gold', assetClassName: '黄金', targetRatio: 0.25, rebalanceThreshold: 0.05 },
    { assetClassId: 'cash', assetClassName: '现金', targetRatio: 0.25, rebalanceThreshold: 0.05 },
  ];
}

export function calculateAllocationTotal(allocations = []) {
  return (Array.isArray(allocations) ? allocations : [])
    .reduce((sum, row) => sum + clampRatio(row?.targetRatio), 0);
}

export function validateTargetAllocations(allocations = [], options = {}) {
  const rows = Array.isArray(allocations) ? allocations.map(normalizeAllocation) : [];
  const errors = [];
  const warnings = [];
  const seenAssetClasses = new Set();
  const total = calculateAllocationTotal(rows);
  const requireTotal = options.requireTotal !== false;

  if (!rows.length) {
    errors.push({ code: 'allocation_empty', message: '请至少设置一个目标资产类别' });
  }

  rows.forEach((row, index) => {
    if (!row.assetClassId) {
      errors.push({ code: `allocation_${index}_missing_asset_class`, message: '目标比例需要选择资产类别' });
    }
    if (row.targetRatio <= 0) {
      errors.push({ code: `allocation_${index}_zero_ratio`, message: `${row.assetClassName || '资产'} 目标比例必须大于 0` });
    }
    if (seenAssetClasses.has(row.assetClassId)) {
      warnings.push({ code: `allocation_${index}_duplicate_asset_class`, message: `${row.assetClassName} 出现多次，保存前建议合并` });
    }
    seenAssetClasses.add(row.assetClassId);
  });

  if (requireTotal && Math.abs(total - 1) > ALLOCATION_TOTAL_TOLERANCE) {
    errors.push({
      code: 'allocation_total_not_100',
      message: total > 1 ? '目标比例合计超过 100%' : '目标比例合计未满 100%',
    });
  }

  return {
    total,
    delta: total - 1,
    isBalanced: Math.abs(total - 1) <= ALLOCATION_TOTAL_TOLERANCE,
    errors,
    warnings,
  };
}

export function normalizeAllocation(row = {}) {
  const assetClassId = toStringValue(row.assetClassId, 'other');
  return {
    assetClassId,
    assetClassName: toStringValue(row.assetClassName, getAssetClassName(assetClassId)),
    targetRatio: clampRatio(row.targetRatio),
    rebalanceThreshold: clampRatio(row.rebalanceThreshold ?? 0.05),
  };
}

export function normalizePortfolio(input = {}) {
  const type = PORTFOLIO_TYPES.includes(input.type) ? input.type : 'custom';
  const allocations = Array.isArray(input.targetAllocations) && input.targetAllocations.length
    ? input.targetAllocations.map(normalizeAllocation).filter((row) => row.targetRatio > 0)
    : createDefaultAllocations(type);
  const id = toStringValue(input.id, `portfolio_${createPortfolioId()}`);
  const now = nowIso();
  return {
    id,
    name: toStringValue(input.name, type === 'permanent' ? '永久投资组合' : '我的投资组合'),
    type,
    description: toStringValue(input.description),
    baseCurrency: toStringValue(input.baseCurrency, 'CNY'),
    targetAllocations: allocations,
    rebalanceConfig: {
      mode: input.rebalanceConfig?.mode || 'threshold',
      thresholdType: input.rebalanceConfig?.thresholdType || 'absoluteRatio',
      defaultThreshold: clampRatio(input.rebalanceConfig?.defaultThreshold ?? 0.05),
      smartTradeEnabled: input.rebalanceConfig?.smartTradeEnabled !== false,
    },
    createdAt: toStringValue(input.createdAt, now),
    updatedAt: toStringValue(input.updatedAt, now),
    archived: Boolean(input.archived),
  };
}

export function createDefaultPortfolio(type = 'permanent', patch = {}) {
  return normalizePortfolio({
    id: `portfolio_${createPortfolioId()}`,
    type,
    targetAllocations: createDefaultAllocations(type),
    ...patch,
  });
}

export function normalizePortfolioHolding(input = {}) {
  const id = toStringValue(input.id, `holding_${createPortfolioId()}`);
  const instrumentType = ['fund', 'stock', 'cash', 'manual'].includes(input.instrumentType) ? input.instrumentType : 'fund';
  const assetClassId = toStringValue(input.assetClassId, instrumentType === 'cash' ? 'cash' : 'other');
  const share = toNumber(input.share, 0);
  const costAmount = toNumber(input.costAmount, 0);
  const costPrice = input.costPrice === null || input.costPrice === undefined
    ? (share ? costAmount / share : 0)
    : toNumber(input.costPrice, 0);
  return {
    id,
    portfolioId: toStringValue(input.portfolioId),
    assetClassId,
    instrumentType,
    fundCode: input.fundCode == null ? '' : String(input.fundCode).trim(),
    fundName: toStringValue(input.fundName, input.name || '未命名资产'),
    share,
    costPrice,
    costAmount,
    currentNav: input.currentNav == null ? null : toNumber(input.currentNav, null),
    estimatedNav: input.estimatedNav == null ? null : toNumber(input.estimatedNav, null),
    previousNav: input.previousNav == null ? null : toNumber(input.previousNav, null),
    currentValue: input.currentValue == null ? null : toNumber(input.currentValue, null),
    manualValue: input.manualValue == null ? null : toNumber(input.manualValue, null),
    enabled: input.enabled !== false,
    archived: Boolean(input.archived),
    createdAt: toStringValue(input.createdAt, nowIso()),
    updatedAt: toStringValue(input.updatedAt, nowIso()),
  };
}

export function normalizePortfolioTransaction(input = {}) {
  const type = [
    'buy', 'sell', 'convert_in', 'convert_out', 'dividend_cash',
    'dividend_reinvest', 'cash_in', 'cash_out', 'fee', 'adjustment',
  ].includes(input.type) ? input.type : 'adjustment';
  const amount = toNumber(input.amount, 0);
  const fee = toNumber(input.fee, 0);
  return {
    id: toStringValue(input.id, `tx_${createPortfolioId()}`),
    portfolioId: toStringValue(input.portfolioId),
    holdingId: toStringValue(input.holdingId),
    fundCode: input.fundCode == null ? '' : String(input.fundCode).trim(),
    assetClassId: toStringValue(input.assetClassId, 'other'),
    type,
    date: toStringValue(input.date, nowIso().slice(0, 10)),
    amount,
    share: toNumber(input.share, 0),
    price: toNumber(input.price, 0),
    fee,
    isAfter3pm: Boolean(input.isAfter3pm),
    relatedTransactionId: input.relatedTransactionId || null,
    principalImpact: input.principalImpact == null ? inferPrincipalImpact(type, amount, fee) : toNumber(input.principalImpact, 0),
    note: toStringValue(input.note),
    createdAt: toStringValue(input.createdAt, nowIso()),
    updatedAt: toStringValue(input.updatedAt, nowIso()),
  };
}

export function inferPrincipalImpact(type, amount, fee = 0) {
  if (['buy', 'cash_in', 'convert_in', 'dividend_reinvest'].includes(type)) return Math.abs(amount) + Math.abs(fee);
  if (['sell', 'cash_out', 'convert_out'].includes(type)) return -Math.abs(amount);
  if (type === 'fee') return Math.abs(fee || amount);
  return 0;
}

export function normalizePrincipalRecord(input = {}) {
  return {
    id: toStringValue(input.id, `principal_${createPortfolioId()}`),
    portfolioId: toStringValue(input.portfolioId),
    holdingId: toStringValue(input.holdingId),
    assetClassId: toStringValue(input.assetClassId, 'other'),
    date: toStringValue(input.date, nowIso().slice(0, 10)),
    type: toStringValue(input.type, 'manual_adjustment'),
    amount: toNumber(input.amount, 0),
    beforePrincipal: toNumber(input.beforePrincipal, 0),
    afterPrincipal: toNumber(input.afterPrincipal, 0),
    transactionId: input.transactionId || null,
    note: toStringValue(input.note),
  };
}
