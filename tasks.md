# Improvement Tasks

### Post-Deploy Date Cleanup

- Keep legacy `date`-based indexes until the new backend is deployed everywhere.
  - The currently deployed old backend may still depend on those indexes operationally even though the frontend contract is unchanged.

- After the new backend is live, drop obsolete legacy indexes.
  - Re-evaluate `mealSchedules.date`, `mealRegistrations.date`, and `mealRegistrations(userId, date)` after confirming production traffic is on `serviceDate`-based reads.

- Later, narrow or remove the centralized compatibility fallback in `modules/shared/date.utils.ts`.
  - Only do this once legacy-field dependence is no longer needed for rollback or old deployments.

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
