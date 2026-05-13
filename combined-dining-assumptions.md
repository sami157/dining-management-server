# Combined Dining Assumptions and Conditions

## Dining Locations

- The system will support two dining locations.
- The fixed location IDs are:
  - `township`
  - `office`
- `township` is the conceptual main/current dining location.
- Existing single-dining behavior maps to `township`.

## Meal Availability

- The meal schedule is common for a date.
- Each meal item inside the schedule has its own dining location.
- A specific meal slot belongs to only one dining location at a time.
- The same `date + mealType` must not be represented as available in both `township` and `office`.
- The two dining patterns are complementary and together fill every meal slot in a week.

## Township Pattern

- `township` keeps the current meal generation pattern for the meals it owns.
- Friday and Saturday:
  - `morning` served at `township`
  - `evening` served at `township`
  - `night` served at `township`
- Sunday through Thursday:
  - `night` served at `township`

## Office Pattern

- `office` uses the opposite of the current township pattern.
- Friday and Saturday:
  - no meals served at `office`
- Sunday through Thursday:
  - `morning` served at `office`
  - `evening` served at `office`

## Registration

- The frontend registration process must distinguish between the two dining locations.
- Meal registrations should be tied to a dining location.
- A registration belongs to one of:
  - `township`
  - `office`

## Meal Defaults

- Existing `mealDefault` applies to `township`.
- A new user field, `mealDefaultOffice`, should apply to `office`.
- Office auto-registration should use `mealDefaultOffice` similarly to how township auto-registration uses `mealDefault`.

## Finance

- Financial calculations will be handled separately per dining location from the frontend.
- The same admins will handle finance for both locations.
- Monthly finalization will be done once per month, across both dining locations.
- Monthly finalization should calculate per-dining meal totals, expenses, meal rates, and member meal costs as metadata.
- Each member's balance should be charged by summing that member's township and office meal costs.
- Deposits and member balances are shared across the combined dining system.

## Compatibility

- Existing behavior should remain compatible as much as possible.
- Missing dining location values should be treated as `township` by default.
