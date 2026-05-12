import { calculatePortfolioSummary } from './calculations.js';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function calculateRebalancePlan(portfolio, holdings = [], options = {}) {
  const summary = calculatePortfolioSummary(portfolio, holdings);
  const totalValue = summary.totalValue;
  const defaultThreshold = portfolio?.rebalanceConfig?.defaultThreshold ?? 0.05;
  const items = summary.assetClasses.map((row) => {
    const threshold = (portfolio?.targetAllocations || []).find((a) => a.assetClassId === row.assetClassId)?.rebalanceThreshold ?? defaultThreshold;
    const targetAmount = totalValue * row.targetRatio;
    const rebalanceAmount = targetAmount - row.currentValue;
    const action = Math.abs(row.drift) <= threshold
      ? 'hold'
      : rebalanceAmount > 0
        ? 'buy'
        : 'sell';
    return {
      assetClassId: row.assetClassId,
      assetClassName: row.assetClassName,
      currentValue: roundMoney(row.currentValue),
      targetRatio: row.targetRatio,
      currentRatio: row.currentRatio,
      drift: row.drift,
      threshold,
      targetAmount: roundMoney(targetAmount),
      rebalanceAmount: roundMoney(rebalanceAmount),
      action,
    };
  });
  return {
    portfolioId: portfolio?.id || '',
    totalValue: roundMoney(totalValue),
    theta: summary.theta,
    thresholdAmount: roundMoney(totalValue * summary.theta),
    mode: options.mode || portfolio?.rebalanceConfig?.mode || 'threshold',
    items,
  };
}

export function calculateProportionalCashPlan(portfolio, cashflow = 0) {
  const amount = Number(cashflow) || 0;
  return {
    totalCashflow: roundMoney(amount),
    mode: 'proportional',
    items: (portfolio?.targetAllocations || []).map((allocation) => ({
      assetClassId: allocation.assetClassId,
      assetClassName: allocation.assetClassName,
      amount: roundMoney(amount * allocation.targetRatio),
      action: amount >= 0 ? 'buy' : 'sell',
    })),
  };
}

export function calculateSmartCashPlan(portfolio, holdings = [], cashflow = 0) {
  const amount = Number(cashflow) || 0;
  const rebalance = calculateRebalancePlan(portfolio, holdings);
  const absAmount = Math.abs(amount);
  if (absAmount > rebalance.thresholdAmount && rebalance.thresholdAmount > 0) {
    return calculateProportionalCashPlan(portfolio, amount);
  }

  const candidates = [...rebalance.items]
    .filter((item) => amount >= 0 ? item.rebalanceAmount > 0 : item.rebalanceAmount < 0)
    .sort((a, b) => amount >= 0 ? b.rebalanceAmount - a.rebalanceAmount : a.rebalanceAmount - b.rebalanceAmount);
  let remaining = absAmount;
  const items = candidates.map((item) => {
    const desired = Math.abs(item.rebalanceAmount);
    const allocated = Math.min(remaining, desired);
    remaining -= allocated;
    return {
      assetClassId: item.assetClassId,
      assetClassName: item.assetClassName,
      amount: roundMoney(allocated),
      action: amount >= 0 ? 'buy' : 'sell',
    };
  }).filter((item) => item.amount > 0);

  if (remaining > 0 && candidates.length > 0) {
    items[0].amount = roundMoney(items[0].amount + remaining);
  }

  return {
    totalCashflow: roundMoney(amount),
    mode: amount >= 0 ? 'smart_fill' : 'smart_trim',
    items,
  };
}
