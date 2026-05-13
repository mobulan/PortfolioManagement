# Agent T: Dashboard Risk Metrics

## Plan

1. Add a focused smoke test in `scripts/portfolio-dashboard-smoke-test.mjs` that imports the dashboard risk helper and verifies trend metrics, contribution analysis, and risk alerts from representative snapshots, holdings, and summary data.
2. Run the smoke test before implementation and confirm it fails because the helper/export is missing.
3. Implement a pure helper in `app/lib/portfolio/dashboardRisk.js` without touching dashboard UI, calculations, progress docs, or test cases.
4. Export the helper from `app/lib/portfolio/index.js`.
5. Re-run the relevant smoke test and record the result here.

## Scope

Allowed files:

- `app/lib/portfolio/dashboardRisk.js`
- `app/lib/portfolio/index.js`
- `scripts/portfolio-dashboard-smoke-test.mjs`
- `docs/portfolio-agent-t-risk-metrics.md`

Out of scope:

- `PortfolioWorkspace`
- `calculations.js`
- progress overview docs
- existing test-cases
- UI wiring

## Validation

Primary validation command:

```bash
node scripts/portfolio-dashboard-smoke-test.mjs
```

The smoke test should first fail before implementation, then pass after the helper and export are added.

## Completion Notes

Completed:

- Added `buildDashboardRiskMetrics` in `app/lib/portfolio/dashboardRisk.js`.
- Added trend metrics from snapshots:
  - sorted time series
  - first/latest/previous snapshot references
  - total value change and change rates
  - latest change and max drawdown
- Added contribution analysis:
  - asset class profit, daily profit, current ratio, target ratio, drift, and profit contribution
  - holding-level profit, return rate, daily profit, and profit contribution
- Added risk alerts:
  - `snapshot_insufficient`
  - `asset_class_overweight`
  - `target_deviation`
  - aggregate `alertSummary`
- Exported the helper from `app/lib/portfolio/index.js`.
- Added `scripts/portfolio-dashboard-smoke-test.mjs`.

TDD notes:

- Initial smoke failed because `dashboardRisk.js` was missing.
- The direct `index.js` import path was not usable in bare Node because existing `storage.js` imports an `@/app` alias; the smoke now imports the helper directly and asserts the `index.js` export line text.

Validation result:

```bash
node scripts/portfolio-dashboard-smoke-test.mjs
```

Result: passed 3 smoke checks. The command still emits existing environment warnings for PowerShell profile loading and Node typeless ESM parsing; no task-scope files were changed to suppress those warnings.
