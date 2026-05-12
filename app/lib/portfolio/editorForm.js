const parsePercent = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const formatPercent = (value) => {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, '');
};

export function normalizeAllocationDraftPercents(rows = []) {
  const allocations = Array.isArray(rows) ? rows : [];
  if (!allocations.length) return [];

  const rawValues = allocations.map((row) => parsePercent(row?.targetPercent));
  const total = rawValues.reduce((sum, value) => sum + value, 0);
  const normalizedValues = total > 0
    ? rawValues.map((value) => (value / total) * 100)
    : allocations.map(() => 100 / allocations.length);

  const nextValues = normalizedValues.map((value) => Number(formatPercent(value)));
  const roundedTotal = nextValues.reduce((sum, value) => sum + value, 0);
  nextValues[nextValues.length - 1] = Number(formatPercent(nextValues[nextValues.length - 1] + 100 - roundedTotal));

  return allocations.map((row, index) => ({
    ...row,
    targetPercent: formatPercent(nextValues[index]),
  }));
}
