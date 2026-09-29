import "server-only";
import { createBillingCycleRecords, queueManualReminders } from "@/lib/payments/billing-cycle";
import { deliverBillingEmails } from "@/lib/payments/billing-mail";
let running = false;
export async function processBillingNotifications() {
  if (running) return { busy: true };
  running = true;
  try {
    const created = await createBillingCycleRecords();
    const queued = await queueManualReminders();
    const delivered = await deliverBillingEmails();
    return { ...created, ...queued, ...delivered };
  } finally { running = false; }
}
export function startBillingWorker() {
  const state = globalThis as typeof globalThis & { genmBillingTimer?: ReturnType<typeof setTimeout> };
  if (state.genmBillingTimer) return;
  const tick = async () => {
    try { await processBillingNotifications(); }
    catch (error) { console.error("Billing notification worker failed", error instanceof Error ? error.message : "unknown error"); }
    state.genmBillingTimer = setTimeout(tick, 5 * 60000);
    state.genmBillingTimer.unref();
  };
  state.genmBillingTimer = setTimeout(tick, 30000);
  state.genmBillingTimer.unref();
}
