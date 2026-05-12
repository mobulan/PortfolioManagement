# PortfolioManagement Agent Action Plan

> Rule from project owner: every agent must write its action plan into the project before acting, and mark the corresponding project/task after completion.

## Status Legend

- `Planned`: action plan recorded, work not started.
- `In Progress`: implementation or verification is underway.
- `Completed`: implementation and verification result have been recorded.
- `Blocked`: cannot proceed without external input or tooling.

## Agent A: Repository And Upstream Compatibility

Status: Blocked

Plan:
- Initialize `real-time-fund` as the repository root.
- Preserve compatibility with `hzm0321/real-time-fund` by configuring it as `upstream`.
- Create or connect private GitHub repository `PortfolioManagement` as `origin`.
- Commit the local baseline and push it to `origin`.

Completion Notes:
- Local git repository initialized on `main`.
- `upstream` remote configured as `https://github.com/hzm0321/real-time-fund.git`.
- `git fetch upstream main --depth=1` succeeded on retry; local `main` is based on `upstream/main` commit `b248a64`.
- Local implementation commit created: `3dab652 feat: add portfolio management module`.
- GitHub upload is blocked in this environment because `gh` is unavailable, no `GITHUB_TOKEN`/`GH_TOKEN` is configured, no `origin` remote exists, and the available GitHub connector exposes file/issue read-write APIs but not repository creation.
- Checked likely remote `https://github.com/Mobulan/PortfolioManagement.git`; GitHub returned `Repository not found`.

## Agent B: Integration Map

Status: Completed

Plan:
- Document existing storage, sync, fund search, valuation, import/export, and UI entry points.
- Mark which areas are reusable, which require small adapter changes, and which should remain untouched.
- Save the output as `docs/portfolio-integration-map.md`.

Completion Notes:
- Created `docs/portfolio-integration-map.md` with reusable entry points, adaptation points, and areas to avoid touching.

## Agent C: Data Model And Storage

Status: Completed

Plan:
- Add `app/lib/portfolio/schema.js` for portfolio constants, defaults, and normalizers.
- Add `app/lib/portfolio/storage.js` for storageStore-backed read/write helpers.
- Add `app/lib/portfolio/migrations.js` for v1 bootstrapping and legacy holdings import.
- Add `app/lib/portfolio/importExport.js` for JSON import/export helpers.
- Extend `app/stores/storageStore.js` with portfolio keys and setters.
- Agent C/F integration pass: verify schema, storage, migrations, snapshots, import/export, calculations, rebalance, transaction engine, and backtest pure helpers against `scripts/portfolio-smoke-test.mjs` and PRD P0 expectations.
- Repair only pure storage/domain helper issues inside the allowed files; do not touch UI files.

Completion Notes:
- Completed Agent C/F integration pass for schema, storage-facing keys, migrations, calculations, rebalance, transaction, snapshot, import/export, and backtest helpers.
- Recreated/updated `scripts/portfolio-smoke-test.mjs` after it was absent from the current tree, preserving P0 coverage and adding a sell-at-profit principal-regression case.
- Verification: `node scripts\portfolio-smoke-test.mjs` passed on 2026-05-12.

## Agent D: Calculation And Rebalance Engine

Status: Completed

Plan:
- Add pure calculation helpers for market value, principal, profit, return rate, daily estimated profit, asset-class summaries, drift, and theta.
- Add rebalance helpers for target amount, threshold mode, proportional buy, smart fill/sell, and forced rebalance suggestions.
- Add executable fixture tests or Node-based checks before relying on the engine from UI.

Completion Notes:
- Implemented `app/lib/portfolio/calculations.js` and `app/lib/portfolio/rebalance.js`.
- Verified market value, principal, profit, return rate, daily estimated profit, asset-class summaries, drift, theta, threshold rebalance, proportional cash flow, and smart fill/trim through `scripts/portfolio-smoke-test.mjs`.

## Agent E: Portfolio Management UI

Status: Completed

Plan:
- Add focused components under `app/components/portfolio/`.
- Provide dashboard, portfolio list, editor, detail, holdings, transaction, snapshot, import/export, and backtest surfaces.
- Keep the first implementation compact and local to the portfolio directory.
- Subagent E/G pass: fix obvious `PortfolioWorkspace.jsx` JSX syntax breakage caused by malformed text/tags while preserving current data flow.
- Subagent E/G pass: tighten form, table, toolbar, and panel usability so controls remain readable and usable on desktop and mobile.

