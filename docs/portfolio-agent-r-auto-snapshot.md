# Agent R: Automatic Daily Snapshot

## Plan

1. Add a focused smoke test for a pure automatic snapshot helper.
2. Verify the smoke fails before implementation.
3. Implement the helper in `app/lib/portfolio/snapshot.js` only.
4. Re-run the smoke and related existing portfolio smoke checks.
5. Record completion notes and verification output here.

## Scope

- In scope:
  - `app/lib/portfolio/snapshot.js`
  - `scripts/portfolio-snapshot-smoke-test.mjs`
  - `docs/portfolio-agent-r-auto-snapshot.md`
- Out of scope:
  - PortfolioWorkspace UI wiring
  - progress overview updates
  - test-case documentation updates
  - direct storage writes

## Helper Contract

- The helper decides from `portfolioSettings` whether automatic daily snapshots are enabled.
- It creates a snapshot proposal for a specific `portfolioId` and date when needed.
- Same `portfolioId + date` is idempotent:
  - default conflict mode is `skip`
  - existing snapshot returns a skipped result without modifying arrays
  - explicit `overwrite` returns a replacement array where only that portfolio/date snapshot is replaced
- It is pure: callers receive result data and must persist it themselves.

## Validation Plan

- Run `node scripts/portfolio-snapshot-smoke-test.mjs` and confirm it fails before implementation.
- Run `node scripts/portfolio-snapshot-smoke-test.mjs` after implementation.
- Run related existing smoke tests:
  - `node scripts/portfolio-import-smoke-test.mjs`
  - `node scripts/portfolio-transaction-smoke-test.mjs`

## Completion Notes

- Added `prepareAutomaticDailySnapshot` in `app/lib/portfolio/snapshot.js`.
- Added `scripts/portfolio-snapshot-smoke-test.mjs` to cover disabled settings, enabled append, default skip idempotency, and explicit overwrite.
- The helper is pure and does not read from or write to storage. It returns `{ status, reason, snapshot, snapshots, shouldPersist }`.
- Settings accepted by the helper:
  - global `snapshotReminderEnabled: true`, `autoSnapshotEnabled: true`, or `automaticDailySnapshotEnabled: true`
  - optional per-portfolio override at `portfolioSettings.portfolioSnapshotSettings[portfolioId]`
  - optional `automaticSnapshotConflictMode: 'skip' | 'overwrite'`
- Verification:
  - RED: `node scripts/portfolio-snapshot-smoke-test.mjs` failed before implementation because `prepareAutomaticDailySnapshot` was not exported.
  - GREEN: `node scripts/portfolio-snapshot-smoke-test.mjs` passed 4 smoke cases.
  - Related smoke: `node scripts/portfolio-import-smoke-test.mjs` passed 3 smoke cases.
  - Related smoke: `node scripts/portfolio-transaction-smoke-test.mjs` passed 2 smoke cases.
  - Existing portfolio smoke: `node scripts/portfolio-smoke-test.mjs` passed 18 smoke cases.
  - Lint: `.\node_modules\.bin\eslint.cmd app/lib/portfolio/snapshot.js scripts/portfolio-snapshot-smoke-test.mjs` exited 0.
- Environment notes:
  - `npx` is not available in this PowerShell session, so lint used the local eslint cmd directly.
  - PowerShell profile execution policy warnings and Node `MODULE_TYPELESS_PACKAGE_JSON` warnings appeared during commands; they did not fail the smoke checks.
