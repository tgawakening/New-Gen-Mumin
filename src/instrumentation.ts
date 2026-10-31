export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && (process.env.APP_DATABASE_URL || process.env.GEN_MUMIN_DATABASE_URL || process.env.DATABASE_URL) && process.env.HOMEWORK_NOTIFICATION_WORKER_ENABLED !== "false") {
    const { startHomeworkNotificationWorker } = await import("@/lib/homework/notifications");
    startHomeworkNotificationWorker();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.DATABASE_URL && process.env.FEEDBACK_EMAIL_WORKER_ENABLED !== "false") {
    const { startFeedbackEmailWorker } = await import("@/lib/feedback/email-worker");
    startFeedbackEmailWorker();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.DATABASE_URL && process.env.BILLING_EMAIL_WORKER_ENABLED !== "false") {
    const { startBillingWorker } = await import("@/lib/payments/billing-worker");
    startBillingWorker();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.DATABASE_URL && process.env.PAYROLL_EMAIL_WORKER_ENABLED !== "false") {
    const { startPayrollEmailWorker } = await import("@/lib/payroll/email-worker");
    startPayrollEmailWorker();
  }
}
