# Gen-Mumin capacity and recovery

The supplied incident screenshots show one 512 MiB shared-CPU container at 100% memory and 91% CPU. This is evidence of saturation, not proof of an OOM kill; verify runtime logs and restart history.

## Current hosting and next steps
The owner reports upgrading to the $25/month 2 GB shared-CPU plan. Keep this as the baseline while deploying the application fixes and checking peak-time runtime and database metrics. Extra memory alone cannot resolve database contention, application failures or overlapping requests. Do not select another upgrade without measuring the remaining bottleneck.

Use /api/health for HTTP liveness checks. Keep inactivity sleep off. Set run command to npm start. Run migrations separately as a pre-deploy job; do not run recurring repairs in each web container. Keep extra capacity running before synchronized class joins; autoscaling takes time. Request-based scaling is also available; tune thresholds using measured latency and request volume.

## Before enabling multiple containers
- Check managed MySQL CPU, memory, slow queries and connections during class joins. The default pool is 8 connections per Node process: four containers may use 32, with additional headroom needed for workers, migrations and overlapping deployments. Upgrade the database only on evidence; do not simply increase every pool size.
- Confirm identical AUTH settings across replicas and deploy the same build artifact. Set a stable secret NEXT_SERVER_ACTIONS_ENCRYPTION_KEY at build time for consistent Server Actions across builds; it is embedded in the build output. Database sessions are already shared. Review Next.js multi-instance cache invalidation if using persistent server caches.
- Confirm uploads/recordings use durable shared storage. Avoid storing user files on a container filesystem. The current 500 MB Server Action body limit deserves a separate streaming/direct-upload change; large buffered uploads can overwhelm memory.
- Keep recording processing and other long jobs in a worker; do not multiply scheduled jobs with web replicas.

## Changes in this patch
- Teacher dashboard no longer loads unused per-class quiz and assignment graphs; question totals use database counts.
- Roster cleanup queries are scoped to the teacher being viewed.
- Dashboard loaders use React request-scoped memoization, avoiding repeated work for the same user during one render without sharing private data across requests.
- Prisma is retained on the process global in production as well as development to reuse the pool across server module bundles.
- Quiz polling waits for the actual React refresh transition to complete instead of unlocking after 1.2 seconds.
- Countdown polling skips hidden/offline tabs and adds timing jitter; subscription no longer resets on every countdown tick.

## Required production verification
Capture logs for OOM / exit 137, restarts, Prisma pool timeouts and slow requests. Use a staging database and test accounts to load-test login, student/parent dashboards, class join and live quizzes at the expected concurrent audience plus headroom. Measure p95 latency, 5xx rate, CPU, RAM and DB connections. Do not stress-test the live classroom during lessons. A public health check cannot verify authenticated capacity.

Remaining query hotspot: getTeacherProgramRosterEntries performs cleanup writes and programme-wide eligibility checks while reading a dashboard. Moving those repairs into an idempotent maintenance job requires separate data-behavior validation. No production hosting settings were changed by this patch.

Sources, checked 2026-09-12:
- https://docs.digitalocean.com/products/app-platform/details/pricing/
- https://docs.digitalocean.com/products/app-platform/how-to/scale-app/
- https://nextjs.org/docs/app/guides/self-hosting
