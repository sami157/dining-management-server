# Improvement Tasks

## Security and Access Control

- Align route protection with controller rules.
  - Review routes like `PUT /users/role/:userId` so the route-level allowed roles and the controller-level role logic do not drift apart.

## Auth Middleware

- Improve auth failure responses.
  - Distinguish between missing token, invalid token, valid token with no app user, and role mismatch.

- Avoid repeated user lookups when possible.
  - Consider storing minimal auth claims on `req.auth` and the Mongo user on `req.user` with consistent shape.

## Date and Time Handling

- Standardize date storage and querying.
  - Stop relying on exact JavaScript `Date` equality across handlers; store and query a canonical service date format such as `YYYY-MM-DD`.

- Normalize timezone behavior.
  - Pick one rule for meal/schedule dates and apply it everywhere: schedule generation, registration, cancellation, totals, and finance calculations.

- Add date validation at the API boundary.
  - Reject invalid or ambiguous date inputs early instead of letting mixed parsing rules leak into business logic.

## Financial Consistency

- Clarify balance semantics in code.
  - Document that deposits update `memberBalances` immediately and monthly finalization consumes the current balance snapshot rather than re-applying deposits.

- Make balance writes transactional.
  - Use MongoDB transactions for deposit add/update/delete and month finalization so partial failures do not leave `memberBalances` out of sync.

- Recheck fallback balance lookups.
  - Fix places where `_id` is queried with a string instead of `ObjectId`, especially `getMyBalance`.

## Data Integrity

- Add database indexes for core invariants.
  - Add unique index on `users.email`.
  - Add unique index on `mealSchedules.date` or the canonical service date field.
  - Add unique compound index on `mealRegistrations(userId, date, mealType)` or its canonical equivalent.
  - Add supporting indexes for common finance and reporting queries.

- Fix the index creation script.
  - `scripts/createIndexes.js` currently imports collection handles that are not exported by the Mongo config module.

- Enforce schema validation.
  - Add request validation for payloads such as roles, numeric amounts, meal counts, date formats, and IDs.

## Business Logic Cleanup

- Unify role logic around `admin` and `super_admin`.
  - Some controller paths treat them differently in ways that look accidental, especially around meal registration updates.

- Remove dead or suspicious code.
  - Clean up the stray `true` token in `modules/managers/managers.route.js`.

- Review reporting-only fields.
  - Fields like `totalUserDeposits` in finalization should be explicitly marked as reporting values if they are not part of balance math.

## Runtime and Infrastructure

- Improve server startup resilience.
  - Add explicit error handling around Mongo connection startup instead of only chaining `.then()` in `index.js`.

- Keep the Mongo client handle intentionally.
  - Avoid shadowing the top-level `client` variable so graceful shutdown and future connection lifecycle management are possible.

- Add structured logging.
  - Replace ad hoc `console.error` calls with consistent request-aware logging.

## Testing and Tooling

- Add basic project scripts.
  - At minimum: `dev`, `start`, `lint`, and real `test` scripts in `package.json`.

- Add automated tests for critical flows.
  - Cover auth middleware, meal registration deadlines, duplicate registration prevention, deposit updates, month finalization, and undo finalization.

- Add linting and formatting.
  - Introduce ESLint and a formatting standard so issues like dead code, mismatched role checks, and fragile imports are caught earlier.

## API Design and Maintainability

- Return more consistent API errors.
  - Standardize error shapes and status codes across controllers.

- Reduce repeated collection lookups.
  - Some handlers call `getCollections()` multiple times inside one request; cache the result per handler execution.

- Consider module boundaries.
  - Split large controller files into smaller units by feature area, especially the finance controller.
