# Agent Q: Group Holdings Migration

## Plan

1. Add a focused smoke test for previewing migration from legacy `groupHoldings` plus `funds` into one target `portfolioId`.
2. Verify the smoke fails before implementation.
3. Add a pure helper in `app/lib/portfolio/migrations.js` that returns generated holdings and skipped details without writing storage.
4. Re-run the smoke and update this document with completion notes.

## Scope

- `app/lib/portfolio/migrations.js`
- `scripts/portfolio-migration-smoke-test.mjs`
- `docs/portfolio-agent-q-group-migration.md`

Out of scope: `PortfolioWorkspace`, progress overview docs, and portfolio test-case docs.

## Verification

- Run `node scripts/portfolio-migration-smoke-test.mjs`.
- Confirm duplicate `fundCode` entries and empty legacy rows are skipped with details.
- Confirm generated holdings are assigned to the requested `portfolioId`.
- Confirm helper does not call or mutate storage.

## Completion

Completed.

## Results

- Added `previewGroupHoldingsMigration` in `app/lib/portfolio/migrations.js`.
- The helper accepts `funds`, `groupHoldings`, `groupId`, `portfolioId`, and optional `existingPortfolioHoldings`.
- It previews normalized portfolio holdings for the requested portfolio, skips duplicate fund codes and empty legacy rows, and returns `skipped` records with `groupId`, `fundCode`, and `reason`.
- It is pure: no storage imports, writes, or mutations.

## TDD Notes

- Red: `node scripts/portfolio-migration-smoke-test.mjs` failed because `previewGroupHoldingsMigration` was not exported.
- Green: after implementation, `node scripts/portfolio-migration-smoke-test.mjs` passed.

## Verification Results

- `node scripts/portfolio-migration-smoke-test.mjs`: passed.
- `node scripts/portfolio-smoke-test.mjs`: passed.

Both commands still print existing environment warnings about the PowerShell profile execution policy and Node reparsing ESM files without `"type": "module"`.

## UI Integration Notes

The main agent can wire group import UI by calling:

```js
previewGroupHoldingsMigration({
  funds,
  groupHoldings,
  groupId,
  portfolioId,
  existingPortfolioHoldings: portfolioHoldings,
})
```

Then display `preview.holdings` as the migratable rows and `preview.skipped` for duplicate or empty-row explanations before any storage write is performed by the UI layer.
