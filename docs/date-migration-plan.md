# Backend Date Migration Plan

## Goal

Migrate the backend to a Dhaka-based business-date model without breaking the existing frontend during rollout.

Business timezone:
- `Asia/Dhaka`

Primary principles:
- Business dates are calendar dates, not timestamps.
- Exact timestamps are kept only where exact instants matter.
- Backend stays backward-compatible until the frontend is updated.
- Existing database records are preserved; migration is additive first.

## Target Date Model

### Business-date fields

Use `YYYY-MM-DD` string fields for business-day semantics.

Examples:
- `serviceDate`
- `createdDate`
- `updatedDate`
- `finalizedDate`

### Month fields

Use `YYYY-MM` string fields for month-based summaries and filtering.

Examples:
- `month`

### Exact timestamp fields

Keep exact timestamps only where the actual moment matters.

Examples:
- `mealRegistrations.registeredAt`
- `monthlyFinalization.finalizedAt`

Store exact timestamps as real instants and interpret/display them in `Asia/Dhaka` when needed.

## Collection-by-Collection Target

### `mealSchedules`

Current:
- `date` is used as a day marker

Target:
- add `serviceDate: YYYY-MM-DD`
- keep legacy `date` during transition

Usage after migration:
- lookup and uniqueness by `serviceDate`
- legacy `date` only for compatibility

### `mealRegistrations`

Current:
- `date` = meal day
- `registeredAt` = actual registration moment

Target:
- add `serviceDate: YYYY-MM-DD`
- keep `registeredAt`
- keep legacy `date` during transition

Usage after migration:
- joins and duplicate checks by `(userId, serviceDate, mealType)`
- deadline checks by `registeredAt` vs backend-computed Dhaka deadline

### `expenses`

Current:
- `date` = expense business date
- `createdAt`, `updatedAt` currently stored as timestamps

Target:
- add `serviceDate: YYYY-MM-DD`
- add `createdDate: YYYY-MM-DD`
- add `updatedDate: YYYY-MM-DD`
- keep legacy `date`, `createdAt`, `updatedAt` during transition

Usage after migration:
- reporting/filtering by `serviceDate`
- UI date display by `createdDate` and `updatedDate`

### `deposits`

Current:
- `month` is already canonical
- `depositDate` and `createdAt` are timestamp-like but business-day semantics are sufficient

Target:
- keep `month`
- add `serviceDate: YYYY-MM-DD` for deposit day
- add `createdDate: YYYY-MM-DD`
- keep legacy `depositDate` and `createdAt` during transition

Usage after migration:
- accounting month logic remains based on `month`
- business-day display/reporting uses `serviceDate`

### `monthlyFinalization`

Current:
- `month` is already canonical
- `finalizedAt` is an exact timestamp

Target:
- keep `month`
- keep `finalizedAt`
- add `finalizedDate: YYYY-MM-DD`

Usage after migration:
- exact audit moment remains in `finalizedAt`
- business-day display/filtering can use `finalizedDate`

## Compatibility Strategy

## Phase 1. Add Shared Date Utilities

Before touching data access logic, add shared backend helpers for:
- parsing `YYYY-MM-DD`
- formatting Dhaka business dates
- month boundary calculation in `Asia/Dhaka`
- converting old timestamps to Dhaka date strings
- comparing deadlines in Dhaka time

Do not change API behavior yet.

## Phase 2. Add Canonical Fields on New Writes

Update write paths so new records populate canonical date fields while still writing legacy fields.

Examples:
- new schedules write both `date` and `serviceDate`
- new registrations write both `date` and `serviceDate`
- new expenses write `date`, `serviceDate`, `createdDate`, `updatedDate`
- new deposits write `month`, legacy fields, `serviceDate`, `createdDate`
- new finalizations write `month`, `finalizedAt`, `finalizedDate`

Backward compatibility:
- existing frontend keeps working because legacy fields still exist

## Phase 3. Add Dual-Read Logic

Update backend reads to prefer canonical fields but fall back to legacy fields when canonical fields are absent.

Rules:
- use `serviceDate` if present
- otherwise derive the business day from legacy fields
- keep response shape unchanged at first

