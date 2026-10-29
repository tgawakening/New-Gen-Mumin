# Qabila contribution history

Parents and teachers can open every Qabila's contribution history. A parent's children's Qabila buttons are highlighted. The popup includes all current members and their net recorded points, a learner filter, and ten activities per history page. A snapshot timestamp keeps newly arriving activity from shifting the pages; Refresh starts a fresh snapshot.

The ledger remains authoritative for rankings and displayed credit. History includes negative adjustments and zero-score live quiz participation. Live answers are grouped per learner and quiz session, daily prayers per learner and day. Bonuses appear separately. Only names and contribution information are shared; account emails, contacts and teacher feedback notes are not included.

New live quiz credits equal saved earned answer points instead of one point per correct answer. Response insertion and credit remain in the same transaction and retries do not award twice. Both live-answer writers follow the same rule. New responses save the original question count so future quiz edits do not change their displayed denominator. Older responses without that snapshot identify the displayed denominator as based on the current quiz.

## Correct historical one-point credits

After deploying the new scoring code, run in the application's configured environment:

```sh
node scripts/reconcile-live-quiz-credits.mjs
```

This only reports counts and the net adjustment; it does not print student names or database credentials. Review the report, then apply the requested actual-score conversion:

```sh
node scripts/reconcile-live-quiz-credits.mjs --apply
```

The repair runs atomically, refuses unexplained manual credit differences or missing required memberships, fixes answer credits from saved earned scores, and verifies the result before committing. Re-running does not add duplicate credit. Existing bonuses, attendance, trackers and other sources are preserved. It does not invent quiz scores or recover missing question-count snapshots. Until repair, the history shows saved quiz scores alongside any different recorded Qabila credit.

Status: prepared locally; historical production repair and deployment have not been performed.
