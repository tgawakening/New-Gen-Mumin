# Monthly payment notifications

Automatic receipts are queued by verified Stripe or PayPal payment webhooks. A durable BillingEmailJob key uses the actual invoice/transaction reference; repeated notifications reuse the job. Completed email logs and provider idempotency keys protect retries. A payment provider success is required before a job is marked sent. Failed sends and quota/configuration skips remain queued.

Stripe supports both legacy invoice.subscription and current invoice.parent.subscription_details.subscription. Receipts include the hosted invoice URL when available, confirmed amount/currency, payment date, order reference, programme, learner, and card/Link details when the gateway provides them. No full card number is stored. Zero-value invoices do not send deduction emails. The first subscription receipt does not double-count the checkout payment in the monthly ledger. Charity subscriptions continue through the separate TGA ledger.

Manual obligations use the latest succeeded order for each current learner/programme selection. A full bundle is one fee, not one fee per subject. Free selections, inactive learners, superseded orders and automatic gateways do not receive manual transfer reminders. The first payment covers the initial month. Subsequent anniversaries use the actual calendar day, with a five-day payment window. Notices occur at renewal, day 3, the deadline, then weekly while the current period remains pending. There is no automatic account suspension in this change.

The reminder uses getManualPaymentDetails() (the same configured bank/JazzCash details used at registration), and WhatsApp 03181602388 for proof. Admin > Monthly payments > Confirm selected payments received updates status and cancels queued reminders. Admin can also see sent/queued totals and the latest delivery problem.

On the always-running DigitalOcean Node service, src/instrumentation.ts starts a lightweight job every five minutes, beginning 30 seconds after startup. It does not wait on page visits. BILLING_EMAIL_WORKER_ENABLED=false disables the in-process worker. The existing CRON_SECRET-protected /api/subscriptions/process-monthly endpoint can run the same work from an external scheduler. Durable email claims prevent two worker instances sending the same queued job concurrently. Routine workers do not change gateway charges or amounts.

Required existing runtime settings: DATABASE_URL, APP_URL, RESEND_API_KEY, EMAIL_FROM; gateway credentials and Stripe webhook secret for their existing integrations. PAYPAL_WEBHOOK_ID can be set explicitly; otherwise the matching webhook ID is discovered from the PayPal app's registered webhooks before verifying signatures. Configure successful-payment events for Stripe invoice.payment_succeeded and PayPal PAYMENT.SALE.COMPLETED.

Apply migration 20260929100000_billing_email_delivery before deploying. No historical receipt blast is performed by migration. Existing completed orders provide the source for current monthly obligations. Validate with node --test scripts/test-billing-notifications.mjs scripts/test-charity-policy.mjs and npm run build.

References: https://docs.stripe.com/api/invoices ; https://developer.paypal.com/api/rest/webhooks/rest/ ; https://resend.com/docs/dashboard/emails/idempotency-keys ; https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
