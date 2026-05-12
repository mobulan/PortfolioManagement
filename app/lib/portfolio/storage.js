import { storageStore } from '@/app/stores';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  PORTFOLIO_SCHEMA_VERSION,
  PORTFOLIO_STORAGE_KEYS,
  normalizePortfolio,
  normalizePortfolioHolding,
} from './schema.js';
import { createDefaultPortfolioState } from './migrations.js';

const get = (key, fallback) => storageStore.getItem(key, fallback);
const set = (key, value) => storageStore.setItem(key, JSON.stringify(value));

export function readPortfolioState() {
  return {
    portfolioSchemaVersion: get(PORTFOLIO_STORAGE_KEYS.portfolioSchemaVersion, PORTFOLIO_SCHEMA_VERSION),
    portfolios: get(PORTFOLIO_STORAGE_KEYS.portfolios, []),
    portfolioHoldings: get(PORTFOLIO_STORAGE_KEYS.portfolioHoldings, []),
    portfolioTransactions: get(PORTFOLIO_STORAGE_KEYS.portfolioTransactions, []),
    portfolioPrincipalRecords: get(PORTFOLIO_STORAGE_KEYS.portfolioPrincipalRecords, []),
    portfolioSnapshots: get(PORTFOLIO_STORAGE_KEYS.portfolioSnapshots, []),
    portfolioBacktests: get(PORTFOLIO_STORAGE_KEYS.portfolioBacktests, []),
    portfolioSettings: get(PORTFOLIO_STORAGE_KEYS.portfolioSettings, DEFAULT_PORTFOLIO_SETTINGS),
  };
}

export function writePortfolioState(patch = {}) {
  Object.entries(PORTFOLIO_STORAGE_KEYS).forEach(([, key]) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) set(key, patch[key]);
  });
}

export function ensureDefaultPortfolioState({ funds = [], holdings = {} } = {}) {
  const state = readPortfolioState();
  if (Array.isArray(state.portfolios) && state.portfolios.length) return state;
  const next = createDefaultPortfolioState({ funds, holdings });
  writePortfolioState(next);
  return { ...state, ...next };
}

export function upsertPortfolio(portfolio) {
  const normalized = normalizePortfolio(portfolio);
  const state = readPortfolioState();
  const exists = state.portfolios.some((row) => row.id === normalized.id);
  const portfolios = exists
    ? state.portfolios.map((row) => row.id === normalized.id ? normalized : row)
    : [...state.portfolios, normalized];
  set(PORTFOLIO_STORAGE_KEYS.portfolios, portfolios);
  return normalized;
}

export function upsertPortfolioHolding(holding) {
  const normalized = normalizePortfolioHolding(holding);
  const state = readPortfolioState();
  const exists = state.portfolioHoldings.some((row) => row.id === normalized.id);
  const portfolioHoldings = exists
    ? state.portfolioHoldings.map((row) => row.id === normalized.id ? normalized : row)
    : [...state.portfolioHoldings, normalized];
  set(PORTFOLIO_STORAGE_KEYS.portfolioHoldings, portfolioHoldings);
  return normalized;
}
