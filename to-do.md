# Combined Dining To-Do

## Database Housekeeping

- Run `scripts/backfillDiningMetadata.js` to tag old expenses missing `diningId` as `township`.
- Run `scripts/createIndexes.js` to create the new dining-aware indexes.

## API Verification

- Generate schedules for a small future date range.
- Verify a Sunday schedule:
  - `morning` -> `office`
  - `evening` -> `office`
  - `night` -> `township`
- Verify a Friday/Saturday schedule:
  - all meals -> `township`
- Toggle `mealDefaultOffice` through `PATCH /users/meal-default`.
- Register, update, and cancel an `office` meal.
- Add both `township` and `office` expenses.
- Check `GET /stats/meal-rate` for both dining locations.

## Finalization Safety

- Do not casually run finalization against production data.
- Add a finalization dry-run mode, or test finalization against a throwaway month/data set.
- Verify finalization stores:
  - `diningBreakdown`
  - member `diningDetails`
  - `cashAtHand`

## Frontend Contract

- Update frontend schedule/registration UI to read `availableMeals[].diningId`.
- Display dining location during meal registration.
- Include `diningId` when registering for a meal.
- Display or edit `mealDefaultOffice`.
- Include `diningId` when creating or editing expenses.
- Display finalization `diningBreakdown`.
- Display member `diningDetails`.
- Display finalization `cashAtHand`.
