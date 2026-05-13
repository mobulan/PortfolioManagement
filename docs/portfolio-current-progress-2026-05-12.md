# PortfolioManagement Current Progress - 2026-05-12

## Current Baseline

- Local branch: `main`
- Current commit: use `git log --oneline -1` for the latest pushed commit.
- Origin: `https://github.com/mobulan/PortfolioManagement.git`
- Upstream: `https://github.com/hzm0321/real-time-fund.git`
- Repository strategy: keep `origin` for PortfolioManagement and `upstream` for the original real-time-fund project so future upstream merges can use `git fetch upstream`.

## Overall Completion

Estimated overall PRD completion: **about 76%**

| Scope | Completion | Notes |
| --- | ---: | --- |
| Milestone 1: Repository and baseline | 100% | Git initialized, upstream preserved, origin configured and pushed. |
| Milestone 2: Data core | 90% | Schema, storage keys, migrations, JSON import/export, calculations, transactions, snapshots, backtest helpers are present. |
| Milestone 3: Usable portfolio management | 85% | Can create/delete portfolios, edit metadata/allocation, add/remove holdings, search/select funds, delete/rebuild baseline-backed transactions, and view dashboard, holdings, transactions, history, and backtest tab. |
| Milestone 4: Dashboard and rebalance | 68% | Basic asset dashboard, empty states, rebalance suggestions, and executable rebalance transaction drafts exist; richer risk cards and charts are pending. |
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
  - fund search suggestions while adding portfolio holdings
  - amount-mode and share-mode holding entry
  - portfolio deletion with cascading local cleanup
  - soft removal of individual holdings

## 2026-05-13 Progress Update

Action plan for this pass:

- Continue the P0 usability work already identified in the progress document.
- Focus on portfolio-management UX rather than starting a new large subsystem.
- Preserve the existing fund valuation workflow and keep changes scoped where possible.
- Verify with smoke tests, lint, build, and `git diff --check`.

Completed in this pass:

- Added pure form helpers:
  - `app/lib/portfolio/holdingForm.js`
  - `app/lib/portfolio/editorForm.js`
- Improved holding entry:
  - local and remote fund search suggestions
  - fund selection that can populate name and estimated NAV
  - amount-mode entry for manual/cash-style market value
  - share-mode entry for fund shares and NAV
- Improved portfolio editor:
  - clearer field labels and helper text
  - currency selector
  - template icons
  - allocation table header
  - one-click normalization of allocation percentages to 100%
- Improved workspace usability:
  - active portfolios are separated from archived/deleted state
  - portfolio deletion cascades local portfolio records
  - holding rows can be soft-removed
  - overview and rebalance tabs now show empty-state guidance
  - holdings layout has a wider single-column editing mode
- Cleaned lint warnings in touched existing files, including React hook dependency warnings and TanStack Table compiler warnings.
- Extended `scripts/portfolio-smoke-test.mjs` for holding form matching, amount/share modes, and allocation normalization.

### Test And Verification

Verified commands:

- `node scripts\portfolio-smoke-test.mjs`: passed
- `node scripts\portfolio-transaction-smoke-test.mjs`: passed
- `node scripts\portfolio-import-smoke-test.mjs`: passed
- `npm run lint`: passed with 0 reported problems in the 2026-05-13 verification run
- `npm run build`: passed
- `git diff --check`: passed with CRLF normalization warnings only

Known verification notes:

- `npm` is available through the conda `fund` environment.
- Node smoke scripts still print `MODULE_TYPELESS_PACKAGE_JSON` warnings because package metadata does not declare `"type": "module"` while the portfolio modules use ESM syntax.

## Remaining PRD Gaps

### P0 / Near-Term

- Add clearer user-facing validation for import conflicts and transaction edit/delete operations.
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

## 2026-05-13 Rebalance Execution Plan

Action plan for this pass:

- Add a pure helper that converts rebalance plan items into executable transaction drafts.
- Keep execution conservative: generate drafts only for asset classes with matching active holdings and non-zero rebalance amounts.
- Wire the rebalance tab to preview transaction drafts and let the user apply them through the existing transaction engine.
- Update progress and test documents after verification.

Acceptance criteria:

- Rebalance drafts map buy/sell actions to existing holdings by asset class.
- Drafts include amount, share estimate, price estimate, and source metadata.
- Draft generation skips `hold` rows and asset classes without a suitable holding.
- Applying drafts updates holdings, transactions, and principal records through `applyPortfolioTransaction`.

Completed in this pass:

- Added `createRebalanceTransactionDrafts` in `app/lib/portfolio/rebalance.js`.
- Added smoke coverage for mapping buy/sell rebalance rows to existing holdings.
- Wired the rebalance tab to show executable transaction drafts.
- Added an "apply rebalance drafts" action that routes drafts through `applyPortfolioTransaction`.
- Captures a transaction baseline before applying rebalance drafts when the current portfolio has no baseline.

Verification:

- `node scripts\portfolio-smoke-test.mjs`: passed
- `npm run lint`: passed
- `npm run build`: passed

## 2026-05-13 Transaction Ledger Continuation Plan

Action plan for this pass:

- Add a transaction baseline snapshot model so destructive transaction delete/rebuild operations can be implemented without replaying from already-mutated holdings.
- Keep the first implementation pure and testable in `app/lib/portfolio/transactionEngine.js`.
- Wire UI callbacks only after the pure rebuild behavior is verified.
- Update test documentation and this progress snapshot after verification.

Acceptance criteria:

- A baseline can be captured from current portfolio holdings before transaction replay.
- Deleting a transaction can rebuild only that portfolio's holdings and principal records from the baseline plus remaining transactions.
- Other portfolios' holdings, transactions, and principal records remain unchanged.
- UI delete/rebuild callbacks use the pure helper and do not mutate storage directly outside existing setters.

Completed in this pass:

- Added transaction baseline helpers in `app/lib/portfolio/transactionEngine.js`:
  - `createPortfolioTransactionBaseline`
  - `rebuildPortfolioAfterTransactionDelete`
- Added transaction smoke coverage for deleting a transaction, rebuilding from baseline, and preserving other portfolio rows.
- Wired `PortfolioWorkspace` to capture a baseline before the first transaction for a portfolio.
- Wired `PortfolioTransactionsPanel` delete/rebuild buttons to baseline-backed rebuild callbacks.
- Disabled destructive ledger actions when a portfolio has no transaction baseline.

Verification:

- `node scripts\portfolio-transaction-smoke-test.mjs`: passed
- `node scripts\portfolio-smoke-test.mjs`: passed
- `node scripts\portfolio-import-smoke-test.mjs`: passed
- `npm run lint`: passed
- `npm run build`: passed
- `git diff --check`: passed with CRLF normalization warnings only
