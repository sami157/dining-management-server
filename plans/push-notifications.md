# Scheduled Push Notifications Plan

This document tracks implementation of a daily, personalized push notification with each user's registration summary for the next day. Work spans `dining-management-server/` and its sibling frontend repository, `dining-management/`.

## Tracking

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete
- `[!]` Blocked

Add a short progress or blocker note below a stage when work begins. Mark a stage complete only after its acceptance checks pass. Implement stages in order unless a dependency is explicitly independent.

## Agreed behavior and operating assumptions

- Send the summary at about **10:00 PM Asia/Dhaka** for the next Dhaka calendar day. The notification is a post-deadline status summary, not a registration reminder.
- Notify every **active user account** with at least one opted-in device, across roles. Include a clear “No meals registered for tomorrow” message for opted-in users without registrations.
- Include registered meal types, quantities, and the schedule menu. Respect per-device opt-in; request browser permission only after the user explicitly chooses to enable notifications.
- Support desktop, Android, and iPhone/iPad. iPhone/iPad web push requires a supported iOS/iPadOS version and the app installed to the Home Screen.
- Use Firebase Cloud Messaging (FCM) and the current Firebase Installation ID (FID) target API. Upgrade the Firebase Web/Admin SDKs and server runtime as needed; the FID-capable Admin SDK requires Node.js 22.
- Use a once-daily Vercel Cron at `0 16 * * *` UTC. On Vercel Hobby this can run any time from 10:00 to 10:59 PM Dhaka time. Vercel does not automatically retry a failed cron invocation, so persist progress and make reruns resume safely.
- No new paid push provider is planned. FCM is no-cost; Vercel Cron is included on all plans. Hobby is limited to personal, non-commercial use and its function usage limits apply. Confirm the existing MongoDB and hosting plans separately before rollout.

## Stages

### 1. Confirm runtime and provider compatibility

- [ ] **Status:** Not started
- **Scope:** Confirm the deployed Vercel Node runtime can run Node.js 22. Upgrade the server `firebase-admin` dependency to a FID-capable release and the frontend Firebase Web SDK to one that supports the current FID registration flow. Record the required Node version in the server README and deployment notes. Confirm the existing Firebase project and service account can send web push.
- **Done when:** A staging smoke test registers a test browser installation and sends a test FCM notification to it using the FID API; the deployed function runs on the supported Node version; setup docs describe the requirement.
- **Dependencies:** None.

### 2. Add browser/PWA setup and per-device opt-in

- [ ] **Status:** Not started
- **Scope:** In `dining-management/`, add the web app manifest, notification icons, Firebase messaging service worker, and foreground/background notification handling. Add an account profile control with a device-level enable/disable flow. Ask for Notification permission only in direct response to the user's enable action; show supported, denied, and unsupported states. Register or revoke the browser installation with the authenticated backend. Document the Home Screen installation requirement for iPhone/iPad.
- **Done when:** A user can enable and disable notifications independently on two devices; permission is never requested on page load; notifications work in foreground and background on supported desktop/Android browsers and an installed supported iOS/iPadOS PWA.
- **Dependencies:** Stage 1.

### 3. Store and secure device registrations

- [ ] **Status:** Not started
- **Scope:** Add a dedicated MongoDB collection for push devices and authenticated device registration/revocation endpoints. Derive the owner from `req.user`; never accept a user ID from the client as the owner. Validate FIDs and metadata, make repeated registration idempotent, prevent a device from being attached to multiple users, and add the required unique index. Remove or deactivate a device on explicit opt-out and when FCM reports it is no longer registered.
- **Done when:** Endpoint tests cover authentication, ownership, invalid payloads, duplicate upserts, opt-out, inactive users, and two users attempting to claim one device. Index setup is safe to rerun and reviewed for the intended database before production use.
- **Dependencies:** Stage 1.

### 4. Build the next-day registration summary

- [ ] **Status:** Not started
- **Scope:** Add a testable server utility that computes tomorrow using `Asia/Dhaka`, reads that date's schedules and registrations, and builds a personalized message containing meal type, quantity, and menu. Include the explicit empty-registration message. Do not include another user's registration data. Handle missing schedules or menus without failing the entire daily job; log the data issue without logging FIDs or sensitive payloads.
- **Done when:** Unit tests cover Dhaka date boundaries, month/year rollover, no registrations, multiple meals, quantities, menu formatting, and missing schedule data. The target date is consistent regardless of the Vercel function's UTC execution time.
- **Dependencies:** None.

### 5. Schedule and make delivery resumable

- [ ] **Status:** Not started
- **Scope:** Add the once-daily UTC Cron and a secret-protected handler using a dedicated `CRON_SECRET`. Create a durable daily run keyed by the target Dhaka date and durable per-device delivery results. Process work in bounded chunks, checkpoint each result, briefly retry transient FCM failures with a strict attempt limit, and remove invalid installations. A rerun for the same target date must resume unfinished work and skip devices already accepted by FCM. Record permanent failures for inspection. Keep the handler within the deployed Vercel function duration and resource limits.
- **Done when:** Integration tests prove one run per target date, safe reruns, partial-batch recovery, bounded transient retries, permanent-error handling, and no replay of confirmed successes. The cron secret is required and never appears in logs. An operator can safely invoke the same protected handler to resume an incomplete run.
- **Dependencies:** Stages 2–4.
- **Reliability note:** FCM acceptance confirms provider handoff, not device receipt. A timeout with an unknown provider outcome can still result in a duplicate if retried; document this boundary and never claim exactly-once delivery.

### 6. Document, deploy, and observe

- [ ] **Status:** Not started
- **Scope:** Update `reference.md` for device registration/revocation endpoints and `README.md` for Node 22, FCM configuration, cron setup, `CRON_SECRET`, database indexes, and the resume procedure. Deploy first to staging with test devices, then enable production scheduling. Add structured logs/counters for target date, recipients/devices, accepted sends, retries, invalid devices, and incomplete runs; exclude FIDs and personal message contents.
- **Done when:** Staging confirms the scheduled trigger, correct Dhaka target date, and expected notification contents; production configuration and indexes are verified; an operator can identify and resume a partial run from logs/run state; the first production runs are reviewed for failures.
- **Dependencies:** Stages 1–5.

## Verification checklist

- Run `node --check` on changed server JavaScript files and `npm test` from `dining-management-server/`.
- Run the frontend lint and production build from `dining-management/`.
- Exercise opt-in, opt-out, permission denied, unsupported browsers, foreground/background delivery, and iOS installed-PWA behavior.
- Test FCM partial failures, invalid FIDs, database outage, function timeout/restart, and a manual rerun of the same target date.
- Update `reference.md` whenever the backend API contract changes. Do not run new index or migration scripts against production until their target and effects have been reviewed.

## Cost and schedule references

- [Firebase pricing](https://firebase.google.com/pricing) lists Cloud Messaging as no-cost.
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) says cron is available on all plans; function usage limits still apply. Hobby cron has daily frequency and per-hour timing precision.
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) limits use to personal, non-commercial projects. Recheck plan eligibility and current limits before deployment.
