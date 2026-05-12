# Portfolio Integration Map

## Existing Entry Points

- Main SPA orchestration: `app/page.jsx`
  - Owns top tabs, mobile bottom navigation, local initialization, cloud sync, import/export, refresh cycles, and existing fund actions.
  - Portfolio integration should only add a top-level tab/panel and pass storage-backed data into a new component.
- Storage source of truth: `app/stores/storageStore.js`
  - All business localStorage reads/writes must go through `storageStore` or `useStorageStore`.
  - Portfolio keys are added to this store so UI state, local persistence, and optional Supabase sync use the same path.
- Fund data APIs: `app/api/fund.js`
  - Existing `searchFunds`, `fetchFundData`, and net value helpers remain reusable.
  - Portfolio code should consume existing `funds` snapshots first and only call fetch helpers from UI flows that add missing funds.
- Holdings and transaction patterns: `app/page.jsx`, `HoldingEditModal`, `TradeModal`, `TransactionHistoryModal`
  - Existing fund holdings use `{ [code]: { share, cost } }`.
  - Portfolio holdings use their own normalized list shape to avoid breaking old grouping semantics.
- Daily earnings and history helpers: `app/lib/dailyEarnings.js`, `app/lib/valuationTimeseries.js`
  - Portfolio dashboard can aggregate current valuation from `funds` plus portfolio holdings.
  - Snapshot history is stored separately in `portfolioSnapshots`.
- Cloud sync: `collectLocalPayload`, `applyCloudConfig`, `storageStore` sync callback
  - Portfolio keys are sync-safe because they are JSON-compatible and independent from existing keys.
  - Full conflict-resolution UX can remain a later milestone.
- Import/export: `exportLocalData`, `handleImportFileChange`
  - Existing app-level import/export remains unchanged for funds.
  - Portfolio JSON import/export is scoped inside the new portfolio panel first.

## Reuse / Adapt / Avoid

- Reuse directly:
  - shadcn UI primitives, lucide icons, Chart.js dependency, CSS variables, `storageStore`, fund code/name data from `funds`.
- Adapt lightly:
  - `storageStore` key list, `page.jsx` initialization, `page.jsx` cloud payload, top tabs, mobile bottom nav.
- Avoid touching:
  - JSONP/script injection internals in `app/api/fund.js`.
  - Existing fund grouping migration logic.
  - Existing trade modal behavior for old holdings.

## Minimal Integration Strategy

1. Add pure portfolio modules under `app/lib/portfolio/`.
2. Add portfolio-specific UI under `app/components/portfolio/`.
3. Add one PC tab id, `portfolio`, and one mobile nav id, `portfolio`.
4. Keep all portfolio state in storageStore-backed portfolio keys.
5. Verify pure math and import/export with a Node smoke test before relying on UI.
