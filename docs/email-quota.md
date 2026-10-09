# Global Gen-M email cap

All Gen-M email templates share a maximum of 60 accepted or reserved emails in a rolling 24-hour window. There are no 75/95-email exceptions for login, payments or class notifications.

The EmailLog singleton genm-email-quota-control-v1 (QUOTA_CONTROL, not a message) serializes reservations using a short ReadCommitted transaction. A SENDING record commits before the Resend call. This protects the cap across concurrent workers, process restarts and replicas. The external request is outside the database transaction.

SENT records count from sentAt, falling back to createdAt for legacy records. SENDING and UNKNOWN reservations keep their slots until their outcome is reconciled. Transport timeouts and provider 5xx responses are uncertain and must not release capacity automatically. After verifying the provider outcome, an operator may mark an uncertain entry SENT with its acceptance time or FAILED if non-acceptance is confirmed. Never blindly remove an uncertain reservation.

Known provider rejection releases capacity. Quota-check failure prevents sending. SKIPPED and QUOTA_CONTROL rows do not consume capacity. Already-delivered billing/payroll/feedback retries remain deduplicated.

At the cap, new attempts return skipped. Existing billing/payroll/feedback queues retry; ordinary notifications retain their existing skipped behavior and are not automatically replayed. This limit covers this Gen-M sender, not separate applications or messages sent directly from the Resend dashboard.

Verification: node --test scripts/test-email-quota.mjs scripts/test-payroll-email.mjs scripts/test-monthly-feedback.mjs. Tests use fake providers; no messages are sent.
