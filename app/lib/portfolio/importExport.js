import {
  DEFAULT_PORTFOLIO_SETTINGS,
  PORTFOLIO_SCHEMA_VERSION,
  normalizePortfolio,
  normalizePortfolioHolding,
  normalizePortfolioTransaction,
  normalizePrincipalRecord,
} from './schema.js';

const asArray = (value) => Array.isArray(value) ? value : [];
const importTypes = [
  'portfolios',
  'portfolioHoldings',
  'portfolioTransactions',
  'portfolioPrincipalRecords',
  'portfolioSnapshots',
  'portfolioBacktests',
];

export const CSV_IMPORT_TYPES = ['portfolioHoldings', 'portfolioTransactions', 'portfolioSnapshots'];

export const PORTFOLIO_IMPORT_CONFLICT_MODES = {
  skip: {
    id: 'skip',
    name: 'Skip existing records',
    description: 'Keep current records when an imported id already exists.',
  },
  overwrite: {
    id: 'overwrite',
    name: 'Overwrite existing records',
    description: 'Replace current records with imported records that share the same id.',
  },
  merge: {
    id: 'merge',
    name: 'Merge fields',
    description: 'Keep current records and fill them with non-empty imported fields.',
  },
};

const csvHeaders = {
  portfolioHoldings: [
    'id', 'portfolioId', 'assetClassId', 'instrumentType', 'fundCode', 'fundName',
    'share', 'costPrice', 'costAmount', 'currentNav', 'estimatedNav', 'previousNav',
    'currentValue', 'manualValue', 'enabled', 'archived', 'createdAt', 'updatedAt',
  ],
  portfolioTransactions: [
    'id', 'portfolioId', 'holdingId', 'fundCode', 'assetClassId', 'type', 'date',
    'amount', 'share', 'price', 'fee', 'isAfter3pm', 'relatedTransactionId',
    'principalImpact', 'note', 'createdAt', 'updatedAt',
  ],
  portfolioSnapshots: [
    'id', 'portfolioId', 'date', 'totalValue', 'totalPrincipal', 'totalProfit',
    'totalReturnRate', 'dailyEstimatedProfit', 'holdingCount', 'assetClassValues',
    'createdAt',
  ],
};

const emptyCounts = () => Object.fromEntries(importTypes.map((type) => [type, { valid: 0, dropped: 0 }]));

const parseImportInput = (input) => {
  if (typeof input !== 'string') return { payload: input || {}, errors: [] };
  const text = input.trim();
  if (!text) return { payload: {}, errors: [] };
  try {
    return { payload: JSON.parse(text), errors: [] };
  } catch (error) {
    return { payload: {}, errors: [`JSON invalid: ${error.message}`] };
  }
};

const stripBom = (value) => String(value ?? '').replace(/^\uFEFF/, '');

const parseCsvLine = (line) => {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell);
  return cells.map((value) => stripBom(value).trim());
};

