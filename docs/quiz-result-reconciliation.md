The reported Life Skills screenshot shows a confirmed historical credit mismatch: the saved quiz score is 40, while the ledger contribution is 4. Current live-answer writes already use the full earned score, but previously saved credits were never automatically reconciled by that code change.

The data migration `20261031160000_reconcile_saved_quiz_scores` repairs old live-answer credits only where the ledger still agrees with the answer's saved old credit, inserts missing positive credits for learners with an existing House membership, and synchronizes answer-credit metadata. It restores missing ordinary-quiz credits from finalized positive auto-scores when there is no conflicting manual score. Existing ordinary credits, perfect-score bonuses, unrelated activity, negative/invalid score records and manually conflicting live credits are preserved. New rows retain their original activity dates. The repair is transactional and idempotent. It does not create marks from attendance, assign missing Qabila memberships or award points for repeat practice.

Contribution history now includes scored ordinary quiz attempts, including zero-score submissions with no ledger row, alongside live-response results. Existing ordinary ledger entries are folded into their result rather than counted twice. Learners who actually joined an ended live session without saved answers are shown as **joined, but no answers recorded** with no invented quiz score. Unjoined roster seats and ongoing sessions do not produce such results. New ordinary submissions snapshot the quiz question count, as live responses already do, so later question edits do not change the recorded denominator.

A bare parent live-quiz link previously let the server choose an arbitrary eligible child seat when no child ID was supplied. Such links now open a learner selector, and the parent quiz API requires an explicit child ID for state, joining and answering. Existing child-specific invitation links continue working. This prevents ambiguous future attribution; historical marks are never reassigned between siblings without evidence.

To verify Mustafa and other learners against production records after deployment, run this read-only command in the DigitalOcean App Platform console:

```sh
node scripts/audit-quiz-results.mjs --quiz "first aid"
```

For a narrower name search (all matches are returned, rather than guessing which Mustafa):

```sh
node scripts/audit-quiz-results.mjs --name Mustafa --quiz "first aid"
```

The audit reports matched student IDs/names, Qabila membership, joined seats, saved live responses and scores, recorded credits, manual credit conflicts, ordinary attempts and separate practice attempts. It never writes data, outputs passwords, includes answer contents or sends emails. Limits are printed in the output. If no saved answers exist for a learner, the result needs teacher review; a script must not fabricate a score. Local tests exercise the actual history query and repair statements with a SQLite fixture, adapting only database syntax. Actual production repair and Mustafa's individual result require verification in the live environment.