Completion Notes:
- Subagent E/G pass completed: repaired malformed `PortfolioWorkspace.jsx` JSX/text, kept the workspace connected to existing portfolio helpers, and improved lightweight form/table/button usability without touching `app/page.jsx` or storageStore.

## Agent F: Transactions And Principal Records

Status: Completed

Plan:
- Add transaction helpers that update holdings and create principal records.
- Support buy, sell, cash in, cash out, fee, dividend cash, and adjustment flows.
- Keep conversion and dividend reinvestment represented in schema, even if advanced UI is deferred.
- Agent C/F integration pass: trace buy, sell, cash in, cash out, fee, dividend cash, and adjustment effects through holdings, cash balance, transaction history, principal records, snapshots, import/export, and smoke-test fixtures.
- Repair only pure transaction/principal calculation issues inside the allowed files; do not touch UI files.

Completion Notes:
- Completed transaction/principal integration check.
- Fixed default principal record amount calculation in `app/lib/portfolio/transactionEngine.js` so sell/cash-out/adjustment records follow actual holding cost-basis delta while still respecting explicit `principalImpact`.
- Verification: `node scripts\portfolio-smoke-test.mjs` passed on 2026-05-12.

## Agent G: Dashboard And Charts

Status: Completed

Plan:
- Add summary cards, allocation chart, portfolio cards, risk alerts, and quick actions.
- Use existing Chart.js dependency where useful, with graceful fallback if chart rendering is unavailable.
- Keep PC and mobile layouts responsive without disturbing existing fund screens.
- Subagent E/G pass: add scoped dashboard/workspace CSS for metric cards, allocation bars, rebalance items, responsive side panel stacking, and readable dark/light theme variables.
- Subagent E/G pass: verify the touched files with at least one static/read-only command after edits.

Completion Notes:
- Subagent E/G pass completed: added scoped `portfolio-*` CSS for responsive dashboard metrics, allocation bars, rebalance rows, side panels, textarea, table overflow, and light/dark readability. Static verification command completed successfully.

## Agent H: Snapshots, Import/Export, Backtest

Status: Completed

Plan:
- Add snapshot recording helpers.
- Add JSON import/export for all portfolio keys.
- Add a basic backtest/risk metrics module for annualized return, volatility, Sharpe ratio, max drawdown, and correlation.

Completion Notes:
- Implemented snapshot helper, portfolio JSON import/export helper, and basic risk/backtest helper modules.
- Verified snapshot capture, JSON round trip, invalid relationship filtering, annualized return, volatility, Sharpe, max drawdown, and correlation through `scripts/portfolio-smoke-test.mjs`.

## Agent I: Tests And Quality

Status: Completed

Plan:
- Add Node-based portfolio verification scripts because the upstream project has no test runner.
- Cover permanent portfolio, multi-fund asset class, buy/sell/cash flow, rebalance, import/export, and invalid input.
- Run `npm run lint` and `npm run build` when npm is available.
- Agent I validation plan:
  - Review and extend `scripts/portfolio-smoke-test.mjs` without changing production code.
  - Add documented test cases in `docs/portfolio-test-cases.md` for permanent portfolio, multi-fund same asset class, cash flows, rebalance, JSON import/export, and invalid inputs.
  - Run the smoke script and available npm verification commands, then record exact results here.

Completion Notes:
- Extended `scripts/portfolio-smoke-test.mjs` to cover 11 automated scenario groups across permanent portfolio defaults, normalization, multi-fund same asset class aggregation, summary calculations, rebalance, smart cash flow, buy/sell/profitable-sell/cash-in/cash-out transactions, snapshots, JSON import/export, invalid import relationships, invalid numeric inputs, and backtest helpers.
- Added `docs/portfolio-test-cases.md` with the automated coverage matrix, manual/integration follow-up cases, and observed risks.
- Verification results:
  - `node scripts/portfolio-smoke-test.mjs`: PASS. All 11 scenario groups passed. Node emitted `MODULE_TYPELESS_PACKAGE_JSON` because `package.json` does not declare `"type": "module"` while portfolio modules use ESM syntax.
  - `npm run lint`: BLOCKED. `npm` is not available in the current PowerShell path; `Get-Command npm` and `Get-Command npm.cmd` returned no command.
  - `npm run build`: BLOCKED. Same missing `npm` command.
- Production code was not modified by Agent I.
