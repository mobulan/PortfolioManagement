import { calculateHoldingMetrics } from './calculations.js';
import { getAssetClassName } from './schema.js';

const DEFAULT_OPTIONS = {
  maxSingleAssetClassRatio: 0.4,
  minSnapshots: 2,
  defaultDeviationThreshold: 0.05
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clampRatio = (value) => Math.min(1, Math.max(0, toNumber(value, 0)));

const round = (value, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

const getSnapshotDailyProfit = (snapshot) => snapshot?.dailyProfit ?? snapshot?.dailyEstimatedProfit ?? 0;

const normalizeSnapshot = (snapshot = {}) => ({
  id: snapshot.id || '',
  portfolioId: snapshot.portfolioId || '',
  date: snapshot.date || snapshot.createdAt || '',
  totalValue: toNumber(snapshot.totalValue),
  totalPrincipal: toNumber(snapshot.totalPrincipal),
  totalProfit: toNumber(snapshot.totalProfit),
  totalReturnRate: toNumber(snapshot.totalReturnRate),
  dailyProfit: toNumber(getSnapshotDailyProfit(snapshot)),
  assetClassValues: snapshot.assetClassValues || {}
});

const sortSnapshots = (snapshots = []) =>
  (Array.isArray(snapshots) ? snapshots : [])
    .map(normalizeSnapshot)
    .filter((snapshot) => snapshot.date || snapshot.id)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

function calculateMaxDrawdown(series) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const row of series) {
    if (row.totalValue > peak) peak = row.totalValue;
    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, (row.totalValue - peak) / peak);
    }
  }
  return Math.abs(maxDrawdown);
}

function buildTrendMetrics(snapshots) {
  const series = sortSnapshots(snapshots);
  const latest = series.at(-1) || null;
  const previous = series.length > 1 ? series.at(-2) : null;
  const first = series[0] || null;
  const totalValueChange = latest && first ? latest.totalValue - first.totalValue : 0;

  return {
    snapshotCount: series.length,
    latest,
    previous,
    first,
    series,
    totalValueChange,
    totalValueChangeRate: first?.totalValue ? totalValueChange / first.totalValue : 0,
    latestChange: latest && previous ? latest.totalValue - previous.totalValue : 0,
    latestChangeRate:
      latest && previous?.totalValue ? (latest.totalValue - previous.totalValue) / previous.totalValue : 0,
    maxDrawdown: calculateMaxDrawdown(series)
  };
}

function buildAssetClassContributions(summary) {
  const rows = Array.isArray(summary?.assetClasses) ? summary.assetClasses : [];
  const totalProfit = toNumber(summary?.totalProfit);

  return rows
    .map((row) => {
      const currentValue = toNumber(row.currentValue);
      const principal = toNumber(row.principal);
      const profit = currentValue - principal;
      return {
        assetClassId: row.assetClassId || 'other',
        assetClassName: row.assetClassName || getAssetClassName(row.assetClassId),
        currentValue,
        principal,
        profit,
        dailyProfit: toNumber(row.dailyEstimatedProfit),
        currentRatio: clampRatio(row.currentRatio),
        targetRatio: clampRatio(row.targetRatio),
        drift: toNumber(row.drift),
        holdingCount: toNumber(row.holdingCount),
        profitContributionRate: totalProfit === 0 ? 0 : profit / totalProfit
      };
    })
    .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));
}

function buildHoldingContributions(holdings = []) {
  const activeHoldings = (Array.isArray(holdings) ? holdings : [])
    .filter((holding) => holding?.enabled !== false && !holding?.archived)
    .map(calculateHoldingMetrics);
  const totalProfit = activeHoldings.reduce((sum, holding) => sum + holding.totalProfit, 0);

  return activeHoldings
    .map((holding) => ({
      holdingId: holding.id,
      fundCode: holding.fundCode || '',
      fundName: holding.fundName || '',
      assetClassId: holding.assetClassId || 'other',
      assetClassName: getAssetClassName(holding.assetClassId),
      currentValue: holding.currentValue,
      principal: holding.totalPrincipal,
      profit: holding.totalProfit,
      totalReturnRate: holding.totalReturnRate,
      dailyProfit: holding.dailyEstimatedProfit,
      profitContributionRate: totalProfit === 0 ? 0 : holding.totalProfit / totalProfit
    }))
    .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));
}

function buildRiskAlerts({ summary, trend, options }) {
  const alerts = [];
  const assetClasses = Array.isArray(summary?.assetClasses) ? summary.assetClasses : [];
  const hasInvestedAssets = toNumber(summary?.totalValue) > 0;

  if (trend.snapshotCount < options.minSnapshots) {
    alerts.push({
      code: 'snapshot_insufficient',
      severity: 'medium',
      title: '快照不足',
      message: `当前只有 ${trend.snapshotCount} 条快照，趋势判断至少需要 ${options.minSnapshots} 条。`,
      current: trend.snapshotCount,
      threshold: options.minSnapshots
    });
  }

  for (const row of hasInvestedAssets ? assetClasses : []) {
    const currentRatio = clampRatio(row.currentRatio);
    const targetRatio = clampRatio(row.targetRatio);
    const drift = currentRatio - targetRatio;
    const threshold = clampRatio(row.rebalanceThreshold ?? options.defaultDeviationThreshold);
    const assetClassId = row.assetClassId || 'other';
    const assetClassName = row.assetClassName || getAssetClassName(assetClassId);

    if (currentRatio > options.maxSingleAssetClassRatio) {
      alerts.push({
        code: 'asset_class_overweight',
        severity: 'high',
        assetClassId,
        assetClassName,
        title: '单类资产占比过高',
        message: `${assetClassName} 当前占比 ${round(currentRatio * 100, 2)}%，高于 ${round(options.maxSingleAssetClassRatio * 100, 2)}% 上限。`,
        currentRatio,
        threshold: options.maxSingleAssetClassRatio
      });
    }

    if (Math.abs(drift) > threshold) {
      alerts.push({
        code: 'target_deviation',
        severity: 'high',
        assetClassId,
        assetClassName,
        title: '目标偏离',
        message: `${assetClassName} 偏离目标 ${round(drift * 100, 2)} 个百分点，超过 ${round(threshold * 100, 2)} 个百分点阈值。`,
        currentRatio,
        targetRatio,
        drift,
        threshold
      });
    }
  }

  return alerts;
}

function summarizeAlerts(alerts) {
  return alerts.reduce(
    (summary, alert) => {
      summary.total += 1;
      summary[alert.severity] = (summary[alert.severity] || 0) + 1;
      return summary;
    },
    { total: 0, high: 0, medium: 0, low: 0 }
  );
}

export function buildDashboardRiskMetrics({
  portfolio = null,
  snapshots = [],
  holdings = [],
  summary = null,
  options = {}
} = {}) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const trend = buildTrendMetrics(snapshots);
  const contributions = {
    assetClasses: buildAssetClassContributions(summary),
    holdings: buildHoldingContributions(holdings)
  };
  const alerts = buildRiskAlerts({ portfolio, summary, trend, options: mergedOptions });

  return {
    portfolioId: portfolio?.id || summary?.portfolioId || '',
    trend,
    contributions,
    alerts,
    alertSummary: summarizeAlerts(alerts)
  };
}
