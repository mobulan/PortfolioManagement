import {
  normalizePortfolioHolding,
  normalizePortfolioTransaction,
  normalizePrincipalRecord,
} from './schema.js';

const round6 = (value) => Math.round((Number(value) || 0) * 1000000) / 1000000;

function applyToHolding(holding, transaction) {
  const next = normalizePortfolioHolding(holding);
  const share = Number(transaction.share) || 0;
  const amount = Number(transaction.amount) || 0;
  const fee = Number(transaction.fee) || 0;
  if (['buy', 'convert_in', 'dividend_reinvest'].includes(transaction.type)) {
    next.share = round6(next.share + share);
    next.costAmount = round6(next.costAmount + Math.abs(amount) + Math.abs(fee));
  } else if (['sell', 'convert_out'].includes(transaction.type)) {
    const oldShare = next.share || 0;
    const soldShare = Math.min(oldShare, Math.abs(share));
    const costReduction = oldShare > 0 ? next.costAmount * (soldShare / oldShare) : Math.abs(amount);
    next.share = round6(Math.max(0, oldShare - soldShare));
    next.costAmount = round6(Math.max(0, next.costAmount - costReduction));
  } else if (transaction.type === 'cash_in') {
    next.manualValue = round6((next.manualValue ?? next.currentValue ?? next.costAmount ?? 0) + Math.abs(amount));
    next.costAmount = round6(next.costAmount + Math.abs(amount));
  } else if (transaction.type === 'cash_out') {
    next.manualValue = round6(Math.max(0, (next.manualValue ?? next.currentValue ?? next.costAmount ?? 0) - Math.abs(amount)));
    next.costAmount = round6(Math.max(0, next.costAmount - Math.abs(amount)));
  } else if (transaction.type === 'fee') {
    next.costAmount = round6(next.costAmount + Math.abs(fee || amount));
  } else if (transaction.type === 'adjustment') {
    if (Number.isFinite(Number(transaction.share))) next.share = round6(transaction.share);
    if (Number.isFinite(Number(transaction.amount))) next.costAmount = round6(transaction.amount);
  }
  next.costPrice = next.share > 0 ? round6(next.costAmount / next.share) : 0;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function applyPortfolioTransaction({ holdings = [], principalRecords = [], transaction }) {
  const hasExplicitPrincipalImpact = transaction && Object.prototype.hasOwnProperty.call(transaction, 'principalImpact');
  const tx = normalizePortfolioTransaction(transaction);
  const existing = (Array.isArray(holdings) ? holdings : []).map(normalizePortfolioHolding);
  const targetIndex = existing.findIndex((holding) => holding.id === tx.holdingId);
  const baseHolding = targetIndex >= 0
    ? existing[targetIndex]
    : normalizePortfolioHolding({
      id: tx.holdingId || undefined,
      portfolioId: tx.portfolioId,
      assetClassId: tx.assetClassId,
      fundCode: tx.fundCode,
      fundName: tx.fundCode || '现金',
      instrumentType: tx.type.startsWith('cash') ? 'cash' : 'fund',
    });
  const beforePrincipal = baseHolding.costAmount || 0;
  const updatedHolding = applyToHolding(baseHolding, tx);
  const nextHoldings = targetIndex >= 0 ? [...existing] : [...existing, updatedHolding];
  if (targetIndex >= 0) nextHoldings[targetIndex] = updatedHolding;

  const principalAmount = hasExplicitPrincipalImpact
    ? tx.principalImpact
    : round6(updatedHolding.costAmount - beforePrincipal);
  const nextPrincipalRecords = [...(Array.isArray(principalRecords) ? principalRecords : [])];
  if (principalAmount !== 0) {
    nextPrincipalRecords.push(normalizePrincipalRecord({
      portfolioId: tx.portfolioId,
      holdingId: updatedHolding.id,
      assetClassId: tx.assetClassId,
      date: tx.date,
      type: principalAmount > 0 ? 'increase' : 'decrease',
      amount: principalAmount,
      beforePrincipal,
      afterPrincipal: updatedHolding.costAmount,
      transactionId: tx.id,
      note: tx.note,
    }));
  }

  return {
    holdings: nextHoldings,
    transaction: tx,
    principalRecords: nextPrincipalRecords,
  };
}
