# PortfolioManagement Current Progress - 2026-05-12

## Current Baseline

- Local branch: `main`
- Current commit: `2bbfc5d docs: record portfolio verification status`
- Origin: `https://github.com/mobulan/PortfolioManagement.git`
- Upstream: `https://github.com/hzm0321/real-time-fund.git`
- Repository strategy: keep `origin` for PortfolioManagement and `upstream` for the original real-time-fund project so future upstream merges can use `git fetch upstream`.

## Overall Completion

Estimated overall PRD completion: **about 65%**

| Scope | Completion | Notes |
| --- | ---: | --- |
| Milestone 1: Repository and baseline | 100% | Git initialized, upstream preserved, origin configured and pushed. |
| Milestone 2: Data core | 90% | Schema, storage keys, migrations, JSON import/export, calculations, transactions, snapshots, backtest helpers are present. |
| Milestone 3: Usable portfolio management | 75% | Can create portfolios, edit metadata/allocation, add holdings, view dashboard, holdings, transactions, history, and backtest tab. |
| Milestone 4: Dashboard and rebalance | 55% | Basic asset dashboard and rebalance suggestions exist; richer risk cards, charts, and actionable rebalance execution are pending. |
| Milestone 5: History and migration | 50% | Manual snapshots, JSON import/export, CSV helper layer, and legacy holdings preview exist; automatic snapshots, CSV UI, XLSM mapping, and group-level migration are pending. |
| Milestone 6: Backtest and enhancements | 30% | Risk metric engine and manual value-series backtest UI exist; historical NAV-driven backtest, correlation UI, saved reports, AI analysis, and full Supabase QA are pending. |

## Completed Capabilities

### Repository And Compatibility

- `origin` points to the private PortfolioManagement repository.
- `upstream` points to `hzm0321/real-time-fund`.
- The repo was unshallowed, so upstream history can now be fetched and merged normally.
- Current branch tracks `origin/main`.

### Portfolio Data Layer

- Added portfolio domain modules under `app/lib/portfolio/`.
- Added portfolio storage keys to `app/stores/storageStore.js`:
  - `portfolios`
  - `portfolioHoldings`
  - `portfolioTransactions`
  - `portfolioPrincipalRecords`
  - `portfolioSnapshots`
  - `portfolioBacktests`
  - `portfolioSettings`
  - `portfolioSchemaVersion`
- Added schema version setter and import-time schema version application.
- Added helpers for schema normalization, migration preview, calculations, rebalance, transactions, snapshots, JSON import/export, CSV parsing/export, and backtest metrics.

### Product UI

- PC top tab and mobile entry for portfolio management are wired through `app/page.jsx`.
- Main workspace exists at `app/components/portfolio/PortfolioWorkspace.jsx`.
- Added focused portfolio components:
  - `PortfolioDetailTabs.jsx`
  - `PortfolioEditorPanel.jsx`
  - `PortfolioHistoryImportPanel.jsx`
  - `PortfolioMigrationPanel.jsx`
  - `PortfolioTransactionsPanel.jsx`
  - `PortfolioBacktestPanel.jsx`
- The workspace now supports:
  - portfolio overview
  - holdings table
  - transaction/principal ledger view
  - rebalance suggestion view
  - manual snapshot/history view
  - JSON import analysis and guarded apply
  - manual value-series backtest with saved result records
  - legacy holdings migration preview

### Test And Verification

Verified commands:

- `node scripts\portfolio-smoke-test.mjs`: passed
- `node scripts\portfolio-transaction-smoke-test.mjs`: passed
- `node scripts\portfolio-import-smoke-test.mjs`: passed
- `npm run lint`: passed with warnings only
- `npm run build`: passed
- `git diff --check`: passed with CRLF normalization warnings only

Known verification notes:

- `npm` is available through the conda `fund` environment.
- `npm run lint` still reports warnings in pre-existing upstream areas such as hook dependencies and TanStack Table React Compiler compatibility. No lint errors remain.
- Node smoke scripts still print `MODULE_TYPELESS_PACKAGE_JSON` warnings because package metadata does not declare `"type": "module"` while the portfolio modules use ESM syntax.

## Remaining PRD Gaps

### P0 / Near-Term

- Add a transaction baseline snapshot model before enabling destructive transaction delete/rebuild in UI.
- Add actionable forced-rebalance list and a safe path from rebalance advice to generated transactions.
- Add clearer user-facing validation for malformed holdings, invalid ratios, and import conflicts.
- Complete group-level migration from existing `groupHoldings`.
- Add automatic daily snapshot option.

### P1

- Add dashboard trend charts, contribution analysis, risk alerts, portfolio cards, and richer visual summaries.
- Wire CSV import/export UI around the completed helper layer.
- Add CSV conflict resolution UX for `skip`, `overwrite`, and `merge`.
- Add XLSM/Excel field mapping.
- Add historical NAV-driven backtest using fund codes and weights.
- Add correlation matrix UI and saved backtest report view.
- Run real multi-device Supabase sync verification for all portfolio keys.

### P2

- Add AI analysis summaries and portfolio reports.
- Add advanced suggestions for concentration risk, correlation risk, and rebalance explainability.

## Document Status And Cleanup Labels

The following labels describe which documents should remain active and which are now mainly historical process records.

| File | Status Label | Reason |
| --- | --- | --- |
| `docs/PRD-PortfolioManagement.md` | `KEEP_ACTIVE_SOURCE` | Product requirements source of truth. Keep. |
| `docs/portfolio-current-progress-2026-05-12.md` | `KEEP_ACTIVE_STATUS` | Current high-level implementation status. Prefer this for progress checks. |
| `docs/portfolio-test-cases.md` | `KEEP_ACTIVE_QA` | Test coverage matrix and future QA checklist. Keep updating. |
| `docs/portfolio-integration-map.md` | `KEEP_REFERENCE` | Stable integration map; useful when merging upstream or adding new wiring. |
| `docs/portfolio-phase-status-2026-05-12.md` | `PROCESS_ARCHIVE_CANDIDATE` | Detailed agent execution log. Useful for audit, but no longer the best current-status document. |
| `docs/portfolio-agent-action-plan.md` | `PROCESS_ARCHIVE_CANDIDATE` | Early agent plan contains outdated blocked notes. Keep only as historical process record or archive later. |

Recommended convention:

- Use `portfolio-current-progress-YYYY-MM-DD.md` for current progress snapshots.
- Keep process-heavy agent logs, but treat them as archive material once a current progress snapshot exists.
- Do not delete process docs yet; they still preserve implementation decisions and agent accountability.
