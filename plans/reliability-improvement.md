# Backend Reliability Improvement Plan

This plan tracks the MongoDB transaction and consistency improvements identified in the backend review. Implement these in order where dependencies are noted. The implementation work belongs in `dining-management-server/`; this file is the progress tracker.

## Tracking

- `[ ]` Not started
- `[x]` Complete

For an item in progress, add a short note beneath it with the branch/PR or current blocker. Mark an item complete only after its acceptance checks pass.

## Work items

### 1. Run finalization transaction operations sequentially

- [ ] **Status:** Not started
- **Scope:** In `finance.controller.js` and `accounting.utils.js`, replace `Promise.all` calls that run database operations with the active transaction session with sequential `await`s. Keep parallel reads outside transactions unchanged.
- **Why:** The Node.js MongoDB driver does not support parallel operations within one transaction.
- **Done when:** Finalization performs every session operation sequentially, still commits balances and the finalization record together, and a transaction-backed test verifies rollback when an operation fails.
- **Dependencies:** None.

### 2. Add a shared month-state guard

- [ ] **Status:** Not started
- **Scope:** Add a durable per-month state/guard record and a unique index. Month-sensitive mutations must conditionally write the guard while the month is open; finalization must close that same guard in its transaction. Define how existing months are treated during rollout, using existing finalization records as the source of truth for closed months.
- **Why:** A read that finds no finalization record does not serialize a mutation against a finalization that is happening at the same time. Wrapping each operation in a transaction without a shared write point still permits stale finalization inputs.
- **Done when:** Concurrent tests show that a mutation either commits before finalization and is included, or loses to finalization and is rejected. The guard handles date changes across two months and schedule ranges spanning multiple months.
- **Dependencies:** None. This is the foundation for items 3–7.

### 3. Make deposit changes atomic with member balances

- [ ] **Status:** Not started
- **Scope:** Put deposit add, update, and delete workflows in transactions with the month guard. Update the deposit record and its balance effect together. Use conditional write filters so concurrent edits/deletes cannot apply the same balance delta twice. Ensure the unique `memberBalances.userId` index is present.
- **Why:** The current code writes deposit history and balances separately, so a partial failure or concurrent delete can leave them out of sync.
- **Done when:** Tests cover add/update/delete success, failure between the two writes, simultaneous deletes/edits, and a finalized-month race. Deposit and balance state remain consistent in every case.
- **Dependencies:** Item 2.

### 4. Serialize expense changes with finalization

- [ ] **Status:** Not started
- **Scope:** Apply the shared month guard transactionally to expense add, update, and delete. For an update that moves an expense, guard both the old and new month.
- **Why:** Each expense write is a single-document operation, but expense data is an input to finalization and currently can change after the open-month check.
- **Done when:** Tests prove expense changes are rejected once finalization wins and are reflected in the finalization when the expense write wins first.
- **Dependencies:** Item 2.

### 5. Make meal registration workflows month-safe and keep audit logs consistent

- [ ] **Status:** Not started
- **Scope:** Apply the month guard to registration, quantity/comment edits, cancellation, and bulk registration. Where a workflow also writes a `systemLogs` entry, commit the log and registration change together. Keep the unique registration key index enabled.
- **Why:** Registration data feeds meal costs. Current open-month checks can race finalization; registration and audit writes can also succeed independently.
- **Done when:** Tests cover each mutation racing finalization, duplicate concurrent registration, bulk registration failure, and late/admin registration or cancellation log failures. No finalized-month source data changes after finalization.
- **Dependencies:** Item 2.

### 6. Make schedule and registration updates atomic

- [ ] **Status:** Not started
- **Scope:** Use transactions and the month guard for schedule generation, single update, deletion, and bulk update. Reconcile registrations in the same transaction when meal availability changes. In bulk update, validate all IDs and month states before issuing any writes; preserve the single-update registration behavior.
- **Why:** Schedule and registration writes currently span separate operations. Bulk update starts writes before checking finalized months and does not synchronize registrations when availability changes.
- **Done when:** Tests cover failure during auto-registration, removal of unavailable meals, newly available meals, a bulk request containing a finalized month, and concurrent schedule edits. Rejected bulk requests make no changes.
- **Dependencies:** Item 2.

### 7. Make finalization undo atomic and preserve later balance activity

- [ ] **Status:** Not started
- **Scope:** Restore balances and remove the finalization record in one transaction guarded by the month state. Keep the rule that later finalized months must be undone first. Change the restore logic so deposits posted after finalization are preserved, for example by reversing the finalization delta against current balances or by rebuilding balances from a ledger.
- **Why:** Undo can currently restore only some balances if a write fails, and setting an old `previousBalance` can erase deposits posted since finalization.
- **Done when:** Tests cover partial-write failure, simultaneous undo/finalize, later finalized months, and deposits posted after finalization. Undo restores the effect of that finalization without discarding later activity.
- **Dependencies:** Items 2 and 3.

### 8. Make password recovery code creation and use resilient

- [ ] **Status:** Not started
- **Scope:** Make MongoDB recovery-code invalidation, replacement, and audit logging atomic. Prevent concurrent code creation from leaving multiple active codes for one user, using an appropriate uniqueness constraint or per-user state. Review the consume-code-before-Firebase-update sequence and handle Firebase failures so a transient provider error does not silently burn the code.
- **Why:** The code lifecycle spans several MongoDB writes and an external Firebase password update. MongoDB transactions cannot include the Firebase call, so the cross-service failure behavior needs an explicit state/retry strategy.
- **Done when:** Tests cover failed MongoDB writes, simultaneous code creation/use, expired codes, and Firebase update failure without permitting code reuse or leaving users without a recovery path.
- **Dependencies:** None. This can be implemented independently of the month guard.

### 9. Document and verify transaction-capable MongoDB deployment

- [ ] **Status:** Not started
- **Scope:** Update backend setup documentation to require a replica set or sharded cluster for transaction-backed routes. Confirm development, test, and production connection targets support transactions. Make the index setup instructions clear, including the unique balance and finalization indexes.
- **Why:** Standalone MongoDB deployments do not support transactions, while current setup documentation only says a MongoDB deployment is required.
- **Done when:** README setup instructions name the requirement, and the transaction-backed test suite runs against a replica-set MongoDB test target.
- **Dependencies:** None; complete before relying on transaction-backed workflows in deployment.

## Verification expectations

- Add meaningful backend tests for transaction rollback, concurrent finalization/mutation, duplicate requests, and undo behavior as each item is implemented.
- Run `node --check` on changed backend JavaScript files and `npm test` from `dining-management-server/`. Replace or extend the current placeholder test script before treating the test gate as satisfied.
- Update `dining-management-server/reference.md` if response behavior or API contracts change.
- Review and run index changes only against the intended database; do not run migration or index scripts against production without reviewing the target first.
