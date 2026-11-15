# Paycontrol

Payment operations and reconciliation frontend for fictional Northstar Commerce and Meridian Pay, by Striped Wall. English UI with deterministic November 1–14, 2026 demo records. No backend or real payment connection.

## Development

Use Node 22.12+ (or Node 20.19+). Install with `npm ci`, then `npm run dev`. For a container or remote preview use `npm run dev -- --host 0.0.0.0 --port 5173`.

Checks: `npm run lint`, `npm run test -- --run`, `npm run build`.

## Behavior

- Choose an active Operator or Admin without a password. Roles are client-side demo controls, not secure authentication. Admin manages employees; self-disable and removing the last active Admin are rejected in the mutation API.
- IndexedDB stores a versioned snapshot. Initial seeding is atomic and only happens for an empty database. Each mutation and its audit event commit together. Revision checks reject concurrent stale writes with a reload prompt; there is no in-memory persistence fallback. Browser storage removal clears the demo.
- Transactions are immutable attempts, with separate retry IDs. Refunds do not reduce original gross amounts. Money uses integer minor units; USD and EUR are never converted or added together. Timestamps and inclusive date filters use UTC.
- Reconciliation uses fixed accounting batches and exact canonical IDs. Missing sides, duplicates, amount, currency, mapped status and absolute event-time differences over 24 hours need review. Every duplicate source row remains visible. Stable result IDs and input fingerprints preserve investigation decisions across reruns.
- Resolved investigations never change source financial facts or comparison categories. Reviewed discrepancies remain open. Reconciliation reporting periods select accounting dates rather than run dates.
- Transactions support search, combined filters, stable sort, pagination and safe CSV export. Save filters explicitly; opening transaction details also saves the list view for returning. Reports share selectors with Overview and provide text alternatives to charts.
- CSV has UTF-8 BOM, quotes all cells and neutralizes leading formula characters. Exports are logged only after persistence commits.

## Structure and verification

`src/domain` contains types, deterministic fixtures, pure selectors, reconciliation and guarded mutations. `src/storage.ts` is the single IndexedDB boundary. Pages consume shared application state; financial facts never change in page components.

Vitest covers matching boundaries, every discrepancy category, duplicate ambiguity, review preservation, reporting semantics, search/range validation, formula-safe CSV, role guards, rollback, reload and concurrent revision conflicts using fake IndexedDB.

Manual browser acceptance is required for the committed UI. Responsive and keyboard checks are not a full screen-reader or WCAG certification audit. Demo data only contains masked test payment methods; no PAN or CVV is stored.

For development acceptance only, append `?testStorageFailure=1` to simulate an unavailable IndexedDB before any storage access. Retry continues to show the error until the parameter is removed. This branch is compiled out of production builds and does not clear or alter stored data.
