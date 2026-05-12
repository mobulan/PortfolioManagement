import {
  DEFAULT_PORTFOLIO_SETTINGS,
  PORTFOLIO_SCHEMA_VERSION,
  normalizePortfolio,
  normalizePortfolioHolding,
  normalizePortfolioTransaction,
  normalizePrincipalRecord,
} from './schema.js';

const asArray = (value) => Array.isArray(value) ? value : [];

export function normalizePortfolioPayload(input = {}) {
  const errors = [];
  const portfolios = asArray(input.portfolios).map((row) => {
    try {
      return normalizePortfolio(row);
    } catch (error) {
      errors.push(`portfolio invalid: ${error.message}`);
      return null;
    }
  }).filter(Boolean);
  const portfolioIds = new Set(portfolios.map((row) => row.id));

  const portfolioHoldings = asArray(input.portfolioHoldings).map((row) => normalizePortfolioHolding(row))
    .filter((row) => row.portfolioId && portfolioIds.has(row.portfolioId));
  const holdingIds = new Set(portfolioHoldings.map((row) => row.id));

  const portfolioTransactions = asArray(input.portfolioTransactions).map((row) => normalizePortfolioTransaction(row))
    .filter((row) => row.portfolioId && portfolioIds.has(row.portfolioId) && (!row.holdingId || holdingIds.has(row.holdingId)));
  const txIds = new Set(portfolioTransactions.map((row) => row.id));

  const portfolioPrincipalRecords = asArray(input.portfolioPrincipalRecords).map((row) => normalizePrincipalRecord(row))
    .filter((row) => row.portfolioId && portfolioIds.has(row.portfolioId) && (!row.transactionId || txIds.has(row.transactionId)));

  const portfolioSnapshots = asArray(input.portfolioSnapshots)
    .filter((row) => row && typeof row === 'object' && portfolioIds.has(row.portfolioId));
  const portfolioBacktests = asArray(input.portfolioBacktests)
    .filter((row) => row && typeof row === 'object');

  return {
    portfolioSchemaVersion: PORTFOLIO_SCHEMA_VERSION,
    portfolios,
    portfolioHoldings,
    portfolioTransactions,
    portfolioPrincipalRecords,
    portfolioSnapshots,
    portfolioBacktests,
    portfolioSettings: {
      ...DEFAULT_PORTFOLIO_SETTINGS,
      ...(input.portfolioSettings && typeof input.portfolioSettings === 'object' ? input.portfolioSettings : {}),
    },
    errors,
  };
}

export function exportPortfolioData(input = {}) {
  return JSON.stringify({
    ...normalizePortfolioPayload(input),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function importPortfolioData(input = {}) {
  return normalizePortfolioPayload(input);
}
