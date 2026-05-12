import { calculatePortfolioSummary } from './calculations.js';
import { createPortfolioId } from './schema.js';

export function createPortfolioSnapshot({ portfolio, holdings = [], date, source = 'manual', note = '' }) {
  const summary = calculatePortfolioSummary(portfolio, holdings);
  const assetClassValues = {};
  const assetClassPrincipals = {};
  for (const row of summary.assetClasses) {
    assetClassValues[row.assetClassId] = row.currentValue;
    assetClassPrincipals[row.assetClassId] = row.principal;
  }
  return {
    id: `snapshot_${createPortfolioId()}`,
    portfolioId: portfolio?.id || '',
    date: date || new Date().toISOString().slice(0, 10),
    totalValue: summary.totalValue,
    totalPrincipal: summary.totalPrincipal,
    totalProfit: summary.totalProfit,
    totalReturnRate: summary.totalReturnRate,
    dailyProfit: summary.dailyEstimatedProfit,
    assetClassValues,
    assetClassPrincipals,
    holdingSnapshots: holdings
      .filter((holding) => !portfolio?.id || holding.portfolioId === portfolio.id)
      .map((holding) => ({
        holdingId: holding.id,
        fundCode: holding.fundCode || '',
        value: Number(holding.currentValue ?? holding.manualValue ?? (holding.share || 0) * (holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0)) || 0,
        principal: Number(holding.costAmount) || 0,
        returnRate: Number(holding.costAmount) ? ((Number(holding.currentValue ?? holding.manualValue ?? (holding.share || 0) * (holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0)) || 0) - Number(holding.costAmount)) / Number(holding.costAmount) : 0,
      })),
    source,
    note,
    createdAt: new Date().toISOString(),
  };
}
