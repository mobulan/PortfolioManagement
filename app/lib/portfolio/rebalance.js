import { calculatePortfolioSummary } from './calculations.js';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const round6 = (value) => Math.round((Number(value) || 0) * 1000000) / 1000000;

const holdingValue = (holding = {}) => {
  if (holding.manualValue !== null && holding.manualValue !== undefined) return Number(holding.manualValue) || 0;
  if (holding.currentValue !== null && holding.currentValue !== undefined) return Number(holding.currentValue) || 0;
  const nav = Number(holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0) || 0;
  return (Number(holding.share) || 0) * nav;
};

const holdingPrice = (holding = {}) => (
  Number(holding.estimatedNav ?? holding.currentNav ?? holding.costPrice ?? 0) || 0
);

const selectRebalanceHolding = (holdings = [], portfolioId = '', assetClassId = '') => (
  (Array.isArray(holdings) ? holdings : [])
    .filter((holding) => (
      (!portfolioId || holding.portfolioId === portfolioId)
      && holding.assetClassId === assetClassId
      && !holding.archived
    ))
    .sort((a, b) => holdingValue(b) - holdingValue(a))[0] || null
);

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

export function createRebalanceTransactionDrafts({
  portfolio,
  holdings = [],
  plan,
  date = new Date().toISOString().slice(0, 10),
} = {}) {
  const rebalancePlan = plan || calculateRebalancePlan(portfolio, holdings);
  const portfolioId = portfolio?.id || rebalancePlan?.portfolioId || '';
  return (rebalancePlan?.items || [])
    .filter((item) => item.action === 'buy' || item.action === 'sell')
    .map((item) => {
      const holding = selectRebalanceHolding(holdings, portfolioId, item.assetClassId);
      if (!holding) return null;
      const amount = Math.abs(Number(item.rebalanceAmount) || 0);
      if (amount <= 0) return null;
      const price = holdingPrice(holding);
      const type = holding.instrumentType === 'cash'
        ? (item.action === 'buy' ? 'cash_in' : 'cash_out')
        : item.action;
      return {
        id: `rebalance_${portfolioId}_${item.assetClassId}_${date}`,
        portfolioId,
        holdingId: holding.id,
        assetClassId: item.assetClassId,
        fundCode: holding.fundCode || '',
        type,
        amount: roundMoney(amount),
        share: price > 0 && holding.instrumentType !== 'cash' ? round6(amount / price) : 0,
        price: price > 0 && holding.instrumentType !== 'cash' ? round6(price) : 0,
        fee: 0,
        date,
        source: 'rebalance',
        note: `${item.assetClassName || item.assetClassId} ${item.action} ${roundMoney(amount)}`,
      };
    })
    .filter(Boolean);
}
