# Monthly parent feedback

Parents: open **Feedback** in the parent portal, select a child and feedback month, then complete the three steps. The current Pakistan-calendar month is the default; earlier months can be selected. Required questions are limited to participation, Seerah experience, community connection and contact/child-chat consent. Written reflections are optional except a convenient time when a child chat is requested.

Names, age, country and time zone are prefilled and editable for the response only. Changing the displayed child name cannot change the child record receiving the feedback. Programme and Qabila snapshots come from the database. Sibling/month drafts remain in page memory while switching; they are not saved across reloads. Submitted responses can be reviewed from monthly history. Older weekly records remain in their original table.

## Staff

Admin and the designated active teacher accounts for Sir Mehran and Sister Saba can open `/feedback/monthly`, linked from their Feedback pages. The account email allowlist uses the existing faculty directory, not name fragments. Other teachers and parents cannot view or export these responses.

Select a month, search by family/programme/Qabila, and review either question summaries or individual responses. Counts and percentages use the families who answered each question. Multiple-choice totals can exceed 100%. CSV downloads include every response for the selected month, with one submission per row and question columns; screen search does not restrict the download. CSV formula-like text is escaped.

## Persistence and delivery

`MonthlyParentFeedback` is separate from legacy weekly feedback. The unique `(studentId, month)` database index handles duplicate clicks, retries and submissions from two parent accounts linked to the same child. The submit transaction verifies ownership and creates the response, portal notifications and email outbox jobs together. Names and answers are validated server-side. No profile, attendance or points records are changed.

Email jobs use `MONTHLY_FEEDBACK` and `FEEDBACK_PENDING` / `FEEDBACK_PROCESSING`, isolated from the billing worker. Post-response delivery plus the production instrumentation worker retries provider failures or quota deferrals. The shared configured TGA sender and permanent `feedback:` delivery key prevent duplicate successful sends. Email includes family/month/programme details and a login-preserving portal link; sensitive free-text answers stay in the portal. Recipient activity and access are rechecked on delivery. Existing mail limits still apply. `FEEDBACK_EMAIL_WORKER_ENABLED=false` disables background polling.

## Deployment and checks

Apply `20261006120000_monthly_feedback` before deploying. `node scripts/apply-monthly-feedback-migration.mjs` is read-only preflight; add `--apply` for the additive table and migration record. It refuses unrecorded partial table creation. Supply `DATABASE_URL` through the environment, never in a committed file.

Tests: `node --test scripts/test-monthly-feedback.mjs scripts/test-payroll-email.mjs scripts/test-family-usability.mjs`. Also run lint and a production build.

No test submissions or test notification emails should be sent to production families or staff. After deployment, a real parent submission should appear once in the staff month view, with outbox jobs eventually `SENT`; provider failures remain queued rather than making the parent's saved response fail.
