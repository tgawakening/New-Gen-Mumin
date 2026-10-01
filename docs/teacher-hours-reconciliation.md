# Teacher hours reconciliation

Hours logs now include completed zoom-webhook occurrences alongside teacher-start, teacher-member-start and zoom-recording evidence. Opening a teacher/admin period (including exports) reconciles that period automatically, so September and other historical months are recoverable without a database migration.

For stored recordings with valid start/end timestamps longer than 15 minutes, missing occurrence evidence is recovered using a deterministic recording ID. Existing conflicting teacher attribution is not reassigned. Recordings without reliable timestamps, future recording ends, deleted recordings, and sessions of 15 minutes or less are not inferred as payable classes.

Deduplication uses overlapping intervals for the same schedule. Separate morning/evening sessions and distinct schedules remain separate; reconnect gaps are not added to teaching time. Submitted, manually edited/reassigned, and explicitly excluded rows are preserved. Entries with null notes remain visible.

This repairs evidence-backed logs; it does not fabricate classes from the weekly timetable. Ambiguous historical teacher assignments still require admin review. Verify September on Admin > Hours Log after deployment, then compare the recovered rows against the teacher recording list. This patch has not independently audited production totals.
