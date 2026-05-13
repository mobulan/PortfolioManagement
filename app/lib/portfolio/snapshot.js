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

const getToday = () => new Date().toISOString().slice(0, 10);

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getPortfolioSnapshotSettings = (portfolioSettings = {}, portfolioId = '') => {
  const scoped = portfolioSettings?.portfolioSnapshotSettings?.[portfolioId];
  return {
    ...(isObject(portfolioSettings) ? portfolioSettings : {}),
    ...(isObject(scoped) ? scoped : {}),
  };
};

const isAutomaticSnapshotEnabled = (settings) => (
  settings.automaticDailySnapshotEnabled === true
  || settings.autoSnapshotEnabled === true
  || settings.snapshotReminderEnabled === true
);

const getAutomaticSnapshotConflictMode = (settings) => (
  ['skip', 'overwrite'].includes(settings.automaticSnapshotConflictMode)
    ? settings.automaticSnapshotConflictMode
    : 'skip'
);

const sortSnapshots = (snapshots) => [...snapshots].sort((a, b) => {
  const dateOrder = String(a?.date || '').localeCompare(String(b?.date || ''));
  if (dateOrder) return dateOrder;
  return String(a?.portfolioId || '').localeCompare(String(b?.portfolioId || ''));
});

export function prepareAutomaticDailySnapshot({
  portfolio,
  holdings = [],
  snapshots = [],
  portfolioSettings = {},
  date = getToday(),
} = {}) {
  if (!portfolio?.id) {
    return {
      status: 'skipped',
      reason: 'missing_portfolio',
      snapshot: null,
      snapshots,
      shouldPersist: false,
    };
  }

  const settings = getPortfolioSnapshotSettings(portfolioSettings, portfolio.id);
  if (!isAutomaticSnapshotEnabled(settings)) {
    return {
      status: 'skipped',
      reason: 'disabled',
      snapshot: null,
      snapshots,
      shouldPersist: false,
    };
  }

  const rows = Array.isArray(snapshots) ? snapshots : [];
  const existing = rows.find((row) => row?.portfolioId === portfolio.id && row?.date === date);
  const conflictMode = getAutomaticSnapshotConflictMode(settings);

  if (existing && conflictMode !== 'overwrite') {
    return {
      status: 'skipped',
      reason: 'already_exists',
      snapshot: existing,
      snapshots,
      shouldPersist: false,
    };
  }

  const snapshot = createPortfolioSnapshot({
    portfolio,
    holdings,
    date,
    source: 'auto',
    note: 'Automatic daily snapshot',
  });
  const nextSnapshots = existing
    ? rows.map((row) => (row?.portfolioId === portfolio.id && row?.date === date ? snapshot : row))
    : [...rows, snapshot];

  return {
    status: 'created',
    reason: existing ? 'overwritten' : 'created',
    snapshot,
    snapshots: sortSnapshots(nextSnapshots),
    shouldPersist: true,
  };
}
