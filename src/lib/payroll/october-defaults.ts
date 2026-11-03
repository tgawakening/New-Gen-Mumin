import "server-only";
import type { PayrollInput, PayrollLine } from "./calculation";
import { STANDARD_RATES, emptyPayroll, SEPTEMBER_TEMPLATES, SEPTEMBER_SOURCE } from "./september-defaults";

export const OCTOBER_SOURCE = "https://docs.google.com/spreadsheets/d/1Km-j_E7sKGxlYlAqiZMZ92IOEYYFM5kdgcmpreeCNAs/edit?gid=1542663915";
export const MALIHA_PAYROLL_EMAIL = "emancheman413@gmail.com";
type PayrollTemplate = { key: string; name: string; aliases: string[]; emails: string[]; lines: PayrollLine[]; adjustment?: string; adjustmentReason?: string };
const line = (label: string, sessions: number, actualMinutes: number, hourlyRate = STANDARD_RATES.arabic): PayrollLine => ({ label, sessions, paidHours: String(sessions), hourlyRate, actualMinutes });
const identity = (key: string) => {
  const template = SEPTEMBER_TEMPLATES.find(template => template.key === key)!;
  return { key, name: template.name, aliases: template.aliases, emails: template.emails };
};
export const OCTOBER_TEMPLATES: PayrollTemplate[] = [
  { ...identity("abdulbadee"), aliases: [...identity("abdulbadee").aliases, "abdul badea", "abdel badea", "abdul badee"], lines: [line("Advanced Arabic / Tajweed", 25, 1769)] },
  { ...identity("abubakar"), lines: [line("Arabic / Tajweed", 11, 704)] },
  { ...identity("afira"), lines: [line("Arabic / Tajweed", 12, 748)] },
  { ...identity("javeria"), lines: [line("Life Skills", 11, 623)] },
  { ...identity("mehran"), lines: [line("Seerah & Parental sessions", 12, 1299, "6.63")] },
  { key: "maliha", name: "Sister Maliha", aliases: ["maliha", "maliha tga"], emails: [MALIHA_PAYROLL_EMAIL],
    lines: [line("Communications support (fixed monthly payment)", 0, 0, "0")], adjustment: "50.00", adjustmentReason: "October communications support payment" },
];
export function payrollReference(month: string) {
  if (month === "2026-10") return { label: "October 2026", source: OCTOBER_SOURCE, templates: OCTOBER_TEMPLATES };
  if (month === "2026-09") return { label: "September 2026", source: SEPTEMBER_SOURCE, templates: SEPTEMBER_TEMPLATES as PayrollTemplate[] };
  return null;
}
export function monthlyPayrollTemplate(month: string, user: { firstName: string; lastName: string | null; email: string }) {
  const name = `${user.firstName} ${user.lastName || ""}`.trim().toLowerCase().replace(/^(ustadh|ustadha|sir|mam|sister|br)\s+/i, "").replace(/\s+/g, " ");
  return payrollReference(month)?.templates.find(template => template.emails.includes(user.email.toLowerCase()) || template.aliases.includes(name));
}
export function referencePayroll(month: string, template: PayrollTemplate): PayrollInput {
  const input = emptyPayroll(template.lines.map(line => ({ ...line })), month === "2026-09");
  return month === "2026-10" ? { ...input, showPkr: false, fxRate: "375.116", fxDate: "2026-09-14", adjustment: template.adjustment || "0", adjustmentReason: template.adjustmentReason || "",
    sourceNote: template.key === "maliha" ? "October 2026: GBP 50 fixed payment requested by admin" : "October 2026 payroll reference: one completed session equals one paid hour" } : input;
}
