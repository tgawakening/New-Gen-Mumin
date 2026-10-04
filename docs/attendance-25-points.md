# Attendance: 25 points per requirement

Attendance now awards 25 points to the learner. The same ledger entry contributes to their Qabila total; there is no second 25-point credit. Joining at any time qualifies. Seerah and Life Skills alternatives count once per Pakistan calendar day; other linked classes count per schedule/day.

Portal joins, Zoom reconciliation, parent confirmations and administrator recovery use the same policy. Awards are serialized on the learner row. A previous five-point award receives only its missing 20 points. Existing 25-point awards are unchanged. Unknown-date missed-class estimates subtract 25 per missed class.

## Historical correction

With DATABASE_URL set securely, run:

```sh
node scripts/backfill-attendance-points.mjs --audit attendance-preview.json
node scripts/backfill-attendance-points.mjs --apply --audit attendance-applied.json
node scripts/backfill-attendance-points.mjs --audit attendance-verification.json
```

Default mode is read-only. The apply command rereads evidence under each learner lock, then atomically appends auditable ledger adjustments for that learner. It does not send notifications, alter attendance, change Qabila membership, delete old points, or reduce historical awards above 25. Repeated execution produces no extra credits. Audit files contain record identifiers and should be kept privately, outside version control.

Confirmed presence and positive net attendance awards qualify. Reversed parent confirmations and absences do not. Parent-derived top-ups retain the ATTENDANCE_PARENT prefix so future attendance corrections can reverse the full credit. Estimated missed-class deductions are updated in the same learner transaction.

Deleted schedules: a single unambiguous legacy award may identify the record. Otherwise unlinked records with no competing linked attendance/award are conservatively grouped once per programme/day. Records that may overlap another same-day award are reported as unresolved and left untouched; their class identity must be established before extra points are added. An unresolved report with estimated missed classes blocks that learner's update.

No database schema migration is needed. The verification dry run should report zero pending credits for the same evidence.
