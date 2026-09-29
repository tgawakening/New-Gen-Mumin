export const DAY = 86400000;
export function recurringPeriod(anchor: Date, now: Date) {
  const at = (offset: number) => {
    const year = now.getUTCFullYear(), month = now.getUTCMonth() + offset;
    const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
    return new Date(Date.UTC(year, month, day));
  };
  const offset = at(0) > now ? -1 : 0;
  const start = at(offset), end = at(offset + 1);
  return { start, end, key: start.toISOString().slice(0, 7), due: new Date(start.getTime() + 5 * DAY) };
}
export function reminderStage(start: Date, now: Date) {
  const days = Math.floor((now.getTime() - start.getTime()) / DAY);
  if (days < 0) return null;
  if (days < 3) return "initial";
  if (days < 5) return "day3";
  return "overdue" + Math.floor((days - 5) / 7);
}
export function allocateAmount(total: number, weights: number[]) {
  const cents = Math.round(total * 100), weight = weights.reduce((a, b) => a + b, 0);
  let used = 0;
  return weights.map((value, i) => {
    const share = i === weights.length - 1 ? cents - used : Math.floor(cents * (weight > 0 ? value / weight : 1 / weights.length));
    used += share; return share / 100;
  });
}
export function stripeSubscriptionId(invoice: unknown): string | null {
  const value = invoice as { subscription?: string | { id?: string }; parent?: { subscription_details?: { subscription?: string | { id?: string } } } };
  const sub = value.parent?.subscription_details?.subscription ?? value.subscription;
  return typeof sub === "string" ? sub : sub?.id ?? null;
}
export function trustedReceiptUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && ["invoice.stripe.com", "pay.stripe.com", "receipt.stripe.com", "www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname) ? value : null; } catch { return null; }
}
