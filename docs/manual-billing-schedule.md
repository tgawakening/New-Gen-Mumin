Manual monthly payment dates are configured from November 2026 dues onward in `src/lib/payments/manual-billing-schedule.ts`:

| Recipients | Due day | Reminder day |
| --- | --- | --- |
| Pakistani manual-payment students, including Yasher Muhammad | 20 | 18 |
| Anum Sheikh / Shaikh | 10 | 8 |
| Parisa (Prisa) Noor family | 10 | 8 |
| Mussab / Musab Ashfaq family | 10 | 8 |

Named exceptions take precedence over the Pakistani default. Match exact normalized parent/student names and existing verified family emails; no fuzzy/first-name-only match. Parent exceptions apply to each child's bill in that family. Country detection uses student or parent billing country (PK/PAK/Pakistan); PKR is a fallback only when no country is recorded. Unrelated foreign-currency/country accounts keep the existing policy. Dates use Asia/Karachi: reminders become eligible at 09:00 on the reminder day, and the due date is valid through 23:59:59.999 on its day. The next chosen due day on/after the existing billing-period start is used, preserving coverage dates and paid-first-period handling. For anniversary dates on/just before the due day, the upcoming renewal may be prepared up to two days early so its reminder can go on the prescribed day, without charging or rebilling the original paid month.

The billing worker and the existing admin refresh path reconcile stored due dates/metadata for pending or failed manual rows. Amounts, currencies, statuses, existing payment confirmations, paid records and automatic gateway invoices are not modified. No schema migration or new paid/unpaid balance is introduced. `metadata.manualBillingSchedule` records the rule, due date, reminder date and timezone. Admin monthly payments shows the reminder date below the due date. Reconciliation preserves existing metadata and uses an optimistic pending-status/date predicate to avoid overwriting a concurrent payment confirmation.

The reminder queue suppresses early initial/day-3 emails under these rules, cancels stale queued stages and deduplicates the scheduled reminder by record/month/rule. Existing weekly overdue follow-ups remain available only after the real due-day deadline, while the billing period is active. Delivery rechecks the active rule immediately before contacting the provider, so an already queued legacy initial reminder cannot bypass the new dates. Existing provider/configuration/quota failures remain retryable; a queued schedule is not proof of email delivery. The worker must be enabled and connected to the production database for the changes to take effect.

`node scripts/audit-manual-billing-dates.mjs` is a read-only deployed-console check showing recorded due dates and schedule metadata. It does not send messages, change records or print credentials. Production dates, exact named-profile matching and delivery remain unverified without a live database connection. Stripe/PayPal charging calendars remain controlled by their respective gateways; this request changes manual bank/NayaPay billing deadlines and reminders only.
