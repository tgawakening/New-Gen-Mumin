/** Owner-approved manual-payment dates, effective for November 2026 dues onward. */
type UserName = { firstName?: string | null; lastName?: string | null; email?: string | null };
export type ManualBillingIdentity = {
  childName?: string; currency?: string;
  student?: { displayName?: string | null; countryCode?: string | null; countryName?: string | null; user?: UserName };
  parent?: { billingCountryCode?: string | null; billingCountryName?: string | null; user?: UserName };
};
const normalize = (value?: string | null) => (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const fullName = (user?: UserName) => normalize(`${user?.firstName || ""} ${user?.lastName || ""}`);
export function manualBillingRule(input: ManualBillingIdentity) {
  const parent = input.parent?.user, email = parent?.email?.trim().toLowerCase();
  const names = [normalize(input.childName), normalize(input.student?.displayName), fullName(input.student?.user), fullName(parent)];
  if (["parisa.noor041082@gmail.com", "sumraashfaq2@gmail.com"].includes(email || "") || names.some(name => [
    "anumsheikh", "anumshaikh", "parisanoor", "prisanoor", "mussabashfaq", "musabashfaq", "mohammadmussabashfaq", "mohammadmusabashfaq",
  ].includes(name))) return { key: "named-due10-remind8", dueDay: 10, reminderDay: 8 };
  const yasher = names.slice(0, 3).some(name => ["yashermuhammad", "yashermohammad", "yashermuhammadshahbaz", "yashurmuhammad", "yashurmuhammadshahbaz"].includes(name))
    || email === "shahbazanwer25@gmail.com" && names.slice(0, 3).some(name => ["yasher", "yashur", "yasherparent"].includes(name));
  if (yasher) return { key: "yasher-due20-remind18", dueDay: 20, reminderDay: 18 };
  const countries = [input.student?.countryCode, input.student?.countryName, input.parent?.billingCountryCode, input.parent?.billingCountryName].map(normalize).filter(Boolean);
  if (countries.some(country => ["pk", "pak", "pakistan"].includes(country)) || !countries.length && input.currency?.toUpperCase() === "PKR")
    return { key: "pakistan-due20-remind18", dueDay: 20, reminderDay: 18 };
  return null;
}
export function manualBillingDates(input: ManualBillingIdentity, periodStart: Date) {
  const rule = manualBillingRule(input);
  if (!rule) return null;
  const local = new Date(periodStart.getTime() + 5 * 3600000);
  const year = local.getUTCFullYear(), month = local.getUTCMonth() + (local.getUTCDate() > rule.dueDay ? 1 : 0);
  // Due through the end of the specified PKT day; reminders are eligible at 09:00 PKT.
  const dueDate = new Date(Date.UTC(year, month, rule.dueDay, 18, 59, 59, 999));
  const reminderDate = new Date(Date.UTC(year, month, rule.reminderDay, 4));
  if (new Date(dueDate.getTime() + 5 * 3600000).toISOString().slice(0, 7) < "2026-11") return null;
  return { ...rule, dueDate, reminderDate };
}
export function scheduledManualStage(schedule: NonNullable<ReturnType<typeof manualBillingDates>>, now: Date) {
  if (now < schedule.reminderDate) return null;
  const month = new Date(schedule.dueDate.getTime() + 5 * 3600000).toISOString().slice(0, 7);
  return now <= schedule.dueDate ? `${month}:${schedule.key}:reminder` : `${month}:${schedule.key}:overdue${Math.floor((now.getTime() - schedule.dueDate.getTime() - 1) / (7 * 86400000))}`;
}
export function manualScheduleMetadata(schedule: NonNullable<ReturnType<typeof manualBillingDates>>) {
  return { version: "2026-11", rule: schedule.key, dueDay: schedule.dueDay, reminderDay: schedule.reminderDay,
    dueDate: schedule.dueDate.toISOString(), reminderAt: schedule.reminderDate.toISOString(), timezone: "Asia/Karachi" };
}
