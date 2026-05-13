# Two Dining Locations With Per-Location Meal Defaults

## Summary

Add a fixed `diningId` discriminator to support two dining locations: `township` for the current/main dining and `office` for the new dining. Keep users/admins shared. Separate schedules, registrations, expenses, meal-rate calculations, and monthly finalizations by dining. Keep deposits and member balances shared. Add `mealDefaultOffice` to users so auto-registration can happen independently for office dining, while existing `mealDefault` continues to mean township dining.

## Key Changes

- Add shared constants/helpers:
  - Valid `diningId`: `township`, `office`.
  - Default `diningId`: `township`.
  - Missing `diningId` defaults to `township` for compatibility, except `GET /users/meals/available`, which returns both locations by default.
- Add `diningId` to:
  - `mealSchedules`
  - `mealRegistrations`
  - `expenses`
  - `monthlyFinalization`
  - meal-related `systemLogs`
- Keep shared/global:
  - `users`
  - `deposits`
  - `memberBalances`
  - auth/password recovery
- Add `mealDefaultOffice: boolean` to users:
  - Existing `mealDefault` remains township default.
  - `mealDefaultOffice` controls office auto-registration.
  - Existing users should default to `mealDefaultOffice: false`.

## API Behavior

### User defaults

- Keep `PATCH /users/meal-default` for township `mealDefault`.
- Extend the existing endpoint with optional `diningId`.
- Request body: `{ "mealDefault": true, "diningId": "office" }` updates `mealDefaultOffice`; omitted `diningId` updates township `mealDefault`.
- User profile/list responses include `mealDefaultOffice`.

### Schedule management

- `POST /managers/schedules/generate` accepts optional `diningId`, default `township`.
- Auto-registration during schedule generation uses:
  - township: users with `mealDefault: true`
  - office: users with `mealDefaultOffice: true`
- `GET /managers/schedules` accepts optional `diningId`; omitted returns both locations.
- Schedule uniqueness is `date + diningId`.

### Meal availability and registration

- `GET /users/meals/available` returns both dining locations by default and includes `diningId`.
- It may accept `diningId=township|office` for filtered views.
- `POST /users/meals/register` accepts optional `diningId`; omitted defaults to `township`.
- Duplicate registration checks use `userId + date + mealType + diningId`.
- Registration responses include `diningId`.

### Conflict rule

- Reject schedule creation/update if the same `date + mealType` is available in both `township` and `office`.
- This enforces that a meal can only be available at one location at a time.

### Finance

- `expenses` are tagged with `diningId`.
- `deposits` and `memberBalances` remain shared.
- `POST /finance/finalize` accepts optional `diningId`, default `township`.
- Finalization uniqueness becomes `month + diningId`.
- Finalization reads, lists, undo, my-finalization, and running meal-rate support `diningId`.
- Each dining finalization deducts that dining's meal cost from shared balances.

## Data and Indexes

- Treat existing records as `diningId: "township"`.
- Backfill users with `mealDefaultOffice: false`.
- Add indexes:
  - `mealSchedules`: `{ date: 1, diningId: 1 }`
  - `mealRegistrations`: `{ userId: 1, date: 1, diningId: 1 }`
  - `mealRegistrations`: `{ date: 1, diningId: 1 }`
  - `expenses`: `{ date: 1, diningId: 1 }`
  - `monthlyFinalization`: `{ month: 1, diningId: 1 }`
- Update `scripts/createIndexes.js`.
- Add or update a backfill script to set missing `diningId` on existing schedule/registration/expense/finalization records to `township`, and missing `mealDefaultOffice` to `false`.

## Test Plan

- Old calls without `diningId` still operate on `township`.
- `GET /users/meals/available` returns both `township` and `office` schedules with `diningId`.
- Township schedule generation auto-registers only `mealDefault: true` users.
- Office schedule generation auto-registers only `mealDefaultOffice: true` users.
- Enabling the same meal/date in both dining locations is rejected.
- Register/cancel/update meal operations respect `diningId`.
- Expenses and running meal-rate are isolated by `diningId`.
- Finalizing `township` and `office` for the same month creates two separate records and each deducts from shared balances.
- User profile/list responses include `mealDefaultOffice`.

## Assumptions

- `township` is the current dining and compatibility default.
- `office` is the second dining.
- Admin roles remain global.
- Deposits and member balances remain shared.
- The preferred minimal API is extending `PATCH /users/meal-default` with optional `diningId`, instead of adding a new endpoint.
