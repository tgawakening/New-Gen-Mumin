# Live quiz reliability (October 2026)

Teachers use **Start live** to open an invited-roster lobby. Wait for the joined count before opening question 1. Learners see a sticky invitation on their parent/student portal and join automatically when opening it. Questions, saved answers, participation and team points update through small JSON requests instead of full dashboard refreshes.

- Discovery polls about every 3 seconds; quiz rooms about every 2 seconds, after the previous request finishes. Hidden/offline tabs pause and reconnect on return. Failed requests back off.
- The invitation is hidden inside a quiz. After joining, it remains available on the home dashboard while the quiz is active but is suppressed on other pages for that browser tab.
- The roster is resolved once when the lobby is created. Every learner request checks the seat, account ownership and current programme enrolment. Answer keys are never sent to learners.
- Answers carry the question ID and exact round timestamp. Server receipt time determines timeliness; database processing time does not consume the answer window. An atomic insert checks the current round again at write time.
- Answer and permanent point writes share a transaction. Duplicate requests reuse the saved answer. Correct answers retain the existing +1 point rule; the perfect-quiz +10 bonus remains once per quiz/student.
- **Reopen timer** gives unanswered learners another window without erasing saved answers. **Finish quiz** finalizes results. The last question no longer silently ends the whole quiz. A teacher connection can recover within 15 minutes rather than being treated as ended after 45 seconds.

Deployment requires `20261007120000_live_quiz_seats`. `scripts/apply-live-quiz-migration.mjs --apply` applies just the additive table/index and records its checksum.

Validation:
- `node --test scripts/test-live-quiz-runtime.mjs scripts/test-dashboard-live-quizzes.mjs`
- `node scripts/test-live-quiz-mysql.mjs`: requires DATABASE_URL; all fixture writes are inside a transaction deliberately rolled back. Parallel first-write races are covered by the unit fixture; MySQL validation covers actual SQL, duplicate retries, ownership, timers and points/bonus transactions.
- `node scripts/test-live-quiz-browser.cjs`: local production server on 3097, Chrome and Playwright required (PLAYWRIGHT_MODULE can point to a temporary installation). Quiz API responses are mocked; temporary authentication sessions are deleted afterward. No real quiz invitations or points are created.

These checks validate the code paths and interaction behavior; they do not establish a production concurrency capacity or guarantee availability under all hosting/network conditions.
