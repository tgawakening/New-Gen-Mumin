# Monthly parent feedback

Parents: open **Feedback** in the parent portal, select a child and feedback month, then complete the three steps. The current Pakistan-calendar month is the default; earlier months can be selected. Required fields follow the starred questions in the supplied form. Unstarred Arabic word-count, self-introduction, routine, duration and teacher-style feedback remain optional, as does child-chat consent. Relevant conditional details become required only when shown. Community-event availability asks for preferred days, times and time zone when a family selects Yes or Maybe. Hidden Arabic questions are not required for nonparticipants.

Names, age, country and time zone are prefilled and editable for the response only. Changing the displayed child name cannot change the child record receiving the feedback. Programme and Qabila snapshots come from the database. Sibling/month drafts remain in page memory while switching; they are not saved across reloads. Submitted responses can be reviewed from monthly history. Older weekly records remain in their original table.

## Staff

Admin, active Communications Lead accounts, and the designated active teacher accounts for Sir Mehran and Sister Saba can open `/feedback/monthly`, linked from their Feedback pages. The account email allowlist uses the existing faculty directory, not name fragments. Other teachers and parents cannot view or export these responses.

Select a month, search by family/programme/Qabila, and review either question summaries or individual responses. Counts and percentages use the families who answered each question. Multiple-choice totals can exceed 100%. CSV downloads include every response for the selected month, with one submission per row and question columns; screen search does not restrict the download. CSV formula-like text is escaped.

## Persistence and delivery

`MonthlyParentFeedback` is separate from legacy weekly feedback. The unique `(studentId, month)` database index handles duplicate clicks, retries and submissions from two parent accounts linked to the same child. The submit transaction verifies ownership and creates the response, portal notifications and email outbox jobs together. Names and answers are validated server-side. No profile, attendance or points records are changed.

Email jobs use `MONTHLY_FEEDBACK` and `FEEDBACK_PENDING` / `FEEDBACK_PROCESSING`, isolated from the billing worker. Post-response delivery plus the production instrumentation worker retries provider failures or quota deferrals. The shared configured TGA sender and permanent versioned `feedback:` delivery key prevent duplicate successful sends. Email includes family/month/programme details and a login-preserving portal link; sensitive free-text answers stay in the portal. Recipient activity and access are rechecked on delivery. Existing mail limits still apply. `FEEDBACK_EMAIL_WORKER_ENABLED=false` disables background polling.

## Deployment and checks

Apply `20261006120000_monthly_feedback` before deploying. `node scripts/apply-monthly-feedback-migration.mjs` is read-only preflight; add `--apply` for the additive table and migration record. It refuses unrecorded partial table creation. Supply `DATABASE_URL` through the environment, never in a committed file.

Tests: `node --test scripts/test-monthly-feedback.mjs scripts/test-payroll-email.mjs scripts/test-family-usability.mjs`. Also run lint and a production build.

No test submissions or test notification emails should be sent to production families or staff. After deployment, a real parent submission should appear once in the staff month view, with outbox jobs eventually `SENT`; provider failures remain queued rather than making the parent's saved response fail.

## Communications portal and parent changes

`/communications` is the dedicated home for the COMMUNICATIONS role. It provides family feedback summaries, month-specific review and exports without granting ADMIN or TEACHER privileges. Maliha's account is provisioned with `scripts/provision-maliha-communications.mjs --apply` only after the new portal is live; it refuses to overwrite an existing account with another role. Credentials are generated with cryptographic randomness and written only to an explicitly provided private TEMP file, never to the repository or console.

The original submitting parent can edit or delete their response while still linked to that child. Another linked parent can review it, but cannot change the original submission. PATCH/DELETE verify session, active parent role, ownership, child linkage and expected revision. A concurrent edit returns a conflict rather than overwriting newer answers. Updates retain the child/month, update detail snapshots and answers, and notify reviewers with a fresh revision key.

Deletion physically removes the response, cascades linked portal notifications and deletes feedback outbox jobs; it frees the child/month uniqueness slot for a new submission. Current report queries and future exports exclude deleted responses. Messages already delivered or exports already downloaded cannot be recalled. A send already in flight may still finish.

Apply `20261006150000_communications_feedback_edits` using `scripts/apply-communications-feedback-migration.mjs --apply` before deploying the new version. The migration adds the role, response version/update time and cascading notification relation. Older notifications are linked conservatively when editing/deleting a legacy response.

## Communications test form
Maliha can open Communications > Monthly feedback to complete the same three-step parent form with sample family details. Submissions live in MonthlyFeedbackDemo, unique per staff account/month, and are explicitly labelled dummy. She can edit or delete them. They are excluded from real family counts, reports, CSVs, notifications and emails. Access is restricted to active COMMUNICATIONS accounts; mutation requests require the portal origin and current revision.

## Portal loading
Dashboard roster reads preload schedule metadata and share eligibility candidates once per request, preserving programme eligibility and canonical student mapping. Teacher dashboard reads no longer trigger registration or roster repairs. Parent and teacher optional community overviews stream separately. There is no cross-family or persistent cache of private dashboard data.
