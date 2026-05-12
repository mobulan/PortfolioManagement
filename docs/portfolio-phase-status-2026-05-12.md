# PortfolioManagement Phase Status - 2026-05-12

## PRD Coverage Summary

Current baseline commit: `b67ec93 feat: add portfolio management module`

Current integration note:
- After the next-stage subagent pass, the standalone detail tabs, import preview, snapshot/history table, backtest panel, and legacy holding migration panel have been integrated into `PortfolioWorkspace`.
- The workspace now exposes PRD detail sections for overview, holdings, transactions, rebalance, history/import, and backtest.
- Read-only PRD coverage review confirms the current implementation covers the P0 data model, local persistence, base dashboard, basic transaction recording, rebalance suggestions, manual snapshots, JSON import/export, and minimal backtest metrics. The remaining PRD gaps are now grouped into the next execution wave below.

| PRD Area | Current Status | Evidence | Next Action |
| --- | --- | --- | --- |
| Repository baseline and upstream compatibility | Partially complete | Git initialized, `upstream/main` fetched, local commit is based on upstream `b248a64` | Create private GitHub repo and push when `gh` or token is available |
| Portfolio data model | Complete for v1 | `app/lib/portfolio/schema.js` | Add stricter UI validation and user-facing import warnings |
| Local storage keys | Complete for v1 | `app/stores/storageStore.js` includes portfolio keys/setters/init | Add migration UX from existing fund holdings into portfolio |
| Calculation engine | Complete for v1 | `calculations.js`, `rebalance.js`, smoke tests | Add UI explainability for theta and rebalance mode |
| Transaction and principal records | Complete for v1 core | `transactionEngine.js`, smoke tests | Add transaction table and edit/delete/rebuild flows |
| Portfolio dashboard | Phase 2 basic complete | `PortfolioWorkspace.jsx`, `PortfolioDetailTabs.jsx`, `portfolio-*` CSS | Add contribution/risk sections and richer charts |
| Portfolio creation and holdings UI | Basic complete | Default/custom portfolio and holding form in workspace | Add template wizard, allocation validation, editable target ratios |
| Rebalance UI | Basic complete | Rebalance list and smart cash suggestion in workspace | Add threshold warnings, forced rebalance action list, clearer copy |
| Snapshot/history | Phase 2 basic complete | `snapshot.js`, history tab, snapshot table, interval summary | Add charts and CSV/XLSM field mapping |
| Import/export | Phase 2 basic complete | `importExport.js`, import analysis, valid/dropped counts | Add conflict resolution modes: skip/overwrite/merge |
| Backtest/risk metrics | Phase 2 basic complete | `backtest.js`, backtest tab, value-series JSON metrics | Add fund-code driven historical NAV fetching and correlation matrix UI |
| Supabase sync compatibility | Partial | portfolio keys included in storage sync and payload | Needs real multi-device verification after npm/build environment works |
| Tests | Pure module smoke complete | `scripts/portfolio-smoke-test.mjs`, `docs/portfolio-test-cases.md` | Add UI/static checks and expand tests for new stage |

## Completed Items

- PRD archived into `docs/PRD-PortfolioManagement.md`.
- Integration map created at `docs/portfolio-integration-map.md`.
- Agent action tracking established at `docs/portfolio-agent-action-plan.md`.
- Portfolio domain modules added under `app/lib/portfolio/`.
- Portfolio workspace added under `app/components/portfolio/`.
- PC tab `投资组合` and mobile nav `组合` wired into `app/page.jsx` and `MobileBottomNav`.
- Portfolio storage keys and setters added to `storageStore`.
- Portfolio data included in app-level import/export and cloud payload collection/application.
- Node smoke test covers 11 pure-module scenario groups and passes.

## Pending Tasks

