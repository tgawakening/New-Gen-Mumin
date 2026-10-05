# Teacher payroll emails

Publishing a paid slip atomically creates a TEACHER_PAYROLL email job in the existing BillingEmailJob table. Draft saves never notify. The publication endpoint tries delivery after returning the response; a production worker checks every five minutes and catches up all already-published slips after startup. No database migration is needed.

Emails use the existing verified EMAIL_FROM sender and RESEND_API_KEY, with TGA Finance / Gen-Mumin branding. Configure EMAIL_FROM to the verified TGA mailbox in the deployment environment; the code does not invent or override a sender address. APP_URL must be the HTTPS public portal URL. PAYROLL_EMAIL_WORKER_ENABLED=false disables the periodic worker (explicit publication still queues and attempts delivery).

The summary uses the immutable published revision: payroll month, actual payment date, sessions, actual teaching time, paid hours, each programme's precise hourly rate and amount, adjustments and final GBP payment, plus PKR equivalent when enabled. The button opens /teacher/payroll?month=YYYY-MM. Login preserves that destination and teacher ownership checks protect the slip. Receipt files remain private in the portal; emails do not expose Drive IDs or links.

Queue keys are payroll:<slip-id>:<published-revision>. Later draft versions never cause another email. Republishing creates an updated notification; superseded unsent revisions are cancelled. Provider idempotency keys, permanent successful-delivery logs and database claims suppress duplicates, including retries after a provider response. A missing provider, exhausted quota or failed request leaves the notification pending with backoff. SENT means accepted by the provider, not proof of arrival in the recipient's inbox.

Payroll uses PAYROLL_PENDING and PAYROLL_PROCESSING states so older billing workers cannot accidentally interpret a payroll job as a parent fee receipt during deployment.

To review or queue existing published slips manually, set DATABASE_URL securely and run:

```sh
node scripts/queue-published-payroll-emails.mjs
node scripts/queue-published-payroll-emails.mjs --apply
```

The default is a dry run. Repeated execution preserves queued/sent jobs. This command only queues; the deployed payroll worker performs delivery.
