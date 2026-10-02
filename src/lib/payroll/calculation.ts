export type PayrollLine = { label: string; sessions: number; paidHours: string; hourlyRate: string; actualMinutes: number };
export type PayrollInput = { lines: PayrollLine[]; showPkr: boolean; fxRate: string; fxDate: string; paidOn: string; paymentReference: string; note: string; sourceNote: string; adjustment: string; adjustmentReason: string };
export type PayrollProof = { fileId: string; name: string; mimeType: string; caption: string };
export type PayrollSnapshot = PayrollInput & { teacherName: string; month: string; totals: ReturnType<typeof calculatePayroll>; proof: PayrollProof | null };
export function scaled(value: string, places: number, signed = false): bigint {
  if (typeof value !== "string" || !(signed ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(value) || value.length > 24) throw new Error("Enter a valid amount.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  if (fraction.length > places) throw new Error("Too many decimal places.");
  const result = BigInt(whole) * BigInt("1" + "0".repeat(places)) + BigInt(fraction.padEnd(places, "0") || "0");
  return negative ? -result : result;
}
function round(value: bigint, divisor: bigint) { return value < BigInt("0") ? -((-value + divisor / BigInt("2")) / divisor) : (value + divisor / BigInt("2")) / divisor; }
export function calculatePayroll(input: Pick<PayrollInput, "lines" | "showPkr" | "fxRate" | "adjustment">) {
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 30) throw new Error("Add 1 to 30 programme rows.");
  let raw = BigInt("0"), paidHourUnits = BigInt("0"), sessions = 0, actualMinutes = 0;
  const linePence: number[] = [];
  for (const line of input.lines) {
    if (!line.label?.trim() || line.label.length > 120 || !Number.isInteger(line.sessions) || line.sessions < 0 || line.sessions > 1000 || !Number.isInteger(line.actualMinutes) || line.actualMinutes < 0 || line.actualMinutes > 100000) throw new Error("Check programme, session count and actual minutes.");
    const hours = scaled(line.paidHours, 4), rate = scaled(line.hourlyRate, 8);
    if (hours > BigInt("10000000") || rate > BigInt("100000000000")) throw new Error("Hours or rate exceeds the allowed range.");
    const amount = hours * rate;
    raw += amount; paidHourUnits += hours; sessions += line.sessions; actualMinutes += line.actualMinutes;
    linePence.push(Number(round(amount, BigInt("10000000000"))));
  }
  const adjustmentPence = scaled(input.adjustment || "0", 2, true);
  if (adjustmentPence < -BigInt("10000000") || adjustmentPence > BigInt("10000000")) throw new Error("Adjustment is outside the allowed range.");
  raw += adjustmentPence * BigInt("10000000000");
  if (raw < BigInt("0") || raw > BigInt("1000000000000000000")) throw new Error("Final payment must be between zero and GBP 1,000,000.");
  let pkr: number | null = null;
  if (input.showPkr) { const fx = scaled(input.fxRate, 6); if (fx <= BigInt("0") || fx > BigInt("10000000000")) throw new Error("Enter a valid GBP to PKR rate."); pkr = Number(round(raw * fx, BigInt("1000000000000000000"))); }
  return { totalPence: Number(round(raw, BigInt("10000000000"))), linePence, pkr, sessions, paidHours: Number(paidHourUnits) / 10000, actualMinutes, adjustmentPence: Number(adjustmentPence) };
}
export function pounds(pence: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100); }
export function minutesLabel(minutes: number) { return Math.floor(minutes / 60) + " hr " + minutes % 60 + " min"; }
export function monthLabel(month: string) { return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month + "-01T00:00:00Z")); }
export function validMonth(month: string) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(month); }