- GitHub private repository `PortfolioManagement` creation and push remain blocked by missing `gh`/token/origin.
- `npm run lint` and `npm run build` remain blocked because `npm`/`npx` are unavailable in the current PowerShell PATH.
- Dashboard still needs trend charts, contribution analysis, risk alerts, and richer portfolio cards.
- Portfolio management now has an editor panel for metadata, archive/restore, target allocation editing, and an all-weather shortcut; deeper route-level editing remains pending.
- Transaction management now has a transaction/principal ledger table and pure rebuild helper; destructive delete/rebuild actions remain pending until a transaction-baseline snapshot exists.
- Rebalance still needs a forced action list, threshold explanations, and a path from advice to transactions.
- Import/export has JSON preview, CSV helper coverage, and conflict mode definitions; CSV UI wiring and XLSM mapping remain pending.
- Snapshot history has a table and interval summary, but no visual trend chart or automatic daily archive yet.
- Backtest has value-series JSON UI, but not fund-code driven historical NAV fetching or a saved-result workflow yet.
- Existing global holdings can be previewed and migrated into the selected portfolio; group-level migration is still pending.

## Next Stage: Product Loop Closure

Goal: turn the current technical MVP into a PRD-aligned, usable portfolio workflow without disturbing the original fund valuation screens.

### Agent J: Portfolio Detail Tabs And Validation

Status: Completed

Action log:
- 2026-05-12 Agent J started. Confirmed write scope and existing portfolio component/CSS context before adding the standalone detail-tab component.
- 2026-05-12 Added standalone `PortfolioDetailTabs.jsx` client component with PRD detail tabs, allocation-total warning, and validation error rendering.
- 2026-05-12 Added scoped `.portfolio-detail-*` styles, including mobile horizontal tab scrolling.
- 2026-05-12 Static `rg` checks passed for component props, PRD tab ids, and CSS selectors. `npm run lint` remains blocked because `npm` is unavailable in the current PowerShell PATH.

Write scope:
- `app/components/portfolio/PortfolioDetailTabs.jsx`
- `app/globals.css`
- `docs/portfolio-phase-status-2026-05-12.md`

Action plan:
- Add a reusable tab component for overview, holdings, transactions, rebalance, history/import, and backtest.
- Add basic form validation messages for missing portfolio, missing holding, invalid numeric values, and invalid JSON.
- Show target allocation total and warn when it is not 100%.
- Mark this section completed after implementation and static verification.

### Agent K: Snapshot, Import Preview, And Backtest UI

Status: Completed

Agent K action log:
- 2026-05-12: Started Snapshot, Import Preview, And Backtest UI work. Scope limited to import analysis helper, history/import panel, backtest panel, smoke tests, and this status section.
- 2026-05-12: Added import preview analysis, standalone history/import and backtest panels, smoke coverage for import counts plus backtest empty/single-point boundaries, and verified with `node scripts\portfolio-smoke-test.mjs`.

Write scope:
- `app/components/portfolio/PortfolioHistoryImportPanel.jsx`
- `app/components/portfolio/PortfolioBacktestPanel.jsx`
- `app/lib/portfolio/importExport.js`
- `app/lib/portfolio/backtest.js`
- `scripts/portfolio-smoke-test.mjs`
- `docs/portfolio-phase-status-2026-05-12.md`

Action plan:
- Add user-facing import analysis that reports valid counts and filtered invalid records before applying import.
- Add snapshot table and simple trend summary using existing snapshots.
- Add a minimal backtest panel that accepts value-series JSON and shows risk metrics.
- Extend smoke tests for import analysis and risk helper edge cases.
- Mark this section completed after tests pass.

### Agent L: Migration And Quality Gate

Status: Completed

Write scope:
- `app/lib/portfolio/migrations.js`
- `app/components/portfolio/PortfolioMigrationPanel.jsx`
- `scripts/portfolio-smoke-test.mjs`
- `docs/portfolio-test-cases.md`
- `docs/portfolio-phase-status-2026-05-12.md`

Action plan:
- Add a guided action to seed a default portfolio from existing `funds` + `holdings`.
- Ensure migration is idempotent and does not delete existing portfolio records.
- Expand test cases for migration from existing holdings.
- Run smoke tests and update quality notes.

Action record:
- 2026-05-12 Agent L started migration preview/idempotency implementation, smoke coverage expansion, migration panel addition, and documentation updates.
- 2026-05-12 Added pure legacy holdings migration preview with duplicate fund-code skipping and deterministic preview holdings.
- 2026-05-12 Added standalone `PortfolioMigrationPanel.jsx` without wiring it into `PortfolioWorkspace`.
- 2026-05-12 Extended smoke/test-case documentation for legacy migration preview and duplicate skipping.
- 2026-05-12 Main integration pass wired the detail tabs, history/import panel, backtest panel, and legacy migration panel into `PortfolioWorkspace`.
- 2026-05-12 Main integration pass added import-apply safeguards so malformed or portfolio-empty imports cannot overwrite existing portfolio data.

