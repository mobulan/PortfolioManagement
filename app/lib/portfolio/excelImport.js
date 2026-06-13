const HEADER_ALIASES = {
  date: ['日期', 'date', '快照日期'],
  equityValue: ['股票市值', '股票资产', 'equityvalue'],
  bondValue: ['债券市值', '债券资产', 'bondvalue'],
  goldValue: ['黄金市值', '黄金资产', 'goldvalue'],
  cashValue: ['现金市值', '现金资产', 'cashvalue'],
  totalValue: ['总资产', '总市值', 'totalvalue'],
  equityPrincipal: ['股票本金', 'equityprincipal'],
  bondPrincipal: ['债券本金', 'bondprincipal'],
  goldPrincipal: ['黄金本金', 'goldprincipal'],
  cashPrincipal: ['现金本金', 'cashprincipal'],
  totalPrincipal: ['总本金', 'totalprincipal'],
  totalProfit: ['总收益', '累计收益', 'totalprofit'],
  totalReturnRate: ['总收益率', '累计收益率', 'totalreturnrate'],
  dailyProfit: ['当日收益', '今日收益', 'dailyprofit'],
  note: ['备注', 'note']
};

const normalizeHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_/%（）()：:.-]/g, '');

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(number) ? number : null;
};

const parseDate = (value) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
};

const buildHeaderMap = (headers = []) => {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => {
      const aliasSet = new Set(aliases.map(normalizeHeader));
      return [field, normalized.findIndex((header) => aliasSet.has(header))];
    })
  );
};

const cell = (row, index) => (index >= 0 ? row[index] : null);

export function analyzePortfolioExcelRows(rows = [], { portfolioId = '' } = {}) {
  const table = Array.isArray(rows) ? rows : [];
  if (table.length < 2) {
    return { valid: false, snapshots: [], errors: ['工作表没有可导入的数据行'], headers: [] };
  }
  const headers = table[0].map((value) => String(value ?? '').trim());
  const headerMap = buildHeaderMap(headers);
  const errors = [];
  if (headerMap.date < 0) errors.push('缺少“日期”列');
  if (
    headerMap.totalValue < 0 &&
    [headerMap.equityValue, headerMap.bondValue, headerMap.goldValue, headerMap.cashValue].every((index) => index < 0)
  ) {
    errors.push('缺少“总资产”或资产类别市值列');
  }
  if (errors.length) return { valid: false, snapshots: [], errors, headers };

  const snapshots = [];
  table.slice(1).forEach((row, index) => {
    if (!Array.isArray(row) || row.every((value) => value === null || value === '')) return;
    const date = parseDate(cell(row, headerMap.date));
    if (!date) {
      errors.push(`第 ${index + 2} 行：日期无效`);
      return;
    }
    const assetClassValues = {
      equity: parseNumber(cell(row, headerMap.equityValue)) || 0,
      bond: parseNumber(cell(row, headerMap.bondValue)) || 0,
      gold: parseNumber(cell(row, headerMap.goldValue)) || 0,
      cash: parseNumber(cell(row, headerMap.cashValue)) || 0
    };
    const assetClassPrincipals = {
      equity: parseNumber(cell(row, headerMap.equityPrincipal)) || 0,
      bond: parseNumber(cell(row, headerMap.bondPrincipal)) || 0,
      gold: parseNumber(cell(row, headerMap.goldPrincipal)) || 0,
      cash: parseNumber(cell(row, headerMap.cashPrincipal)) || 0
    };
    const totalValue =
      parseNumber(cell(row, headerMap.totalValue)) ??
      Object.values(assetClassValues).reduce((sum, value) => sum + value, 0);
    const totalPrincipal =
      parseNumber(cell(row, headerMap.totalPrincipal)) ??
      Object.values(assetClassPrincipals).reduce((sum, value) => sum + value, 0);
    const totalProfit = parseNumber(cell(row, headerMap.totalProfit)) ?? totalValue - totalPrincipal;
    const importedReturnRate = parseNumber(cell(row, headerMap.totalReturnRate));
    const totalReturnRate =
      importedReturnRate === null
        ? totalPrincipal > 0
          ? totalProfit / totalPrincipal
          : 0
        : Math.abs(importedReturnRate) > 1
          ? importedReturnRate / 100
          : importedReturnRate;

    snapshots.push({
      id: `snapshot_excel_${portfolioId || 'unknown'}_${date}`,
      portfolioId,
      date,
      totalValue,
      totalPrincipal,
      totalProfit,
      totalReturnRate,
      dailyProfit: parseNumber(cell(row, headerMap.dailyProfit)) || 0,
      assetClassValues,
      assetClassPrincipals,
      holdingSnapshots: [],
      source: 'import',
      note: String(cell(row, headerMap.note) || 'Excel 历史导入').trim(),
      createdAt: new Date().toISOString()
    });
  });

  return {
    valid: snapshots.length > 0 && errors.length === 0,
    snapshots,
    errors,
    headers
  };
}
