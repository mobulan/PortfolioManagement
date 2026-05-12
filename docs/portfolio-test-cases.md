# Portfolio Test Cases

## Scope

Agent I validates portfolio behavior through the Node smoke script and documents manual follow-up cases for UI or integration paths that are outside this agent's write scope.

Automated script:

```bash
node scripts/portfolio-smoke-test.mjs
```

## Automated Smoke Coverage

| Area | Case | Expected result | Status |
| --- | --- | --- | --- |
| Permanent portfolio | Default permanent portfolio creates equity, bond, gold, and cash allocations at 25% each. | Allocation ratios sum to 1.0 and each sleeve is 0.25. | Automated |
| Normalization | Unknown portfolio type and out-of-range allocation ratios are normalized. | Type falls back to `custom`; ratios are clamped to 0..1; zero-ratio rows are removed. | Automated |
| Summary | Mixed holdings calculate total value, principal, profit, return rate, daily estimated profit, and ignore archived holdings. | Total value 700, principal 660, profit 40, daily estimated profit 18, active holding count 5. | Automated |
| Multi-fund same asset class | Two equity funds in one portfolio are grouped into one equity sleeve. | Equity current value 220, principal 190, holding count 2, ratio 220/700. | Automated |
| Rebalance | Drifted permanent portfolio creates target amounts and buy/sell actions. | Equity is sell -45; cash is buy 95; total value is 700. | Automated |
| Smart cash flow | Positive and negative cash flow use smart fill/trim. | Positive 70 fills cash first; negative 60 trims overweight sleeves first. | Automated |
| Buy transaction | Buying more of an existing fund updates share, cost amount, cost price, and principal records. | Equity A share 150, cost amount 161, principal increase 61. | Automated |
| Sell transaction | Selling an existing fund reduces shares and proportional cost basis. | Bond share 150, cost amount 157.5, principal decrease -52.5. | Automated |
| Profitable sell transaction | Selling at a market amount above proportional cost does not over-reduce principal. | Profit-sale holding share 100, cost amount 110, principal decrease -110. | Automated |
| Cash in/out | Cash transactions update manual cash value and principal. | Cash in raises value/cost to 120; cash out lowers value/cost to 95. | Automated |
| Snapshot | Snapshot captures summary and asset-class values. | Snapshot value 700 and equity asset-class value 220. | Automated |
| JSON export/import | Exported portfolio payload can be parsed and imported. | Valid portfolios, holdings, transactions, principal records, and snapshots are preserved. | Automated |
| Invalid JSON relationships | Import filters orphan holdings, transactions, principal records, and snapshots. | Only records linked to existing portfolio/holding/transaction IDs remain. | Automated |
| Malformed payloads | Non-array import fields and invalid holding numbers are tolerated. | Empty arrays or numeric defaults are returned without throwing. | Automated |
| Backtest helpers | Representative value series and correlation inputs produce finite metrics. | Annualized return, volatility, max drawdown are finite; perfect correlation is near 1. | Automated |

## Manual And Integration Follow-Up

| Area | Case | Expected result | Owner note |
| --- | --- | --- | --- |
| UI portfolio editor | Create permanent portfolio from the UI. | Four target allocation rows render and can be saved without corrupting ratios. | Requires Agent E UI surface. |
| UI holdings | Add multiple funds under one asset class. | Dashboard and detail views show both holdings and one aggregated sleeve. | Requires Agent E/G UI surface. |
| UI transactions | Enter buy, sell, cash in, and cash out from forms. | Form validation prevents missing portfolio/holding IDs and updates principal history. | Requires Agent F/E surface. |
| UI rebalance | Trigger rebalance view for a drifted portfolio. | Buy/sell suggestions match calculation engine amounts and thresholds. | Requires Agent E/G surface. |
| Import/export UI | Export JSON, re-import it, and inspect state. | User-facing import reports filtered invalid records and preserves valid records. | Requires Agent H/E surface. |
| Error states | Submit negative shares, non-numeric NAV, missing fund code, and orphan relationships. | UI blocks or normalizes consistently and communicates the result. | Requires production validation decisions. |

## Current Risks Observed By Agent I

- `node scripts/portfolio-smoke-test.mjs` passes but emits Node's `MODULE_TYPELESS_PACKAGE_JSON` warning because `package.json` does not declare `"type": "module"` while portfolio library files use ESM syntax.
- PowerShell command startup emits a local profile execution-policy warning in this environment. It does not fail the commands, but it adds noise to verification output.
- Import normalization filters invalid relationships silently. This is safe for data integrity, but user-facing import screens may need counts or warnings so users understand what was dropped.
- The current automated smoke validates pure modules only; UI wiring, storage persistence, and sync behavior still need integration tests after those agents finish.
