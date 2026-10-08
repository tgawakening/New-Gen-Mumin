# Stopping recurring classes without losing history

Teacher Live Sessions, course-builder removal, admin class removal and declined requests now end the recurrence using ClassSchedule.endsOn. They do not delete the schedule or any recording, roster, occurrence or attendance relation. Historical recording queries continue to include ended schedules.

Ended schedules are excluded from upcoming family/teacher/admin lists and cannot start or join through portal routes. Zoom meeting-start events and class-start notifications ignore ended schedules. Recording-completed events retain historical schedule matching, including recordings uploaded after a class was stopped.

The action does not delete a Zoom meeting or a stored video. It stops portal recurrence and access; previously shared raw Zoom URLs are controlled by Zoom.

## Recovery of already deleted schedules

GET /api/admin/recordings/recovery is an admin-only, no-store, read-only inventory of Gen-Mumin recording files tagged with a selected teacher user ID. It preserves Drive pagination. Optional zoomMonth=YYYY-MM returns technical recording metadata without playback/download tokens, for exact recording-file-ID matching during recovery. It does not change storage, restore intentionally hidden recordings, or send notifications.

Restore only verified original teacher/program/schedule metadata. Recovered schedules must remain ended, without a live meeting URL. Do not invent attendance or teaching hours from video duration. When exact recording time cannot be verified, retain the filename date and mark precise session time unknown.

## Verification

- npm run build
- node --test scripts/test-schedule-lifecycle.mjs
- DATABASE_URL=... node scripts/test-schedule-archive.mjs (transaction always rolls back and verifies no test schedule remains)
