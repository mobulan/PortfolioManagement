import {
  normalizePortfolioHolding,
  normalizePortfolioTransaction,
  normalizePrincipalRecord,
} from './schema.js';

const round6 = (value) => Math.round((Number(value) || 0) * 1000000) / 1000000;
const transactionTypeOrder = {
  cash_in: 10,
  buy: 20,
  dividend_reinvest: 30,
  sell: 40,
  convert_out: 50,
  convert_in: 60,
  dividend_cash: 70,
  cash_out: 80,
  fee: 90,
  adjustment: 100,
};

const sortTransactions = (transactions = []) => [...(Array.isArray(transactions) ? transactions : [])]
  .map((transaction) => ({
    transaction,
    normalized: normalizePortfolioTransaction(transaction),
  }))
  .sort((a, b) => (
    String(a.normalized.date).localeCompare(String(b.normalized.date))
    || ((transactionTypeOrder[a.normalized.type] || 999) - (transactionTypeOrder[b.normalized.type] || 999))
    || String(a.normalized.id).localeCompare(String(b.normalized.id))
  ))
  .map((entry) => entry.transaction);

const stableLedgerTimestamp = (transaction) => (
  transaction.date ? `${transaction.date}T00:00:00.000Z` : (transaction.updatedAt || transaction.createdAt || new Date().toISOString())
);

function applyToHolding(holding, transaction, updatedAt = new Date().toISOString()) {
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
  } else if (transaction.type === 'dividend_cash') {
    if (next.instrumentType === 'cash' || next.assetClassId === 'cash') {
      next.manualValue = round6((next.manualValue ?? next.currentValue ?? next.costAmount ?? 0) + Math.abs(amount));
    }
  } else if (transaction.type === 'adjustment') {
    if (Number.isFinite(Number(transaction.share))) next.share = round6(transaction.share);
    if (Number.isFinite(Number(transaction.amount))) next.costAmount = round6(transaction.amount);
  }
  next.costPrice = next.share > 0 ? round6(next.costAmount / next.share) : 0;
  next.updatedAt = updatedAt;
  return next;
}

export function applyPortfolioTransaction({
  holdings = [],
  principalRecords = [],
  transaction,
  updatedAt,
  deterministicPrincipalIds = false,
}) {
  const hasExplicitPrincipalImpact = transaction && Object.prototype.hasOwnProperty.call(transaction, 'principalImpact');
  const tx = normalizePortfolioTransaction(transaction);
  const holdingUpdatedAt = updatedAt || new Date().toISOString();
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
      createdAt: holdingUpdatedAt,
      updatedAt: holdingUpdatedAt,
    });
  const beforePrincipal = baseHolding.costAmount || 0;
  const updatedHolding = applyToHolding(baseHolding, tx, holdingUpdatedAt);
  const nextHoldings = targetIndex >= 0 ? [...existing] : [...existing, updatedHolding];
  if (targetIndex >= 0) nextHoldings[targetIndex] = updatedHolding;

  const principalAmount = hasExplicitPrincipalImpact
    ? tx.principalImpact
    : round6(updatedHolding.costAmount - beforePrincipal);
  const nextPrincipalRecords = [...(Array.isArray(principalRecords) ? principalRecords : [])];
  if (principalAmount !== 0) {
    nextPrincipalRecords.push(normalizePrincipalRecord({
      id: deterministicPrincipalIds ? `principal_${tx.id}` : undefined,
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

export function rebuildPortfolioLedgerFromTransactions({ holdings = [], transactions = [] } = {}) {
  const sortedTransactions = sortTransactions(transactions);
  return sortedTransactions.reduce((ledger, transaction) => {
    const result = applyPortfolioTransaction({
      holdings: ledger.holdings,
      principalRecords: ledger.principalRecords,
      transaction,
      updatedAt: stableLedgerTimestamp(transaction),
      deterministicPrincipalIds: true,
    });
    return {
      holdings: result.holdings,
      transactions: [...ledger.transactions, result.transaction],
      principalRecords: result.principalRecords,
    };
  }, {
    holdings: (Array.isArray(holdings) ? holdings : []).map(normalizePortfolioHolding),
    transactions: [],
    principalRecords: [],
  });
}

export function createPortfolioTransactionBaseline({ portfolioId = '', holdings = [], createdAt = new Date().toISOString() } = {}) {
  const baselineHoldings = (Array.isArray(holdings) ? holdings : [])
    .map(normalizePortfolioHolding)
    .filter((holding) => !portfolioId || holding.portfolioId === portfolioId)
    .map((holding) => ({
      ...holding,
      baselineCreatedAt: createdAt,
    }));

  return {
    id: `transaction_baseline_${portfolioId || 'all'}_${Date.parse(createdAt) || Date.now()}`,
    portfolioId,
    createdAt,
    holdings: baselineHoldings,
  };
}

export function rebuildPortfolioAfterTransactionDelete({
  portfolioId = '',
  baseline,
  holdings = [],
  transactions = [],
  principalRecords = [],
  transactionId = '',
} = {}) {
  const scopedBaselineHoldings = (baseline?.holdings || [])
    .map(normalizePortfolioHolding)
    .filter((holding) => !portfolioId || holding.portfolioId === portfolioId);
  const otherHoldings = (Array.isArray(holdings) ? holdings : [])
    .map(normalizePortfolioHolding)
    .filter((holding) => portfolioId && holding.portfolioId !== portfolioId);
  const remainingTransactions = (Array.isArray(transactions) ? transactions : [])
    .map(normalizePortfolioTransaction)
    .filter((transaction) => transaction.id !== transactionId);
  const scopedTransactions = remainingTransactions
    .filter((transaction) => !portfolioId || transaction.portfolioId === portfolioId);
  const otherTransactions = remainingTransactions
    .filter((transaction) => portfolioId && transaction.portfolioId !== portfolioId);
  const otherPrincipalRecords = (Array.isArray(principalRecords) ? principalRecords : [])
    .map(normalizePrincipalRecord)
    .filter((record) => portfolioId && record.portfolioId !== portfolioId);

  const rebuilt = rebuildPortfolioLedgerFromTransactions({
    holdings: scopedBaselineHoldings,
    transactions: scopedTransactions,
  });

  return {
    holdings: [...otherHoldings, ...rebuilt.holdings],
    transactions: [...otherTransactions, ...rebuilt.transactions],
    principalRecords: [...otherPrincipalRecords, ...rebuilt.principalRecords],
  };
}
