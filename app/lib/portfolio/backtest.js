const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

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
  const variance = returns.length
    ? returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / returns.length
    : 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  const first = Number(sorted[0]?.value) || 0;
  const last = Number(sorted[sorted.length - 1]?.value) || first;
  const periods = Math.max(1, returns.length);
  const annualizedReturn = first > 0 ? (last / first) ** (252 / periods) - 1 : 0;
  const sharpe = volatility === 0 ? 0 : (annualizedReturn - riskFreeRate) / volatility;
  return {
    dailyReturn: avg,
    annualizedReturn,
    volatility,
    sharpe,
    maxDrawdown: calculateMaxDrawdown(sorted),
    sampleSize: returns.length,
  };
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
