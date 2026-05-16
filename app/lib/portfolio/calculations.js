import { getAssetClassName, normalizePortfolioHolding } from './schema.js';

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const clampPercent = (value) => Math.min(100, Math.max(0, round2(value)));
const formatSignedPct = (value) => {
  const pct = (Number(value) || 0) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
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
    const allocation = (portfolio?.targetAllocations || []).find((a) => a.assetClassId === row.assetClassId);
    const targetRatio = allocation?.targetRatio ?? 0;
    const threshold = allocation?.rebalanceThreshold ?? portfolio?.rebalanceConfig?.defaultThreshold ?? 0.05;
    const currentRatio = totalValue === 0 ? 0 : row.currentValue / totalValue;
    return {
      ...row,
      targetRatio,
      threshold,
      currentRatio,
      drift: currentRatio - targetRatio,
    };
  });
}

export function createAssetDriftDisplay(row = {}) {
  const currentRatio = toNumber(row.currentRatio);
  const targetRatio = toNumber(row.targetRatio);
  const threshold = Math.max(0, toNumber(row.threshold ?? row.rebalanceThreshold, 0.05));
  const drift = currentRatio - targetRatio;
  const lowerRatio = Math.max(0, targetRatio - threshold);
  const upperRatio = Math.min(1, targetRatio + threshold);
  const axisMin = targetRatio - threshold;
  const axisMax = targetRatio + threshold;
  const axisSpan = Math.max(axisMax - axisMin, 0.000001);
  const targetPosition = clampPercent(((targetRatio - axisMin) / axisSpan) * 100);
  const currentPosition = clampPercent(((currentRatio - axisMin) / axisSpan) * 100);
  const rangeStart = clampPercent(((lowerRatio - axisMin) / axisSpan) * 100);
  const rangeEnd = clampPercent(((upperRatio - axisMin) / axisSpan) * 100);
  const absDrift = Math.abs(drift);
  const nearBoundaryStart = threshold * 0.8;
  const severeStart = threshold * 1.5;
  let status = 'normal';
  let statusText = '正常';
  let tone = 'normal';

  if (threshold > 0 && absDrift > threshold) {
    status = 'rebalance';
    statusText = '建议再平衡';
    tone = absDrift >= severeStart ? 'danger' : 'warning';
  } else if (threshold > 0 && absDrift >= nearBoundaryStart) {
    status = drift < 0 ? 'near_lower' : 'near_upper';
    statusText = drift < 0 ? '接近下限' : '接近上限';
    tone = 'caution';
  }

  return {
    assetClassId: row.assetClassId || '',
    assetClassName: row.assetClassName || getAssetClassName(row.assetClassId),
    currentRatio,
    targetRatio,
    threshold,
    lowerRatio,
    upperRatio,
    drift,
    driftText: drift < 0 ? `低配 ${formatSignedPct(drift)}` : drift > 0 ? `超配 ${formatSignedPct(drift)}` : '无偏离',
    status,
    statusText,
    tone,
    targetPosition,
    currentPosition,
    rangeStart,
    rangeEnd,
  };
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
