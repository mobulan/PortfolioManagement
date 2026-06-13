import { calculateHoldingMetrics, calculatePortfolioSummary } from './calculations.js';
import { createAssetDriftDisplay } from './calculations.js';

const daysBetween = (left, right) => {
  const start = Date.parse(left);
  const end = Date.parse(right);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000));
};

export function buildPortfolioDataQuality({
  portfolio,
  holdings = [],
  snapshots = [],
  transactions = [],
  now = new Date().toISOString()
} = {}) {
  const scopedHoldings = (Array.isArray(holdings) ? holdings : []).filter(
    (row) => row.portfolioId === portfolio?.id && !row.archived
  );
  const issues = [];

  scopedHoldings.forEach((holding) => {
    const metrics = calculateHoldingMetrics(holding);
    if (holding.instrumentType === 'fund' && !holding.fundCode) {
      issues.push({
        severity: 'high',
        code: 'missing_fund_code',
        holdingId: holding.id,
        message: `${holding.fundName} 缺少基金代码`
      });
    }
    if (holding.instrumentType === 'fund' && !Number(holding.estimatedNav ?? holding.currentNav ?? holding.costPrice)) {
      issues.push({
        severity: 'high',
        code: 'missing_nav',
        holdingId: holding.id,
        message: `${holding.fundName} 缺少可用净值`
      });
    }
    if (Number(holding.share) < 0 || Number(holding.costAmount) < 0 || metrics.currentValue < 0) {
      issues.push({
        severity: 'high',
        code: 'negative_value',
        holdingId: holding.id,
        message: `${holding.fundName} 存在负数持仓数据`
      });
    }
    if (holding.updatedAt && daysBetween(holding.updatedAt, now) > 14) {
      issues.push({
        severity: 'medium',
        code: 'stale_holding',
        holdingId: holding.id,
        message: `${holding.fundName} 已超过 14 天未更新`
      });
    }
  });

  const sortedSnapshots = (Array.isArray(snapshots) ? snapshots : [])
    .filter((row) => row.portfolioId === portfolio?.id)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (sortedSnapshots.length < 2) {
    issues.push({
      severity: 'medium',
      code: 'insufficient_snapshots',
      message: '历史快照不足 2 条，趋势与风险指标可信度有限'
    });
  } else if (daysBetween(sortedSnapshots.at(-1)?.date, now.slice(0, 10)) > 7) {
    issues.push({ severity: 'medium', code: 'stale_snapshot', message: '最近一条快照已超过 7 天' });
  }

  const plannedCount = (Array.isArray(transactions) ? transactions : []).filter(
    (row) => row.portfolioId === portfolio?.id && row.status === 'planned'
  ).length;
  if (plannedCount > 0) {
    issues.push({ severity: 'low', code: 'planned_transactions', message: `有 ${plannedCount} 笔交易计划尚未确认` });
  }

  return {
    issues,
    high: issues.filter((row) => row.severity === 'high').length,
    medium: issues.filter((row) => row.severity === 'medium').length,
    low: issues.filter((row) => row.severity === 'low').length
  };
}

export function buildPortfolioInsights({ portfolio, holdings = [], snapshots = [], transactions = [], summary } = {}) {
  const resolvedSummary = summary || calculatePortfolioSummary(portfolio, holdings);
  const quality = buildPortfolioDataQuality({ portfolio, holdings, snapshots, transactions });
  const drifts = (resolvedSummary.assetClasses || []).map(createAssetDriftDisplay);
  const insights = [];

  (resolvedSummary.totalValue > 0 ? drifts : [])
    .filter((row) => row.status === 'rebalance')
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
    .slice(0, 3)
    .forEach((row) => {
      insights.push({
        severity: row.tone === 'danger' ? 'high' : 'medium',
        code: `drift_${row.assetClassId}`,
        title: `${row.assetClassName}${row.drift > 0 ? '超配' : '低配'}`,
        reason: `当前 ${Math.round(row.currentRatio * 10000) / 100}% ，目标 ${Math.round(row.targetRatio * 10000) / 100}%`,
        action: row.drift > 0 ? '优先减少该类资产或用新增资金补足其他类别' : '优先用新增资金补足该类资产'
      });
    });

  const activeHoldings = (Array.isArray(holdings) ? holdings : [])
    .filter((row) => row.portfolioId === portfolio?.id && !row.archived)
    .map(calculateHoldingMetrics);
  const largest = [...activeHoldings].sort((a, b) => b.currentValue - a.currentValue)[0];
  const concentration =
    resolvedSummary.totalValue > 0 ? Number(largest?.currentValue || 0) / resolvedSummary.totalValue : 0;
  if (concentration > 0.5) {
    insights.push({
      severity: concentration > 0.7 ? 'high' : 'medium',
      code: 'holding_concentration',
      title: '单一持仓集中度较高',
      reason: `${largest.fundName} 占组合 ${Math.round(concentration * 10000) / 100}%`,
      action: '检查该集中度是否符合长期配置意图，并评估分散到同类或低相关资产'
    });
  }

  if (!insights.length) {
    insights.push({
      severity: 'low',
      code: resolvedSummary.totalValue > 0 ? 'healthy_allocation' : 'awaiting_holdings',
      title: resolvedSummary.totalValue > 0 ? '配置处于目标区间' : '等待添加首笔持仓',
      reason:
        resolvedSummary.totalValue > 0
          ? '当前未发现超过再平衡阈值的资产类别'
          : '当前组合尚无有效持仓，不进行目标偏离判断',
      action:
        resolvedSummary.totalValue > 0
          ? '继续按计划记录快照，并在新增资金时复核配置'
          : '添加持仓或导入现有数据后，再生成配置诊断'
    });
  }

  const activeDrifts = resolvedSummary.totalValue > 0 ? drifts : [];
  const score = Math.max(
    0,
    Math.round(
      100 -
        quality.high * 18 -
        quality.medium * 8 -
        quality.low * 3 -
        activeDrifts.filter((row) => row.status === 'rebalance').length * 7 -
        Math.max(0, concentration - 0.5) * 40
    )
  );

  return {
    score,
    grade: score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '需关注' : '待改善',
    quality,
    insights
  };
}
