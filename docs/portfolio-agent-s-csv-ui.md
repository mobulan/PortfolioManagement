# Agent S CSV Import UI Panel

## Plan

1. Inspect nearby portfolio component conventions and available UI primitives without editing outside the assigned scope.
2. Add `app/components/portfolio/PortfolioCsvImportPanel.jsx` as an isolated client component.
3. Support CSV type selection, conflict mode selection, CSV text input, and callback-driven analyze/apply/export actions.
4. Render callback results for counts, errors, and preview rows while keeping all behavior compatible with static export.
5. Run the available static check and record the result here.

## Scope

Writable files:

- `app/components/portfolio/PortfolioCsvImportPanel.jsx`
- `docs/portfolio-agent-s-csv-ui.md`

Explicitly out of scope:

- `PortfolioWorkspace`
- `importExport.js`
- Progress overview documents
- Test case documents

## Verification

- Use the repository lint command if feasible: `npm run lint`.
- If lint reports unrelated existing issues, record the relevant output and whether the new component is implicated.

## Completion Notes

Completed on 2026-05-13.

## Implemented

- Added `app/components/portfolio/PortfolioCsvImportPanel.jsx` as an isolated client component.
- Supports CSV type selection, conflict mode selection, CSV text input, analyze/apply/export buttons, async callback handling, busy states, and callback error display.
- Displays result counts, errors, preview rows, and generated CSV output without reading or writing storage.
- Kept integration callback-driven so static export remains compatible.

## Props Interface

- `csvText`: optional controlled CSV text.
- `onCsvTextChange(nextText)`: optional controlled text change handler.
- `initialCsvText`: uncontrolled initial CSV text.
- `initialType`: initial CSV type, default `portfolioTransactions`.
- `initialConflictMode`: initial conflict mode, default `skip`.
- `csvTypes`: optional options as strings or `{ id, label/name, description }`.
- `conflictModes`: optional options as strings or `{ id, label/name, description }`.
- `analysis`: optional externally controlled latest analysis/result.
- `onAnalyze(payload)`: receives `{ type, conflictMode, csv, analysis }`; may return analysis result.
- `onApply(payload)`: receives `{ type, conflictMode, csv, analysis }`; may return apply result.
- `onExport(payload)`: receives `{ type, conflictMode, csv, analysis }`; may return CSV string or `{ csv, counts, errors, rows/previewRows }`.
- `disabled`: disables controls.
- `maxPreviewRows`: preview row cap, default `8`.

## Verification Result

- `npm run lint` could not start because `npm` is not available in the current PowerShell PATH.
- Fallback command succeeded: `.\node_modules\.bin\eslint.cmd .`
- Exit code: `0`
- Note: PowerShell prints a profile execution-policy warning before commands, but ESLint completed successfully.

## Main Agent Wiring Notes

- Import the component where the CSV UI should appear, likely in the portfolio history/import area.
- Wire `onAnalyze` to `analyzePortfolioCsvImport({ csv, type, knownFunds, validPortfolioIds, validHoldingIds })`.
- Wire `onApply` to the storage/state merge logic using `payload.conflictMode` (`skip`, `overwrite`, `merge`) and `payload.analysis.rows`.
- Wire `onExport` to `exportPortfolioCsv({ type, rows })` and return the CSV string or `{ csv }`.
