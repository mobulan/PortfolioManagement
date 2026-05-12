import { normalizePortfolioHolding } from './schema.js';

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clean = (value) => String(value ?? '').trim();

export function normalizePortfolioFundCandidate(input = {}) {
  const code = clean(input.code ?? input.CODE ?? input.fundCode);
  const name = clean(input.name ?? input.NAME ?? input.SHORTNAME ?? input.fundName);
  if (!code && !name) return null;
  return {
    code,
    name,
    estimatedNav: toNumber(input.gsz ?? input.estimatedNav ?? input.dwjz ?? input.currentNav, null),
    currentNav: toNumber(input.dwjz ?? input.currentNav ?? input.gsz ?? input.estimatedNav, null),
    previousNav: toNumber(input.lastNav ?? input.previousNav, null),
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
  const costAmount = toNumber(draft.costAmount, 0);
  const manualValue = valueMode === 'amount'
    ? toNumber(draft.manualValue || draft.currentValue || costAmount, 0)
    : null;
  const share = valueMode === 'amount'
    ? toNumber(draft.share || 1, 1)
    : toNumber(draft.share, instrumentType === 'cash' ? 1 : 0);
  const estimatedNav = valueMode === 'amount' || instrumentType === 'cash'
    ? null
    : toNumber(draft.estimatedNav || matchedFund?.estimatedNav || matchedFund?.currentNav, null);
  const currentNav = valueMode === 'amount' || instrumentType === 'cash'
    ? null
    : toNumber(matchedFund?.currentNav || estimatedNav, null);
  const previousNav = valueMode === 'amount' || instrumentType === 'cash'
    ? null
    : toNumber(matchedFund?.previousNav, null);

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
