# Recording downloads and private quiz practice

Admin > Recordings offers Download video (original file) and Download MP3 (mono 64 kbps speech audio). Both endpoints require an ADMIN session and exclude deleted/unprepared recordings. Video supports byte ranges. MP3 converts through a local, random-path range proxy: OAuth credentials never reach the browser or FFmpeg command line. One conversion per application process, one codec thread, cancellation propagation and a 15-minute timeout limit resource usage. No temporary public recordings are created. The UI shows preparation/download feedback and cancellation.

FFmpeg is installed by the pinned ffmpeg-static package during deployment. Next treats it as an external server package and includes its platform binary. Audio export requires a regular Node runtime with child-process and loopback-network support. A file without an audio track returns an explanatory error. Large MP3s take time to prepare/download; keep the page open. No ZIP/bulk export or automatic transcription is added.

Parent/Student > Quizzes > Practice playground lists published quizzes that have ended live sessions for that learner's roster. An actively running copy of the quiz is excluded from the practice library. Historic sessions without roster snapshots fall back to their teacher's current programme roster. Only automatically marked questions with answer keys are offered.

Practice uses its own QuizPracticeAttempt table. It never writes assessed QuizAttempt records, notifications, or HousePointLedger entries. The personal total sums each quiz's best completed practice score, so repeating a quiz does not inflate Qabila points. Each attempt snapshots its questions and keys, but the API exposes keys only for answered questions. Results persist across devices and include correct, incorrect and timed-out answers. Parent ownership is checked on every request. Database row locks and question IDs make repeated start/answer/next requests idempotent. Each question's timer starts on the server; refreshing does not reset it.

Migration: 20261015120000_add_private_quiz_practice. Apply before deploying routes that use the new table.

Checks: test-quiz-practice.cjs; test-recording-download.cjs; test-recording-audio.cjs (uses a generated two-second video, no student recordings); TypeScript; focused ESLint; production build.
