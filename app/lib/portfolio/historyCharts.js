import { ASSET_CLASSES } from './schema.js';

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const parseAssetClassValues = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export function buildPortfolioHistorySeries(snapshots = [], transactions = []) {
  const rows = [...(Array.isArray(snapshots) ? snapshots : [])]
    .filter((snapshot) => snapshot?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const assetClassIds = new Set();
  rows.forEach((snapshot) => {
    Object.keys(parseAssetClassValues(snapshot.assetClassValues)).forEach((id) => assetClassIds.add(id));
  });

  const assetClasses = [...assetClassIds].map((assetClassId) => ({
    id: assetClassId,
    name: ASSET_CLASSES.find((row) => row.id === assetClassId)?.name || assetClassId,
    values: rows.map((snapshot) => asNumber(parseAssetClassValues(snapshot.assetClassValues)[assetClassId])),
    principals: rows.map((snapshot) => asNumber(parseAssetClassValues(snapshot.assetClassPrincipals)[assetClassId])),
    returnRates: rows.map((snapshot) => {
      const value = asNumber(parseAssetClassValues(snapshot.assetClassValues)[assetClassId]);
      const principal = asNumber(parseAssetClassValues(snapshot.assetClassPrincipals)[assetClassId]);
      return principal > 0 ? value / principal - 1 : 0;
    }),
    ratios: rows.map((snapshot) => {
      const totalValue = asNumber(snapshot.totalValue);
      const value = asNumber(parseAssetClassValues(snapshot.assetClassValues)[assetClassId]);
      return totalValue > 0 ? value / totalValue : 0;
    })
  }));

  let peak = 0;
  const drawdowns = rows.map((snapshot) => {
    const value = asNumber(snapshot.totalValue);
    peak = Math.max(peak, value);
    return peak > 0 ? (value - peak) / peak : 0;
  });

  return {
    labels: rows.map((snapshot) => snapshot.date),
    totalValues: rows.map((snapshot) => asNumber(snapshot.totalValue)),
    totalPrincipals: rows.map((snapshot) => asNumber(snapshot.totalPrincipal)),
    totalReturnRates: rows.map((snapshot) => asNumber(snapshot.totalReturnRate)),
    dailyProfits: rows.map((snapshot) => asNumber(snapshot.dailyProfit ?? snapshot.dailyEstimatedProfit)),
    dailyProfitRows: rows.map((snapshot) => ({
      date: snapshot.date,
      value: asNumber(snapshot.dailyProfit ?? snapshot.dailyEstimatedProfit)
    })),
    drawdowns,
    assetClasses,
    transactionEvents: (Array.isArray(transactions) ? transactions : [])
      .filter((transaction) => rows.some((snapshot) => snapshot.date === transaction?.date))
      .map((transaction) => {
        const snapshot = rows.find((row) => row.date === transaction.date);
        return {
          id: transaction.id,
          date: transaction.date,
          value: asNumber(snapshot?.totalValue),
          type: transaction.type || 'adjustment',
          amount: asNumber(transaction.amount),
          note: transaction.note || ''
        };
      })
  };
}
