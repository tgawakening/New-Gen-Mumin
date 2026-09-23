# Parent attendance recovery

Parents can open **Attendance > Confirm past attendance**, choose their child, and submit Present/Absent for completed class dates from **1 September 2026 (Asia/Karachi)**. Dates come from recorded completed occurrences or the child's historical attendance records, not an extrapolated weekly timetable. Missing historical session dates must be recorded by staff before they can be confirmed.

- Parent ownership is checked on read and again inside the write transaction.
- Verified Zoom/teacher attendance is protected. Parent confirmation does not invent join/leave timestamps or minutes.
- Same-day Seerah / Life Skills alternatives share a requirement and one attendance reward.
- Unmatched Zoom records display **Needs confirmation** and do not reduce the percentage. Existing Zoom ABSENT rows are interpreted this way without rewriting historical evidence. Confirmed absences remain absent.
- Newly confirmed attendance earns **5 points**. Existing legacy attendance awards prevent additional points. New verified Zoom attendance also earns 5 points, regardless of arrival time.
- Attendance writes, point adjustments, and append-only `AttendanceConfirmationAudit` rows are transactional. Parent and Zoom writers lock the same StudentProfile row. Repeated requests cannot award twice. Parent corrections reverse only the parent-confirmation balance.
- Audits retain actor ID, class/date, previous/new status, point delta, and timestamp. Recent audit entries appear in the parent's attendance page; point ledger entries appear in points history.
- Direct Zoom joins use a unique email/name match. Shared parent emails require disambiguation by child name. A generic Zoom name is not guessed from a recent portal click.
- Participant reports are requested after a meeting ends and again when recording completion arrives, using the meeting UUID when supplied. If Zoom has no usable identity or the report is not yet available, the parent can confirm the session.

## Rollout

1. Generate Prisma client: `npm run prisma:generate` (also runs on install).
2. Apply the new migration to the deployment database before serving the new app: `npm run prisma:migrate:deploy`.
3. Deploy the application. The existing `start:migrate` script can apply migrations before Next starts.
4. Confirm Zoom's participant joined/left and meeting ended webhooks are enabled, and the app has permission to read past-meeting participants.
5. Verify one parent/child in production: pending date -> Present (+5), refresh/resubmit (no duplicate), Absent (-5), then Present (+5). Confirm a different parent cannot change the child and a verified Zoom record is locked.

The development checkout has no database credentials. Production migration, real database concurrency, webhook scopes, and live parent records require deployment verification. No live records were modified during implementation.

## Regression checks

`node --test scripts/test-parent-attendance.mjs scripts/test-attendance-policy.mjs scripts/test-attendance-zoom.mjs scripts/test-attendance-recovery-ui.mjs scripts/test-dashboard-rosters.mjs scripts/test-points-history.mjs`

`npm run typecheck`

Transaction tests use a serialized in-memory adapter and rollback snapshots; they do not substitute for running the migration and concurrency checks against MySQL.
