# Shared class links

Teachers use **Copy student join link** on Live Sessions, Schedule, Classes, or their dashboard. Share this portal URL in groups instead of a raw Zoom URL. Existing Zoom links cannot be converted retroactively.

The link opens /join/[scheduleId]. Families sign in if necessary, choose their own rostered child, and press Join class once the teacher has started Zoom. Login returns them to the same class. A reusable schedule link waits for the next live occurrence after a class ends.

Only an authenticated POST from the same site records attendance. Link previews, page loads, and login do not. The server rechecks family ownership, roster and active enrollment, and checks the current Zoom occurrence before saving. Attendance and five points are saved transactionally before redirecting to Zoom. A failed save returns a retry page.

Portal attendance uses source portal-join. It records Present without claiming a Zoom connection or inventing minutes. Actual Zoom reports can subsequently supply connected time. Existing Zoom data is preserved; repeated joins and Seerah/Life Skills daily alternatives use the existing shared points ledger to avoid duplicate awards.

No database migration or automatic historical attendance change is required. Validate after deployment with a teacher's live class and a rostered family account: copy link, open while signed out, log in, choose child, join, then check attendance and points. Repeating the join must not add another five points. Non-rostered accounts must not receive the meeting URL.
