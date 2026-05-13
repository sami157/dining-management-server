# Combined Dining Assumptions and Conditions

## Dining Locations

- The system will support two dining locations.
- The fixed location IDs are:
  - `township`
  - `office`
- `township` is the conceptual main/current dining location.
- Existing single-dining behavior maps to `township`.

## Meal Availability

- A specific meal slot can be available at only one dining location at a time.
- The same `date + mealType` must not be available in both `township` and `office`.
- The backend should enforce this uniqueness rule.
- The two dining patterns are complementary and together fill every meal slot in a week.

## Township Pattern

- `township` keeps the current meal generation pattern.
- Friday and Saturday:
  - `morning` available
  - `evening` available
  - `night` available
- Sunday through Thursday:
  - `morning` unavailable
  - `evening` unavailable
  - `night` available

## Office Pattern

- `office` uses the opposite of the current township pattern.
- Friday and Saturday:
  - `morning` unavailable
  - `evening` unavailable
  - `night` unavailable
- Sunday through Thursday:
  - `morning` available
  - `evening` available
  - `night` unavailable

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
- Monthly finalization will be done separately per dining location.
- Deposits and member balances are shared across the combined dining system.

## Compatibility

- Existing behavior should remain compatible as much as possible.
- Missing dining location values should be treated as `township` by default.
