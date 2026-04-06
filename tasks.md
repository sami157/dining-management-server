# Improvement Tasks

## High Priority

## Medium Priority

### API Design and Maintainability

- Reduce repeated collection lookups.
  - Some handlers call `getCollections()` multiple times inside one request; cache the result per handler execution where it simplifies the flow.

- Consider module boundaries.
  - Split large service files into smaller units by feature area, especially finance- and meal-related services.

### Post-Deploy Date Cleanup

- Keep legacy `date`-based indexes until the new backend is deployed everywhere.
  - The currently deployed old backend may still depend on those indexes operationally even though the frontend contract is unchanged.

- After the new backend is live, drop obsolete legacy indexes.
  - Re-evaluate `mealSchedules.date`, `mealRegistrations.date`, and `mealRegistrations(userId, date)` after confirming production traffic is on `serviceDate`-based reads.

- Later, narrow or remove the centralized compatibility fallback in `modules/shared/date.utils.ts`.
  - Only do this once legacy-field dependence is no longer needed for rollback or old deployments.

## Lower Priority

### Testing and Tooling

- Add a real automated test setup.
  - Cover auth middleware, meal registration deadlines, duplicate registration prevention, deposit updates, month finalization, and undo finalization.

- Add linting and formatting.
  - Introduce ESLint and a formatting standard so issues like dead code, mismatched role checks, and fragile imports are caught earlier.

- Add a real `test` script.
  - `dev`, `build`, `start`, and `typecheck` exist now, but `test` is still a placeholder.

## Completed

### Date and Time Handling

- Standardized the backend on a Dhaka business-date model.
  - Canonical `serviceDate` / `createdDate` / `updatedDate` / `finalizedDate` fields are in place.

- Centralized shared date helpers.
  - Shared business-date parsing, formatting, and month-range logic now lives in `modules/shared/date.utils.ts`.

- Migrated date-sensitive service queries away from legacy raw `Date` equality.
  - Schedule, meal, expense, deposit, finalization, and stats flows now use canonical date fields internally.

- Backfilled canonical date fields into existing data.
  - Existing legacy date/timestamp fields were preserved for compatibility.

### Data Integrity

- Added core canonical indexes and repaired the index script.
  - `scripts/createIndexes.js` now works with the current project structure and canonical fields.

- Added and verified the main unique constraints.
  - `users.email`
  - `mealSchedules.serviceDate`
  - `mealRegistrations(userId, serviceDate, mealType)`
  - `memberBalances.userId`
  - `monthlyFinalization.month`

### Runtime and Infrastructure

- Improved server startup resilience.
  - `index.ts` now handles Mongo startup failure explicitly instead of failing silently.

- Kept the Mongo client handle intentionally.
  - `config/connectMongodb.ts` now preserves and reuses the shared client handle for sessions and transactions.
