import { normalizePortfolioHolding } from './schema.js';

export const parsePortfolioNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const text = String(value)
    .trim()
    .replace(/[￥¥\s]/g, '');
  if (!text) return fallback;
  const normalized = text.includes(',')
    ? (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text) ? text.replace(/,/g, '') : '')
    : text;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
};

const isPortfolioNumberValid = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim().replace(/[￥¥\s]/g, '');
  if (!text) return true;
  if (text.includes(',')) return /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text);
  return Number.isFinite(Number(text));
};

const clean = (value) => String(value ?? '').trim();

export function getPortfolioHoldingDraftErrors(draft = {}) {
  const fields = [
    ['costAmount', '本金/成本金额'],
    ['manualValue', '当前市值'],
    ['currentValue', '当前市值'],
    ['share', '份额'],
    ['estimatedNav', '估算净值'],
  ];
  return fields
    .filter(([field]) => !isPortfolioNumberValid(draft[field]))
    .map(([, label]) => `${label}格式不正确，请使用 39202.20 或 39,202.20`);
}

export function normalizePortfolioFundCandidate(input = {}) {
  const code = clean(input.code ?? input.CODE ?? input.fundCode);
  const name = clean(input.name ?? input.NAME ?? input.SHORTNAME ?? input.fundName);
  if (!code && !name) return null;
  return {
    code,
    name,
    estimatedNav: parsePortfolioNumber(input.gsz ?? input.estimatedNav ?? input.dwjz ?? input.currentNav, null),
    currentNav: parsePortfolioNumber(input.dwjz ?? input.currentNav ?? input.gsz ?? input.estimatedNav, null),
    previousNav: parsePortfolioNumber(input.lastNav ?? input.previousNav, null),
  };
}

export function findPortfolioFundCandidate(funds = [], query = '') {
  const normalizedQuery = clean(query).toLowerCase();
  if (!normalizedQuery) return null;

  const candidates = (Array.isArray(funds) ? funds : [])
    .map(normalizePortfolioFundCandidate)
    .filter(Boolean);

  return candidates.find((fund) => fund.code === normalizedQuery)
    || candidates.find((fund) => fund.code.includes(normalizedQuery) || fund.name.toLowerCase().includes(normalizedQuery))
    || null;
}

export function buildPortfolioHoldingFromDraft({ portfolioId = '', draft = {}, funds = [] } = {}) {
  const instrumentType = draft.instrumentType || 'fund';
  const fundCode = instrumentType === 'cash' ? '' : clean(draft.fundCode);
  const matchedFund = findPortfolioFundCandidate(funds, fundCode) || findPortfolioFundCandidate(funds, draft.fundName);
  const valueMode = draft.valueMode === 'amount' ? 'amount' : 'share';
  const costAmount = parsePortfolioNumber(draft.costAmount, 0);
  const amountValue = parsePortfolioNumber(draft.manualValue || draft.currentValue || costAmount, 0);
  const amountModeNav = parsePortfolioNumber(draft.estimatedNav || matchedFund?.estimatedNav || matchedFund?.currentNav, null);
  const manualValue = valueMode === 'amount'
    ? amountValue
    : null;
  const share = valueMode === 'amount'
    ? (instrumentType === 'fund' && amountModeNav > 0 ? parsePortfolioNumber(amountValue / amountModeNav, 0) : parsePortfolioNumber(draft.share || 1, 1))
    : parsePortfolioNumber(draft.share, instrumentType === 'cash' ? 1 : 0);
  const estimatedNav = (valueMode === 'amount' && instrumentType === 'fund')
    ? amountModeNav
    : valueMode === 'amount' || instrumentType === 'cash'
    ? null
    : parsePortfolioNumber(draft.estimatedNav || matchedFund?.estimatedNav || matchedFund?.currentNav, null);
  const currentNav = (valueMode === 'amount' && instrumentType === 'fund')
    ? parsePortfolioNumber(matchedFund?.currentNav || amountModeNav, null)
    : valueMode === 'amount' || instrumentType === 'cash'
    ? null
    : parsePortfolioNumber(matchedFund?.currentNav || estimatedNav, null);
  const previousNav = valueMode === 'amount' || instrumentType === 'cash'
    ? null
    : parsePortfolioNumber(matchedFund?.previousNav, null);

  return normalizePortfolioHolding({
    portfolioId,
    assetClassId: draft.assetClassId,
    instrumentType,
    fundCode,
    fundName: clean(draft.fundName) || matchedFund?.name || (instrumentType === 'cash' ? '现金' : fundCode),
    share,
    costAmount,
    estimatedNav,
    currentNav,
    previousNav,
    manualValue,
  });
}
