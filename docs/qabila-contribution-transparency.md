# Qabila contribution history

Parents and teachers can open every Qabila's contribution history. A parent's children's Qabila buttons are highlighted. The popup includes all current members and their net recorded points, a learner filter, and ten activities per history page. A snapshot timestamp keeps newly arriving activity from shifting the pages; Refresh starts a fresh snapshot.

The ledger remains authoritative for rankings and displayed credit. History includes negative adjustments and zero-score live quiz participation. Live answers are grouped per learner and quiz session, daily prayers per learner and day. Bonuses appear separately. Only names and contribution information are shared; account emails, contacts and teacher feedback notes are not included.

Daily Sunnah submission and task credits are grouped per learner and tracker day before counting/pagination, including the daily submission bonus in the displayed points. For example, seven completed tasks plus the submission credit show one `Daily Sunnah tracker: 7/8 Sunnahs completed` row with 75 points. The denominator comes from the saved submission's answers, limited to the history snapshot, rather than the currently edited tracker. If those saved answers are unavailable, show the known completed count without inventing a denominator. A submitted tracker with no completed tasks still shows its submission credit. Fardh prayers similarly show one `Fardh tracker: 4/5 prayers completed` row and the total recorded prayer points for that child/day. Different children and days stay separate. Preview and full-history pages use the same grouping. Weekly certificates remain individual dated entries in newest-first order alongside the grouped trackers; all Qabila totals remain unchanged.

Admin rewards now uses the same shared history, replacing its separate grouping by ledger submission date. This prevents backfilled prayers from multiple tracker days being described as, for example, 46 prayers "for the day". Its visible activity and certificate previews are fetched from the full Qabila history, independently of the global 300-entry ledger window used by other admin metrics. Leaderboard cards and the admin contribution section show one compact dated latest-certificate row and a small View all history button opening the certificate-only paginated history. This preview shows actual ledger credits, not synthetic credits for published certificates; missing live credits still require checking publication and the deployed database audit. Mum certificate credits represent each linked assigned child's share of the 150-point family total; Mumin certificates retain the full 150-point student bonus.

Weekly certificate entries include a small family-name line below the child name in recent activity, the compact certificate preview and the full history. Mum shares use the public, non-revoked certificate recipient's name, falling back to that awarded parent's account name. Mumin awards prefer parent links explicitly marked Mother/Mum/Mom; unspecified guardian links are honestly labelled Parent/Parents. Other activity does not show these names, and parent emails/contact details are not queried or returned.

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


The owner-requested Laiba Qabila assignment is now an explicit operational repair, separate from app startup. First inspect her approved family/account records with `node scripts/assign-laiba-qabila.mjs` (read-only). To apply the assignment, use `node scripts/assign-laiba-qabila.mjs --apply`, which runs `scripts/sql/assign-laiba-girls-qabila.sql` and then prints a read-only audit. It identifies Laiba through Anum Sheikh/Shaikh and requires approved enrolment. It leaves ambiguous matches unchanged, compares canonical enrolled girls in Banu Makhzum and Banu Zuhra, chooses the smaller group (Makhzum on a tie), and preserves an existing valid girls’ assignment. It restores the exact approved parent link if missing and joins the selected Qabila room. Existing points, other learners, general rooms and past notifications remain intact. No points or messages are created.

The original `20261109160000_assign_laiba_girls_qabila` startup migration could prevent the entire web service from deploying. Its historical slot now contains only `SELECT 1`; the data operation is retained in the explicit repair tool. `npm start` and `npm run start:migrate` still apply all schema migrations. For the sole unresolved Laiba attempt, startup recognises the exact checksums of both previously shipped data-only transactional scripts (`b2cf421` and `7879823`), marks that interrupted attempt rolled back, and applies the replacement. Unrelated failures and unknown scripts still require review. Already successful assignments are preserved; deployment does not rerun or reverse them.

`test-laiba-prisma-migration.mjs` tests startup recovery against MySQL 8, verifies that startup performs no family data changes, and applies the explicit repair separately. It supports both the original collation failure and the later shipped repair’s interrupted state. Live assignment must be verified with the audit after applying it; a successful deployment alone does not confirm Laiba’s group.