export function parsePortfolioCsv(csv = '') {
  const text = stripBom(csv).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return { headers: [], records: [], errors: ['CSV empty'] };
  const lines = text.split('\n').filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]);
  const errors = [];
  const records = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    if (cells.length !== headers.length) {
      errors.push(`row ${index + 2}: column count ${cells.length} does not match header count ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']));
  });
  return { headers, records, errors };
}

const hasText = (value) => String(value ?? '').trim() !== '';
const toCsvNumber = (value, field, errors) => {
  if (!hasText(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push(`${field} invalid: ${value}`);
    return null;
  }
  return number;
};

const isValidIsoDate = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

const buildKnownFundCodes = (knownFunds = []) => new Set(asArray(knownFunds)
  .map((fund) => String(fund?.code ?? fund?.fundCode ?? '').trim())
  .filter(Boolean));

const assertKnownFundCode = (row, knownFundCodes, errors) => {
  if (!knownFundCodes.size || !hasText(row.fundCode)) return;
  if (!knownFundCodes.has(String(row.fundCode).trim())) {
    errors.push(`fundCode ${row.fundCode} was not found`);
  }
};

const normalizeCsvHolding = (row, context) => {
  const errors = [];
  assertKnownFundCode(row, context.knownFundCodes, errors);
  ['share', 'costPrice', 'costAmount', 'currentNav', 'estimatedNav', 'previousNav', 'currentValue', 'manualValue']
    .forEach((field) => toCsvNumber(row[field], field, errors));
  if (context.validPortfolioIds.size && !context.validPortfolioIds.has(row.portfolioId)) {
    errors.push(`portfolioId ${row.portfolioId || '(empty)'} was not found`);
  }
  if (errors.length) return { row: null, errors };
  return { row: normalizePortfolioHolding(row), errors };
};

const normalizeCsvTransaction = (row, context) => {
  const errors = [];
  assertKnownFundCode(row, context.knownFundCodes, errors);
  if (!isValidIsoDate(row.date)) errors.push(`date invalid: ${row.date || '(empty)'}`);
  ['amount', 'share', 'price', 'fee', 'principalImpact'].forEach((field) => toCsvNumber(row[field], field, errors));
  if (!hasText(row.amount)) errors.push('amount invalid: (empty)');
  if (context.validPortfolioIds.size && !context.validPortfolioIds.has(row.portfolioId)) {
    errors.push(`portfolioId ${row.portfolioId || '(empty)'} was not found`);
  }
  if (row.holdingId && context.validHoldingIds.size && !context.validHoldingIds.has(row.holdingId)) {
    errors.push(`holdingId ${row.holdingId} was not found`);
  }
  if (errors.length) return { row: null, errors };
  return { row: normalizePortfolioTransaction(row), errors };
};

const normalizeCsvSnapshot = (row, context) => {
  const errors = [];
  if (!isValidIsoDate(row.date)) errors.push(`date invalid: ${row.date || '(empty)'}`);
  ['totalValue', 'totalPrincipal', 'totalProfit', 'totalReturnRate', 'dailyEstimatedProfit', 'holdingCount']
    .forEach((field) => toCsvNumber(row[field], field, errors));
  if (context.validPortfolioIds.size && !context.validPortfolioIds.has(row.portfolioId)) {
    errors.push(`portfolioId ${row.portfolioId || '(empty)'} was not found`);
  }
  if (errors.length) return { row: null, errors };
  return {
    row: {
      ...row,
      totalValue: toCsvNumber(row.totalValue, 'totalValue', []),
      totalPrincipal: toCsvNumber(row.totalPrincipal, 'totalPrincipal', []),
      totalProfit: toCsvNumber(row.totalProfit, 'totalProfit', []),
      totalReturnRate: toCsvNumber(row.totalReturnRate, 'totalReturnRate', []),
      dailyEstimatedProfit: toCsvNumber(row.dailyEstimatedProfit, 'dailyEstimatedProfit', []),
      holdingCount: toCsvNumber(row.holdingCount, 'holdingCount', []),
    },
    errors,
  };
};

const csvNormalizers = {
  portfolioHoldings: normalizeCsvHolding,
  portfolioTransactions: normalizeCsvTransaction,
  portfolioSnapshots: normalizeCsvSnapshot,
};

export function analyzePortfolioCsvImport({
  csv = '',
  type = 'portfolioTransactions',
  knownFunds = [],
  validPortfolioIds = [],
  validHoldingIds = [],
} = {}) {
  const parseResult = parsePortfolioCsv(csv);
  const errors = [...parseResult.errors];
  const rows = [];
  const droppedRows = [];
  const normalizer = csvNormalizers[type];

  if (!normalizer) {
    errors.push(`CSV type ${type} is not supported`);
    return {
      valid: false,
      type,
      counts: { valid: 0, dropped: parseResult.records.length },
      rows,
      droppedRows: parseResult.records,
      headers: parseResult.headers,
      errors,
    };
  }

  const context = {
    knownFundCodes: buildKnownFundCodes(knownFunds),
    validPortfolioIds: new Set(validPortfolioIds),
    validHoldingIds: new Set(validHoldingIds),
  };

  parseResult.records.forEach((record, index) => {
    const result = normalizer(record, context);
    if (result.errors.length) {
      droppedRows.push(record);
      result.errors.forEach((message) => errors.push(`row ${index + 2}: ${message}`));
      return;
    }
    rows.push(result.row);
  });

  return {
    valid: errors.length === 0,
    type,
    counts: {
      valid: rows.length,
      dropped: droppedRows.length,
    },
    rows,
    droppedRows,
    headers: parseResult.headers,
    errors,
  };
}

const formatCsvCell = (value) => {
  if (value == null) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export function exportPortfolioCsv({ type = 'portfolioHoldings', rows = [] } = {}) {
  const headers = csvHeaders[type];
  if (!headers) throw new Error(`CSV type ${type} is not supported`);
  const body = asArray(rows).map((row) => headers.map((header) => formatCsvCell(row?.[header])).join(','));
  return [headers.join(','), ...body].join('\n');
}

export function normalizePortfolioPayload(input = {}) {
  const errors = [];
  const portfolios = asArray(input.portfolios).map((row) => {
    try {
      return normalizePortfolio(row);
    } catch (error) {
      errors.push(`portfolio invalid: ${error.message}`);
      return null;
    }
  }).filter(Boolean);
  const portfolioIds = new Set(portfolios.map((row) => row.id));

  const portfolioHoldings = asArray(input.portfolioHoldings).map((row) => normalizePortfolioHolding(row))
    .filter((row) => row.portfolioId && portfolioIds.has(row.portfolioId));
  const holdingIds = new Set(portfolioHoldings.map((row) => row.id));

  const portfolioTransactions = asArray(input.portfolioTransactions).map((row) => normalizePortfolioTransaction(row))
    .filter((row) => row.portfolioId && portfolioIds.has(row.portfolioId) && (!row.holdingId || holdingIds.has(row.holdingId)));
  const txIds = new Set(portfolioTransactions.map((row) => row.id));

  const portfolioPrincipalRecords = asArray(input.portfolioPrincipalRecords).map((row) => normalizePrincipalRecord(row))
    .filter((row) => row.portfolioId && portfolioIds.has(row.portfolioId) && (!row.transactionId || txIds.has(row.transactionId)));

  const portfolioSnapshots = asArray(input.portfolioSnapshots)
    .filter((row) => row && typeof row === 'object' && portfolioIds.has(row.portfolioId));
  const portfolioBacktests = asArray(input.portfolioBacktests)
    .filter((row) => row && typeof row === 'object');

  return {
    portfolioSchemaVersion: PORTFOLIO_SCHEMA_VERSION,
    portfolios,
    portfolioHoldings,
    portfolioTransactions,
    portfolioPrincipalRecords,
    portfolioSnapshots,
    portfolioBacktests,
    portfolioSettings: {
      ...DEFAULT_PORTFOLIO_SETTINGS,
      ...(input.portfolioSettings && typeof input.portfolioSettings === 'object' ? input.portfolioSettings : {}),
    },
    errors,
  };
}

export function analyzePortfolioImport(input = {}) {
  const { payload, errors } = parseImportInput(input);
  const counts = emptyCounts();
  const normalized = {
    portfolios: [],
    portfolioHoldings: [],
    portfolioTransactions: [],
    portfolioPrincipalRecords: [],
    portfolioSnapshots: [],
    portfolioBacktests: [],
    portfolioSettings: {
      ...DEFAULT_PORTFOLIO_SETTINGS,
      ...(payload.portfolioSettings && typeof payload.portfolioSettings === 'object' ? payload.portfolioSettings : {}),
    },
  };

  const recordDrop = (type, message) => {
    counts[type].dropped += 1;
    errors.push(`${type}: ${message}`);
  };
  const recordValid = (type, row) => {
    counts[type].valid += 1;
    normalized[type].push(row);
  };

  for (const row of asArray(payload.portfolios)) {
    if (!row || typeof row !== 'object') {
      recordDrop('portfolios', 'record is not an object');
      continue;
    }
    try {
      recordValid('portfolios', normalizePortfolio(row));
    } catch (error) {
      recordDrop('portfolios', error.message);
    }
  }
  const portfolioIds = new Set(normalized.portfolios.map((row) => row.id));

  for (const row of asArray(payload.portfolioHoldings)) {
    if (!row || typeof row !== 'object') {
      recordDrop('portfolioHoldings', 'record is not an object');
      continue;
    }
    try {
      const normalizedRow = normalizePortfolioHolding(row);
      if (!normalizedRow.portfolioId || !portfolioIds.has(normalizedRow.portfolioId)) {
        recordDrop('portfolioHoldings', `portfolioId ${normalizedRow.portfolioId || '(empty)'} was not found`);
        continue;
      }
      recordValid('portfolioHoldings', normalizedRow);
    } catch (error) {
      recordDrop('portfolioHoldings', error.message);
    }
  }
  const holdingIds = new Set(normalized.portfolioHoldings.map((row) => row.id));

  for (const row of asArray(payload.portfolioTransactions)) {
    if (!row || typeof row !== 'object') {
      recordDrop('portfolioTransactions', 'record is not an object');
      continue;
    }
    try {
      const normalizedRow = normalizePortfolioTransaction(row);
      if (!normalizedRow.portfolioId || !portfolioIds.has(normalizedRow.portfolioId)) {
        recordDrop('portfolioTransactions', `portfolioId ${normalizedRow.portfolioId || '(empty)'} was not found`);
        continue;
      }
      if (normalizedRow.holdingId && !holdingIds.has(normalizedRow.holdingId)) {
        recordDrop('portfolioTransactions', `holdingId ${normalizedRow.holdingId} was not found`);
        continue;
      }
      recordValid('portfolioTransactions', normalizedRow);
    } catch (error) {
      recordDrop('portfolioTransactions', error.message);
    }
  }
  const transactionIds = new Set(normalized.portfolioTransactions.map((row) => row.id));

  for (const row of asArray(payload.portfolioPrincipalRecords)) {
    if (!row || typeof row !== 'object') {
      recordDrop('portfolioPrincipalRecords', 'record is not an object');
      continue;
    }
    try {
      const normalizedRow = normalizePrincipalRecord(row);
      if (!normalizedRow.portfolioId || !portfolioIds.has(normalizedRow.portfolioId)) {
        recordDrop('portfolioPrincipalRecords', `portfolioId ${normalizedRow.portfolioId || '(empty)'} was not found`);
        continue;
      }
      if (normalizedRow.transactionId && !transactionIds.has(normalizedRow.transactionId)) {
        recordDrop('portfolioPrincipalRecords', `transactionId ${normalizedRow.transactionId} was not found`);
        continue;
      }
      recordValid('portfolioPrincipalRecords', normalizedRow);
    } catch (error) {
      recordDrop('portfolioPrincipalRecords', error.message);
    }
  }

  for (const row of asArray(payload.portfolioSnapshots)) {
    if (!row || typeof row !== 'object') {
      recordDrop('portfolioSnapshots', 'record is not an object');
      continue;
    }
    if (!row.portfolioId || !portfolioIds.has(row.portfolioId)) {
      recordDrop('portfolioSnapshots', `portfolioId ${row.portfolioId || '(empty)'} was not found`);
      continue;
    }
    recordValid('portfolioSnapshots', row);
  }

  for (const row of asArray(payload.portfolioBacktests)) {
    if (!row || typeof row !== 'object') {
      recordDrop('portfolioBacktests', 'record is not an object');
      continue;
    }
    recordValid('portfolioBacktests', row);
  }

  return {
    valid: errors.length === 0,
    counts,
    errors,
    normalized,
  };
}

export function exportPortfolioData(input = {}) {
  return JSON.stringify({
    ...normalizePortfolioPayload(input),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function importPortfolioData(input = {}) {
  return normalizePortfolioPayload(input);
}
