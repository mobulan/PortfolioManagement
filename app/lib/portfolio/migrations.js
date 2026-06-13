import { createDefaultPortfolio, normalizePortfolioHolding, PORTFOLIO_SCHEMA_VERSION } from './schema.js';

const DEFAULT_MIGRATION_PORTFOLIO_ID = 'portfolio_legacy_migration_preview';

const normalizeFundCode = (value) => String(value ?? '').trim();

const createMigrationHoldingId = (portfolioId, fundCode) => {
  const safePortfolioId = String(portfolioId || DEFAULT_MIGRATION_PORTFOLIO_ID).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFundCode = String(fundCode || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `holding_migration_${safePortfolioId}_${safeFundCode}`;
};

export function previewLegacyHoldingsMigration({
  funds = [],
  holdings = {},
  existingPortfolioHoldings = [],
  portfolioId = DEFAULT_MIGRATION_PORTFOLIO_ID
} = {}) {
  const fundByCode = new Map(
    (Array.isArray(funds) ? funds : []).map((fund) => [normalizeFundCode(fund?.code), fund]).filter(([code]) => code)
  );
  const existingFundCodes = new Set();
  const existingPortfolioFundCodes = new Set();

  (Array.isArray(existingPortfolioHoldings) ? existingPortfolioHoldings : []).forEach((holding) => {
    const fundCode = normalizeFundCode(holding?.fundCode);
    if (!fundCode) return;
    existingFundCodes.add(fundCode);
    existingPortfolioFundCodes.add(`${holding?.portfolioId || ''}:${fundCode}`);
  });

  const previewHoldings = [];
  let skippedCount = 0;

  Object.entries(holdings || {}).forEach(([rawCode, holding]) => {
    const fundCode = normalizeFundCode(rawCode);
    const duplicateInPortfolio = existingPortfolioFundCodes.has(`${portfolioId}:${fundCode}`);
    const duplicateFundCode = existingFundCodes.has(fundCode);
    if (!fundCode || duplicateInPortfolio || duplicateFundCode) {
      skippedCount += 1;
      return;
    }

    const fund = fundByCode.get(fundCode);
    const share = Number(holding?.share) || 0;
    const cost = Number(holding?.cost) || 0;
    previewHoldings.push(
      normalizePortfolioHolding({
        id: createMigrationHoldingId(portfolioId, fundCode),
        portfolioId,
        assetClassId: 'equity',
        instrumentType: 'fund',
        fundCode,
        fundName: fund?.name || fundCode,
        share,
        costPrice: cost,
        costAmount: share * cost,
        currentNav: Number(fund?.dwjz) || null,
        estimatedNav: Number(fund?.gsz) || Number(fund?.dwjz) || null
      })
    );
  });

  return {
    migratableCount: previewHoldings.length,
    skippedCount,
    holdings: previewHoldings
  };
}

const getGroupHoldingEntries = (groupHoldings = {}, groupId) => {
  if (!groupHoldings || typeof groupHoldings !== 'object') return [];
  if (groupId) return [[String(groupId), groupHoldings[groupId] || {}]];
  return Object.entries(groupHoldings);
};

const isEmptyLegacyHolding = (holding) => {
  if (!holding || typeof holding !== 'object') return true;
  const share = Number(holding.share);
  return !Number.isFinite(share) || share <= 0;
};

export function previewGroupHoldingsMigration({
  funds = [],
  groupHoldings = {},
  groupId = '',
  existingPortfolioHoldings = [],
  portfolioId = DEFAULT_MIGRATION_PORTFOLIO_ID
} = {}) {
  const fundByCode = new Map(
    (Array.isArray(funds) ? funds : []).map((fund) => [normalizeFundCode(fund?.code), fund]).filter(([code]) => code)
  );
  const duplicateFundCodes = new Set();

  (Array.isArray(existingPortfolioHoldings) ? existingPortfolioHoldings : []).forEach((holding) => {
    if ((holding?.portfolioId || '') !== portfolioId) return;
    const fundCode = normalizeFundCode(holding?.fundCode);
    if (fundCode) duplicateFundCodes.add(fundCode);
  });

  const previewHoldings = [];
  const skipped = [];

  getGroupHoldingEntries(groupHoldings, groupId).forEach(([currentGroupId, bucket]) => {
    Object.entries(bucket || {}).forEach(([rawCode, holding]) => {
      const fundCode = normalizeFundCode(rawCode);
      const skipBase = {
        groupId: currentGroupId,
        fundCode
      };

      if (!fundCode) {
        skipped.push({ ...skipBase, reason: 'empty_fund_code' });
        return;
      }

      if (isEmptyLegacyHolding(holding)) {
        skipped.push({ ...skipBase, reason: 'empty_holding' });
        return;
      }

      if (duplicateFundCodes.has(fundCode)) {
        skipped.push({ ...skipBase, reason: 'duplicate_fund_code' });
        return;
      }

      duplicateFundCodes.add(fundCode);
      const fund = fundByCode.get(fundCode);
      const share = Number(holding?.share) || 0;
      const cost = Number(holding?.cost) || 0;
      previewHoldings.push(
        normalizePortfolioHolding({
          id: createMigrationHoldingId(portfolioId, fundCode),
          portfolioId,
          assetClassId: 'equity',
          instrumentType: 'fund',
          fundCode,
          fundName: fund?.name || fundCode,
          share,
          costPrice: cost,
          costAmount: share * cost,
          currentNav: Number(fund?.dwjz) || null,
          estimatedNav: Number(fund?.gsz) || Number(fund?.dwjz) || null
        })
      );
    });
  });

  return {
    portfolioId,
    groupId: groupId || '',
    migratableCount: previewHoldings.length,
    skippedCount: skipped.length,
    holdings: previewHoldings,
    skipped
  };
}

export function createDefaultPortfolioState({ funds = [], holdings = {}, existingPortfolios = [] } = {}) {
  if (Array.isArray(existingPortfolios) && existingPortfolios.length) {
    return {
      portfolios: existingPortfolios,
      portfolioHoldings: [],
      portfolioSchemaVersion: PORTFOLIO_SCHEMA_VERSION
    };
  }
  const portfolio = createDefaultPortfolio('permanent', { name: '我的基金组合' });
  const preview = previewLegacyHoldingsMigration({ funds, holdings, portfolioId: portfolio.id });
  return {
    portfolios: [portfolio],
    portfolioHoldings: preview.holdings,
    portfolioSchemaVersion: PORTFOLIO_SCHEMA_VERSION
  };
}
