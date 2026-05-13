# Two Dining Locations With Per-Location Meal Defaults

## Summary

Add a fixed `diningId` discriminator to support two dining locations: `township` for the current/main dining and `office` for the new dining. Keep users/admins shared. Keep one common meal schedule per date, with each meal item carrying the dining location where that meal is served. Separate registrations, expenses, meal-rate calculations, and monthly finalizations by dining. Keep deposits and member balances shared. Add `mealDefaultOffice` to users so auto-registration can happen independently for office dining, while existing `mealDefault` continues to mean township dining.

## Key Changes

- Add shared constants/helpers:
  - Valid `diningId`: `township`, `office`.
  - Default `diningId`: `township`.
  - Missing `diningId` defaults to `township` for compatibility, except `GET /users/meals/available`, which returns both locations by default.
- Add `diningId` to:
  - each `availableMeals[]` item inside `mealSchedules`
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

- `POST /managers/schedules/generate` creates one common schedule per date.
- Generated meal ownership:
  - Friday/Saturday: all meals served at `township`
  - Sunday-Thursday: `morning` and `evening` served at `office`, `night` served at `township`
- Auto-registration during schedule generation is meal-by-meal:
  - `township` meals: users with `mealDefault: true`
  - `office` meals: users with `mealDefaultOffice: true`
- `GET /managers/schedules` accepts optional `diningId` to find schedules containing available meals for that dining.
- Schedule uniqueness remains `date`.

### Meal availability and registration

- `GET /users/meals/available` returns both dining locations by default and includes `diningId`.
- It may accept `diningId=township|office` for filtered views.
- `POST /users/meals/register` accepts optional `diningId`; omitted defaults to `township`.
- Duplicate registration checks use `userId + date + mealType + diningId`.
- Registration responses include `diningId`.

### Conflict rule

- A meal item has exactly one `diningId`.
- This enforces that a meal can only be available at one location at a time inside the common date schedule.

### Finance

- `expenses` are tagged with `diningId`.
- `deposits` and `memberBalances` remain shared.
- `POST /finance/finalize` accepts optional `diningId`, default `township`.
- Finalization uniqueness becomes `month + diningId`.
- Finalization reads, lists, undo, my-finalization, and running meal-rate support `diningId`.
- Each dining finalization deducts that dining's meal cost from shared balances.

## Data and Indexes

- Treat existing meal schedule items and registrations as `diningId: "township"` where missing.
- Backfill users with `mealDefaultOffice: false`.
- Add indexes:
  - `mealSchedules`: `{ date: 1, "availableMeals.diningId": 1 }`
  - `mealRegistrations`: `{ userId: 1, date: 1, diningId: 1 }`
  - `mealRegistrations`: `{ date: 1, diningId: 1 }`
  - `expenses`: `{ date: 1, diningId: 1 }`
  - `monthlyFinalization`: `{ month: 1, diningId: 1 }`
- Update `scripts/createIndexes.js`.
- Add or update a backfill script to set missing meal item/registration/expense/finalization `diningId` values to `township`, and missing `mealDefaultOffice` to `false`.

## Test Plan

- Old calls without `diningId` still operate on `township`.
- `GET /users/meals/available` returns schedule meals with per-meal `diningId`.
- Schedule generation creates one schedule per date.
- Township-owned generated meals auto-register only `mealDefault: true` users.
- Office-owned generated meals auto-register only `mealDefaultOffice: true` users.
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