Examples:
- schedule queries can find by `serviceDate`, else fall back to legacy `date`
- registration totals can join by `serviceDate`, else fall back to legacy `date`
- expense filtering can prefer `serviceDate`, else use legacy `date`

Backward compatibility:
- existing frontend still works
- old records continue to work before backfill

## Phase 4. Backfill Existing Records

Run additive migration scripts that only add canonical fields.

No destructive rewriting in this phase.

Backfill rules:
- `mealSchedules.date` -> `serviceDate`
- `mealRegistrations.date` -> `serviceDate`
- `expenses.date` -> `serviceDate`
- `expenses.createdAt` -> `createdDate` using Dhaka conversion
- `expenses.updatedAt` -> `updatedDate` using Dhaka conversion
- `deposits.depositDate` -> `serviceDate` using Dhaka conversion
- `deposits.createdAt` -> `createdDate` using Dhaka conversion
- `monthlyFinalization.finalizedAt` -> `finalizedDate` using Dhaka conversion

Verification after backfill:
- record counts unchanged
- random samples across month boundaries verified manually
- reporting endpoints produce same or intentionally improved business results

## Phase 5. Add Indexes on Canonical Fields

After backfill is complete, add indexes for the new model.

Recommended indexes:
- `mealSchedules.serviceDate` unique
- `mealRegistrations { userId, serviceDate, mealType }` unique
- `expenses.serviceDate`
- `deposits.month`
- `deposits.serviceDate`
- `monthlyFinalization.month` unique

Do not add unique indexes before verifying backfill quality.

## Phase 6. Expose Canonical Fields to Frontend

Start returning canonical fields in API responses while keeping legacy fields for compatibility.

Examples:
- schedules return both `date` and `serviceDate`
- registrations return both `date` and `serviceDate`
- expenses return `serviceDate`, `createdDate`, `updatedDate` plus legacy timestamps if still needed
- deposits return `serviceDate`, `createdDate`, `month`
- finalizations return `finalizedAt`, `finalizedDate`

At this point the frontend can be updated safely.

## Phase 7. Update Frontend

After the backend is already compatible:
- switch frontend business-date inputs to `YYYY-MM-DD`
- use canonical response fields where available
- stop relying on browser-local date interpretation
- keep backend as source of truth for deadline enforcement

## Phase 8. Remove Legacy Dependence

Only after the frontend rollout is stable:
- remove read fallbacks where appropriate
- stop using exact legacy `Date` equality in business logic
- optionally remove legacy fields from writes
- consider eventual cleanup of legacy fields from old records

This is the only phase where compatibility can be reduced.

## API Compatibility Rules During Migration

To avoid breaking the current frontend:
- do not immediately rename required request parameters
- do not remove existing response fields
- accept legacy inputs temporarily where necessary
- add new canonical fields in responses before making them required in the frontend

Safe migration behavior:
- old frontend continues to work
- new frontend can adopt canonical fields progressively

## Backend Implementation Order

### Step 1
- create shared Dhaka date helper module

### Step 2
- update `mealSchedules` and `mealRegistrations`
- these are the most important business-date collections

### Step 3
- update `expenses` and `deposits`

### Step 4
- update stats and finance aggregation logic to use canonical fields

### Step 5
- backfill old records

### Step 6
- add indexes

### Step 7
- expose canonical fields in responses and update frontend

## Main Risks

### Risk 1
- Month-boundary or midnight-adjacent legacy timestamps map to a different Dhaka business day than a naive UTC interpretation.

Mitigation:
- always derive new business-date fields in `Asia/Dhaka`

### Risk 2
- Old and new query logic diverge during transition.

Mitigation:
- use one shared compatibility helper for business-date resolution

### Risk 3
- Frontend breaks because a field was removed too early.

Mitigation:
- additive response changes first, removal later

## Success Criteria

Migration is considered complete when:
- all business-day logic uses canonical date fields
- deadline checks are backend-enforced in `Asia/Dhaka`
- frontend sends `YYYY-MM-DD` and `YYYY-MM`
- old and new records behave identically in reports and lookups
- legacy `Date` equality is no longer required for business-day records
