import { createDefaultPortfolio, normalizePortfolioHolding, PORTFOLIO_SCHEMA_VERSION } from './schema.js';

export function createDefaultPortfolioState({ funds = [], holdings = {}, existingPortfolios = [] } = {}) {
  if (Array.isArray(existingPortfolios) && existingPortfolios.length) {
    return {
      portfolios: existingPortfolios,
      portfolioHoldings: [],
      portfolioSchemaVersion: PORTFOLIO_SCHEMA_VERSION,
    };
  }
  const portfolio = createDefaultPortfolio('permanent', { name: '我的基金组合' });
  const fundByCode = new Map((Array.isArray(funds) ? funds : []).map((fund) => [String(fund?.code || ''), fund]));
  const portfolioHoldings = Object.entries(holdings || {}).map(([code, holding]) => {
    const fund = fundByCode.get(String(code));
    const share = Number(holding?.share) || 0;
    const cost = Number(holding?.cost) || 0;
    return normalizePortfolioHolding({
      portfolioId: portfolio.id,
      assetClassId: 'equity',
      instrumentType: 'fund',
      fundCode: String(code),
      fundName: fund?.name || String(code),
      share,
      costPrice: cost,
      costAmount: share * cost,
      currentNav: Number(fund?.dwjz) || null,
      estimatedNav: Number(fund?.gsz) || Number(fund?.dwjz) || null,
    });
  });
  return {
    portfolios: [portfolio],
    portfolioHoldings,
    portfolioSchemaVersion: PORTFOLIO_SCHEMA_VERSION,
  };
}
