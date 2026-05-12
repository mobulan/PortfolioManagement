import { getAssetClassName, normalizePortfolioHolding } from './schema.js';

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export function getHoldingUnitValue(holding) {
  if (!holding) return 0;
  if (holding.manualValue !== null && holding.manualValue !== undefined) return toNumber(holding.manualValue);
  if (holding.currentValue !== null && holding.currentValue !== undefined) return toNumber(holding.currentValue);
  const nav = holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0;
  return toNumber(holding.share) * toNumber(nav);
}

export function calculateHoldingMetrics(input) {
  const holding = normalizePortfolioHolding(input);
  const currentValue = getHoldingUnitValue(holding);
  const totalPrincipal = toNumber(holding.costAmount);
  const totalProfit = currentValue - totalPrincipal;
  const totalReturnRate = totalPrincipal === 0 ? 0 : totalProfit / totalPrincipal;
  let dailyEstimatedProfit = 0;
  if (holding.estimatedNav !== null && holding.previousNav !== null) {
    dailyEstimatedProfit = holding.share * (holding.estimatedNav - holding.previousNav);
  }
  return {
    ...holding,
    currentValue,
    totalPrincipal,
    totalProfit,
    totalReturnRate,
    dailyEstimatedProfit,
  };
}

export function filterPortfolioHoldings(portfolio, holdings = []) {
  const portfolioId = portfolio?.id;
  return (Array.isArray(holdings) ? holdings : [])
    .map(normalizePortfolioHolding)
    .filter((holding) => holding.enabled && !holding.archived && (!portfolioId || holding.portfolioId === portfolioId));
}

export function summarizeAssetClasses(portfolio, holdings = []) {
  const activeHoldings = filterPortfolioHoldings(portfolio, holdings).map(calculateHoldingMetrics);
  const totalValue = activeHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const byClass = new Map();
  for (const holding of activeHoldings) {
    const prev = byClass.get(holding.assetClassId) || {
      assetClassId: holding.assetClassId,
      assetClassName: getAssetClassName(holding.assetClassId),
      currentValue: 0,
      principal: 0,
      dailyEstimatedProfit: 0,
      holdingCount: 0,
    };
    prev.currentValue += holding.currentValue;
    prev.principal += holding.totalPrincipal;
    prev.dailyEstimatedProfit += holding.dailyEstimatedProfit;
    prev.holdingCount += 1;
    byClass.set(holding.assetClassId, prev);
  }
  for (const allocation of portfolio?.targetAllocations || []) {
    if (!byClass.has(allocation.assetClassId)) {
      byClass.set(allocation.assetClassId, {
        assetClassId: allocation.assetClassId,
        assetClassName: allocation.assetClassName || getAssetClassName(allocation.assetClassId),
        currentValue: 0,
        principal: 0,
        dailyEstimatedProfit: 0,
        holdingCount: 0,
      });
    }
  }
  return Array.from(byClass.values()).map((row) => {
    const targetRatio = (portfolio?.targetAllocations || []).find((a) => a.assetClassId === row.assetClassId)?.targetRatio ?? 0;
    const currentRatio = totalValue === 0 ? 0 : row.currentValue / totalValue;
    return {
      ...row,
      targetRatio,
      currentRatio,
      drift: currentRatio - targetRatio,
    };
  });
}

export function calculatePortfolioSummary(portfolio, holdings = []) {
  const activeHoldings = filterPortfolioHoldings(portfolio, holdings).map(calculateHoldingMetrics);
  const totalValue = activeHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalPrincipal = activeHoldings.reduce((sum, holding) => sum + holding.totalPrincipal, 0);
  const totalProfit = totalValue - totalPrincipal;
  const dailyEstimatedProfit = activeHoldings.reduce((sum, holding) => sum + holding.dailyEstimatedProfit, 0);
  const assetClasses = summarizeAssetClasses(portfolio, activeHoldings);
  const theta = assetClasses.reduce((sum, row) => sum + Math.abs(row.drift), 0);
  return {
    portfolioId: portfolio?.id || '',
    totalValue,
    totalPrincipal,
    totalProfit,
    totalReturnRate: totalPrincipal === 0 ? 0 : totalProfit / totalPrincipal,
    dailyEstimatedProfit,
    dailyEstimatedReturnRate: totalValue === 0 ? 0 : dailyEstimatedProfit / totalValue,
    holdingCount: activeHoldings.length,
    assetClassCount: assetClasses.filter((row) => row.currentValue > 0).length,
    theta,
    assetClasses,
  };
}

export function aggregateDashboard(portfolios = [], holdings = []) {
  const summaries = (Array.isArray(portfolios) ? portfolios : [])
    .filter((portfolio) => !portfolio.archived)
    .map((portfolio) => calculatePortfolioSummary(portfolio, holdings));
  const totalValue = summaries.reduce((sum, row) => sum + row.totalValue, 0);
  const totalPrincipal = summaries.reduce((sum, row) => sum + row.totalPrincipal, 0);
  const dailyEstimatedProfit = summaries.reduce((sum, row) => sum + row.dailyEstimatedProfit, 0);
  return {
    totalValue,
    totalPrincipal,
    totalProfit: totalValue - totalPrincipal,
    totalReturnRate: totalPrincipal === 0 ? 0 : (totalValue - totalPrincipal) / totalPrincipal,
    dailyEstimatedProfit,
    dailyEstimatedReturnRate: totalValue === 0 ? 0 : dailyEstimatedProfit / totalValue,
    portfolioCount: summaries.length,
    summaries,
  };
}
