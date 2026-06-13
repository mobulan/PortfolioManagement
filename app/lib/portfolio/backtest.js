const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export function valueSeriesToReturns(series = []) {
  const sorted = [...series]
    .filter((row) => row && Number(row.value) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const returns = [];
  for (let i = 1; i < sorted.length; i += 1) {
    returns.push((Number(sorted[i].value) - Number(sorted[i - 1].value)) / Number(sorted[i - 1].value));
  }
  return returns;
}

export function calculateMaxDrawdown(series = []) {
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const row of series) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    peak = Math.max(peak, value);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, (value - peak) / peak);
  }
  return maxDrawdown;
}

export function calculateRiskMetrics(series = [], { riskFreeRate = 0 } = {}) {
  const sorted = [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const returns = valueSeriesToReturns(sorted);
  const avg = mean(returns);
  const variance = returns.length ? returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / returns.length : 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  const first = Number(sorted[0]?.value) || 0;
  const last = Number(sorted[sorted.length - 1]?.value) || first;
  const periods = Math.max(1, returns.length);
  const annualizedReturn = first > 0 ? (last / first) ** (252 / periods) - 1 : 0;
  const sharpe = volatility === 0 ? 0 : (annualizedReturn - riskFreeRate) / volatility;
  const winRate = returns.length ? returns.filter((value) => value > 0).length / returns.length : 0;
  let peakIndex = 0;
  let longestRecoveryPeriods = 0;
  let underwaterStart = -1;
  sorted.forEach((row, index) => {
    if (Number(row.value) >= Number(sorted[peakIndex]?.value || 0)) {
      if (underwaterStart >= 0) longestRecoveryPeriods = Math.max(longestRecoveryPeriods, index - underwaterStart);
      peakIndex = index;
      underwaterStart = -1;
    } else if (underwaterStart < 0) {
      underwaterStart = peakIndex;
    }
  });
  if (underwaterStart >= 0)
    longestRecoveryPeriods = Math.max(longestRecoveryPeriods, sorted.length - 1 - underwaterStart);
  return {
    dailyReturn: avg,
    annualizedReturn,
    volatility,
    sharpe,
    winRate,
    longestRecoveryPeriods,
    maxDrawdown: calculateMaxDrawdown(sorted),
    sampleSize: returns.length
  };
}

export function calculateRollingVolatility(series = [], window = 20) {
  const sorted = [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const returns = valueSeriesToReturns(sorted);
  const size = Math.max(2, Number(window) || 20);
  return sorted.slice(1).map((row, index) => {
    const values = returns.slice(Math.max(0, index - size + 1), index + 1);
    const avg = mean(values);
    const variance = values.length ? values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length : 0;
    return {
      date: row.date,
      value: Math.sqrt(variance) * Math.sqrt(252),
      sampleSize: values.length
    };
  });
}

export function calculateCorrelation(left = [], right = []) {
  const n = Math.min(left.length, right.length);
  if (n < 2) return 0;
  const a = left.slice(0, n).map(Number);
  const b = right.slice(0, n).map(Number);
  const meanA = mean(a);
  const meanB = mean(b);
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : numerator / denom;
}

export function buildBenchmarkComparison({
  portfolioSeries = [],
  benchmarkHistory = [],
  initialCapital = 100000
} = {}) {
  const benchmarkByDate = new Map(normalizeHistory(benchmarkHistory).map((row) => [row.date, row.value]));
  const aligned = (Array.isArray(portfolioSeries) ? portfolioSeries : []).filter((row) =>
    benchmarkByDate.has(row?.date)
  );
  if (aligned.length < 2) {
    return {
      series: [],
      metrics: calculateRiskMetrics([]),
      excessReturn: 0,
      trackingError: 0,
      informationRatio: 0
    };
  }

  const firstBenchmarkValue = Number(benchmarkByDate.get(aligned[0].date)) || 0;
  const capital = Number(initialCapital) > 0 ? Number(initialCapital) : Number(aligned[0].value) || 100000;
  const series = aligned.map((row) => ({
    date: row.date,
    value: firstBenchmarkValue > 0 ? (Number(benchmarkByDate.get(row.date)) / firstBenchmarkValue) * capital : 0
  }));
  const metrics = calculateRiskMetrics(series);
  const portfolioReturns = valueSeriesToReturns(aligned);
  const benchmarkReturns = valueSeriesToReturns(series);
  const activeReturns = portfolioReturns.map((value, index) => value - (benchmarkReturns[index] || 0));
  const activeMean = mean(activeReturns);
  const activeVariance = activeReturns.length
    ? activeReturns.reduce((sum, value) => sum + (value - activeMean) ** 2, 0) / activeReturns.length
    : 0;
  const trackingError = Math.sqrt(activeVariance) * Math.sqrt(252);
  const benchmarkMean = mean(benchmarkReturns);
  const benchmarkVariance = benchmarkReturns.length
    ? benchmarkReturns.reduce((sum, value) => sum + (value - benchmarkMean) ** 2, 0) / benchmarkReturns.length
    : 0;
  const portfolioMean = mean(portfolioReturns);
  const covariance = portfolioReturns.length
    ? portfolioReturns.reduce(
        (sum, value, index) => sum + (value - portfolioMean) * ((benchmarkReturns[index] || 0) - benchmarkMean),
        0
      ) / portfolioReturns.length
    : 0;
  const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
  const alpha = (portfolioMean - beta * benchmarkMean) * 252;
  const portfolioCumulative =
    Number(aligned[0]?.value) > 0 ? Number(aligned.at(-1)?.value) / Number(aligned[0].value) - 1 : 0;
  const benchmarkCumulative =
    Number(series[0]?.value) > 0 ? Number(series.at(-1)?.value) / Number(series[0].value) - 1 : 0;

  return {
    series,
    metrics: { ...metrics, cumulativeReturn: benchmarkCumulative },
    excessReturn: portfolioCumulative - benchmarkCumulative,
    trackingError,
    informationRatio: trackingError > 0 ? (portfolioCumulative - benchmarkCumulative) / trackingError : 0,
    alpha,
    beta
  };
}

const normalizeHistory = (series = [], startDate = '', endDate = '') =>
  [...(Array.isArray(series) ? series : [])]
    .filter((row) => {
      const date = String(row?.date || '');
      const value = Number(row?.value);
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(value) &&
        value > 0 &&
        (!startDate || date >= startDate) &&
        (!endDate || date <= endDate)
      );
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

export function buildWeightedPortfolioBacktest({
  assets = [],
  histories = {},
  initialCapital = 100000,
  startDate = '',
  endDate = '',
  rebalanceRule = { type: 'none', threshold: 0.05 }
} = {}) {
  const normalizedAssets = (Array.isArray(assets) ? assets : [])
    .map((asset) => ({
      ...asset,
      fundCode: String(asset?.fundCode || '').trim(),
      weight: Number(asset?.weight) || 0
    }))
    .filter((asset) => asset.fundCode && asset.weight > 0);
  const totalWeight = normalizedAssets.reduce((sum, asset) => sum + asset.weight, 0);
  const prepared = normalizedAssets
    .map((asset) => ({
      ...asset,
      normalizedWeight: totalWeight > 0 ? asset.weight / totalWeight : 0,
      history: normalizeHistory(histories?.[asset.fundCode], startDate, endDate)
    }))
    .filter((asset) => asset.history.length > 1);

  if (!prepared.length || prepared.length !== normalizedAssets.length) {
    return {
      series: [],
      assetSeries: [],
      metrics: calculateRiskMetrics([]),
      correlation: [],
      missingFundCodes: normalizedAssets
        .filter((asset) => normalizeHistory(histories?.[asset.fundCode], startDate, endDate).length < 2)
        .map((asset) => asset.fundCode)
    };
  }

  const commonDates = prepared
    .map((asset) => new Set(asset.history.map((row) => row.date)))
    .reduce((common, dates) => new Set([...common].filter((date) => dates.has(date))));
  const dates = [...commonDates].sort();
  if (dates.length < 2) {
    return {
      series: [],
      assetSeries: [],
      metrics: calculateRiskMetrics([]),
      correlation: [],
      missingFundCodes: prepared.map((asset) => asset.fundCode)
    };
  }
  const capital = Number(initialCapital) > 0 ? Number(initialCapital) : 100000;
  const priceMaps = prepared.map((asset) => new Map(asset.history.map((row) => [row.date, Number(row.value)])));
  let units = prepared.map((asset, index) => {
    const price = priceMaps[index].get(dates[0]) || 0;
    return price > 0 ? (capital * asset.normalizedWeight) / price : 0;
  });
  const assetValuesByIndex = prepared.map(() => []);
  const series = dates.map((date, dateIndex) => {
    let values = prepared.map((_, assetIndex) => units[assetIndex] * priceMaps[assetIndex].get(date));
    const totalValue = values.reduce((sum, value) => sum + value, 0);
    if (
      dateIndex > 0 &&
      shouldRebalance({
        rule: rebalanceRule,
        date,
        previousDate: dates[dateIndex - 1],
        values,
        totalValue,
        weights: prepared.map((asset) => asset.normalizedWeight)
      })
    ) {
      units = prepared.map((asset, assetIndex) => {
        const price = priceMaps[assetIndex].get(date);
        return price > 0 ? (totalValue * asset.normalizedWeight) / price : 0;
      });
      values = prepared.map((_, assetIndex) => units[assetIndex] * priceMaps[assetIndex].get(date));
    }
    values.forEach((value, assetIndex) => assetValuesByIndex[assetIndex].push(value));
    return {
      date,
      value: values.reduce((sum, value) => sum + value, 0)
    };
  });
  const assetSeries = prepared.map((asset, assetIndex) => {
    const byDate = priceMaps[assetIndex];
    return {
      fundCode: asset.fundCode,
      fundName: asset.fundName || asset.fundCode,
      weight: asset.normalizedWeight,
      returns: dates.slice(1).map((date, index) => {
        const previous = byDate.get(dates[index]);
        const current = byDate.get(date);
        return previous > 0 ? (current - previous) / previous : 0;
      }),
      values: assetValuesByIndex[assetIndex]
    };
  });
  const metrics = calculateRiskMetrics(series);
  const firstValue = Number(series[0]?.value) || capital;
  const lastValue = Number(series.at(-1)?.value) || firstValue;
  const cumulativeReturn = firstValue > 0 ? lastValue / firstValue - 1 : 0;
  const correlation = assetSeries.map((left) => ({
    fundCode: left.fundCode,
    fundName: left.fundName,
    values: assetSeries.map((right) => ({
      fundCode: right.fundCode,
      value: calculateCorrelation(left.returns, right.returns)
    }))
  }));
  const contributions = assetSeries.map((asset) => {
    const initialValue = capital * asset.weight;
    const finalValue = Number(asset.values.at(-1)) || initialValue;
    return {
      fundCode: asset.fundCode,
      fundName: asset.fundName,
      weight: asset.weight,
      profit: finalValue - initialValue,
      returnRate: initialValue > 0 ? finalValue / initialValue - 1 : 0
    };
  });
  const portfolioReturns = valueSeriesToReturns(series);
  const portfolioMean = mean(portfolioReturns);
  const portfolioVariance = portfolioReturns.length
    ? portfolioReturns.reduce((sum, value) => sum + (value - portfolioMean) ** 2, 0) / portfolioReturns.length
    : 0;
  const rawRiskContributions = assetSeries.map((asset) => {
    const assetMean = mean(asset.returns);
    const covariance = asset.returns.length
      ? asset.returns.reduce(
          (sum, value, index) => sum + (value - assetMean) * ((portfolioReturns[index] || 0) - portfolioMean),
          0
        ) / asset.returns.length
      : 0;
    return {
      fundCode: asset.fundCode,
      fundName: asset.fundName,
      value: portfolioVariance > 0 ? (asset.weight * covariance) / portfolioVariance : 0
    };
  });
  const riskTotal = rawRiskContributions.reduce((sum, row) => sum + row.value, 0);
  const riskContributions = rawRiskContributions.map((row) => ({
    ...row,
    contributionRate: riskTotal !== 0 ? row.value / riskTotal : 0
  }));

  return {
    series,
    assetSeries,
    metrics: {
      ...metrics,
      cumulativeReturn,
      calmar: metrics.maxDrawdown < 0 ? metrics.annualizedReturn / Math.abs(metrics.maxDrawdown) : 0
    },
    correlation,
    contributions,
    riskContributions,
    rollingVolatility: {
      20: calculateRollingVolatility(series, 20),
      60: calculateRollingVolatility(series, 60),
      120: calculateRollingVolatility(series, 120)
    },
    missingFundCodes: []
  };
}

function shouldRebalance({ rule, date, previousDate, values, totalValue, weights }) {
  const type = rule?.type || 'none';
  if (type === 'none') return false;
  if (type === 'threshold') {
    const threshold = Math.max(0, Number(rule?.threshold) || 0.05);
    return values.some((value, index) => {
      const currentRatio = totalValue > 0 ? value / totalValue : 0;
      return Math.abs(currentRatio - weights[index]) >= threshold;
    });
  }
  const current = new Date(`${date}T00:00:00Z`);
  const previous = new Date(`${previousDate}T00:00:00Z`);
  if (type === 'monthly') return current.getUTCMonth() !== previous.getUTCMonth();
  if (type === 'quarterly') {
    return (
      current.getUTCFullYear() !== previous.getUTCFullYear() ||
      Math.floor(current.getUTCMonth() / 3) !== Math.floor(previous.getUTCMonth() / 3)
    );
  }
  if (type === 'yearly') return current.getUTCFullYear() !== previous.getUTCFullYear();
  return false;
}
