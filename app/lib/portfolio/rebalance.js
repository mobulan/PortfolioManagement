import { calculatePortfolioSummary } from './calculations.js';
import { normalizePortfolioFundCandidate } from './holdingForm.js';

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

const holdingTradeValue = (holding = {}, price = holdingPrice(holding)) => {
  if (holding.instrumentType === 'cash') return Number(holding.manualValue ?? holding.currentValue ?? holding.costAmount ?? 0) || 0;
  if (holding.manualValue !== null && holding.manualValue !== undefined) return Number(holding.manualValue) || 0;
  if (holding.currentValue !== null && holding.currentValue !== undefined) return Number(holding.currentValue) || 0;
  return (Number(holding.share) || 0) * (Number(price) || 0);
};

const buildFundCandidateMap = (funds = []) => {
  const map = new Map();
  (Array.isArray(funds) ? funds : []).forEach((fund) => {
    const candidate = normalizePortfolioFundCandidate(fund);
    if (!candidate?.code || map.has(candidate.code)) return;
    map.set(candidate.code, { raw: fund, candidate });
  });
  return map;
};

export function resolveHoldingTradePrice(holding = {}, fundEntry = null) {
  if (holding.instrumentType === 'cash') {
    return { price: 0, source: 'cash', time: '' };
  }
  const raw = fundEntry?.raw || {};
  const candidate = fundEntry?.candidate || null;
  const hasRawEstimated = (
    raw.gsz !== null && raw.gsz !== undefined && raw.gsz !== ''
  ) || (
    raw.estimatedNav !== null && raw.estimatedNav !== undefined && raw.estimatedNav !== ''
  );
  const estimated = Number(hasRawEstimated ? (raw.gsz ?? raw.estimatedNav) : NaN);
  if (Number.isFinite(estimated) && estimated > 0) {
    return { price: round6(estimated), source: 'estimated', time: raw.gztime || '' };
  }
  const latestNav = Number(raw.dwjz ?? raw.currentNav ?? candidate?.currentNav);
  if (Number.isFinite(latestNav) && latestNav > 0) {
    return { price: round6(latestNav), source: 'latestNav', time: raw.jzrq || '' };
  }
  const holdingEstimated = Number(holding.estimatedNav);
  if (Number.isFinite(holdingEstimated) && holdingEstimated > 0) {
    return { price: round6(holdingEstimated), source: 'holdingEstimated', time: '' };
  }
  const holdingCurrent = Number(holding.currentNav);
  if (Number.isFinite(holdingCurrent) && holdingCurrent > 0) {
    return { price: round6(holdingCurrent), source: 'holdingCurrent', time: '' };
  }
  return { price: 0, source: 'missing', time: '' };
}

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
  if (absAmount > rebalance.thresholdAmount) {
    return {
      ...calculateProportionalCashPlan(portfolio, amount),
      theta: rebalance.theta,
      thresholdAmount: rebalance.thresholdAmount,
    };
  }

  const futureTotal = rebalance.totalValue + amount;
  const gaps = rebalance.items.map((item) => ({
    ...item,
    futureGap: roundMoney((futureTotal * item.targetRatio) - item.currentValue),
  }));
  const candidates = gaps.filter((item) => amount >= 0 ? item.futureGap > 0 : item.futureGap < 0);
  const totalGap = candidates.reduce((sum, item) => sum + Math.abs(item.futureGap), 0);
  const action = amount >= 0 ? 'buy' : 'sell';
  const items = [];

  if (totalGap > 0) {
    if (absAmount >= totalGap) {
      const surplus = absAmount - totalGap;
      rebalance.items.forEach((item) => {
        const gap = gaps.find((gapItem) => gapItem.assetClassId === item.assetClassId)?.futureGap || 0;
        const gapAmount = amount >= 0
          ? Math.max(0, gap)
          : Math.abs(Math.min(0, gap));
        const allocated = gapAmount + (surplus * item.targetRatio);
        if (allocated <= 0) return;
        items.push({
          assetClassId: item.assetClassId,
          assetClassName: item.assetClassName,
          amount: roundMoney(allocated),
          action,
        });
      });
    } else {
      candidates.forEach((item) => {
        const allocated = absAmount * (Math.abs(item.futureGap) / totalGap);
        if (allocated <= 0) return;
        items.push({
          assetClassId: item.assetClassId,
          assetClassName: item.assetClassName,
          amount: roundMoney(allocated),
          action,
        });
      });
    }
  } else {
    rebalance.items.forEach((item) => {
      const allocated = absAmount * item.targetRatio;
      if (allocated <= 0) return;
      items.push({
        assetClassId: item.assetClassId,
        assetClassName: item.assetClassName,
        amount: roundMoney(allocated),
        action,
      });
    });
  }

  return {
    totalCashflow: roundMoney(amount),
    mode: amount >= 0 ? 'smart_fill' : 'smart_trim',
    theta: rebalance.theta,
    thresholdAmount: rebalance.thresholdAmount,
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

export function createSmartTradeDrafts({
  portfolio,
  holdings = [],
  funds = [],
  plan,
  date = new Date().toISOString().slice(0, 10),
} = {}) {
  const portfolioId = portfolio?.id || '';
  const cashPlan = plan || calculateSmartCashPlan(portfolio, holdings, 0);
  const fundMap = buildFundCandidateMap(funds);
  const activeHoldings = (Array.isArray(holdings) ? holdings : [])
    .filter((holding) => (
      (!portfolioId || holding.portfolioId === portfolioId)
      && !holding.archived
      && holding.enabled !== false
    ));
  const blockingWarnings = [];
  const rows = [];

  const totalSellRequest = (cashPlan?.items || [])
    .filter((item) => item.action === 'sell')
    .reduce((sum, item) => sum + Math.abs(Number(item.amount) || 0), 0);
  if (totalSellRequest > 0) {
    const totalAvailableValue = activeHoldings.reduce((sum, holding) => {
      const priceInfo = resolveHoldingTradePrice(holding, fundMap.get(holding.fundCode));
      return sum + holdingTradeValue(holding, priceInfo.price);
    }, 0);
    if (totalSellRequest > totalAvailableValue + 0.01) {
      blockingWarnings.push({
        code: 'sell_amount_exceeds_available_value',
        message: 'Sell amount exceeds available portfolio value.',
      });
    }
  }

  (cashPlan?.items || []).forEach((item) => {
    const action = item.action === 'sell' ? 'sell' : 'buy';
    const requestedAmount = Math.abs(Number(item.amount) || 0);
    if (requestedAmount <= 0) return;
    const classHoldings = activeHoldings
      .filter((holding) => holding.assetClassId === item.assetClassId)
      .map((holding) => {
        const priceInfo = resolveHoldingTradePrice(holding, fundMap.get(holding.fundCode));
        return {
          holding,
          priceInfo,
          currentValue: holdingTradeValue(holding, priceInfo.price),
        };
      })
      .filter((entry) => entry.holding);
    if (!classHoldings.length) {
      blockingWarnings.push({
        code: 'asset_class_has_no_holding',
        assetClassId: item.assetClassId,
        message: `No holding exists for ${item.assetClassName || item.assetClassId}.`,
      });
      return;
    }

    let remaining = requestedAmount;
    const ordered = action === 'sell'
      ? [...classHoldings].sort((a, b) => b.currentValue - a.currentValue)
      : [...classHoldings].sort((a, b) => a.currentValue - b.currentValue);

    ordered.forEach((entry) => {
      if (remaining <= 0) return;
      const { holding, priceInfo } = entry;
      const isCash = holding.instrumentType === 'cash';
      const maxAmount = action === 'sell' ? entry.currentValue : remaining;
      const amount = roundMoney(Math.min(remaining, maxAmount));
      if (amount <= 0) return;
      const price = priceInfo.price;
      const canCalculateShare = !isCash && price > 0;
      const share = canCalculateShare ? round6(amount / price) : 0;
      const currentShare = Number(holding.share) || 0;
      const projectedShare = action === 'sell'
        ? round6(Math.max(0, currentShare - share))
        : round6(currentShare + share);
      const projectedValue = action === 'sell'
        ? roundMoney(Math.max(0, entry.currentValue - amount))
        : roundMoney(entry.currentValue + amount);
      const warning = priceInfo.source === 'missing' && !isCash
        ? 'missing_price'
        : action === 'sell' && amount < remaining
          ? 'sell_clipped_to_available_value'
          : '';

      rows.push({
        id: `smart_trade_${portfolioId}_${holding.id}_${action}_${date}`,
        portfolioId,
        holdingId: holding.id,
        assetClassId: item.assetClassId,
        assetClassName: item.assetClassName || item.assetClassId,
        fundCode: holding.fundCode || '',
        fundName: holding.fundName || holding.fundCode || holding.id,
        type: isCash ? (action === 'buy' ? 'cash_in' : 'cash_out') : action,
        amount,
        price,
        priceSource: priceInfo.source,
        priceTime: priceInfo.time,
        share,
        currentShare: round6(currentShare),
        currentValue: roundMoney(entry.currentValue),
        projectedShare,
        projectedValue,
        warning,
        fee: 0,
        date,
        source: 'smart_trade',
        note: `smart_trade:${cashPlan.mode || 'unknown'}`,
      });
      remaining = roundMoney(remaining - amount);
    });

    if (remaining > 0.01) {
      blockingWarnings.push({
        code: action === 'sell' ? 'asset_class_sell_amount_exceeds_available_value' : 'asset_class_unallocated_amount',
        assetClassId: item.assetClassId,
        amount: roundMoney(remaining),
        message: `${item.assetClassName || item.assetClassId} has ${roundMoney(remaining)} unallocated.`,
      });
    }
  });

  return {
    mode: cashPlan?.mode || '',
    totalCashflow: roundMoney(cashPlan?.totalCashflow || 0),
    rows,
    blockingWarnings,
    warnings: rows.filter((row) => row.warning).map((row) => ({
      code: row.warning,
      holdingId: row.holdingId,
    })),
  };
}