## Next Execution Wave

Before action note:
- This section is the required action plan for the next subagent wave. Agents must update the action record under their section after completing work.
- The wave is split by write scope to keep changes compatible with upstream and reduce merge conflicts.

### Agent M: Transaction Rebuild And Principal Ledger

Status: Completed

Write scope:
- `app/lib/portfolio/transactionEngine.js`
- `app/components/portfolio/PortfolioTransactionsPanel.jsx`
- `scripts/portfolio-transaction-smoke-test.mjs`
- `docs/portfolio-phase-status-2026-05-12.md`

Action plan:
- Add pure helpers to rebuild holdings/principal records from a transaction list.
- Handle cash dividend and conversion transactions consistently.
- Add a transaction/principal table panel with delete/rebuild affordances.
- Extend smoke tests for rebuild idempotency and cash-dividend behavior.

Action log:
- 2026-05-12 Agent M started. Latest user scope overrides the older workspace wiring line: do not edit `PortfolioWorkspace.jsx`; add the standalone transaction smoke test at `scripts/portfolio-transaction-smoke-test.mjs` and leave wiring instructions for the main agent.
- 2026-05-12 Added `rebuildPortfolioLedgerFromTransactions` as a pure transaction replay helper. It sorts transactions deterministically, rebuilds holdings and principal records from the supplied list, keeps cash dividends out of principal while raising cash manual value, and processes conversion out before conversion in on the same date.
- 2026-05-12 Added standalone `PortfolioTransactionsPanel.jsx` with transaction and principal-record tables plus delete/rebuild callback affordances. It is intentionally not wired into `PortfolioWorkspace.jsx`.
- 2026-05-12 Added `scripts/portfolio-transaction-smoke-test.mjs` covering rebuild idempotency, cash-dividend behavior, and conversion principal records.
- 2026-05-12 Verification passed: `node scripts/portfolio-transaction-smoke-test.mjs` and `node scripts/portfolio-smoke-test.mjs`. Both commands exit 0; the environment still prints the existing PowerShell profile warning and Node module-type warning.

Main-agent wiring note:
- 2026-05-12 Main agent imported `PortfolioTransactionsPanel` and replaced the inline transaction table with the standalone transaction/principal ledger view.
- The delete/rebuild callbacks are intentionally not wired yet because the workspace does not persist a pre-transaction baseline snapshot. This avoids recomputing holdings from an already-mutated holding set.
- Implement `onDeleteTransaction` by removing the selected transaction, calling `rebuildPortfolioLedgerFromTransactions({ holdings: baselineHoldings, transactions: remainingTransactionsForPortfolio })`, then replacing that portfolio's holdings/principal records while preserving other portfolios' records. The baseline should be the pre-transaction seed holdings for that portfolio, or an agreed migration snapshot if the workspace cannot yet distinguish seed holdings from replayed holdings.
- Implement `onRebuildLedger` with the same helper and state replacement flow. Agent M did not edit `PortfolioWorkspace.jsx` per the latest user scope.

### Agent N: Portfolio Editor And Allocation UX

Status: Completed

Write scope:
- `app/components/portfolio/PortfolioEditorPanel.jsx`
- `app/components/portfolio/PortfolioWorkspace.jsx`
- `app/lib/portfolio/schema.js`
- `app/globals.css`

Action plan:
- Add edit/archive flow for portfolio metadata.
- Add target allocation editor with live total validation.
- Add an all-weather template shortcut while preserving the existing permanent/custom flow.
- Keep all changes inside portfolio components except the minimal workspace wiring.

Action log:
- 2026-05-12 Agent N started. User narrowed write scope to `PortfolioEditorPanel.jsx`, `schema.js`, and this phase document only; no edits will be made to `PortfolioWorkspace.jsx` or `globals.css`.
- 2026-05-12 Added schema-level portfolio template metadata plus live allocation-total validation helpers.
- 2026-05-12 Added standalone `PortfolioEditorPanel.jsx` with metadata editing, archive/restore callback, target allocation editor, and all-weather shortcut/create actions.
- 2026-05-12 Verified `validateTargetAllocations(createDefaultAllocations('all_weather'))` with Node import. `npm run lint` remains blocked because `npm` is unavailable in the current PowerShell PATH.
- 2026-05-12 Main agent wired `PortfolioEditorPanel` into the overview side panel, added save/archive/create callbacks, and added scoped editor CSS.

### Agent O: Import Export Field Mapping

Status: Completed

Write scope:
- `app/lib/portfolio/importExport.js`
- `scripts/portfolio-import-smoke-test.mjs`
- `docs/portfolio-test-cases.md`
- `docs/portfolio-phase-status-2026-05-12.md`

Action plan:
- Add CSV parsing helpers and preview counts without touching storage directly.
- Add conflict mode definitions for skip, overwrite, and merge.
- Add CSV export for portfolio holdings, transactions, and snapshots.
- Extend tests for malformed dates, malformed amounts, and unknown fund codes.

Action log:
- 2026-05-12 Agent O started. Confirmed write scope is limited to import/export helpers, a new import smoke test, test-case docs, and this phase status file; `PortfolioHistoryImportPanel.jsx` and `PortfolioWorkspace.jsx` will not be modified in this pass.
- 2026-05-12 Added failing `scripts/portfolio-import-smoke-test.mjs` coverage for CSV preview validation, conflict modes, and CSV export headers; initial run fails because the CSV helper exports do not exist yet.
- 2026-05-12 Added pure CSV parsing/preview helpers, skip/overwrite/merge conflict mode definitions, and CSV export helpers for portfolio holdings, transactions, and snapshots.
- 2026-05-12 Updated portfolio test-case documentation with the new CSV import/export coverage. No changes were made to `PortfolioHistoryImportPanel.jsx` or `PortfolioWorkspace.jsx`.
- 2026-05-12 Verification passed: `node scripts\portfolio-import-smoke-test.mjs` and `node scripts\portfolio-smoke-test.mjs`. Both commands still emit the existing local PowerShell profile warning and Node `MODULE_TYPELESS_PACKAGE_JSON` warning.
- 2026-05-12 `npm --version` check confirms `npm` is still unavailable in the current PowerShell PATH, so lint/build were not run in this agent pass.
- 2026-05-12 Main agent left CSV UI wiring for a later pass because applying skip/overwrite/merge safely needs a visible conflict-resolution workflow. The pure helpers and smoke tests are ready.

## Main Integration Verification

- 2026-05-12 Wired backtest persistence by passing `portfolioBacktests` and `setPortfolioBacktests` into `PortfolioBacktestPanel`; saved manual value-series results now render in the backtest tab.
- 2026-05-12 Added `setPortfolioSchemaVersion` to `storageStore`, passed schema version props from `app/page.jsx`, and applied imported schema version in `PortfolioWorkspace`.
- 2026-05-12 Ran `node scripts\portfolio-smoke-test.mjs`, `node scripts\portfolio-transaction-smoke-test.mjs`, and `node scripts\portfolio-import-smoke-test.mjs`; all exited 0.
- 2026-05-12 Ran static token/conflict-marker checks across the new portfolio components and helpers; passed.
- 2026-05-12 Ran `git diff --check`; passed with only CRLF normalization warnings.
- 2026-05-12 After activating the conda `fund` toolchain, installed dependencies with `npm ci`, ran `npm run lint` successfully with warnings only, and ran `npm run build` successfully.
- 2026-05-12 Completed remote setup: local `main` now tracks `origin/main` at `https://github.com/mobulan/PortfolioManagement.git`; `upstream` remains `https://github.com/hzm0321/real-time-fund.git`.

### Agent P: Dashboard Risk And Trend Panel

Status: Planned

Write scope:
- `app/components/portfolio/PortfolioRiskPanel.jsx`
- `app/components/portfolio/PortfolioWorkspace.jsx`
- `app/lib/portfolio/calculations.js`
- `app/globals.css`

Action plan:
- Add snapshot-based trend metrics and risk alerts.
- Surface annualized return, volatility, Sharpe, and max drawdown when enough snapshots exist.
- Add contribution summaries by asset class and holding.
- Keep visual additions lightweight and static-deploy compatible.
